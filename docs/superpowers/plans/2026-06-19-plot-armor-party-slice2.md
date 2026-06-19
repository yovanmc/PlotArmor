# Plot Armor — Party System Slice 2 (Stars + Edits) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-class 5★ star system funded by a global "Edits" currency that drops from boss kills, so players permanently boost a class's power and ability magnitude on top of per-book leveling.

**Architecture:** Stars live on `GameState` as a per-class `Record<ClassId, number>` (not on each `Character`), and Edits are a single global `Num` wallet. Star multipliers fold into the existing `modifiers.ts` `effective*` read-paths exactly like shop-upgrade multipliers — so combat, offline, and the harness pick them up automatically. At 1★ every multiplier is `1`, so all Slice 1 behavior is unchanged at a fresh state (minimal test churn). Save schema bumps v3→v4 with safe defaults for older saves.

**Tech Stack:** TypeScript (strict) + Vite + Vitest (jsdom) + `break_eternity.js` big numbers behind `num.ts` + localStorage saves. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-06-19-plot-armor-party-system-design.md` (§6 star system & Edits economy — LOCKED).

---

## Conventions (read once)

- **Commit identity:** plain `git commit` with the repo's configured global identity (`yovanmc <yovanmc@users.noreply.github.com>`). NEVER pass `--author`, NEVER set a per-commit `user.email`, NEVER `--no-verify`.
- **Do NOT push** until Task 8.
- Run from `C:\Agent Projects\PlotArmor`. Verify each task with `npx tsc --noEmit` + `npm test`.
- **All magnitudes are harness-tuned placeholders** (`STAR_GROWTH`, `EDITS_BASE`, drop amounts). Task 8 tunes them; do not treat the starting numbers as final.
- **Key design rule:** the **Protagonist has no stars** (it grows via the Royalties track, deferred to Slice 3). Its star entry stays at `1` so `starStatMult(1) === 1` makes it a no-op; `starUp` refuses it.

## File map

| File | Change | Task |
|------|--------|------|
| `src/engine/content.ts` | add star/Edit constants + `starStatMult`/`starAbilityMult`/`starUpCost`/`bossEditDrop` | 1 |
| `src/engine/state.ts` | `GameState.edits` + `GameState.stars`, `makeStars()`, `initialState` | 2 |
| `src/engine/save.ts` | stopgap (Task 2), then schema v4 finalize | 2, 6 |
| `src/engine/modifiers.ts` | `effectiveCharacterPower` + thread stars through abilities/DPS | 3 |
| `src/engine/economy.ts` | `canStarUp` / `starUp` | 4 |
| `src/engine/progression.ts` | `onClear` awards Edits on a boss kill | 5 |
| `src/ui/render.ts` | Edits in HUD, star pips + star-up button on cards | 7 |
| `src/ui/input.ts` | `starup` click handler | 7 |
| `src/styles.css` | `.cstars` pip styling | 7 |
| `src/engine/balance.test.ts` | greedy spends Edits on stars; loop still closes | 8 |
| `README.md`, spec status | docs | 8 |

---

## Task 1: Star + Edit constants and pure functions (`content.ts`)

**Files:**
- Modify: `src/engine/content.ts` (append after the upgrade catalog, before `// --- party classes (Slice 1)` at line ~218)
- Test: `src/engine/content.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/engine/content.test.ts` (append inside the existing file, after the last test; keep existing imports and add the new names):

```ts
import {
  starStatMult, starAbilityMult, starUpCost, bossEditDrop, MAX_STAR,
} from './content';

describe('stars + Edits (Slice 2)', () => {
  it('MAX_STAR is 5', () => {
    expect(MAX_STAR).toBe(5);
  });

  it('star multipliers are exactly 1 at 1 star and grow with stars', () => {
    expect(starStatMult(1)).toBe(1);
    expect(starAbilityMult(1)).toBe(1);
    expect(starStatMult(5)).toBeGreaterThan(starStatMult(1));
    expect(starAbilityMult(5)).toBeGreaterThan(starAbilityMult(1));
  });

  it('star-up cost rises with the current star', () => {
    expect(num.gt(starUpCost(2), starUpCost(1))).toBe(true);
    expect(num.gt(starUpCost(1), num.ZERO)).toBe(true);
  });

  it('boss Edit drop is positive and grows with the book number', () => {
    expect(num.gt(bossEditDrop(1), num.ZERO)).toBe(true);
    expect(num.gt(bossEditDrop(3), bossEditDrop(1))).toBe(true);
  });
});
```

Note: `content.test.ts` already imports `* as num from './num'` and `describe/it/expect` from vitest. If it does not import `num`, add `import * as num from './num';` at the top.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/content.test.ts`
Expected: FAIL — `starStatMult`/`MAX_STAR`/etc. are not exported.

- [ ] **Step 3: Write minimal implementation**

In `src/engine/content.ts`, insert this block immediately before the line `// --- party classes (Slice 1) -------------------------------------------------`:

