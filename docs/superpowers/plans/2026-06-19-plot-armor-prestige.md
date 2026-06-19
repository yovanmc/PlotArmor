# Plot Armor Prestige Depth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Royalties into a real spend currency — a permanent upgrade catalog fed by a scaling royalty payout, with books that escalate in difficulty/size each publish — replacing v1's passive `prestigeMultiplier`.

**Architecture:** A new pure read-path module `modifiers.ts` folds *book escalation × upgrade effects* into the numbers the existing reducers read; a new `prestige.ts` holds buy/cost/affordability + the royalty faucet; the upgrade catalog + base cost curves live as static data in `content.ts`. The flat `prestigeMultiplier` is removed. Engine-only — no spend UI this pass.

**Tech Stack:** TypeScript (strict) · Vite · Vitest (jsdom) · `break_eternity.js` · `localStorage`.

---

## How to read this plan

- Spec this implements: [`docs/superpowers/specs/2026-06-19-plot-armor-prestige-design.md`](../specs/2026-06-19-plot-armor-prestige-design.md).
- All commands run from repo root `C:\Agent Projects\PlotArmor` (Windows / PowerShell). Bash tool also available.
- Commit after each task with plain `git commit` (global identity `yovanmc <yovanmc@users.noreply.github.com>` — never override per-commit).
- Run one test file: `npx vitest run src/engine/<name>.test.ts`. Run all: `npm test`.

### Sequencing principle (READ ONCE — this is why tasks are ordered as they are)

This is a **refactor**, so the suite must stay green at every milestone boundary. The strategy:

1. **M0–M2 are additive** (new constants, new fields kept *alongside* the old `prestigeMultiplier`, two new modules). Nothing old breaks.
2. **M3–M5 rewire consumers** to read the new `effective*` values. Because `effective*` at **book 1 with no upgrades == the raw v1 curve**, every existing book-1 test keeps passing. This equivalence is the core regression guard and is asserted directly in M1.
3. **M6 removes `prestigeMultiplier`** only after nothing reads it anymore, and switches `publish` to the royalty wallet.
4. **M7** is the whole-project build + full suite + push.

Per-task gate = that task's own vitest file (red → green). Each **milestone ends by running the full `npm test`** to catch cross-file breaks. Whole-project `tsc --noEmit` + `vite build` is the M7 gate (a mid-refactor whole-project tsc may be red and that is expected; do not add a per-task tsc gate during M3–M6).

### Module layering (no circular imports — verify you preserve this)

```
num  →  content  →  state  →  modifiers  →  {prestige, economy, combat, loop, progression, offline}  →  {save, render}
```

`modifiers.ts` imports only `num`, `content`, `state` (NEVER `economy`/`combat`/etc.). This is why base cost curves move into `content.ts` and `characterPower` moves into `state.ts` — so `modifiers` can read them without importing `economy`, while `economy` actions import `modifiers` one-way.

### Honesty / tuning notes

- All magnitudes/costs here are **MVP tuning constants** (concrete so the code compiles and tests are deterministic), not balance-final. They live as named constants in `content.ts` for easy iteration.
- No new external deps, no UI/browser/Windows-specific behavior introduced — nothing new needs owner-machine confirmation this pass.
- `break_eternity` `.pow()` with a fractional exponent (used once, in `royaltiesForBook` for √) goes through the library's native log-based path; the result is floored, so its minor float drift is irrelevant.

---

## File structure (created/changed across the plan)

```
src/engine/
  num.ts          (changed)  + floorN
  content.ts      (changed)  + escalation/faucet/bound constants, base cost curves, upgrade catalog
  state.ts        (changed)  + Upgrades type, emptyUpgrades, characterPower (moved in), upgrades field; makeStartingParty(level); (M6) drop prestigeMultiplier
  modifiers.ts    (NEW)      effective* read-path (book escalation × upgrade effects)
  prestige.ts     (NEW)      upgradeCost/canBuy/buyUpgrade/royaltiesForBook
  economy.ts      (changed)  actions only; read effective costs/cap; base math removed
  combat.ts       (changed)  targetInfo reads effective DPS/regen/HP
  loop.ts         (changed)  step reads effective inspiration rate
  offline.ts      (changed)  applyOffline uses effective offline cap
  progression.ts  (changed)  onClear effective words/HP; publish → royalty wallet, pre-leveled start
  save.ts         (changed)  serialize/deserialize upgrades; v1→v2 tolerant migration; drop prestigeMultiplier
  ui/render.ts    (changed)  display effective values; drop ×multiplier readout
```

---

## Milestone 0 — Additive foundation (state, content, num)

### Task 0.1: Add `floorN` to `num.ts`

**Files:**
- Modify: `src/engine/num.ts`
- Test: `src/engine/num.test.ts` (append)

- [ ] **Step 1: Append a failing test** to `src/engine/num.test.ts` (add this `it` block inside the existing `describe('num', …)`):

```ts
  it('floors to an integer magnitude', () => {
    expect(num.eq(num.floorN(num.n(5.9)), num.n(5))).toBe(true);
    expect(num.eq(num.floorN(num.n(5)), num.n(5))).toBe(true);
    expect(num.eq(num.floorN(num.n('1.99e3')), num.n(1990))).toBe(true);
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/engine/num.test.ts`
Expected: FAIL — `num.floorN is not a function`.

- [ ] **Step 3: Implement** — add to `src/engine/num.ts` (next to the other one-line wrappers, e.g. just after `strToNum`):

```ts
export const floorN = (v: Num): Num => v.floor();
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/engine/num.test.ts`
Expected: PASS (all cases incl. the new one).

- [ ] **Step 5: Commit**

```bash
git add src/engine/num.ts src/engine/num.test.ts
git commit -m "feat: add floorN to num wrapper"
```

### Task 0.2: State — `Upgrades`, `characterPower`, `upgrades` field, leveled starting party

**Files:**
- Modify: `src/engine/state.ts`
- Test: `src/engine/state.test.ts`

> Note: `prestigeMultiplier` is intentionally KEPT here (removed in M6) so the build stays green.

- [ ] **Step 1: Replace `src/engine/state.test.ts`** with (existing two cases kept, new assertions added):

```ts
// src/engine/state.test.ts
import { describe, it, expect } from 'vitest';
import * as num from './num';
import { initialState, makeStartingParty, emptyUpgrades, characterPower } from './state';
import { STARTING_PARTY_SIZE, targetMaxHp } from './content';

describe('state', () => {
  it('starts a fresh game with the right defaults', () => {
    const s = initialState(1000);
    expect(s.party.length).toBe(STARTING_PARTY_SIZE);
    expect(s.bookNumber).toBe(1);
    expect(s.bookComplete).toBe(false);
    expect(s.zone).toEqual({ zoneIndex: 0, encounterIndex: 0 });
    expect(s.lastSaved).toBe(1000);
    expect(num.eq(s.inspiration, num.ZERO)).toBe(true);
    expect(num.eq(s.royalties, num.ZERO)).toBe(true);
    expect(num.eq(s.currentHp, targetMaxHp(0, 0))).toBe(true);
    expect(s.upgrades).toEqual(emptyUpgrades());
  });

  it('starting party members are level 1 with base power 1', () => {
    const party = makeStartingParty();
    expect(party.every((c) => c.level === 1)).toBe(true);
    expect(party.every((c) => num.eq(c.basePower, num.ONE))).toBe(true);
    expect(new Set(party.map((c) => c.id)).size).toBe(party.length);
  });

  it('makeStartingParty can start the party at a higher level', () => {
    const party = makeStartingParty(5);
    expect(party.every((c) => c.level === 5)).toBe(true);
    expect(party.length).toBe(STARTING_PARTY_SIZE);
  });

  it('characterPower = basePower * level', () => {
    expect(num.toNum(characterPower({ id: 'x', name: 'X', level: 4, basePower: num.n(2) }))).toBe(8);
  });

  it('emptyUpgrades has zeroed levels and false flags', () => {
    const u = emptyUpgrades();
    expect(u.prolific).toBe(0);
    expect(u.sharpProse).toBe(0);
    expect(u.ensembleCast).toBe(false);
    expect(u.ghostwriter).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/engine/state.test.ts`
Expected: FAIL — `emptyUpgrades`/`characterPower` not exported; `makeStartingParty(5)` level wrong.

- [ ] **Step 3: Replace `src/engine/state.ts`** with:

