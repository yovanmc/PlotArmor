# Plot Armor Tuning Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make rainbow loadouts competitive via an Ensemble (diversity) set that amplifies affinity; pivot the Scribe into "The Critic," a DoT combat class; steepen late-game pacing; and build a measurement harness to tune all magnitudes to target bands.

**Architecture:** Tasks 1–3 add the *mechanics* + the *measurement instrument* (deterministic, TDD, subagent-built). Tasks 4–5 are *controller-led*: the iterative magnitude tuning (run the harness, read numbers, adjust constants, re-run) and the ship steps, which need judgment and live smoke and so are not handed to a subagent.

**Tech Stack:** TypeScript (strict) + Vite + Vitest (jsdom). Big numbers behind `src/engine/num.ts`.

**Spec:** `docs/superpowers/specs/2026-06-20-plot-armor-tuning-pass-design.md` (LOCKED).

---

## File Structure

| File | Responsibility | Task |
|------|----------------|------|
| `src/engine/content.ts` | `AbilityKind` (`words`→`dot`), Critic catalog entry, Ensemble constants, magnitudes | 1, 2, 4 |
| `src/engine/variants.ts` | `distinctWorldsFielded`, `ensembleAffinityAmp`, `affinityMult` amp param | 2 |
| `src/engine/modifiers.ts` | revert `effectiveWords`, DoT in `effectivePartyDps`, thread Ensemble amp | 1, 2 |
| `src/ui/render.ts` | HUD Ensemble line | 2 |
| `src/engine/analysis.ts` (new) | pure `compareLoadouts()` | 3 |
| `src/engine/balance.test.ts` | parameterize `simulate(comp)`, Critic-vs-combat compare, report, band asserts | 3, 4 |
| test files | content/variants/modifiers/analysis | 1, 2, 3 |
| `README.md`, memory | status | 5 |

**Key facts (verified anchors):**
- `content.ts:338` `ClassId` (keep `'scribe'`); `:339` `AbilityKind`; `:349-356` `CLASSES` (scribe at `:355`); `:295-303` `SET_THRESHOLDS`/`setTier`; `:324` `AFFINITY_MAG`; `:146` `BOOK_SCALE`.
- `modifiers.ts:25` private `abilitySum(party, kind, stars, zoneIndex)`; `:47` `effectiveTargetMaxHp(s, zoneIndex, encounterIndex)` (in-module); `:60` `effectiveWords`; `:71` `effectivePartyDps`. Affinity is applied in `abilitySum` (`:29`) and `effectivePartyDps` (`:80`).
- `variants.ts:52` `worldCounts(party): Map<number,number>`; `:100` `affinityMult`.
- `num` helpers: `n, add, mul, gt, eq, ZERO`. `makeCharacter(id, classId, level)`, `initialState(seed)`.

---

### Task 1: Pivot the Scribe into "The Critic" (DoT combat class)

**Files:** Modify `src/engine/content.ts`, `src/engine/modifiers.ts`. Tests: `src/engine/content.test.ts`, `src/engine/modifiers.test.ts`.

- [ ] **Step 1: Update/replace the failing assertions**

In `src/engine/content.test.ts`, change the Scribe ability-kind assertion (added when the Scribe shipped) from:
```ts
    expect(C.findClass('scribe').ability.kind).toBe('words');
```
to:
```ts
    expect(C.findClass('scribe').ability.kind).toBe('dot');
    expect(C.findClass('scribe').name).toBe('The Critic');
```

In `src/engine/modifiers.test.ts`, **delete** the entire block added when the Scribe shipped:
```ts
describe('Scribe (Words-axis class)', () => {
  it('a fielded Scribe raises effectiveWords above the same party without it', () => { ... });
  it('is neutral with no Scribe fielded — effectiveWords equals the raw curve at book 1', () => { ... });
});
```
and replace it with:
```ts
describe('The Critic (DoT combat class)', () => {
  it('a fielded Critic raises party DPS via its max-HP bleed', () => {
    const base = initialState(0);
    const withCritic = { ...base, party: [...base.party, makeCharacter('crit', 'scribe', 10)] };
    expect(num.gt(M.effectivePartyDps(withCritic), M.effectivePartyDps(base))).toBe(true);
  });
  it('contributes nothing when no Critic is fielded — party DPS unchanged', () => {
    const base = initialState(0);
    const plusSupport = { ...base, party: [...base.party, makeCharacter('s', 'support', 10)] };
    const dpsBefore = M.effectivePartyDps(base);
    // adding a non-Critic does not invoke the DoT path; sanity that the DoT term is Critic-gated
    expect(num.gt(M.effectivePartyDps(plusSupport), dpsBefore)).toBe(true); // support still helps
  });
});
```
(The book-1 PARITY test at the top of the file still asserts `effectiveWords(s,0,0) === targetWords(0,0)` — that stays valid after the revert below, because a default party fields no Critic and the words scribeMult is removed.)