```ts
// --- party stars + the Edits economy (Slice 2) -------------------------------
// Stars are PER-CLASS (1..MAX_STAR). starStatMult scales class base power and
// starAbilityMult scales class ability magnitude; both are 1 at 1 star so the
// fresh game is identical to Slice 1. Edits are a global currency dropped by
// bosses, spent to raise a class's star. ALL magnitudes are harness-tuned.
export const MAX_STAR = 5;
export const STAR_GROWTH = 1.6;          // class base-power multiplier per star
export const STAR_ABILITY_GROWTH = 1.5;  // class ability-magnitude multiplier per star
export const EDITS_BASE = n(2);          // Edits cost of the 1*->2* step
export const STAR_COST_GROWTH = 2;       // star-up cost escalation per star
export const EDITS_PER_BOSS = n(1);      // base Edits per boss kill (book 1)
export const EDIT_BOOK_GROWTH = 1.25;    // gentle per-book growth of the boss drop

export function starStatMult(stars: number): number {
  return Math.pow(STAR_GROWTH, stars - 1);
}

export function starAbilityMult(stars: number): number {
  return Math.pow(STAR_ABILITY_GROWTH, stars - 1);
}

// Edits to go from `currentStar` to `currentStar + 1`.
export function starUpCost(currentStar: number): Num {
  return mul(EDITS_BASE, pow(n(STAR_COST_GROWTH), currentStar - 1));
}

// Edits dropped by a boss kill in the given book. Grows gently with the book
// number (stars are a bounded permanent boost, not a scaling mechanism).
export function bossEditDrop(bookNumber: number): Num {
  return mul(EDITS_PER_BOSS, pow(n(EDIT_BOOK_GROWTH), bookNumber - 1));
}
```

