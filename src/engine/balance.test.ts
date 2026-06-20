// Balance harness: greedy-play simulation over the REAL engine.
// Asserts the core loop closes (book 1 is publishable on a sane timeline) and that
// the first several books stay beatable. Run the verbose pacing report with:
//   BALANCE_REPORT=1 npx vitest run src/engine/balance.test.ts
import { describe, it, expect } from 'vitest';
import { GameState, initialState } from './state';
import {
  effectiveInspirationRate, effectivePartyDps, effectiveBossRegen,
  effectiveLevelCost, effectiveRecruitCost, effectivePartyCap,
} from './modifiers';
import { CLASSES, ClassId, MAX_STAR, ZONE_COUNT } from './content';
import { step } from './loop';
import { publish } from './progression';
import { levelUp, recruit, starUp, canLevel, canRecruit, canStarUp } from './economy';
import { Num, n, ZERO, sub, div, gt, toNum, fmt } from './num';
import { compareLoadouts } from './analysis';

// --- representative play: build a fixed composition, then level everyone evenly ---
// The party cap is 5; the start is Protagonist + Anti-hero, leaving exactly 3 recruit
// slots. We fill them with three DISTINCT new classes — a Debuffer to break boss regen,
// a Support to amplify party DPS, and a Sidekick for Inspiration income — so the fielded
// party is all 5 distinct classes. That maximizes the Protagonist's Plot Armor and makes
// the harness exercise every ability kind (loneWolf, regenCut, partyDps, inspRate).
// Leveling the lowest-level member each step keeps the party even as power grows.
const COMP: ClassId[] = ['debuffer', 'support', 'sidekick'];

function nextRecruitClass(s: GameState, comp: ClassId[]): ClassId | null {
  const recruitIndex = s.party.length - 2; // slots 0,1 are the starting Protagonist + Anti-hero
  if (recruitIndex < 0 || recruitIndex >= comp.length) return null;
  if (s.party.length >= effectivePartyCap(s)) return null;
  return comp[recruitIndex];
}

function lowestLevelId(s: GameState): string {
  let id = s.party[0].id;
  let min = s.party[0].level;
  for (const c of s.party) if (c.level < min) { min = c.level; id = c.id; }
  return id;
}

// The lowest-starred non-Protagonist class still able to advance (else null).
function lowestStarClass(s: GameState): ClassId | null {
  let best: ClassId | null = null;
  let min = Infinity;
  for (const c of s.party) {
    if (c.classId === 'protagonist') continue;
    const st = s.stars[c.classId];
    if (st < MAX_STAR && st < min) { min = st; best = c.classId; }
  }
  return best;
}

// Cost of the next purchase the sim wants: a recruit while the comp is incomplete, else the cheapest level.
function nextPurchaseCost(s: GameState, comp: ClassId[]): Num {
  if (nextRecruitClass(s, comp)) return effectiveRecruitCost(s, s.party.length);
  let min = effectiveLevelCost(s, s.party[0].level);
  for (const c of s.party) {
    const lc = effectiveLevelCost(s, c.level);
    if (gt(min, lc)) min = lc;
  }
  return min;
}

function spendGreedy(s: GameState, comp: ClassId[]): GameState {
  let cur = s;
  for (let guard = 0; guard < 100000; guard++) {
    const nextClass = nextRecruitClass(cur, comp);
    if (nextClass && canRecruit(cur)) { cur = recruit(cur, nextClass); continue; }
    const starClass = lowestStarClass(cur);
    if (starClass && canStarUp(cur, starClass)) { cur = starUp(cur, starClass); continue; }
    const id = lowestLevelId(cur);
    if (canLevel(cur, id)) { cur = levelUp(cur, id); continue; }
    break;
  }
  return cur;
}

interface BookResult { book: number; seconds: number; completed: boolean; wall?: string; }

// Simulate greedy play across `books` books. Returns per-book in-game seconds to
// publish plus the final GameState (so tests can inspect earned variants/stars).
function simulate(books: number, maxSecondsPerBook: number, comp: ClassId[] = COMP): { results: BookResult[]; finalState: GameState } {
  let s = initialState(0);
  const results: BookResult[] = [];

  for (let b = 1; b <= books; b++) {
    let t = 0;
    let iters = 0;
    let wall: string | undefined;
    while (!s.bookComplete) {
      if (t > maxSecondsPerBook) { wall = `time cap (${fmt(n(t))}s) at zone ${s.zone.zoneIndex}/enc ${s.zone.encounterIndex}`; break; }
      if (iters++ > 500_000) { wall = `iter cap at zone ${s.zone.zoneIndex}/enc ${s.zone.encounterIndex}`; break; }

      s = spendGreedy(s, comp);

      const { zoneIndex, encounterIndex } = s.zone;
      const dps = effectivePartyDps(s);
      const regen = effectiveBossRegen(s, zoneIndex, encounterIndex);
      const net = sub(dps, regen);

      if (gt(net, ZERO)) {
        const ttc = toNum(div(s.currentHp, net));
        if (!isFinite(ttc)) { wall = `HP overflow at zone ${zoneIndex}`; break; }
        const res = step(s, ttc + 1e-6);
        s = res.state; t += ttc;
      } else {
        // stuck on a regenerating boss: accrue inspiration until the next level is affordable
        const rate = effectiveInspirationRate(s, zoneIndex, encounterIndex);
        const deficit = sub(nextPurchaseCost(s, comp), s.inspiration);
        const dt = toNum(div(deficit, rate));
        if (!isFinite(dt) || dt <= 0) { wall = `regen wall at zone ${zoneIndex} (DPS ${fmt(dps)} <= regen ${fmt(regen)})`; break; }
        const res = step(s, dt + 1e-6);
        s = res.state; t += dt;
      }
    }
    results.push({ book: b, seconds: t, completed: s.bookComplete, wall });
    if (!s.bookComplete) break;
    s = publish(s);
  }
  return { results, finalState: s };
}