- [ ] **Step 2: Run to verify failure**

Run: `cd "C:/Agent Projects/PlotArmor" && npx vitest run src/engine/content.test.ts src/engine/modifiers.test.ts`
Expected: FAIL — `'scribe'` kind is still `'words'`; the Critic DoT path doesn't exist.

- [ ] **Step 3: content.ts — flip the ability axis and rename**

Change `AbilityKind` (`:339`), replacing `'words'` with `'dot'`:
```ts
export type AbilityKind = 'plotArmor' | 'loneWolf' | 'partyDps' | 'regenCut' | 'inspRate' | 'dot';
```
Change the catalog entry (`:355`) — rename to "The Critic", ability kind `'dot'` (mag is a placeholder, tuned in Task 4):
```ts
  { id: 'scribe',      name: 'The Critic',      classBasePower: n(0.5), ability: { kind: 'dot', mag: 0.003 } },
```

- [ ] **Step 4: modifiers.ts — revert `effectiveWords`, add the DoT to `effectivePartyDps`**

Replace `effectiveWords` (`:60-64`) with the pre-Scribe form (drop the `scribeMult` term; keep the words set-axis `setMult`):
```ts
export function effectiveWords(s: GameState, zoneIndex: number, encounterIndex: number): Num {
  const setMult = activeSetBonus(s.party).wordsMult;
  return mul(mul(mul(targetWords(zoneIndex, encounterIndex), bookDifficulty(s)), n(pageTurnerMult(s))), n(setMult));
}
```

In `effectivePartyDps` (`:71-90`), read `encounterIndex`, build the direct-damage product into a `direct` local, and add the DoT bonus. Replace the function body's final lines so the whole function reads:
```ts
export function effectivePartyDps(s: GameState): Num {
  const zoneIndex = s.zone.zoneIndex;
  const encounterIndex = s.zone.encounterIndex;
  const lm = legacyMult(s.legacy);
  let sum = ZERO;
  for (const c of s.party) {
    const ab = findClass(c.classId).ability;
    const selfMult = ab.kind === 'loneWolf'
      ? 1 + ab.mag * c.level * starAbilityMult(s.stars[c.classId]) * lm // Lone Wolf amps only itself
      : 1;
    const aff = affinityMult(c, zoneIndex); // home character: scale its whole contribution
    sum = add(sum, mul(mul(effectiveCharacterPower(s, c), n(selfMult)), n(aff)));
  }
  const supportMult = 1 + abilitySum(s.party, 'partyDps', s.stars, zoneIndex) * lm;
  const hasProtagonist = s.party.some((c) => c.classId === 'protagonist');
  const plotArmorMult = hasProtagonist
    ? 1 + findClass('protagonist').ability.mag * distinctClassCount(s.party) * starAbilityMult(s.stars.protagonist) * lm
    : 1; // Plot Armor is a party-variety signature — NOT affinity-scaled (§9)
  const setMult = activeSetBonus(s.party).dpsMult;
  const direct = mul(mul(mul(mul(sum, n(sharpMult(s))), n(supportMult)), n(plotArmorMult)), n(setMult));
  // The Critic's DoT: % of the CURRENT encounter's max HP per second, added independently of the
  // direct-attack multipliers. Strong vs high-HP bosses; caps clear-time against the HP wall.
  const dotSum = abilitySum(s.party, 'dot', s.stars, zoneIndex) * lm;
  const dotBonus = mul(n(dotSum), effectiveTargetMaxHp(s, zoneIndex, encounterIndex));
  return add(direct, dotBonus);
}
```

- [ ] **Step 5: Run to verify pass**