```ts
// src/engine/state.ts
import { Num, n, mul, ZERO, ONE } from './num';
import { STARTING_PARTY_SIZE, targetMaxHp } from './content';

export interface Character {
  id: string;
  name: string;
  level: number;
  basePower: Num;
}

export interface ZoneState {
  zoneIndex: number;
  encounterIndex: number;
}

export interface Upgrades {
  // repeatable -> level counts
  prolific: number;
  sharpProse: number;
  pageTurner: number;
  muse: number;
  nightOwl: number;
  frugalDrafts: number;
  // one-time -> owned flags
  ensembleCast: boolean;
  ghostwriter: boolean;
}

export interface GameState {
  schemaVersion: number;
  lastSaved: number; // epoch ms
  inspiration: Num;
  words: Num;
  royalties: Num; // prestige wallet (spent on upgrades)
  party: Character[];
  zone: ZoneState;
  currentHp: Num;
  bookComplete: boolean;
  bookNumber: number;
  prestigeMultiplier: Num; // DEPRECATED: removed in M6 once nothing reads it
  upgrades: Upgrades;
}

export const CHARACTER_NAMES = [
  'Quill', 'Inkheart', 'Margin', 'Verse', 'Footnote', 'Epilogue', 'Prologue',
];

export function emptyUpgrades(): Upgrades {
  return {
    prolific: 0, sharpProse: 0, pageTurner: 0, muse: 0, nightOwl: 0, frugalDrafts: 0,
    ensembleCast: false, ghostwriter: false,
  };
}

export function characterPower(c: Character): Num {
  return mul(c.basePower, n(c.level));
}

export function makeStartingParty(level = 1): Character[] {
  const party: Character[] = [];
  for (let i = 0; i < STARTING_PARTY_SIZE; i++) {
    party.push({ id: `c${i}`, name: CHARACTER_NAMES[i], level, basePower: ONE });
  }
  return party;
}

export function initialState(nowMs: number): GameState {
  const zone: ZoneState = { zoneIndex: 0, encounterIndex: 0 };
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
    prestigeMultiplier: ONE,
    upgrades: emptyUpgrades(),
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/engine/state.test.ts`
Expected: PASS (5 cases).

- [ ] **Step 5: Commit**

```bash
git add src/engine/state.ts src/engine/state.test.ts
git commit -m "feat: add Upgrades, characterPower, leveled starting party to state"
```

### Task 0.3: Content — escalation/faucet/bound constants, base cost curves, upgrade catalog

**Files:**
- Modify: `src/engine/content.ts`
- Test: `src/engine/content.test.ts` (append)

> These are all ADDITIONS. Do not change existing exports. `baseLevelCost`/`baseRecruitCost` are the same curves v1 had in `economy.ts`; they move here so `modifiers` can read them without importing `economy`.

- [ ] **Step 1: Append failing tests** to `src/engine/content.test.ts` (new `describe` block at end of file):

```ts
describe('content: prestige catalog & costs', () => {
  it('exposes 6 repeatable upgrades and 2 one-time unlocks', () => {
    expect(C.REPEATABLE_UPGRADES.length).toBe(6);
    expect(C.ONE_TIME_UPGRADES.length).toBe(2);
  });

  it('findUpgrade returns a def by id and throws on unknown', () => {
    expect(C.findUpgrade('prolific').kind).toBe('repeatable');
    expect(C.findUpgrade('ensembleCast').kind).toBe('oneTime');
    expect(() => C.findUpgrade('nope' as C.UpgradeId)).toThrow();
  });

  it('base spend costs grow with level / party size', () => {
    expect(num.gt(C.baseLevelCost(2), C.baseLevelCost(1))).toBe(true);
    expect(num.gt(C.baseRecruitCost(3), C.baseRecruitCost(2))).toBe(true);
  });

  it('book escalation constant is > 1', () => {
    expect(C.BOOK_SCALE).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/engine/content.test.ts`
Expected: FAIL — `REPEATABLE_UPGRADES`/`findUpgrade`/`baseLevelCost` undefined.