`n`, `mul`, `pow`, `Num` are already imported at the top of `content.ts` (`import { Num, n, mul, pow, ZERO } from './num';`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/content.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/content.ts src/engine/content.test.ts
git commit -m "feat: star/Edit constants + starStatMult/starAbilityMult/starUpCost/bossEditDrop"
```

---

## Task 2: `GameState.edits` + per-class `stars` (`state.ts`) + save stopgap

**Files:**
- Modify: `src/engine/state.ts`
- Modify: `src/engine/save.ts` (stopgap only — finalized in Task 6)
- Test: `src/engine/state.test.ts`

> **Ripple note (expected):** adding the required `edits` and `stars` fields to the `GameState` interface makes the `GameState` literal returned by `save.ts` `deserialize` fail to type-check. We patch it with safe defaults here (stopgap) and finalize the real read in Task 6. `initialState` (this task) and `publish` (spreads `...state`, no change) are the only other `GameState` literals. Run `tsc` at Step 4 to confirm nothing else broke.

- [ ] **Step 1: Write the failing test**

Append to `src/engine/state.test.ts` (it already imports `initialState` and `* as num`; add `makeStars` to the state import):

```ts
import { makeStars } from './state';

describe('stars + Edits state (Slice 2)', () => {
  it('initial state starts with 0 Edits and every class at 1 star', () => {
    const s = initialState(0);
    expect(num.eq(s.edits, num.ZERO)).toBe(true);
    expect(s.stars.protagonist).toBe(1);
    expect(s.stars.antihero).toBe(1);
    expect(s.stars.support).toBe(1);
    expect(s.stars.debuffer).toBe(1);
    expect(s.stars.sidekick).toBe(1);
  });

  it('makeStars seeds every class at 1', () => {
    const stars = makeStars();
    expect(Object.values(stars).every((v) => v === 1)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/state.test.ts`
Expected: FAIL — `s.edits`/`s.stars`/`makeStars` do not exist.

- [ ] **Step 3: Write minimal implementation**

(a) In `src/engine/state.ts`, extend the content import to include `CLASSES`:

```ts
import { targetMaxHp, POWER_GROWTH, ClassId, findClass, CLASSES } from './content';
```

(b) Add `edits` and `stars` to the `GameState` interface (after `upgrades: Upgrades;`):

```ts
export interface GameState {
  schemaVersion: number;
  lastSaved: number;
  inspiration: Num;
  words: Num;
  royalties: Num;
  party: Character[];
  zone: ZoneState;
  currentHp: Num;
  bookComplete: boolean;
  bookNumber: number;
  upgrades: Upgrades;
  edits: Num;
  stars: Record<ClassId, number>;
}
```

(c) Add the `makeStars` helper (after `emptyUpgrades`):

```ts
// Per-class star levels, all classes seeded at 1. Derived from CLASSES so it
// can never drift out of sync with the class catalog.
export function makeStars(): Record<ClassId, number> {
  const stars = {} as Record<ClassId, number>;
  for (const c of CLASSES) stars[c.id] = 1;
  return stars;
}
```

(d) Initialize them in `initialState` (add the two fields to the returned object):

```ts
  return {
    schemaVersion: 1,
    lastSaved: nowMs,
    inspiration: ZERO,
    words: ZERO,
    royalties: ZERO,
    party: makeStartingParty(),
    zone,
    currentHp: targetMaxHp(zone.zoneIndex, zone.encounterIndex),
    bookComplete: false,
    bookNumber: 1,
    upgrades: emptyUpgrades(),
    edits: ZERO,
    stars: makeStars(),
  };
```

(e) **Stopgap** in `src/engine/save.ts` `deserialize`. Add an import of `makeStars` and `ZERO` is already imported. Change the state import line to include `makeStars`:

```ts
import { GameState, Character, Upgrades, initialState, emptyUpgrades, makeStartingParty, makeStars } from './state';
```

Then add the two fields to the object `deserialize` returns (after `upgrades: mergeUpgrades(dto.upgrades),`):

```ts
    upgrades: mergeUpgrades(dto.upgrades),
    edits: ZERO,              // STOPGAP — Task 6 reads dto.edits
    stars: makeStars(),       // STOPGAP — Task 6 reads dto.stars
```

- [ ] **Step 4: Run typecheck + full suite**

Run: `npx tsc --noEmit && npm test`
Expected: tsc clean (if it flags any other `GameState` literal beyond `save.ts`, add `edits: ZERO, stars: makeStars(),` there too). All tests PASS — existing tests are unaffected because every class starts at 1★ (multipliers = 1) and they construct state via `initialState`/spreads.

- [ ] **Step 5: Commit**

```bash
git add src/engine/state.ts src/engine/save.ts src/engine/state.test.ts
git commit -m "feat: GameState carries global Edits + per-class stars (save stopgap)"
```

---

## Task 3: Star scaling in the modifiers (`modifiers.ts`)

**Files:**
- Modify: `src/engine/modifiers.ts`
- Test: `src/engine/modifiers.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/engine/modifiers.test.ts` (it already imports from `./modifiers`, `./state`, `* as num`; add `effectiveCharacterPower` to the modifiers import and `makeCharacter` to the state import):

```ts
import { effectiveCharacterPower } from './modifiers';
import { makeCharacter } from './state';

describe('star scaling (Slice 2)', () => {
  it('a higher star raises a character\'s effective power and the party DPS', () => {
    const base = initialState(0);
    const starred = { ...base, stars: { ...base.stars, antihero: 3 } };
    const c = base.party.find((p) => p.classId === 'antihero')!;
    expect(num.gt(effectiveCharacterPower(starred, c), effectiveCharacterPower(base, c))).toBe(true);
    expect(num.gt(effectivePartyDps(starred), effectivePartyDps(base))).toBe(true);
  });

  it('effectiveCharacterPower equals raw characterPower at 1 star', () => {
    const s = initialState(0);
    const c = s.party[0];
    expect(num.eq(effectiveCharacterPower(s, c), characterPower(c))).toBe(true);
  });

  it('starring a Support amplifies its party-DPS ability', () => {
    const oneStar = {
      ...initialState(0),
      party: [makeCharacter('c0', 'protagonist'), makeCharacter('c1', 'support')],
    };
    const threeStar = { ...oneStar, stars: { ...oneStar.stars, support: 3 } };
    expect(num.gt(effectivePartyDps(threeStar), effectivePartyDps(oneStar))).toBe(true);
  });
});
```

Note: this test uses `characterPower` — add it to the `./state` import in the test if not already present (`import { initialState, characterPower, makeCharacter } from './state';`).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/modifiers.test.ts`
Expected: FAIL — `effectiveCharacterPower` is not exported.

- [ ] **Step 3: Write minimal implementation**

(a) Extend the `content` import in `modifiers.ts` to add `ClassId`, `starStatMult`, `starAbilityMult`:

```ts
import {
  RECRUIT_CAP, OFFLINE_CAP_SECONDS,
  targetInspirationRate, targetMaxHp, targetRegen, targetWords,
  baseLevelCost, baseRecruitCost,
  BOOK_SCALE, PROLIFIC_MAG, SHARP_MAG, PAGETURNER_MAG, MUSE_MAG, MUSE_FLOOR,
  FRUGAL_MAG, FRUGAL_FLOOR, NIGHT_OWL_HOURS_PER_LEVEL, GHOSTWRITER_LEVEL,
  PARTY_ABILITY_FLOOR, findClass, AbilityKind, ClassId, starStatMult, starAbilityMult,
} from './content';
```

(b) Add `effectiveCharacterPower` (place it just above `effectivePartyDps`):

```ts
// A character's power including its CLASS star multiplier (stars live on state).
export function effectiveCharacterPower(state: GameState, c: Character): Num {
  return mul(characterPower(c), n(starStatMult(state.stars[c.classId])));
}
```

(c) Change `abilitySum` to take the per-class `stars` and scale each contribution by `starAbilityMult`:

```ts
function abilitySum(party: Character[], kind: AbilityKind, stars: Record<ClassId, number>): number {
  let total = 0;
  for (const c of party) {
    const ab = findClass(c.classId).ability;
    if (ab.kind === kind) total += ab.mag * c.level * starAbilityMult(stars[c.classId]);
  }
  return total;
}
```

(d) Update the three `abilitySum` callers to pass `s.stars`:

```ts
export function effectiveInspirationRate(s: GameState, zoneIndex: number, encounterIndex: number): Num {
  const sidekickMult = 1 + abilitySum(s.party, 'inspRate', s.stars);
  return mul(
    mul(mul(targetInspirationRate(zoneIndex, encounterIndex), bookDifficulty(s)), n(prolificMult(s))),
    n(sidekickMult),
  );
}
```

```ts
export function effectiveBossRegen(s: GameState, zoneIndex: number, encounterIndex: number): Num {
  const shopReduction = 1 - museMult(s);
  const partyReduction = abilitySum(s.party, 'regenCut', s.stars);
  const combined = Math.max(PARTY_ABILITY_FLOOR, 1 - (shopReduction + partyReduction));
  return mul(mul(targetRegen(zoneIndex, encounterIndex), bookDifficulty(s)), n(combined));
}
```

(e) Rewrite `effectivePartyDps` to use `effectiveCharacterPower`, star-scale Lone Wolf, and pass `s.stars`:

```ts
export function effectivePartyDps(s: GameState): Num {
  let sum = ZERO;
  for (const c of s.party) {
    const ab = findClass(c.classId).ability;
    const selfMult = ab.kind === 'loneWolf'
      ? 1 + ab.mag * c.level * starAbilityMult(s.stars[c.classId]) // Lone Wolf amps only itself
      : 1;
    sum = add(sum, mul(effectiveCharacterPower(s, c), n(selfMult)));
  }
  const supportMult = 1 + abilitySum(s.party, 'partyDps', s.stars);
  const hasProtagonist = s.party.some((c) => c.classId === 'protagonist');
  const plotArmorMult = hasProtagonist
    ? 1 + findClass('protagonist').ability.mag * distinctClassCount(s.party)
    : 1;
  return mul(mul(mul(sum, n(sharpMult(s))), n(supportMult)), n(plotArmorMult));
}
```

(Plot Armor is intentionally NOT star-scaled — the Protagonist has no stars; its `starAbilityMult(1)` would be `1` anyway.)

- [ ] **Step 4: Run typecheck + full suite**

Run: `npx tsc --noEmit && npm test`
Expected: PASS. Existing modifier/combat/loop assertions are unchanged because at a fresh state all stars are 1 → `starStatMult(1) === 1`, `starAbilityMult(1) === 1`.

- [ ] **Step 5: Commit**

```bash
git add src/engine/modifiers.ts src/engine/modifiers.test.ts
git commit -m "feat: per-class stars scale character power + ability magnitude in modifiers"
```

---

## Task 4: Spend Edits to star up (`economy.ts`)

**Files:**
- Modify: `src/engine/economy.ts`
- Test: `src/engine/economy.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/engine/economy.test.ts` (add `starUp, canStarUp` to the `./economy` import; it already imports `initialState` and `* as num`):

```ts
import { starUp, canStarUp } from './economy';

describe('star-up (Slice 2)', () => {
  it('star up spends Edits and raises the class star', () => {
    const s = { ...initialState(0), edits: num.n('1e6') };
    const after = starUp(s, 'support');
    expect(after.stars.support).toBe(2);
    expect(num.lt(after.edits, s.edits)).toBe(true);
  });

  it('refuses the Protagonist (it grows via Royalties, not stars)', () => {
    const s = { ...initialState(0), edits: num.n('1e6') };
    expect(canStarUp(s, 'protagonist')).toBe(false);
    expect(starUp(s, 'protagonist')).toBe(s); // no-op, same reference
  });

  it('refuses past MAX_STAR and when Edits are insufficient', () => {
    const fresh = initialState(0);
    const maxed = { ...fresh, edits: num.n('1e9'), stars: { ...fresh.stars, support: 5 } };
    expect(canStarUp(maxed, 'support')).toBe(false);
    const broke = { ...fresh, edits: num.ZERO };
    expect(canStarUp(broke, 'support')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/economy.test.ts`
Expected: FAIL — `starUp`/`canStarUp` not exported.

- [ ] **Step 3: Write minimal implementation**

In `src/engine/economy.ts`, extend imports and append the two functions:

```ts
import { sub, gte } from './num';
import { GameState, makeCharacter } from './state';
import { ClassId, MAX_STAR, starUpCost } from './content';
import { effectiveLevelCost, effectiveRecruitCost, effectivePartyCap } from './modifiers';
```

```ts
export function canStarUp(state: GameState, classId: ClassId): boolean {
  if (classId === 'protagonist') return false; // Protagonist grows via Royalties (Slice 3)
  const current = state.stars[classId];
  if (current >= MAX_STAR) return false;
  return gte(state.edits, starUpCost(current));
}

export function starUp(state: GameState, classId: ClassId): GameState {
  if (!canStarUp(state, classId)) return state;
  const current = state.stars[classId];
  const cost = starUpCost(current);
  return {
    ...state,
    edits: sub(state.edits, cost),
    stars: { ...state.stars, [classId]: current + 1 },
  };
}
```

- [ ] **Step 4: Run typecheck + full suite**

Run: `npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/economy.ts src/engine/economy.test.ts
git commit -m "feat: spend global Edits to star up a class (Protagonist refused, capped at MAX_STAR)"
```

---

## Task 5: Bosses drop Edits (`progression.ts`)

**Files:**
- Modify: `src/engine/progression.ts`
- Test: `src/engine/progression.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/engine/progression.test.ts` (add `BOSS_INDEX` to the `./content` import; it already imports `onClear`, `initialState`, `* as num`):

```ts
import { BOSS_INDEX } from './content';

describe('boss Edit drops (Slice 2)', () => {
  it('clearing a boss awards Edits', () => {
    const atBoss = { ...initialState(0), zone: { zoneIndex: 0, encounterIndex: BOSS_INDEX } };
    const after = onClear(atBoss);
    expect(num.gt(after.edits, atBoss.edits)).toBe(true);
  });

  it('clearing a regular encounter awards no Edits', () => {
    const atReg = { ...initialState(0), zone: { zoneIndex: 0, encounterIndex: 0 } };
    const after = onClear(atReg);
    expect(num.eq(after.edits, atReg.edits)).toBe(true);
  });

  it('awards Edits on the final boss too (the book-complete branch)', () => {
    const finalBoss = {
      ...initialState(0),
      zone: { zoneIndex: ZONE_COUNT - 1, encounterIndex: BOSS_INDEX },
    };
    const after = onClear(finalBoss);
    expect(after.bookComplete).toBe(true);
    expect(num.gt(after.edits, finalBoss.edits)).toBe(true);
  });
});
```

Note: this uses `ZONE_COUNT` — add it to the `./content` import (`import { BOSS_INDEX, ZONE_COUNT } from './content';`). If `progression.test.ts` does not already import `initialState`, add `import { initialState } from './state';`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/progression.test.ts`
Expected: FAIL — `after.edits` does not increase (no drop wired yet).

- [ ] **Step 3: Write minimal implementation**

In `src/engine/progression.ts`, add `bossEditDrop` to the content import and award Edits once, covering both the final-boss and normal-boss branches:

```ts
import { ZONE_COUNT, isBossIndex, bossEditDrop } from './content';
```

```ts
export function onClear(state: GameState): GameState {
  const { zoneIndex, encounterIndex } = state.zone;
  const words = add(state.words, effectiveWords(state, zoneIndex, encounterIndex));
  const clearedBoss = isBossIndex(encounterIndex);
  const edits = clearedBoss ? add(state.edits, bossEditDrop(state.bookNumber)) : state.edits;

  if (clearedBoss && zoneIndex >= ZONE_COUNT - 1) {
    return { ...state, words, edits, bookComplete: true };
  }

  const nz = clearedBoss ? zoneIndex + 1 : zoneIndex;
  const ne = clearedBoss ? 0 : encounterIndex + 1;
  const advanced = { ...state, words, edits, zone: { zoneIndex: nz, encounterIndex: ne } };
  return { ...advanced, currentHp: effectiveTargetMaxHp(advanced, nz, ne) };
}
```

- [ ] **Step 4: Run typecheck + full suite**

Run: `npx tsc --noEmit && npm test`
Expected: PASS. (Edits persist across `publish` automatically — `publish` builds from `...state`.)

- [ ] **Step 5: Commit**

```bash
git add src/engine/progression.ts src/engine/progression.test.ts
git commit -m "feat: boss kills drop Edits (scaling gently with book number)"
```

---

## Task 6: Save schema v4 — persist Edits + stars (`save.ts`)

**Files:**
- Modify: `src/engine/save.ts`
- Test: `src/engine/save.test.ts`

- [ ] **Step 1: Write the failing test**

(a) Update the TWO existing version assertions in `src/engine/save.test.ts` from `3` to `4`:
- the round-trip test: `expect(back.schemaVersion).toBe(4);`
- the v1-migration test: `expect(s.schemaVersion).toBe(4);`

(b) Append new tests (the file already imports `serialize, deserialize`, `initialState`, `makeCharacter`, `* as num`):

```ts
describe('save v4: Edits + stars', () => {
  it('round-trips Edits and per-class stars', () => {
    const fresh = initialState(0);
    const s = { ...fresh, edits: num.n(42), stars: { ...fresh.stars, support: 4, debuffer: 2 } };
    const back = deserialize(serialize(s), 0);
    expect(num.eq(back.edits, num.n(42))).toBe(true);
    expect(back.stars.support).toBe(4);
    expect(back.stars.debuffer).toBe(2);
    expect(back.schemaVersion).toBe(4);
  });

  it('migrates a pre-v4 save: defaults Edits to 0 and all stars to 1, keeps progress', () => {
    const v3 = JSON.stringify({
      schemaVersion: 3, lastSaved: 0, inspiration: '500', words: '0', royalties: '9',
      party: [{ id: 'c0', name: 'The Protagonist', classId: 'protagonist', level: 2, basePower: '1' }],
      zone: { zoneIndex: 0, encounterIndex: 0 }, currentHp: '10', bookComplete: false, bookNumber: 1, upgrades: {},
    });
    const s = deserialize(v3, 0);
    expect(num.eq(s.edits, num.ZERO)).toBe(true);
    expect(s.stars.protagonist).toBe(1);
    expect(num.toNum(s.royalties)).toBe(9);
  });

  it('clamps and ignores corrupt star values', () => {
    const corrupt = JSON.stringify({
      schemaVersion: 4, lastSaved: 0, inspiration: '0', words: '0', royalties: '0',
      party: [{ id: 'c0', name: 'The Protagonist', classId: 'protagonist', level: 1, basePower: '1' }],
      zone: { zoneIndex: 0, encounterIndex: 0 }, currentHp: '10', bookComplete: false, bookNumber: 1, upgrades: {},
      edits: '5', stars: { support: 99, debuffer: -4, wizard: 3 },
    });
    const s = deserialize(corrupt, 0);
    expect(s.stars.support).toBe(5);   // clamped to MAX_STAR
    expect(s.stars.debuffer).toBe(1);  // negative -> floored up to 1
    expect((s.stars as Record<string, number>).wizard).toBeUndefined(); // unknown class ignored
    expect(num.toNum(s.edits)).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/save.test.ts`
Expected: FAIL — version is still 3 and Edits/stars are stopgapped to defaults (round-trip test fails on `support`/`edits`).

- [ ] **Step 3: Write minimal implementation**

In `src/engine/save.ts`:

(a) Bump the version constant:

```ts
export const SCHEMA_VERSION = 4;
```

(b) Add `MAX_STAR` to the content import (it already imports `ClassId, findClass, CLASSES`):

```ts
import { ClassId, findClass, CLASSES, MAX_STAR } from './content';
```

(c) Add `edits` and `stars` to the `SaveDTO` interface (after `upgrades: Upgrades;`):

```ts
  upgrades: Upgrades;
  edits: string;
  stars: Record<string, number>;
```

(d) Write them in `serialize` (add to the DTO object, after `upgrades: state.upgrades,`):

```ts
    upgrades: state.upgrades,
    edits: numToStr(state.edits),
    stars: state.stars,
```

(e) Add a `sanitizeStars` helper (place it near `mergeUpgrades`):

```ts
// Read per-class stars defensively: every class defaults to 1, values are
// clamped to [1, MAX_STAR], and unknown keys are dropped. Derived from CLASSES.
function sanitizeStars(raw: unknown): Record<ClassId, number> {
  const out = makeStars();
  if (raw && typeof raw === 'object') {
    for (const c of CLASSES) {
      const v = (raw as Record<string, unknown>)[c.id];
      if (typeof v === 'number' && Number.isFinite(v)) {
        out[c.id] = Math.max(1, Math.min(MAX_STAR, Math.floor(v)));
      }
    }
  }
  return out;
}
```

(f) Replace the Task-2 stopgap lines in the `deserialize` return with the real reads:

```ts
    upgrades: mergeUpgrades(dto.upgrades),
    edits: numOr(dto.edits, ZERO),
    stars: sanitizeStars(dto.stars),
```

- [ ] **Step 4: Run typecheck + full suite**

Run: `npx tsc --noEmit && npm test`
Expected: PASS — all save tests including migration and corruption cases.

- [ ] **Step 5: Commit**

```bash
git add src/engine/save.ts src/engine/save.test.ts
git commit -m "feat: save schema v4 persists Edits + per-class stars; migrate + sanitize older saves"
```

---

## Task 7: UI — Edits in the HUD, star pips + star-up on cards (`render.ts`, `input.ts`, `styles.css`)

**Files:**
- Modify: `src/ui/render.ts`
- Modify: `src/ui/input.ts`
- Modify: `src/styles.css`
- Test: `src/ui/render.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/ui/render.test.ts`:

```ts
import { makeCharacter } from '../engine/state';

describe('stars + Edits UI (Slice 2)', () => {
  it('shows the Edits balance in the HUD', () => {
    render({ ...initialState(0), edits: num.n(12) });
    expect(document.getElementById('hud')!.textContent).toContain('Edits');
    expect(document.getElementById('hud')!.textContent).toContain('12');
  });

  it('shows star pips and a star-up button for a non-Protagonist class, but not for the Protagonist', () => {
    render({ ...initialState(0), edits: num.n('1e6') });
    const party = document.getElementById('party')!;
    expect(party.querySelector('[data-action="starup"][data-class="antihero"]')).not.toBeNull();
    expect(party.querySelector('[data-action="starup"][data-class="protagonist"]')).toBeNull();
    expect(party.textContent).toContain('★');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/render.test.ts`
Expected: FAIL — no Edits HUD line, no `starup` button.

- [ ] **Step 3: Write minimal implementation**

(a) In `src/ui/render.ts`, extend imports:

```ts
import { GameState } from '../engine/state';
import { fmt, div, toNum } from '../engine/num';
import {
  ZONES, TARGETS_PER_BOOK,
  isBossIndex, targetName, targetEmoji, targetsClearedInBook, CLASSES, MAX_STAR, starUpCost,
} from '../engine/content';
import {
  effectivePartyDps, effectiveLevelCost, effectiveRecruitCost, effectivePartyCap,
  effectiveTargetMaxHp, effectiveBossRegen, effectiveCharacterPower,
} from '../engine/modifiers';
import { canLevel, canRecruit, canStarUp } from '../engine/economy';
```

(Note: `characterPower` is no longer imported here — the card now uses `effectiveCharacterPower`.)

(b) Add the Edits line to the HUD block (after the Royalties line):

```ts
  el('hud').innerHTML = `
    <div>Book #${state.bookNumber} — <strong>${zone.genre}</strong></div>
    <div>📜 Manuscript: ${progress}%</div>
    <div>✒️ Inspiration: <strong>${fmt(state.inspiration)}</strong></div>
    <div>📖 Words: ${fmt(state.words)}</div>
    <div>💰 Royalties: ${fmt(state.royalties)}</div>
    <div>✏️ Edits: ${fmt(state.edits)}</div>
    <div>⚔️ Party DPS: ${fmt(effectivePartyDps(state))}</div>`;
```

(c) Replace the `cards` block with a star-aware version:

```ts
  const cards = state.party
    .map((c) => {
      const stars = state.stars[c.classId];
      const isProtagonist = c.classId === 'protagonist';
      const starRow = isProtagonist
        ? '<div class="cstars">—</div>'
        : `<div class="cstars">${'★'.repeat(stars)}${'☆'.repeat(MAX_STAR - stars)}</div>`;
      const starBtn = (!isProtagonist && stars < MAX_STAR)
        ? `<button data-action="starup" data-class="${c.classId}" ${canStarUp(state, c.classId) ? '' : 'disabled'}>★ Up (✏️${fmt(starUpCost(stars))})</button>`
        : '';
      return `
      <div class="card">
        <div class="cemoji">✍️</div>
        <div class="cname">${c.name}</div>
        ${starRow}
        <div class="clevel">Lv ${c.level} · pow ${fmt(effectiveCharacterPower(state, c))}</div>
        <button data-action="level" data-id="${c.id}" ${canLevel(state, c.id) ? '' : 'disabled'}>Develop (✒️${fmt(effectiveLevelCost(state, c.level))})</button>
        ${starBtn}
      </div>`;
    })
    .join('');
```

(d) In `src/ui/input.ts`, add the `starup` branch and import `starUp`:

```ts
import { levelUp, recruit, starUp } from '../engine/economy';
```

```ts
    if (action === 'level') {
      const id = btn.getAttribute('data-id');
      if (id) setState(levelUp(getState(), id));
    } else if (action === 'recruit') {
      const classId = btn.getAttribute('data-class');
      if (classId) setState(recruit(getState(), classId as ClassId));
    } else if (action === 'starup') {
      const classId = btn.getAttribute('data-class');
      if (classId) setState(starUp(getState(), classId as ClassId));
    }
```

(e) In `src/styles.css`, append a minimal pip style (gold accent, slightly dimmed empty pips):

```css
.cstars {
  letter-spacing: 1px;
  color: #d9a441;
  font-size: 0.9rem;
  min-height: 1.1em;
}
```

- [ ] **Step 4: Run typecheck + full suite**

Run: `npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/render.ts src/ui/input.ts src/styles.css src/ui/render.test.ts
git commit -m "feat: HUD shows Edits; party cards show star pips + a star-up button"
```

---

## Task 8: Harness fields stars + tune + docs + ship

> **Controller-driven task.** The greedy-harness wiring (Steps 1–2) is a normal subagent implementation; **tuning (Step 3) and docs/ship (Steps 4–6) are done by the controller inline**, mirroring Slice 1's Task 7/8 split.

**Files:**
- Modify: `src/engine/balance.test.ts`
- Modify: `README.md`, `docs/superpowers/specs/2026-06-19-plot-armor-party-system-design.md`

- [ ] **Step 1: Extend the greedy harness to spend Edits on stars**

In `src/engine/balance.test.ts`:

(a) Add imports: `canStarUp, starUp` from `./economy`, and `MAX_STAR` from `./content` (it already imports `ClassId`).

```ts
import { levelUp, recruit, starUp, canLevel, canRecruit, canStarUp } from './economy';
```

```ts
import { ClassId, MAX_STAR } from './content';
```

(b) Add a helper that picks the lowest-starred non-Protagonist class (returns `null` when none can advance):

```ts
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
```

(c) Add a star-up branch to `spendGreedy` (Edits and Inspiration are independent currencies, so spend both each pass):

```ts
function spendGreedy(s: GameState): GameState {
  let cur = s;
  for (let guard = 0; guard < 100000; guard++) {
    const nextClass = nextRecruitClass(cur);
    if (nextClass && canRecruit(cur)) { cur = recruit(cur, nextClass); continue; }
    const starClass = lowestStarClass(cur);
    if (starClass && canStarUp(cur, starClass)) { cur = starUp(cur, starClass); continue; }
    const id = lowestLevelId(cur);
    if (canLevel(cur, id)) { cur = levelUp(cur, id); continue; }
    break;
  }
  return cur;
}
```

- [ ] **Step 2: Run the harness + full suite**

Run: `npx tsc --noEmit && npm test`
Expected: PASS — the two balance assertions (book 1 publishable < 2h; books 1–8 complete) still hold. Adding stars only makes the player stronger, so the loop closes at least as fast.

- [ ] **Step 3: Tune (controller, inline)**

Run the verbose pacing report:

```bash
BALANCE_REPORT=1 npx vitest run src/engine/balance.test.ts
```

Target: book 1 in the ~5–15 minute range, a smooth ramp, books 1–8 all complete with no wall, and Edits/stars feeling earned (not maxing all classes inside book 1, not irrelevant by book 8). Adjust the placeholders in `content.ts` if needed:
- `STAR_GROWTH` / `STAR_ABILITY_GROWTH` — how impactful a 5★ class is.
- `EDITS_BASE` / `STAR_COST_GROWTH` — how expensive stars are.
- `EDITS_PER_BOSS` / `EDIT_BOOK_GROWTH` — Edit income pace.

Re-run after each change. Commit the harness wiring + any tuning together:

```bash
git add src/engine/balance.test.ts src/engine/content.ts
git commit -m "test: harness funds stars from boss Edits; tune star/Edit economy so the loop holds"
```

- [ ] **Step 4: Live DOM smoke (controller)**

`npm run build`, then serve the built `dist/` (the `plotarmor-dist` preview config) and `preview_eval`: confirm the HUD shows an Edits line, party cards show star pips, a star-up button exists for a non-Protagonist class (none for the Protagonist), and — with Edits in state — clicking it raises the class star and Party DPS, with no console errors. (Pixel screenshots remain uncapturable in this sandbox — flag honestly; do not load PNGs into the main session.)

- [ ] **Step 5: Docs**

- `README.md` Status: note the party now has **per-class 5★ stars funded by Edits dropped from bosses** (Slice 2 of the party system); bump the test count.
- In the party-system spec, mark **Slice 2 status Implemented** (§10 bullet + the top Status line).

- [ ] **Step 6: Commit + push + report**

```bash
git add README.md docs/superpowers/specs/2026-06-19-plot-armor-party-system-design.md
git commit -m "feat: party system Slice 2 — per-class stars + Edits economy"
git push origin main
```

Report: final `npm run build` + `npm test` output, the tuned magnitudes, the greedy pacing table, and the pushed commit range. Flag the live visual/feel pass as the owner's on `npm run dev`.

---

## Self-review (completed during planning)

- **Spec coverage (§6):** per-class stars 1–5★ → Tasks 1,2,3; `starStatMult`/`starAbilityMult` on power + ability → Tasks 1,3; **global** Edit wallet → Task 2; **boss-drop only**, scaling with book → Tasks 1,5; single sink = star-up → Task 4; escalating star cost → Tasks 1,4; **Protagonist has no stars** → Tasks 4 (refused), 3/7 (no-op/UI hidden); Edits persist across publish → Task 5 (free via `...state` spread); star pips visual → Task 7; harness re-verify → Task 8. **Max-star overflow is reserved, NOT built** (spec §6) — correctly out of scope here; surplus Edits simply stop being spendable at 5★.
- **Green sequencing:** Task 2 changes the `GameState` shape; the only literal that breaks is `save.ts` `deserialize` (stopgapped in Task 2, finalized in Task 6). Every other state is built via `initialState`/spreads, and at 1★ all multipliers are 1, so Slice 1 numerics are unchanged — full suite stays green from Task 2 onward. Task 6 flips two existing `schemaVersion` assertions 3→4 (called out explicitly).
- **Placeholder honesty:** all magnitudes are explicit placeholders tuned in Task 8 against the harness.
- **No data loss:** v3→v4 migration defaults Edits to 0 and stars to 1, preserving every permanent field; corrupt/unknown star data is clamped/ignored, never crashes.
- **DRY:** `makeStars` (state) and `sanitizeStars` (save) both derive from `CLASSES`; `effectiveCharacterPower` is the single star-aware power unit used by both `effectivePartyDps` and the card UI.
- **Type consistency:** `stars: Record<ClassId, number>` is the shape everywhere; `starUpCost(currentStar)`, `bossEditDrop(bookNumber)`, `starStatMult(stars)`, `starAbilityMult(stars)`, `canStarUp(state, classId)`, `starUp(state, classId)`, `effectiveCharacterPower(state, c)` signatures are consistent across all tasks.