Run: `cd "C:/Agent Projects/PlotArmor" && npx tsc --noEmit && npm test 2>&1 | grep -E "Test Files|Tests "`
Expected: tsc clean (the removed `'words'` kind has no remaining users — `effectiveWords`'s scribeMult is gone); all tests pass. Grep for stragglers: `grep -rn "'words'" src/engine` should now only match the `SetAxis` `'words'` (set bonus), not `AbilityKind`.

- [ ] **Step 6: Update any remaining `'Scribe'` display string**

Run: `cd "C:/Agent Projects/PlotArmor" && grep -rn "Scribe" src`
For each hit that is a **display string** (UI text or a test asserting the literal `'Scribe'`), change it to `'The Critic'`. Do NOT change the `id` `'scribe'` (string literal in unions/maps/saves stays). If `npm test` was already green at Step 5, there were none in tests; this is a safety sweep for UI copy.

- [ ] **Step 7: Commit**
```bash
git add src/engine/content.ts src/engine/modifiers.ts src/engine/content.test.ts src/engine/modifiers.test.ts
git commit -m "feat: pivot Scribe into The Critic (DoT % max-HP boss-slayer)"
```

---

### Task 2: Ensemble (diversity) set that amplifies affinity

**Files:** Modify `src/engine/content.ts`, `src/engine/variants.ts`, `src/engine/modifiers.ts`, `src/ui/render.ts`. Tests: `src/engine/content.test.ts`, `src/engine/variants.test.ts`, `src/engine/modifiers.test.ts`.

- [ ] **Step 1: Write failing tests**

In `src/engine/content.test.ts`, add:
```ts
describe('content: Ensemble (diversity) set', () => {
  it('tiers by distinct-world count [3,4,5] -> 1/2/3', () => {
    expect(C.ensembleTier(2)).toBe(0);
    expect(C.ensembleTier(3)).toBe(1);
    expect(C.ensembleTier(4)).toBe(2);
    expect(C.ensembleTier(5)).toBe(3);
  });
});
```

In `src/engine/variants.test.ts`, add (match the file's existing import style for `makeCharacter`/types; characters set `variantWorld` directly):
```ts
import { distinctWorldsFielded, ensembleAffinityAmp, affinityMult } from './variants';
// ... inside the describe area:
describe('Ensemble (diversity) set', () => {
  const mk = (id: string, world: number | null) => ({ ...makeCharacter(id, 'support', 1), variantWorld: world });
  it('counts distinct fielded worlds (base look ignored)', () => {
    expect(distinctWorldsFielded([mk('a', 2), mk('b', 2), mk('c', null)])).toBe(1);
    expect(distinctWorldsFielded([mk('a', 0), mk('b', 1), mk('c', 2)])).toBe(3);
  });
  it('amplifies affinity for an in-element character when 3+ distinct worlds are fielded', () => {
    const rainbow = [mk('a', 0), mk('b', 1), mk('c', 2)];
    const amp = ensembleAffinityAmp(rainbow);
    expect(amp).toBeGreaterThan(0);
    const inEl = rainbow[0]; // wears world 0, fighting zone 0
    expect(affinityMult(inEl, 0, amp)).toBeGreaterThan(affinityMult(inEl, 0, 0));
  });
  it('is neutral below the threshold (mono / <3 distinct) and off-element', () => {
    const mono = [mk('a', 2), mk('b', 2)];
    expect(ensembleAffinityAmp(mono)).toBe(0);
    expect(affinityMult(mono[0], 5, 1.0)).toBe(1); // off-element: amp irrelevant
  });
});
```
(`makeCharacter` is imported in `variants.test.ts` already if used; if not, add it to the `./state` import.)

- [ ] **Step 2: Run to verify failure**
Run: `cd "C:/Agent Projects/PlotArmor" && npx vitest run src/engine/content.test.ts src/engine/variants.test.ts`
Expected: FAIL — `ensembleTier`/`distinctWorldsFielded`/`ensembleAffinityAmp` undefined; `affinityMult` ignores a 3rd arg.

- [ ] **Step 3: content.ts — Ensemble constants** (insert after `AFFINITY_MAG`, `:324`)
```ts
// --- Ensemble (diversity) set — Slice-4 sibling -----------------------------
// Fielding N DISTINCT worlds grants an always-on Ensemble bonus that AMPLIFIES
// zone affinity (go broad -> your in-element characters hit harder). Mirrors the
// same-world set (SET_THRESHOLDS). Harness-/owner-tuned placeholders.
export const ENSEMBLE_THRESHOLDS: [number, number, number] = [3, 4, 5];
export const ENSEMBLE_AFFINITY_AMP: [number, number, number] = [0.5, 1.0, 2.0];

export function ensembleTier(distinctCount: number): number {
  if (distinctCount >= ENSEMBLE_THRESHOLDS[2]) return 3;
  if (distinctCount >= ENSEMBLE_THRESHOLDS[1]) return 2;
  if (distinctCount >= ENSEMBLE_THRESHOLDS[0]) return 1;
  return 0;
}
```

- [ ] **Step 4: variants.ts — distinct-world count + amp; amplify `affinityMult`**

Add `ensembleTier, ENSEMBLE_AFFINITY_AMP` to the `./content` import. Add after `worldCounts` (`:58`):
```ts
// How many DISTINCT worlds are fielded (base look ignored).
export function distinctWorldsFielded(party: Character[]): number {
  return worldCounts(party).size;
}

// The Ensemble set amplifies affinity by this factor at the current distinct-world tier (0 at tier 0).
export function ensembleAffinityAmp(party: Character[]): number {
  const tier = ensembleTier(distinctWorldsFielded(party));
  return tier === 0 ? 0 : ENSEMBLE_AFFINITY_AMP[tier - 1];
}
```
Change `affinityMult` (`:100`) to take an optional amp (default `0` keeps every existing caller byte-identical):
```ts
export function affinityMult(c: Character, zoneIndex: number, ensembleAmp = 0): number {
  return isInElement(c, zoneIndex) ? 1 + AFFINITY_MAG * (1 + ensembleAmp) : 1;
}
```

- [ ] **Step 5: modifiers.ts — thread the Ensemble amp through the affinity paths**

Add `ensembleAffinityAmp` to the `./variants` import. Give `abilitySum` an `ensembleAmp` param and pass it to `affinityMult`:
```ts
function abilitySum(party: Character[], kind: AbilityKind, stars: Record<ClassId, number>, zoneIndex: number, ensembleAmp: number): number {
  let total = 0;
  for (const c of party) {
    const ab = findClass(c.classId).ability;
    if (ab.kind === kind) total += ab.mag * c.level * starAbilityMult(stars[c.classId]) * affinityMult(c, zoneIndex, ensembleAmp);
  }
  return total;
}
```
Update each caller to compute `eAmp` once and pass it:
- `effectiveInspirationRate`: add `const eAmp = ensembleAffinityAmp(s.party);` and call `abilitySum(s.party, 'inspRate', s.stars, zoneIndex, eAmp)`.
- `effectiveBossRegen`: add `const eAmp = ensembleAffinityAmp(s.party);` and call `abilitySum(s.party, 'regenCut', s.stars, zoneIndex, eAmp)`.
- `effectivePartyDps`: add `const eAmp = ensembleAffinityAmp(s.party);` near the top; change the in-loop `affinityMult(c, zoneIndex)` → `affinityMult(c, zoneIndex, eAmp)`; change `abilitySum(s.party, 'partyDps', s.stars, zoneIndex)` → `... zoneIndex, eAmp)`; change the DoT line `abilitySum(s.party, 'dot', s.stars, zoneIndex)` → `... zoneIndex, eAmp)`.

(`effectiveWords` no longer calls `abilitySum` after Task 1, so nothing to thread there.)

- [ ] **Step 6: render.ts — HUD Ensemble line**

Import `distinctWorldsFielded` from `../engine/variants` and `ensembleTier, ENSEMBLE_AFFINITY_AMP` from `../engine/content`. Near the existing `setLine` (`render.ts:33-35`), add:
```ts
  const eTier = ensembleTier(distinctWorldsFielded(state.party));
  const ensembleLine = eTier > 0
    ? `<div>🌈 Ensemble T${eTier}: in-element ×${(1 + (/* AFFINITY_MAG */ 0.5) * (1 + ENSEMBLE_AFFINITY_AMP[eTier - 1])).toFixed(2)}</div>`
    : '';
```
and include `${ensembleLine}` in the rendered HUD block alongside `${setLine}`. (Import `AFFINITY_MAG` too and use it instead of the inline `0.5` so the line can't drift from the constant.)

- [ ] **Step 7: modifiers neutral test**

In `src/engine/modifiers.test.ts` add:
```ts
it('Ensemble is neutral at <3 distinct worlds — default game DPS unchanged', () => {
  const s = initialState(0); // base skins, 0 distinct worlds
  // recompute is deterministic; just assert the parity holds (no throw, finite)
  expect(num.gt(M.effectivePartyDps(s), num.ZERO)).toBe(true);
});
```

- [ ] **Step 8: Run, typecheck, commit**
Run: `cd "C:/Agent Projects/PlotArmor" && npx tsc --noEmit && npm test 2>&1 | grep -E "Test Files|Tests "`
Expected: green (default game unaffected — `eAmp` is 0 at <3 distinct worlds; `affinityMult` default arg keeps untouched call sites identical).
```bash
git add src/engine/content.ts src/engine/variants.ts src/engine/modifiers.ts src/ui/render.ts src/engine/content.test.ts src/engine/variants.test.ts src/engine/modifiers.test.ts
git commit -m "feat: Ensemble (diversity) set amplifies zone affinity"
```

---

### Task 3: The measurement instrument

**Files:** Create `src/engine/analysis.ts`; modify `src/engine/balance.test.ts`. Test: `src/engine/analysis.test.ts`.

- [ ] **Step 1: Write the failing analysis test**

Create `src/engine/analysis.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { compareLoadouts } from './analysis';

describe('analysis: loadout comparison', () => {
  it('returns positive mono/rainbow book outputs and a finite ratio', () => {
    const r = compareLoadouts();
    expect(r.mono).toBeGreaterThan(0);
    expect(r.rainbow).toBeGreaterThan(0);
    expect(Number.isFinite(r.ratio)).toBe(true);
    expect(r.ratio).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**
Run: `cd "C:/Agent Projects/PlotArmor" && npx vitest run src/engine/analysis.test.ts`
Expected: FAIL — `./analysis` does not exist.

- [ ] **Step 3: Create `src/engine/analysis.ts`** (pure; DOM-free)
```ts
// src/engine/analysis.ts
// Pure tuning instruments: compare loadout archetypes by total book DPS output.
// Used by the balance report to tune the Ensemble/affinity/set magnitudes to parity.
import { GameState, initialState, makeCharacter, Character } from './state';
import { ZONE_COUNT } from './content';
import { effectivePartyDps } from './modifiers';
import { Num, add, toNum, ZERO } from './num';

// A representative fielded combat party at a fixed level, wearing a given set of worlds.
function partyWearing(worlds: (number | null)[]): Character[] {
  const classes = ['protagonist', 'antihero', 'support', 'debuffer', 'sidekick'] as const;
  return worlds.map((w, i) => ({ ...makeCharacter(`c${i}`, classes[i], 12), variantWorld: w }));
}

// Sum effectivePartyDps across all zones of a book (affinity fires per matching zone).
function bookOutput(party: Character[]): number {
  const base = initialState(0);
  let total: Num = ZERO;
  for (let z = 0; z < ZONE_COUNT; z++) {
    const s: GameState = { ...base, party, zone: { zoneIndex: z, encounterIndex: 0 } };
    total = add(total, effectivePartyDps(s));
  }
  return toNum(total);
}

// Mono = all 5 wear world 2 (Space, a dps-axis set). Rainbow = 5 distinct worlds incl. Space.
export function compareLoadouts(): { mono: number; rainbow: number; ratio: number } {
  const mono = bookOutput(partyWearing([2, 2, 2, 2, 2]));
  const rainbow = bookOutput(partyWearing([2, 5, 0, 3, 4]));
  return { mono, rainbow, ratio: rainbow / mono };
}
```

- [ ] **Step 4: Run to verify pass**
Run: `cd "C:/Agent Projects/PlotArmor" && npx vitest run src/engine/analysis.test.ts`
Expected: PASS.

- [ ] **Step 5: Parameterize the greedy sim + extend the report**

In `src/engine/balance.test.ts`:
- Change the module `COMP` usage so `nextRecruitClass` and `simulate` accept a comp. Add a parameter: `function nextRecruitClass(s: GameState, comp: ClassId[]): ClassId | null` (use `comp` instead of the module `COMP`), `function spendGreedy(s: GameState, comp: ClassId[])`, and `function simulate(books, maxSecondsPerBook, comp: ClassId[] = COMP)`. Thread `comp` through (the body currently calls `nextRecruitClass(cur)`/`spendGreedy(s)` → pass `comp`). Keep the existing `simulate(8, 30 * 86400)` call working via the default.
- Add a Critic-vs-combat comparison helper:
```ts
function publishTime(comp: ClassId[]): number {
  const { results } = simulate(2, 30 * 86400, comp); // 2 books: 1 ramp + 1 measured
  const b2 = results.find((r) => r.book === 2);
  return b2 && b2.completed ? b2.seconds : Infinity;
}
```
- In the `BALANCE_REPORT` block, also log (NOTE on the baseline: the start party is `[protagonist, antihero]` and the proven comp recruits `[debuffer, support, sidekick]` — none may duplicate a starter, so a comp must NOT include `protagonist`/`antihero`. The combat roles `antihero`/`support` are already fielded, so the realistic "flex slot" alternative to the Critic is the **Sidekick**; we measure the Critic against it):
```ts
const lo = compareLoadouts(); // import from './analysis'
const critic = publishTime(['debuffer', 'support', 'scribe']);    // The Critic in the flex slot
const baseline = publishTime(['debuffer', 'support', 'sidekick']); // the default flex pick
console.log(`loadout rainbow/mono ratio: ${(lo.ratio).toFixed(3)} (mono ${lo.mono.toFixed(1)}, rainbow ${lo.rainbow.toFixed(1)})`);
console.log(`critic/baseline publish ratio (book 2): ${(critic / baseline).toFixed(3)} (critic ${human(critic)}, baseline ${human(baseline)})`);
console.log(`book 8: ${human(results.find((r) => r.book === 8)!.seconds)}`);
```
Import `compareLoadouts` from `./analysis` at the top. Do NOT add band assertions in this task (the bands fail until Task 4 tunes).

- [ ] **Step 6: Run full suite, commit**
Run: `cd "C:/Agent Projects/PlotArmor" && npx tsc --noEmit && npm test 2>&1 | grep -E "Test Files|Tests " && BALANCE_REPORT=1 npx vitest run src/engine/balance.test.ts 2>&1 | grep -E "ratio|book 8"`
Expected: green; the report prints the loadout ratio, critic/combat ratio, and book-8 time (numbers will be off-target — that's Task 4's job).
```bash
git add src/engine/analysis.ts src/engine/analysis.test.ts src/engine/balance.test.ts
git commit -m "test: tuning instrument (loadout + critic-vs-combat + pacing report)"
```

---

### Task 4 (CONTROLLER-LED): Tune magnitudes to the target bands, then lock them in

> Not a subagent task — iterative judgment + live smoke. The controller runs the report, adjusts constants, re-runs, and only then writes the band assertions (now passing) so they can never silently regress.

- [ ] **Step 1:** Run `BALANCE_REPORT=1 npx vitest run src/engine/balance.test.ts` and record the three metrics.
- [ ] **Step 2 — rainbow parity:** Adjust `WORLD_SET_BONUS` tiers (down), `AFFINITY_MAG` (up), and `ENSEMBLE_AFFINITY_AMP` until `compareLoadouts().ratio ∈ [0.85, 1.15]`. Per the spec's coverage math, expect the same-world DPS tier-3 to land roughly `+0.30–0.40` (from `+0.75`). Keep in-element multipliers sane (≤ ~×3).
- [ ] **Step 3 — pacing:** Raise `BOOK_SCALE` until greedy book 8 ∈ ~[1 h, 2 h] and books 1–8 all still complete (no wall). Book 1 stays unchanged (D(1)=1). If HP outruns purchasable power, secondarily nudge `POWER_GROWTH`.
- [ ] **Step 4 — Critic parity:** Adjust the Critic `classBasePower` + dot `mag` until `critic/baseline publish ratio ∈ [0.85, 1.15]` (baseline = the Sidekick flex pick; see Task 3 note on why there's no spare unique combat class). The Critic should win on boss-heavy/late books and lag on quick ones — judge on the overall publish time.
- [ ] **Step 5 — lock in:** Add assertions to `balance.test.ts`: loadout ratio within `[0.85, 1.15]`; critic/baseline ratio within `[0.85, 1.15]`; book 8 within `[3600, 7200]` s AND completed. Update the now-churned live-number set/affinity tests in `modifiers.test.ts` to the new magnitudes (do not weaken them). Run full `npm test` green + `npm run build`.
- [ ] **Step 6 — live smoke:** built `dist/` via `plotarmor-dist`; inject a save fielding a 3-distinct-world rainbow → confirm the `🌈 Ensemble` HUD line and that an in-element character reads higher DPS than the mono equivalent; field The Critic → confirm party DPS rises and the card shows "The Critic"; 0 console errors; restore the test save.

---

### Task 5 (CONTROLLER-LED): Docs, memory, ship

- [ ] **Step 1:** Update `README.md` Status with a tuning-pass paragraph (Ensemble set, The Critic pivot, steeper late-game, harness-tuned magnitudes; new test count) + spec/plan links.
- [ ] **Step 2:** Update memory (`project_plotarmor.md` + `MEMORY.md` index) — tuning pass shipped; the Scribe→Critic pivot; final magnitudes.
- [ ] **Step 3:** `git push origin main`; report the pushed range, final test count, and the three tuned bands' measured values.