- [ ] **Step 3: Append to `src/engine/content.ts`** (after the existing exports; the existing `import { Num, n, mul, pow, ZERO } from './num';` already covers what's used here):

```ts
// ---------------------------------------------------------------------------
// Prestige depth (v2): escalation, royalty faucet, upgrade bounds — ALL tunable
// ---------------------------------------------------------------------------

export const BOOK_SCALE = 3;        // per-book difficulty/size growth; D(b) = BOOK_SCALE^(b-1)
export const ROYALTY_K = n(1);      // royalty payout coefficient
export const ROYALTY_W0 = n(10000); // royalty payout divisor (manuscript scale)

export const PROLIFIC_MAG = 0.10;   // +10% inspiration rate per level
export const SHARP_MAG = 0.10;      // +10% party DPS per level
export const PAGETURNER_MAG = 0.10; // +10% words per clear per level
export const MUSE_MAG = 0.05;       // -5% boss regen per level
export const MUSE_FLOOR = 0.10;     // regen multiplier floor (>=10% of base; max 90% reduction)
export const FRUGAL_MAG = 0.05;     // -5% spend costs per level
export const FRUGAL_FLOOR = 0.25;   // cost multiplier floor (>=25% of base; max 75% reduction)
export const NIGHT_OWL_HOURS_PER_LEVEL = 2; // +2h offline cap per level
export const GHOSTWRITER_LEVEL = 5; // pre-leveled new-book start when owned

// --- base spend-cost curves (the project's level/recruit cost curves) ---
const LEVEL_BASE_COST = n(10);
const LEVEL_COST_GROWTH = 1.5;
const RECRUIT_BASE_COST = n(100);
const RECRUIT_COST_GROWTH = 6;

export function baseLevelCost(level: number): Num {
  return mul(LEVEL_BASE_COST, pow(n(LEVEL_COST_GROWTH), level - 1));
}

export function baseRecruitCost(partySize: number): Num {
  return mul(RECRUIT_BASE_COST, pow(n(RECRUIT_COST_GROWTH), partySize - 2));
}

// --- upgrade catalog (static data) ---
export type RepeatableUpgradeId =
  | 'prolific' | 'sharpProse' | 'pageTurner' | 'muse' | 'nightOwl' | 'frugalDrafts';
export type OneTimeUpgradeId = 'ensembleCast' | 'ghostwriter';
export type UpgradeId = RepeatableUpgradeId | OneTimeUpgradeId;

export interface RepeatableUpgradeDef {
  id: RepeatableUpgradeId;
  kind: 'repeatable';
  name: string;
  desc: string;
  baseCost: Num;
  costGrowth: number;
}
export interface OneTimeUpgradeDef {
  id: OneTimeUpgradeId;
  kind: 'oneTime';
  name: string;
  desc: string;
  cost: Num;
}
export type UpgradeDef = RepeatableUpgradeDef | OneTimeUpgradeDef;

export const REPEATABLE_UPGRADES: RepeatableUpgradeDef[] = [
  { id: 'prolific', kind: 'repeatable', name: 'Prolific', desc: '+10% Inspiration rate per level', baseCost: n(3), costGrowth: 2 },
  { id: 'sharpProse', kind: 'repeatable', name: 'Sharp Prose', desc: '+10% party DPS per level', baseCost: n(3), costGrowth: 2 },
  { id: 'pageTurner', kind: 'repeatable', name: 'Page-Turner', desc: '+10% Words per clear per level', baseCost: n(5), costGrowth: 2 },
  { id: 'muse', kind: 'repeatable', name: 'Muse', desc: '-5% boss regen per level (max 90%)', baseCost: n(4), costGrowth: 2 },
  { id: 'nightOwl', kind: 'repeatable', name: 'Night Owl', desc: '+2h offline cap per level', baseCost: n(2), costGrowth: 2 },
  { id: 'frugalDrafts', kind: 'repeatable', name: 'Frugal Drafts', desc: '-5% level/recruit costs per level (max 75%)', baseCost: n(3), costGrowth: 2 },
];

export const ONE_TIME_UPGRADES: OneTimeUpgradeDef[] = [
  { id: 'ensembleCast', kind: 'oneTime', name: 'Ensemble Cast', desc: 'Party cap 5 -> 6', cost: n(25) },
  { id: 'ghostwriter', kind: 'oneTime', name: 'Ghostwriter', desc: 'Start each new book at level 5', cost: n(15) },
];

export function findUpgrade(id: UpgradeId): UpgradeDef {
  const all: UpgradeDef[] = [...REPEATABLE_UPGRADES, ...ONE_TIME_UPGRADES];
  const def = all.find((u) => u.id === id);
  if (!def) throw new Error(`Unknown upgrade: ${id}`);
  return def;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/engine/content.test.ts`
Expected: PASS (existing 6 + new 4).

- [ ] **Step 5: Run the full suite (milestone boundary)**

Run: `npm test`
Expected: PASS — all files green (additive milestone; nothing old broke).

- [ ] **Step 6: Commit**

```bash
git add src/engine/content.ts src/engine/content.test.ts
git commit -m "feat: add prestige constants, base cost curves, and upgrade catalog to content"
```

---

## Milestone 1 — `modifiers.ts` (the effective\* read-path) + parity guard

### Task 1.1: Effective-value layer with book-1 parity

**Files:**
- Create: `src/engine/modifiers.ts`
- Test: `src/engine/modifiers.test.ts`

- [ ] **Step 1: Write the failing test** `src/engine/modifiers.test.ts`:

```ts
// src/engine/modifiers.test.ts
import { describe, it, expect } from 'vitest';
import * as num from './num';
import { initialState, emptyUpgrades } from './state';
import {
  BOSS_INDEX, OFFLINE_CAP_SECONDS, RECRUIT_CAP, GHOSTWRITER_LEVEL, BOOK_SCALE,
  NIGHT_OWL_HOURS_PER_LEVEL, MUSE_FLOOR, FRUGAL_FLOOR,
  targetInspirationRate, targetMaxHp, targetRegen, targetWords, baseLevelCost, baseRecruitCost,
} from './content';
import * as M from './modifiers';

describe('modifiers: book-1, no-upgrades PARITY with raw v1 curves', () => {
  const s = initialState(0); // bookNumber 1, empty upgrades, party of 2 level-1 basePower-1

  it('bookDifficulty is 1 at book 1', () => {
    expect(num.toNum(M.bookDifficulty(s))).toBe(1);
  });
  it('HP / regen / words / inspiration-rate equal the raw curves', () => {
    expect(num.eq(M.effectiveTargetMaxHp(s, 0, 1), targetMaxHp(0, 1))).toBe(true);
    expect(num.eq(M.effectiveBossRegen(s, 0, BOSS_INDEX), targetRegen(0, BOSS_INDEX))).toBe(true);
    expect(num.eq(M.effectiveWords(s, 0, 0), targetWords(0, 0))).toBe(true);
    expect(num.eq(M.effectiveInspirationRate(s, 0, 0), targetInspirationRate(0, 0))).toBe(true);
  });
  it('party DPS equals sum of power (2) and costs equal base curves', () => {
    expect(num.toNum(M.effectivePartyDps(s))).toBe(2);
    expect(num.eq(M.effectiveLevelCost(s, 1), baseLevelCost(1))).toBe(true);
    expect(num.eq(M.effectiveRecruitCost(s, 2), baseRecruitCost(2))).toBe(true);
  });
  it('party cap / offline cap / starting level match v1 defaults', () => {
    expect(M.effectivePartyCap(s)).toBe(RECRUIT_CAP);
    expect(M.effectiveOfflineCap(s)).toBe(OFFLINE_CAP_SECONDS);
    expect(M.startingPartyLevel(s)).toBe(1);
  });
});

describe('modifiers: escalation and upgrade effects', () => {
  it('bookDifficulty scales by BOOK_SCALE and lifts enemy curves', () => {
    const b2 = { ...initialState(0), bookNumber: 2 };
    expect(num.toNum(M.bookDifficulty(b2))).toBe(BOOK_SCALE);
    expect(num.eq(M.effectiveTargetMaxHp(b2, 0, 1), num.mul(targetMaxHp(0, 1), num.n(BOOK_SCALE)))).toBe(true);
    expect(num.gt(M.effectiveWords(b2, 0, 0), targetWords(0, 0))).toBe(true);
  });
  it('sharpProse multiplies DPS; prolific multiplies inspiration rate', () => {
    const s = { ...initialState(0), upgrades: { ...emptyUpgrades(), sharpProse: 5, prolific: 10 } };
    expect(num.toNum(M.effectivePartyDps(s))).toBeCloseTo(2 * 1.5, 6);     // +10%*5
    expect(num.toNum(M.effectiveInspirationRate(s, 0, 0))).toBeCloseTo(num.toNum(targetInspirationRate(0, 0)) * 2, 6); // +10%*10
  });
  it('muse and frugalDrafts reductions are clamped to their floors', () => {
    const s = { ...initialState(0), upgrades: { ...emptyUpgrades(), muse: 100, frugalDrafts: 100 } };
    expect(num.toNum(M.effectiveBossRegen(s, 0, BOSS_INDEX)))
      .toBeCloseTo(num.toNum(targetRegen(0, BOSS_INDEX)) * MUSE_FLOOR, 6);
    expect(num.toNum(M.effectiveLevelCost(s, 1))).toBeCloseTo(num.toNum(baseLevelCost(1)) * FRUGAL_FLOOR, 6);
  });
  it('one-time unlocks raise cap / offline / starting level', () => {
    const s = { ...initialState(0), upgrades: { ...emptyUpgrades(), ensembleCast: true, ghostwriter: true, nightOwl: 3 } };
    expect(M.effectivePartyCap(s)).toBe(RECRUIT_CAP + 1);
    expect(M.effectiveOfflineCap(s)).toBe(OFFLINE_CAP_SECONDS + 3 * NIGHT_OWL_HOURS_PER_LEVEL * 3600);
    expect(M.startingPartyLevel(s)).toBe(GHOSTWRITER_LEVEL);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/engine/modifiers.test.ts`
Expected: FAIL — cannot resolve `./modifiers`.

- [ ] **Step 3: Write the implementation** `src/engine/modifiers.ts`:

```ts
// src/engine/modifiers.ts
import { Num, n, add, mul, pow, ZERO } from './num';
import { GameState, characterPower } from './state';
import {
  RECRUIT_CAP, OFFLINE_CAP_SECONDS,
  targetInspirationRate, targetMaxHp, targetRegen, targetWords,
  baseLevelCost, baseRecruitCost,
  BOOK_SCALE, PROLIFIC_MAG, SHARP_MAG, PAGETURNER_MAG, MUSE_MAG, MUSE_FLOOR,
  FRUGAL_MAG, FRUGAL_FLOOR, NIGHT_OWL_HOURS_PER_LEVEL, GHOSTWRITER_LEVEL,
} from './content';

// Per-book difficulty/size factor D(b) = BOOK_SCALE^(b-1). D(1) = 1 (book 1 == v1).
export function bookDifficulty(state: GameState): Num {
  return pow(n(BOOK_SCALE), state.bookNumber - 1);
}

const prolificMult = (s: GameState): number => 1 + PROLIFIC_MAG * s.upgrades.prolific;
const sharpMult = (s: GameState): number => 1 + SHARP_MAG * s.upgrades.sharpProse;
const pageTurnerMult = (s: GameState): number => 1 + PAGETURNER_MAG * s.upgrades.pageTurner;
const museMult = (s: GameState): number => Math.max(MUSE_FLOOR, 1 - MUSE_MAG * s.upgrades.muse);
const frugalMult = (s: GameState): number => Math.max(FRUGAL_FLOOR, 1 - FRUGAL_MAG * s.upgrades.frugalDrafts);

export function effectiveInspirationRate(s: GameState, zoneIndex: number, encounterIndex: number): Num {
  return mul(mul(targetInspirationRate(zoneIndex, encounterIndex), bookDifficulty(s)), n(prolificMult(s)));
}

export function effectiveTargetMaxHp(s: GameState, zoneIndex: number, encounterIndex: number): Num {
  return mul(targetMaxHp(zoneIndex, encounterIndex), bookDifficulty(s));
}

export function effectiveBossRegen(s: GameState, zoneIndex: number, encounterIndex: number): Num {
  return mul(mul(targetRegen(zoneIndex, encounterIndex), bookDifficulty(s)), n(museMult(s)));
}

export function effectiveWords(s: GameState, zoneIndex: number, encounterIndex: number): Num {
  return mul(mul(targetWords(zoneIndex, encounterIndex), bookDifficulty(s)), n(pageTurnerMult(s)));
}

export function effectivePartyDps(s: GameState): Num {
  let sum = ZERO;
  for (const c of s.party) sum = add(sum, characterPower(c));
  return mul(sum, n(sharpMult(s)));
}

export function effectiveLevelCost(s: GameState, level: number): Num {
  return mul(baseLevelCost(level), n(frugalMult(s)));
}

export function effectiveRecruitCost(s: GameState, partySize: number): Num {
  return mul(baseRecruitCost(partySize), n(frugalMult(s)));
}

export function effectivePartyCap(s: GameState): number {
  return RECRUIT_CAP + (s.upgrades.ensembleCast ? 1 : 0);
}

export function effectiveOfflineCap(s: GameState): number {
  return OFFLINE_CAP_SECONDS + s.upgrades.nightOwl * NIGHT_OWL_HOURS_PER_LEVEL * 3600;
}

export function startingPartyLevel(s: GameState): number {
  return s.upgrades.ghostwriter ? GHOSTWRITER_LEVEL : 1;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/engine/modifiers.test.ts`
Expected: PASS (3 + 4 cases). If a `toBeCloseTo` parity case fails, the bug is in `modifiers.ts` math — fix there only; do NOT change the asserted v1 curve values.

- [ ] **Step 5: Full suite + commit**

```bash
npm test
git add src/engine/modifiers.ts src/engine/modifiers.test.ts
git commit -m "feat: add modifiers (effective values: book escalation x upgrades) with book-1 parity"
```

---

## Milestone 2 — `prestige.ts` (buy logic + royalty faucet)

### Task 2.1: Upgrade cost / affordability / purchase + `royaltiesForBook`

**Files:**
- Create: `src/engine/prestige.ts`
- Test: `src/engine/prestige.test.ts`

- [ ] **Step 1: Write the failing test** `src/engine/prestige.test.ts`:

```ts
// src/engine/prestige.test.ts
import { describe, it, expect } from 'vitest';
import * as num from './num';
import { initialState, emptyUpgrades } from './state';
import * as P from './prestige';

const rich = () => ({ ...initialState(0), royalties: num.n(1000) });

describe('prestige: costs', () => {
  it('repeatable cost grows geometrically with current level', () => {
    const s0 = rich();
    const s1 = { ...s0, upgrades: { ...emptyUpgrades(), prolific: 1 } };
    expect(num.gt(P.upgradeCost(s1, 'prolific'), P.upgradeCost(s0, 'prolific'))).toBe(true);
  });
  it('one-time cost is the fixed catalog cost', () => {
    expect(num.eq(P.upgradeCost(rich(), 'ghostwriter'), num.n(15))).toBe(true);
  });
});

describe('prestige: canBuy / buyUpgrade', () => {
  it('buys a repeatable upgrade: spends royalties, increments level', () => {
    const s = rich();
    const cost = P.upgradeCost(s, 'prolific');
    const next = P.buyUpgrade(s, 'prolific');
    expect(next.upgrades.prolific).toBe(1);
    expect(num.eq(next.royalties, num.sub(num.n(1000), cost))).toBe(true);
  });
  it('buys a one-time unlock: sets the flag, cannot be bought twice', () => {
    const s = P.buyUpgrade(rich(), 'ensembleCast');
    expect(s.upgrades.ensembleCast).toBe(true);
    expect(P.canBuy(s, 'ensembleCast')).toBe(false);
    expect(P.buyUpgrade(s, 'ensembleCast')).toBe(s); // no-op, same ref
  });
  it('is a no-op (same ref) when unaffordable', () => {
    const broke = { ...initialState(0), royalties: num.ZERO };
    expect(P.canBuy(broke, 'prolific')).toBe(false);
    expect(P.buyUpgrade(broke, 'prolific')).toBe(broke);
  });
});

describe('prestige: royaltiesForBook faucet', () => {
  it('is monotonic in manuscript size with a floor of 1', () => {
    expect(num.eq(P.royaltiesForBook(num.ZERO), num.ONE)).toBe(true);
    expect(num.gte(P.royaltiesForBook(num.n('1e6')), P.royaltiesForBook(num.n('1e4')))).toBe(true);
    expect(num.gt(P.royaltiesForBook(num.n('1e8')), num.ONE)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/engine/prestige.test.ts`
Expected: FAIL — cannot resolve `./prestige`.

- [ ] **Step 3: Write the implementation** `src/engine/prestige.ts`:

```ts
// src/engine/prestige.ts
import { Num, n, ONE, sub, mul, div, pow, gte, maxN, floorN } from './num';
import { GameState } from './state';
import { findUpgrade, UpgradeId, ROYALTY_K, ROYALTY_W0 } from './content';

export function upgradeCost(state: GameState, id: UpgradeId): Num {
  const def = findUpgrade(id);
  if (def.kind === 'oneTime') return def.cost;
  const level = state.upgrades[def.id]; // repeatable -> current level (number)
  return mul(def.baseCost, pow(n(def.costGrowth), level));
}

export function isOwned(state: GameState, id: UpgradeId): boolean {
  const def = findUpgrade(id);
  return def.kind === 'oneTime' ? state.upgrades[def.id] === true : false;
}

export function canBuy(state: GameState, id: UpgradeId): boolean {
  if (isOwned(state, id)) return false;
  return gte(state.royalties, upgradeCost(state, id));
}

export function buyUpgrade(state: GameState, id: UpgradeId): GameState {
  if (!canBuy(state, id)) return state;
  const def = findUpgrade(id);
  const royalties = sub(state.royalties, upgradeCost(state, id));
  if (def.kind === 'oneTime') {
    return { ...state, royalties, upgrades: { ...state.upgrades, [def.id]: true } };
  }
  return { ...state, royalties, upgrades: { ...state.upgrades, [def.id]: state.upgrades[def.id] + 1 } };
}

// Royalty payout for publishing a book: floor(K * sqrt(words / W0)), minimum 1.
export function royaltiesForBook(wordsThisBook: Num): Num {
  const root = pow(div(wordsThisBook, ROYALTY_W0), 0.5); // sqrt via fractional pow
  return maxN(floorN(mul(ROYALTY_K, root)), ONE);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/engine/prestige.test.ts`
Expected: PASS (2 + 3 + 1 cases).

- [ ] **Step 5: Full suite + commit**

```bash
npm test
git add src/engine/prestige.ts src/engine/prestige.test.ts
git commit -m "feat: add prestige buy logic and scaling royalty faucet"
```

---

## Milestone 3 — Rewire combat / loop / offline to read `effective*`

> These read effective values. At book 1 with no upgrades `effective* == base`, so `combat.test`/`loop.test` are UNCHANGED and stay green. Only `offline.test` changes (the `offlineSeconds` signature gains a `capSeconds` arg).

### Task 3.1: `combat.ts` reads effective DPS / regen / HP

**Files:**
- Modify: `src/engine/combat.ts` (replace whole file)

- [ ] **Step 1: Confirm the existing test still describes desired behavior** — `combat.test.ts` is unchanged. Run it now to see current state:

Run: `npx vitest run src/engine/combat.test.ts`
Expected: PASS (4 cases) against the current implementation.

- [ ] **Step 2: Replace `src/engine/combat.ts`** with (now sourcing values from `modifiers`):

```ts
// src/engine/combat.ts
import { Num, n, ZERO, sub, mul, div, gt, minN } from './num';
import { GameState } from './state';
import { isBossIndex } from './content';
import { effectivePartyDps, effectiveBossRegen, effectiveTargetMaxHp } from './modifiers';

export interface TargetInfo {
  maxHp: Num;
  regen: Num;
  isBoss: boolean;
  netDps: Num; // effectivePartyDps - regen
}

export function targetInfo(state: GameState): TargetInfo {
  const { zoneIndex, encounterIndex } = state.zone;
  const regen = effectiveBossRegen(state, zoneIndex, encounterIndex);
  return {
    maxHp: effectiveTargetMaxHp(state, zoneIndex, encounterIndex),
    regen,
    isBoss: isBossIndex(encounterIndex),
    netDps: sub(effectivePartyDps(state), regen),
  };
}

export interface AdvanceResult {
  hp: Num;
  cleared: boolean;
  timeUsed: number;
}

// Apply up to `dt` seconds of combat to the current target (unchanged logic).
export function advanceTarget(currentHp: Num, info: TargetInfo, dt: number): AdvanceResult {
  if (gt(info.netDps, ZERO)) {
    const ttc = div(currentHp, info.netDps).toNumber();
    if (ttc <= dt) {
      return { hp: ZERO, cleared: true, timeUsed: ttc };
    }
    return { hp: sub(currentHp, mul(info.netDps, n(dt))), cleared: false, timeUsed: dt };
  }
  const regened = sub(currentHp, mul(info.netDps, n(dt))); // subtracting non-positive => increase
  return { hp: minN(regened, info.maxHp), cleared: false, timeUsed: dt };
}
```

- [ ] **Step 3: Run to verify it passes**

Run: `npx vitest run src/engine/combat.test.ts`
Expected: PASS (4 cases — book-1 parity holds).

- [ ] **Step 4: Commit**

```bash
git add src/engine/combat.ts
git commit -m "refactor: combat reads effective DPS/regen/HP from modifiers"
```

### Task 3.2: `loop.ts` reads effective inspiration rate

**Files:**
- Modify: `src/engine/loop.ts` (replace whole file)

- [ ] **Step 1: Replace `src/engine/loop.ts`** with:

```ts
// src/engine/loop.ts
import { n, add, mul } from './num';
import { GameState } from './state';
import { OFFLINE_MAX_ITERS } from './content';
import { effectiveInspirationRate } from './modifiers';
import { targetInfo, advanceTarget } from './combat';
import { onClear } from './progression';

export interface StepResult {
  state: GameState;
  clears: number;
  cappedOut: boolean;
}

export function step(state: GameState, dt: number): StepResult {
  let s = state;
  let remaining = dt;
  let clears = 0;
  let iters = 0;
  let cappedOut = false;

  while (remaining > 1e-9 && !s.bookComplete) {
    if (iters++ >= OFFLINE_MAX_ITERS) {
      cappedOut = true;
      break;
    }
    const info = targetInfo(s);
    const rate = effectiveInspirationRate(s, s.zone.zoneIndex, s.zone.encounterIndex);
    const res = advanceTarget(s.currentHp, info, remaining);

    s = {
      ...s,
      inspiration: add(s.inspiration, mul(rate, n(res.timeUsed))),
      currentHp: res.hp,
    };
    remaining -= res.timeUsed;

    if (res.cleared) {
      s = onClear(s);
      clears++;
    } else {
      break;
    }
  }

  return { state: s, clears, cappedOut };
}
```

- [ ] **Step 2: Run to verify it passes** (test unchanged)

Run: `npx vitest run src/engine/loop.test.ts`
Expected: PASS (4 cases — book-1 parity).

- [ ] **Step 3: Commit**

```bash
git add src/engine/loop.ts
git commit -m "refactor: loop reads effective inspiration rate from modifiers"
```

### Task 3.3: `offline.ts` uses the effective offline cap

**Files:**
- Modify: `src/engine/offline.ts` (replace whole file)
- Test: `src/engine/offline.test.ts` (update `offlineSeconds` calls — signature gains `capSeconds`)

- [ ] **Step 1: Replace `src/engine/offline.test.ts`** with (3 `offlineSeconds` calls now pass the cap explicitly; `applyOffline` cases unchanged):

```ts
// src/engine/offline.test.ts
import { describe, it, expect } from 'vitest';
import * as num from './num';
import { initialState } from './state';
import { offlineSeconds, applyOffline } from './offline';
import { OFFLINE_CAP_SECONDS } from './content';

describe('offline', () => {
  it('computes elapsed seconds', () => {
    expect(offlineSeconds(60_000, 0, OFFLINE_CAP_SECONDS)).toBe(60);
  });

  it('clamps to the supplied cap', () => {
    const huge = OFFLINE_CAP_SECONDS * 1000 * 5;
    expect(offlineSeconds(huge, 0, OFFLINE_CAP_SECONDS)).toBe(OFFLINE_CAP_SECONDS);
  });

  it('guards against a rewound clock (lastSaved in the future)', () => {
    expect(offlineSeconds(0, 10_000, OFFLINE_CAP_SECONDS)).toBe(0);
  });

  it('applyOffline accrues resources and updates lastSaved', () => {
    const s = { ...initialState(0), lastSaved: 0 };
    const { state, summary } = applyOffline(s, 3_600_000); // 1 hour
    expect(summary.seconds).toBe(3600);
    expect(num.gt(state.inspiration, num.ZERO)).toBe(true);
    expect(state.lastSaved).toBe(3_600_000);
    expect(num.eq(summary.inspirationGained, state.inspiration)).toBe(true);
  });

  it('applyOffline with no elapsed time only bumps lastSaved', () => {
    const s = { ...initialState(0), lastSaved: 5000 };
    const { state, summary } = applyOffline(s, 4000); // clock went backwards
    expect(summary.seconds).toBe(0);
    expect(num.eq(state.inspiration, num.ZERO)).toBe(true);
    expect(state.lastSaved).toBe(4000);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/engine/offline.test.ts`
Expected: FAIL — `offlineSeconds` currently takes 2 args; the 3-arg calls/type mismatch (or wrong clamp) fail.

- [ ] **Step 3: Replace `src/engine/offline.ts`** with:

```ts
// src/engine/offline.ts
import { Num, ZERO, sub } from './num';
import { GameState } from './state';
import { step } from './loop';
import { effectiveOfflineCap } from './modifiers';

export function offlineSeconds(nowMs: number, lastSavedMs: number, capSeconds: number): number {
  const raw = (nowMs - lastSavedMs) / 1000;
  if (!Number.isFinite(raw) || raw <= 0) return 0; // rewound/zero/invalid
  return Math.min(raw, capSeconds);
}

export interface OfflineSummary {
  seconds: number;
  inspirationGained: Num;
  wordsGained: Num;
  clears: number;
  cappedOut: boolean;
}

export function applyOffline(
  state: GameState,
  nowMs: number,
): { state: GameState; summary: OfflineSummary } {
  const seconds = offlineSeconds(nowMs, state.lastSaved, effectiveOfflineCap(state));
  if (seconds === 0) {
    return {
      state: { ...state, lastSaved: nowMs },
      summary: { seconds: 0, inspirationGained: ZERO, wordsGained: ZERO, clears: 0, cappedOut: false },
    };
  }
  const before = state;
  const res = step(state, seconds);
  return {
    state: { ...res.state, lastSaved: nowMs },
    summary: {
      seconds,
      inspirationGained: sub(res.state.inspiration, before.inspiration),
      wordsGained: sub(res.state.words, before.words),
      clears: res.clears,
      cappedOut: res.cappedOut,
    },
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/engine/offline.test.ts`
Expected: PASS (5 cases).

- [ ] **Step 5: Full suite (milestone boundary) + commit**

```bash
npm test
git add src/engine/offline.ts src/engine/offline.test.ts
git commit -m "refactor: offline uses effective offline cap; offlineSeconds takes capSeconds"
```

---

## Milestone 4 — Rewire `render.ts` to display effective values

### Task 4.1: Render reads effective DPS/HP/regen/costs/cap; drop the ×multiplier readout

**Files:**
- Modify: `src/engine/../ui/render.ts` (path: `src/ui/render.ts`, replace whole file)

> `render.test.ts` is unchanged (it asserts book-1 text presence + publish-button visibility). After this task, `render` no longer imports `partyDps`/`levelCost`/`recruitCost`/`characterPower`/`RECRUIT_CAP` from `economy`/`content` — it uses `modifiers` + `state`. `economy` still exports its base math until M5; nothing breaks.

- [ ] **Step 1: Replace `src/ui/render.ts`** with:

```ts
// src/ui/render.ts
import { GameState, characterPower } from '../engine/state';
import { fmt, div, toNum } from '../engine/num';
import {
  ZONES, TARGETS_PER_BOOK,
  isBossIndex, targetName, targetEmoji, targetsClearedInBook,
} from '../engine/content';
import {
  effectivePartyDps, effectiveLevelCost, effectiveRecruitCost, effectivePartyCap,
  effectiveTargetMaxHp, effectiveBossRegen,
} from '../engine/modifiers';
import { canLevel, canRecruit } from '../engine/economy';

function el(id: string): HTMLElement {
  return document.getElementById(id)!;
}

export function render(state: GameState): void {
  const { zoneIndex, encounterIndex } = state.zone;
  const zone = ZONES[zoneIndex];
  document.body.style.setProperty('--bg', zone.bg);
  document.body.style.setProperty('--accent', zone.accent);

  const maxHp = effectiveTargetMaxHp(state, zoneIndex, encounterIndex);
  const hpPct = Math.max(0, Math.min(100, toNum(div(state.currentHp, maxHp)) * 100));
  const isBoss = isBossIndex(encounterIndex);
  const progress = state.bookComplete
    ? 100
    : Math.round((targetsClearedInBook(zoneIndex, encounterIndex) / TARGETS_PER_BOOK) * 100);

  el('hud').innerHTML = `
    <div>Book #${state.bookNumber} — <strong>${zone.genre}</strong></div>
    <div>📜 Manuscript: ${progress}%</div>
    <div>✒️ Inspiration: <strong>${fmt(state.inspiration)}</strong></div>
    <div>📖 Words: ${fmt(state.words)}</div>
    <div>💰 Royalties: ${fmt(state.royalties)}</div>
    <div>⚔️ Party DPS: ${fmt(effectivePartyDps(state))}</div>`;

  el('enemy').innerHTML = `
    <div class="enemy-emoji">${targetEmoji(zoneIndex, encounterIndex)}</div>
    <div class="enemy-name">${targetName(zoneIndex, encounterIndex)} ${isBoss ? '<span class="boss-tag">BOSS</span>' : ''}</div>
    <div class="hpbar"><div class="hpfill" style="width:${hpPct}%"></div></div>
    <div class="hptext">${fmt(state.currentHp)} / ${fmt(maxHp)} HP${isBoss ? ` · regen ${fmt(effectiveBossRegen(state, zoneIndex, encounterIndex))}/s` : ''}</div>`;

  const cards = state.party
    .map(
      (c) => `
      <div class="card">
        <div class="cemoji">✍️</div>
        <div class="cname">${c.name}</div>
        <div class="clevel">Lv ${c.level} · pow ${fmt(characterPower(c))}</div>
        <button data-action="level" data-id="${c.id}" ${canLevel(state, c.id) ? '' : 'disabled'}>Develop (✒️${fmt(effectiveLevelCost(state, c.level))})</button>
      </div>`,
    )
    .join('');
  const recruitCard =
    state.party.length < effectivePartyCap(state)
      ? `<div class="card recruit"><div class="cemoji">➕</div><button data-action="recruit" ${canRecruit(state) ? '' : 'disabled'}>Introduce character (✒️${fmt(effectiveRecruitCost(state, state.party.length))})</button></div>`
      : '';
  el('party').innerHTML = cards + recruitCard;

  el('publish').style.display = state.bookComplete ? 'block' : 'none';
}
```

- [ ] **Step 2: Run to verify it passes**

Run: `npx vitest run src/ui/render.test.ts`
Expected: PASS (2 cases).

- [ ] **Step 3: Full suite (milestone boundary) + commit**

```bash
npm test
git add src/ui/render.ts
git commit -m "refactor: render displays effective values; drop prestige-multiplier readout"
```

---

## Milestone 5 — Rewire `economy.ts` actions; remove relocated base math

> After M3 (combat→modifiers) and M4 (render→modifiers/state), nothing imports `economy`'s base math (`partyDps`/`levelCost`/`recruitCost`/`characterPower`) anymore — only its actions (`canLevel`/`levelUp`/`canRecruit`/`recruit`, used by render + input). This task slims `economy` to actions that charge the **effective** cost / honor the **effective** cap. The DPS test moves to `modifiers.test` (already covered there).

### Task 5.1: `economy.ts` = actions only, reading `modifiers`

**Files:**
- Modify: `src/engine/economy.ts` (replace whole file)
- Test: `src/engine/economy.test.ts` (replace whole file)

- [ ] **Step 1: Replace `src/engine/economy.test.ts`** with:

```ts
// src/engine/economy.test.ts
import { describe, it, expect } from 'vitest';
import * as num from './num';
import { initialState, emptyUpgrades } from './state';
import * as eco from './economy';
import { baseLevelCost, RECRUIT_CAP } from './content';

describe('economy actions', () => {
  it('levelUp spends the (effective) cost and raises level when affordable', () => {
    const s = { ...initialState(0), inspiration: num.n(1000) };
    const id = s.party[0].id;
    const cost = baseLevelCost(s.party[0].level); // book1 / no upgrades => effective == base
    const next = eco.levelUp(s, id);
    expect(next.party[0].level).toBe(2);
    expect(num.eq(next.inspiration, num.sub(num.n(1000), cost))).toBe(true);
  });

  it('levelUp is a no-op when unaffordable', () => {
    const s = { ...initialState(0), inspiration: num.ZERO };
    expect(eco.levelUp(s, s.party[0].id)).toBe(s);
  });

  it('recruit adds a character and respects the base cap', () => {
    let s = { ...initialState(0), inspiration: num.n('1e9') };
    while (s.party.length < RECRUIT_CAP) {
      const before = s.party.length;
      s = eco.recruit(s);
      expect(s.party.length).toBe(before + 1);
    }
    expect(eco.canRecruit(s)).toBe(false);
    expect(eco.recruit(s)).toBe(s);
  });

  it('frugalDrafts reduces the effective recruit cost actually charged', () => {
    const base = { ...initialState(0), inspiration: num.n('1e9') };
    const thrifty = { ...base, upgrades: { ...emptyUpgrades(), frugalDrafts: 4 } }; // -20%
    const afterBase = eco.recruit(base);
    const afterThrifty = eco.recruit(thrifty);
    expect(num.gt(afterThrifty.inspiration, afterBase.inspiration)).toBe(true);
  });

  it('ensembleCast raises the cap so a 6th member can be recruited', () => {
    let s = { ...initialState(0), inspiration: num.n('1e12'), upgrades: { ...emptyUpgrades(), ensembleCast: true } };
    while (eco.canRecruit(s)) s = eco.recruit(s);
    expect(s.party.length).toBe(RECRUIT_CAP + 1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/engine/economy.test.ts`
Expected: FAIL — old `economy` still multiplies DPS / exports moved symbols; the new effective-cost / cap behavior isn't there yet (and `eco.partyDps`/`eco.levelCost` no longer referenced).

- [ ] **Step 3: Replace `src/engine/economy.ts`** with:

```ts
// src/engine/economy.ts
import { n, sub, gte } from './num';
import { GameState, Character, CHARACTER_NAMES } from './state';
import { effectiveLevelCost, effectiveRecruitCost, effectivePartyCap } from './modifiers';

export function canLevel(state: GameState, id: string): boolean {
  const c = state.party.find((p) => p.id === id);
  if (!c) return false;
  return gte(state.inspiration, effectiveLevelCost(state, c.level));
}

export function levelUp(state: GameState, id: string): GameState {
  if (!canLevel(state, id)) return state;
  const c = state.party.find((p) => p.id === id)!;
  const cost = effectiveLevelCost(state, c.level);
  return {
    ...state,
    inspiration: sub(state.inspiration, cost),
    party: state.party.map((p) => (p.id === id ? { ...p, level: p.level + 1 } : p)),
  };
}

export function canRecruit(state: GameState): boolean {
  return (
    state.party.length < effectivePartyCap(state) &&
    gte(state.inspiration, effectiveRecruitCost(state, state.party.length))
  );
}

export function recruit(state: GameState): GameState {
  if (!canRecruit(state)) return state;
  const cost = effectiveRecruitCost(state, state.party.length);
  const idx = state.party.length;
  const newChar: Character = {
    id: `c${idx}`,
    name: CHARACTER_NAMES[idx] ?? `Character ${idx + 1}`,
    level: 1,
    basePower: n(1),
  };
  return { ...state, inspiration: sub(state.inspiration, cost), party: [...state.party, newChar] };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/engine/economy.test.ts`
Expected: PASS (5 cases).

- [ ] **Step 5: Full suite (milestone boundary) + commit**

Run: `npm test`
Expected: PASS — all files. (If any file still imports `economy.partyDps`/`levelCost`/`recruitCost`/`characterPower`, that's a leftover from M3/M4 — fix the import to use `modifiers`/`state`.)

```bash
git add src/engine/economy.ts src/engine/economy.test.ts
git commit -m "refactor: economy actions charge effective costs and honor effective cap"
```

---

## Milestone 6 — Publish → royalty wallet; save migration; remove `prestigeMultiplier`

> `prestigeMultiplier` is now read by nothing except `save` + the `state` field/`initialState`. This single task rewrites `progression` (publish pays the wallet, starts pre-leveled), rewrites `save` (upgrades + v1→v2 migration, drops `prestigeMultiplier`), and removes the field. Done as ONE task so no commit is left non-compiling.

### Task 6.1: Royalty-wallet publish + upgrade persistence + migration + field removal

**Files:**
- Modify: `src/engine/state.ts` (remove the `prestigeMultiplier` field + its `initialState` line)
- Modify: `src/engine/progression.ts` (replace whole file)
- Modify: `src/engine/save.ts` (replace whole file)
- Test: `src/engine/progression.test.ts` (replace whole file)
- Test: `src/engine/save.test.ts` (replace whole file)

- [ ] **Step 1: Replace `src/engine/progression.test.ts`** with:

```ts
// src/engine/progression.test.ts
import { describe, it, expect } from 'vitest';
import * as num from './num';
import { initialState, emptyUpgrades } from './state';
import { onClear, publish } from './progression';
import { BOSS_INDEX, ZONE_COUNT, targetMaxHp, targetWords, GHOSTWRITER_LEVEL } from './content';
import { royaltiesForBook } from './prestige';

describe('progression', () => {
  it('advances to the next encounter on a regular clear and grants words', () => {
    const s = initialState(0);
    const next = onClear(s);
    expect(next.zone).toEqual({ zoneIndex: 0, encounterIndex: 1 });
    expect(num.eq(next.words, targetWords(0, 0))).toBe(true);   // book1 => effective == base
    expect(num.eq(next.currentHp, targetMaxHp(0, 1))).toBe(true);
  });

  it('advances to the next zone when a non-final boss is cleared', () => {
    const s = { ...initialState(0), zone: { zoneIndex: 0, encounterIndex: BOSS_INDEX } };
    const next = onClear(s);
    expect(next.zone).toEqual({ zoneIndex: 1, encounterIndex: 0 });
    expect(next.bookComplete).toBe(false);
    expect(num.eq(next.currentHp, targetMaxHp(1, 0))).toBe(true);
  });

  it('flags bookComplete when the final zone boss is cleared', () => {
    const s = { ...initialState(0), zone: { zoneIndex: ZONE_COUNT - 1, encounterIndex: BOSS_INDEX } };
    expect(onClear(s).bookComplete).toBe(true);
  });

  it('publish pays scaling royalties to the wallet, escalates the book, resets, keeps upgrades', () => {
    const done = {
      ...initialState(0),
      bookComplete: true,
      inspiration: num.n(5000),
      words: num.n(99999),
      royalties: num.n(2),
      upgrades: { ...emptyUpgrades(), sharpProse: 3 },
      zone: { zoneIndex: ZONE_COUNT - 1, encounterIndex: BOSS_INDEX },
    };
    const next = publish(done);
    expect(num.eq(next.royalties, num.add(num.n(2), royaltiesForBook(num.n(99999))))).toBe(true);
    expect(next.bookNumber).toBe(2);
    expect(next.bookComplete).toBe(false);
    expect(next.zone).toEqual({ zoneIndex: 0, encounterIndex: 0 });
    expect(num.eq(next.inspiration, num.ZERO)).toBe(true);
    expect(num.eq(next.words, num.ZERO)).toBe(true);
    expect(next.party.length).toBe(initialState(0).party.length);
    expect(next.upgrades.sharpProse).toBe(3); // upgrades persist
  });

  it('Ghostwriter makes the published party start pre-leveled', () => {
    const done = {
      ...initialState(0),
      bookComplete: true,
      words: num.n(1000),
      upgrades: { ...emptyUpgrades(), ghostwriter: true },
      zone: { zoneIndex: ZONE_COUNT - 1, encounterIndex: BOSS_INDEX },
    };
    const next = publish(done);
    expect(next.party.every((c) => c.level === GHOSTWRITER_LEVEL)).toBe(true);
  });

  it('publish is a no-op when the book is not complete', () => {
    const s = initialState(0);
    expect(publish(s)).toBe(s);
  });
});
```

- [ ] **Step 2: Replace `src/engine/save.test.ts`** with:

```ts
// src/engine/save.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import * as num from './num';
import { initialState, emptyUpgrades } from './state';
import { serialize, deserialize, save, load, exportSave, importSave, SAVE_KEY } from './save';

describe('save', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a non-trivial state incl. upgrades', () => {
    const s = {
      ...initialState(1234),
      inspiration: num.n('1.5e40'),
      royalties: num.n(7),
      upgrades: { ...emptyUpgrades(), prolific: 3, ensembleCast: true },
    };
    const back = deserialize(serialize(s), 0);
    expect(num.eq(back.inspiration, s.inspiration)).toBe(true);
    expect(num.eq(back.royalties, s.royalties)).toBe(true);
    expect(back.upgrades.prolific).toBe(3);
    expect(back.upgrades.ensembleCast).toBe(true);
    expect(back.party.length).toBe(s.party.length);
    expect(back.lastSaved).toBe(1234);
    expect(back.schemaVersion).toBe(2);
  });

  it('migrates a v1 save: keeps royalties as wallet, ignores prestigeMultiplier, defaults upgrades', () => {
    const v1 = JSON.stringify({
      schemaVersion: 1, lastSaved: 5, inspiration: '100', words: '200', royalties: '4',
      prestigeMultiplier: '2.5', party: [{ id: 'c0', name: 'Quill', level: 3, basePower: '1' }],
      zone: { zoneIndex: 1, encounterIndex: 2 }, currentHp: '50', bookComplete: false, bookNumber: 2,
    });
    const s = deserialize(v1, 9);
    expect(num.eq(s.royalties, num.n(4))).toBe(true);
    expect(s.upgrades).toEqual(emptyUpgrades());
    expect(s.schemaVersion).toBe(2);
    expect((s as Record<string, unknown>).prestigeMultiplier).toBeUndefined();
  });

  it('tolerates missing fields and ignores unknown fields', () => {
    const partial = deserialize('{"inspiration":"500","mysteryField":42}', 7);
    expect(num.eq(partial.inspiration, num.n(500))).toBe(true);
    expect(num.eq(partial.royalties, num.ZERO)).toBe(true);
    expect(partial.upgrades).toEqual(emptyUpgrades());
    expect(partial.party.length).toBe(initialState(0).party.length);
  });

  it('returns a fresh state on malformed JSON', () => {
    const fresh = deserialize('not json', 9);
    expect(num.eq(fresh.inspiration, num.ZERO)).toBe(true);
    expect(fresh.lastSaved).toBe(9);
  });

  it('save() then load() persists through localStorage', () => {
    save({ ...initialState(0), inspiration: num.n(777) });
    expect(localStorage.getItem(SAVE_KEY)).toBeTruthy();
    expect(num.eq(load(0)!.inspiration, num.n(777))).toBe(true);
  });

  it('load() returns null when nothing is saved', () => {
    expect(load(0)).toBeNull();
  });

  it('export/import round-trips via an opaque string', () => {
    const s = { ...initialState(0), words: num.n('1e12'), upgrades: { ...emptyUpgrades(), muse: 2 } };
    const back = importSave(exportSave(s), 0);
    expect(num.eq(back.words, num.n('1e12'))).toBe(true);
    expect(back.upgrades.muse).toBe(2);
  });
});
```

- [ ] **Step 3: Run both to verify they fail**

Run: `npx vitest run src/engine/progression.test.ts src/engine/save.test.ts`
Expected: FAIL — publish still sets `prestigeMultiplier`/awards 1 royalty; save lacks upgrades/migration.

- [ ] **Step 4a: Edit `src/engine/state.ts`** — remove the deprecated field and its initializer:
  - Delete the line `  prestigeMultiplier: Num; // DEPRECATED: removed in M6 once nothing reads it` from `interface GameState`.
  - Delete the line `    prestigeMultiplier: ONE,` from `initialState`.
  - (`ONE` is still used by `makeStartingParty`, so leave the import.)

- [ ] **Step 4b: Replace `src/engine/progression.ts`** with:

```ts
// src/engine/progression.ts
import { ZERO, add } from './num';
import { GameState, makeStartingParty } from './state';
import { ZONE_COUNT, isBossIndex } from './content';
import { effectiveWords, effectiveTargetMaxHp, startingPartyLevel } from './modifiers';
import { royaltiesForBook } from './prestige';

// Called when the current target's HP reaches 0.
export function onClear(state: GameState): GameState {
  const { zoneIndex, encounterIndex } = state.zone;
  const words = add(state.words, effectiveWords(state, zoneIndex, encounterIndex));
  const clearedBoss = isBossIndex(encounterIndex);

  if (clearedBoss && zoneIndex >= ZONE_COUNT - 1) {
    return { ...state, words, bookComplete: true };
  }

  const nz = clearedBoss ? zoneIndex + 1 : zoneIndex;
  const ne = clearedBoss ? 0 : encounterIndex + 1;
  const advanced = { ...state, words, zone: { zoneIndex: nz, encounterIndex: ne } };
  return { ...advanced, currentHp: effectiveTargetMaxHp(advanced, nz, ne) };
}

// Player action: publish the finished book and start the next (harder) one.
export function publish(state: GameState): GameState {
  if (!state.bookComplete) return state;
  const royalties = add(state.royalties, royaltiesForBook(state.words));
  const zone = { zoneIndex: 0, encounterIndex: 0 };
  const base: GameState = {
    ...state, // upgrades persist via spread
    royalties,
    bookNumber: state.bookNumber + 1,
    inspiration: ZERO,
    words: ZERO,
    party: makeStartingParty(startingPartyLevel(state)),
    zone,
    currentHp: ZERO, // set below using the NEW (incremented) bookNumber
    bookComplete: false,
  };
  return { ...base, currentHp: effectiveTargetMaxHp(base, 0, 0) };
}
```

- [ ] **Step 4c: Replace `src/engine/save.ts`** with:

```ts
// src/engine/save.ts
import { Num, n, ZERO, numToStr, strToNum } from './num';
import { GameState, Character, Upgrades, initialState, emptyUpgrades } from './state';

export const SAVE_KEY = 'plotarmor.save.v1';
export const SCHEMA_VERSION = 2;

interface CharDTO { id: string; name: string; level: number; basePower: string; }
interface SaveDTO {
  schemaVersion: number;
  lastSaved: number;
  inspiration: string;
  words: string;
  royalties: string;
  party: CharDTO[];
  zone: { zoneIndex: number; encounterIndex: number };
  currentHp: string;
  bookComplete: boolean;
  bookNumber: number;
  upgrades: Upgrades;
}

function mergeUpgrades(u: Partial<Upgrades> | undefined): Upgrades {
  const e = emptyUpgrades();
  if (!u || typeof u !== 'object') return e;
  const numOrDefault = (v: unknown, d: number): number => (typeof v === 'number' ? v : d);
  const boolOrDefault = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d);
  return {
    prolific: numOrDefault(u.prolific, e.prolific),
    sharpProse: numOrDefault(u.sharpProse, e.sharpProse),
    pageTurner: numOrDefault(u.pageTurner, e.pageTurner),
    muse: numOrDefault(u.muse, e.muse),
    nightOwl: numOrDefault(u.nightOwl, e.nightOwl),
    frugalDrafts: numOrDefault(u.frugalDrafts, e.frugalDrafts),
    ensembleCast: boolOrDefault(u.ensembleCast, e.ensembleCast),
    ghostwriter: boolOrDefault(u.ghostwriter, e.ghostwriter),
  };
}

export function serialize(state: GameState): string {
  const dto: SaveDTO = {
    schemaVersion: SCHEMA_VERSION,
    lastSaved: state.lastSaved,
    inspiration: numToStr(state.inspiration),
    words: numToStr(state.words),
    royalties: numToStr(state.royalties),
    party: state.party.map((c) => ({ id: c.id, name: c.name, level: c.level, basePower: numToStr(c.basePower) })),
    zone: { zoneIndex: state.zone.zoneIndex, encounterIndex: state.zone.encounterIndex },
    currentHp: numToStr(state.currentHp),
    bookComplete: state.bookComplete,
    bookNumber: state.bookNumber,
    upgrades: state.upgrades,
  };
  return JSON.stringify(dto);
}

// Tolerant: missing fields fall back to fresh defaults; unknown fields (incl. the v1
// `prestigeMultiplier`) are ignored. A v1 save's `royalties` is preserved as the wallet.
export function deserialize(raw: string, nowMs: number): GameState {
  const fresh = initialState(nowMs);
  let dto: Partial<SaveDTO>;
  try {
    dto = JSON.parse(raw) as Partial<SaveDTO>;
  } catch {
    return fresh;
  }
  const numOr = (s: string | undefined, fallback: Num): Num => (typeof s === 'string' ? strToNum(s) : fallback);

  const party: Character[] =
    Array.isArray(dto.party) && dto.party.length > 0
      ? dto.party.map((c, i) => ({
          id: c?.id ?? `c${i}`,
          name: c?.name ?? `Character ${i + 1}`,
          level: typeof c?.level === 'number' ? c.level : 1,
          basePower: numOr(c?.basePower, n(1)),
        }))
      : fresh.party;

  return {
    schemaVersion: SCHEMA_VERSION,
    lastSaved: typeof dto.lastSaved === 'number' ? dto.lastSaved : nowMs,
    inspiration: numOr(dto.inspiration, ZERO),
    words: numOr(dto.words, ZERO),
    royalties: numOr(dto.royalties, ZERO),
    party,
    zone: { zoneIndex: dto.zone?.zoneIndex ?? 0, encounterIndex: dto.zone?.encounterIndex ?? 0 },
    currentHp: numOr(dto.currentHp, fresh.currentHp),
    bookComplete: typeof dto.bookComplete === 'boolean' ? dto.bookComplete : false,
    bookNumber: typeof dto.bookNumber === 'number' ? dto.bookNumber : 1,
    upgrades: mergeUpgrades(dto.upgrades),
  };
}

export function save(state: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, serialize(state));
  } catch {
    /* storage unavailable/full — ignore for a single-user local game */
  }
}

export function load(nowMs: number): GameState | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(SAVE_KEY);
  } catch {
    raw = null;
  }
  if (!raw) return null;
  return deserialize(raw, nowMs);
}

export function exportSave(state: GameState): string {
  return btoa(unescape(encodeURIComponent(serialize(state))));
}

export function importSave(encoded: string, nowMs: number): GameState {
  return deserialize(decodeURIComponent(escape(atob(encoded))), nowMs);
}
```

- [ ] **Step 5: Run both targeted suites, then the full suite**

Run: `npx vitest run src/engine/progression.test.ts src/engine/save.test.ts`
Expected: PASS (6 + 7 cases).

Run: `npm test`
Expected: PASS — entire suite green (this is the first point where `prestigeMultiplier` is fully gone).

- [ ] **Step 6: Commit**

```bash
git add src/engine/state.ts src/engine/progression.ts src/engine/save.ts src/engine/progression.test.ts src/engine/save.test.ts
git commit -m "feat: royalty-wallet publish, upgrade persistence, v1->v2 migration; remove prestigeMultiplier"
```

---

## Milestone 7 — Whole-project build, full suite, docs, push

### Task 7.1: Type-check + build + full test (the M7 gate)

**Files:** none (verification only)

- [ ] **Step 1: Whole-project type-check + production build**

Run: `npm run build`
Expected: `tsc --noEmit` passes with NO errors (this is the first whole-project `tsc` since the refactor) and `vite build` writes `dist/`. Fix any surfaced errors (most likely: a leftover import of a removed `economy`/`state` symbol, or an unused import flagged by `noUnusedLocals`/`noUnusedParameters`) at the call site only — do not change behavior.

- [ ] **Step 2: Full test suite**

Run: `npm test`
Expected: PASS. Test files now: `num, content, state, modifiers, prestige, economy, combat, progression, loop, offline, save, render` (12 files). Confirm all green and note the totals.

- [ ] **Step 3: Commit (only if Step 1 required fixes; otherwise skip)**

```bash
git add -A
git commit -m "fix: resolve build/type issues after prestige refactor"
```

### Task 7.2: Update README + spec status, push

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-06-19-plot-armor-prestige-design.md` (status line)

- [ ] **Step 1: Update `README.md` status section** — replace the "v1 complete" paragraph's first sentence area so it reads (keep the rest of the section intact):

```markdown
**v2 (prestige depth) engine complete.** On top of v1, Royalties are now a spendable
wallet feeding a permanent upgrade catalog (6 repeatable + 2 one-time), books escalate
in difficulty/size each publish, and the royalty payout scales with manuscript size.
All headless-tested; `npm run build` is green. (No spend UI yet — engine systems only.)
```

- [ ] **Step 2: Update the spec status line** in `docs/superpowers/specs/2026-06-19-plot-armor-prestige-design.md`:
  - Change `- **Status:** Approved (brainstorming complete) — ready for implementation planning`
  - To `- **Status:** Implemented (engine) — <DATE>; spend UI deferred`
  - (Use the actual date; the agent does not have `Date.now()` — use the date from the environment context, e.g. 2026-06-19.)

- [ ] **Step 3: Commit + push**

```bash
git add README.md docs/superpowers/specs/2026-06-19-plot-armor-prestige-design.md
git commit -m "docs: mark prestige-depth v2 engine complete"
git push origin main
```

- [ ] **Step 4: Report** the final `npm run build` + `npm test` output and the pushed commit range. Flag (per owner's hard rules) that no browser/UI run was performed this pass because there is no new UI to exercise — the v1 owner-side visual check is unaffected, and the new systems are exercised only via headless tests until a future spend-UI milestone.

---

## Self-review (completed during planning)

- **Spec coverage** (checked against `2026-06-19-plot-armor-prestige-design.md`):
  - §4.1 book escalation `D(b)` → `modifiers.bookDifficulty` + applied in `effectiveTargetMaxHp/BossRegen/Words/InspirationRate` (M1); identity at book 1 asserted (M1 parity tests).
  - §4.2 royalty faucet `f(WordsThisBook)` → `prestige.royaltiesForBook` (M2), used by `publish` (M6).
  - §4.3 reset tension / pre-leveled start → `startingPartyLevel` + `makeStartingParty(level)` + Ghostwriter (M0/M1/M6).
  - §5 catalog (6 repeatable + 2 one-time, bounds on muse/frugal) → `content` catalog (M0), bounds in `modifiers` (M1).
  - §6 data model (`upgrades`, wallet `royalties`, drop `prestigeMultiplier`) → `state` (M0 add, M6 drop), `economy`/`combat`/etc. consume effective values.
  - §7 architecture (`modifiers.ts`, `prestige.ts`, catalog/base-costs in `content`, reducers read effective) → M1–M6.
  - §8 save migration v1→v2 (keep royalties wallet, drop prestigeMultiplier, default upgrades) → `save` + test (M6).
  - §9 verification incl. book-1 parity guard → M1 parity tests + per-milestone full suite + M7 build.
  - §3 scope (engine-only, no spend UI) → no `input.ts`/new-button work; `render` only updated to display effective values (M4).
- **Placeholder scan:** none — every step has complete code; all tuning constants are concrete named values in `content.ts`.
- **Type/name consistency:** `effective*` names identical across `modifiers` (def, M1) and consumers (`combat` M3, `loop` M3, `offline` M3, `economy` M5, `progression` M6, `render` M4); `Upgrades` field names identical across `state`, `content` catalog ids, `modifiers`, `prestige`, `save`. `offlineSeconds(now, lastSaved, capSeconds)` 3-arg signature consistent between `offline.ts` and `offline.test.ts` (M3). `findUpgrade`/`UpgradeId`/`upgradeCost`/`canBuy`/`buyUpgrade`/`royaltiesForBook` consistent between `prestige` and its test (M2) and `progression` (M6).
- **Circular-import check:** `modifiers` imports only `num`/`content`/`state`; `economy`/`combat`/`loop`/`progression`/`offline` import `modifiers` one-way; `content` holds base cost curves and `state` holds `characterPower`, so nothing below `modifiers` imports upward. No cycles.
- **Incremental green:** each milestone ends with full `npm test`; the only signature change to an existing test is `offline.test` (M3); book-1 parity keeps `combat`/`loop`/`render` tests unchanged.