function human(seconds: number): string {
  if (!isFinite(seconds)) return 'never';
  if (seconds < 60) return `${seconds.toFixed(0)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
  if (seconds < 31_557_600) return `${(seconds / 86400).toFixed(1)}d`;
  return `${(seconds / 31_557_600).toExponential(1)}yr`;
}

function publishTime(comp: ClassId[]): number {
  const { results } = simulate(2, 30 * 86400, comp); // 2 books: 1 ramp + 1 measured
  const b2 = results.find((r) => r.book === 2);
  return b2 && b2.completed ? b2.seconds : Infinity;
}

describe('balance: the core loop closes', () => {
  const { results, finalState } = simulate(8, 30 * 86400); // cap each book at 30 in-game days

  const report = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.BALANCE_REPORT;
  if (report) {
    const lines = results.map(
      (r) => `book ${r.book}: ${r.completed ? human(r.seconds) : 'WALL — ' + r.wall}`,
    );
    // eslint-disable-next-line no-console
    console.log('\n=== balance: greedy time-to-publish ===\n' + lines.join('\n') + '\n');
    const lo = compareLoadouts();
    const critic = publishTime(['debuffer', 'support', 'scribe']);    // The Critic in the flex slot
    const baseline = publishTime(['debuffer', 'support', 'sidekick']); // the default flex pick
    // eslint-disable-next-line no-console
    console.log(`loadout rainbow/mono ratio: ${(lo.ratio).toFixed(3)} (mono ${lo.mono.toFixed(1)}, rainbow ${lo.rainbow.toFixed(1)})`);
    // eslint-disable-next-line no-console
    console.log(`critic/baseline publish ratio (book 2): ${(critic / baseline).toFixed(3)} (critic ${human(critic)}, baseline ${human(baseline)})`);
    // eslint-disable-next-line no-console
    console.log(`book 8: ${human(results.find((r) => r.book === 8)!.seconds)}`);
  }

  it('book 1 is publishable within 2 in-game hours of greedy play', () => {
    const book1 = results.find((r) => r.book === 1)!;
    expect(book1.completed).toBe(true);
    expect(book1.seconds).toBeLessThan(2 * 3600);
  });

  it('books 1-8 all complete (no hard wall)', () => {
    expect(results.length).toBe(8);
    expect(results.every((r) => r.completed)).toBe(true);
  });

  // --- tuning-pass parity/pacing bands (magnitudes set in the tuning pass) ---
  it('rainbow loadouts compete with mono (loadout parity band 0.85-1.15)', () => {
    const { ratio } = compareLoadouts();
    expect(ratio).toBeGreaterThanOrEqual(0.85);
    expect(ratio).toBeLessThanOrEqual(1.15);
  });

  it('The Critic is on par with the flex-slot baseline (publish-time band 0.85-1.15)', () => {
    const ratio = publishTime(['debuffer', 'support', 'scribe'])
      / publishTime(['debuffer', 'support', 'sidekick']);
    expect(ratio).toBeGreaterThanOrEqual(0.85);
    expect(ratio).toBeLessThanOrEqual(1.15);
  });

  it('book 8 lands in the steeper late-game band (1-2h) and still completes', () => {
    const book8 = results.find((r) => r.book === 8)!;
    expect(book8.completed).toBe(true);
    expect(book8.seconds).toBeGreaterThanOrEqual(3600);
    expect(book8.seconds).toBeLessThanOrEqual(7200);
  });

  // Slice 3a: variants are earned by clearing world bosses. Each book clears all
  // 8 worlds once, unlocking one class's variant per world per book, so after 8
  // books every class should own every world's skin (the full 5x8 collection).
  it('clearing 8 books unlocks the full variant collection through real play', () => {
    const total = Object.values(finalState.unlockedVariants).reduce((sum, ws) => sum + ws.length, 0);
    expect(finalState.unlockedVariants.protagonist.length).toBe(ZONE_COUNT);
    expect(total).toBe(CLASSES.length * ZONE_COUNT);
  });
});
