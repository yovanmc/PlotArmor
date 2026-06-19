// Balance harness: greedy-play simulation over the REAL engine.
// Asserts the core loop closes (book 1 is publishable on a sane timeline) and that
// the first several books stay beatable. Run the verbose pacing report with:
//   BALANCE_REPORT=1 npx vitest run src/engine/balance.test.ts
import { describe, it, expect } from 'vitest';
import { GameState, initialState, characterPower, Character } from './state';
import {
  effectiveInspirationRate, effectivePartyDps, effectiveBossRegen,
  effectiveLevelCost, effectiveRecruitCost, effectivePartyCap,
} from './modifiers';
import { step } from './loop';
import { publish } from './progression';
import { levelUp, recruit, canLevel, canRecruit } from './economy';
import { n, ZERO, ONE, sub, div, gt, toNum, fmt } from './num';

// --- greedy spending: repeatedly buy the most DPS-efficient affordable purchase ---
function bestAffordablePurchase(s: GameState): { kind: 'level'; id: string } | { kind: 'recruit' } | null {
  let best: { kind: 'level'; id: string } | { kind: 'recruit' } | null = null;
  let bestRatio = ZERO; // ΔDPS per inspiration, as a Num

  for (const c of s.party) {
    if (!canLevel(s, c.id)) continue;
    const cur = characterPower(c);
    const next = characterPower({ ...c, level: c.level + 1 } as Character);
    const dDps = sub(next, cur);
    const cost = effectiveLevelCost(s, c.level);
    const ratio = div(dDps, cost);
    if (gt(ratio, bestRatio)) { bestRatio = ratio; best = { kind: 'level', id: c.id }; }
  }
  if (canRecruit(s)) {
    const dDps = ONE; // a fresh level-1 char contributes basePower (1)
    const cost = effectiveRecruitCost(s, s.party.length);
    const ratio = div(dDps, cost);
    if (gt(ratio, bestRatio)) { bestRatio = ratio; best = { kind: 'recruit' }; }
  }
  return best;
}

function spendGreedy(s: GameState): GameState {
  let cur = s;
  for (let guard = 0; guard < 10000; guard++) {
    const buy = bestAffordablePurchase(cur);
    if (!buy) break;
    cur = buy.kind === 'recruit' ? recruit(cur) : levelUp(cur, buy.id);
  }
  return cur;
}

function cheapestNextCost(s: GameState): import('./num').Num {
  let min = effectiveLevelCost(s, s.party[0].level);
  for (const c of s.party) {
    const lc = effectiveLevelCost(s, c.level);
    if (gt(min, lc)) min = lc;
  }
  if (s.party.length < effectivePartyCap(s)) {
    const rc = effectiveRecruitCost(s, s.party.length);
    if (gt(min, rc)) min = rc;
  }
  return min;
}

interface BookResult { book: number; seconds: number; completed: boolean; wall?: string; }

// Simulate greedy play across `books` books. Returns per-book in-game seconds to publish.
function simulate(books: number, maxSecondsPerBook: number): BookResult[] {
  let s = initialState(0);
  const results: BookResult[] = [];

  for (let b = 1; b <= books; b++) {
    let t = 0;
    let iters = 0;
    let wall: string | undefined;
    while (!s.bookComplete) {
      if (t > maxSecondsPerBook) { wall = `time cap (${fmt(n(t))}s) at zone ${s.zone.zoneIndex}/enc ${s.zone.encounterIndex}`; break; }
      if (iters++ > 500_000) { wall = `iter cap at zone ${s.zone.zoneIndex}/enc ${s.zone.encounterIndex}`; break; }

      s = spendGreedy(s);

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
        const deficit = sub(cheapestNextCost(s), s.inspiration);
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
  return results;
}

function human(seconds: number): string {
  if (!isFinite(seconds)) return 'never';
  if (seconds < 60) return `${seconds.toFixed(0)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
  if (seconds < 31_557_600) return `${(seconds / 86400).toFixed(1)}d`;
  return `${(seconds / 31_557_600).toExponential(1)}yr`;
}

describe('balance: the core loop closes', () => {
  const results = simulate(8, 30 * 86400); // cap each book at 30 in-game days

  const report = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.BALANCE_REPORT;
  if (report) {
    const lines = results.map(
      (r) => `book ${r.book}: ${r.completed ? human(r.seconds) : 'WALL — ' + r.wall}`,
    );
    // eslint-disable-next-line no-console
    console.log('\n=== balance: greedy time-to-publish ===\n' + lines.join('\n') + '\n');
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
});
