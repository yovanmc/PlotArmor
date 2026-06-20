# Star-Prestige ("Legacy") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a global **Legacy** track — a repeatable, Edits-funded upgrade that multiplies every character's power and ability magnitude by `legacyMult(level)` — giving surplus Edits a late-game sink once classes are maxed.

**Architecture:** A single tunable `LEGACY_GROWTH` drives `legacyMult(level) = LEGACY_GROWTH ** level` (1 at level 0 → neutral). It folds into the existing `effective*` read-paths in `modifiers.ts` the same way star/affinity multipliers do. State gains a `legacy: number`; save bumps v5 → v6 with a neutral migration. Buying mirrors the `canPromoteProtagonist`/`promoteProtagonist` pair and is surfaced in the Publishing House modal.

**Tech Stack:** TypeScript (strict) + Vite + Vitest (jsdom). `break_eternity.js` big numbers behind `src/engine/num.ts`.

**Spec:** `docs/superpowers/specs/2026-06-20-plot-armor-star-prestige-design.md` (LOCKED).

---

## File Structure

| File | Responsibility | Change |
|------|----------------|--------|
| `src/engine/content.ts` | Constants + `legacyMult` + `legacyCost` | **Modify** |
| `src/engine/state.ts` | `GameState.legacy` + `initialState` | **Modify** |
| `src/engine/save.ts` | v6: serialize/deserialize/sanitize `legacy` | **Modify** |
| `src/engine/prestige.ts` | `canBuyLegacy` / `buyLegacy` | **Modify** |
| `src/engine/modifiers.ts` | Fold `legacyMult` into power + ability read-paths | **Modify** |
| `src/ui/shop.ts` | "Legacy" section + `data-action="legacy"` | **Modify** |
| Test files | content / state / save / prestige / modifiers / shop | **Modify** |
| `README.md` | Status paragraph | **Modify** |

**Key facts the implementer needs:**
- `num` helpers: `n`, `mul`, `pow`, `sub`, `gte`, `toNum`, `eq`, `gt`, `ZERO`. `Num` is the big-number type.
- `GameState` already has `edits: Num`, `stars: Record<ClassId, number>`. `effectiveCharacterPower(state, c)` and the module-private `abilitySum(party, kind, stars, zoneIndex)` live in `modifiers.ts`.
- Save DTO pattern: `SaveDTO` interface + `serialize` + `deserialize` (tolerant, field-by-field) + `sanitize*` helpers. `SCHEMA_VERSION` is currently `5`.
- The shop modal pattern (`renderShop`/`wireShop`, delegated `#shop-body` click handler) is in `src/ui/shop.ts`; `promoteProtagonist` is the existing precedent for a non-`buyUpgrade` action.
- **Neutral-default invariant:** at `legacy: 0`, `legacyMult(0) === 1`, so every existing test number is unchanged — only save-version assertions and the new tests move.

---

### Task 1: Constants — `legacyMult` + `legacyCost`

**Files:**
- Modify: `src/engine/content.ts` (after the `starUpCost` function, ~line 242)
- Test: `src/engine/content.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/engine/content.test.ts` (add `legacyMult, legacyCost, LEGACY_BASE` to the existing `./content` imports or import inline):

```ts
import { legacyMult, legacyCost, LEGACY_BASE } from './content';

describe('star-prestige Legacy curve', () => {
  it('legacyMult is 1 at level 0 and grows with level', () => {
    expect(legacyMult(0)).toBe(1);
    expect(legacyMult(2)).toBeGreaterThan(legacyMult(1));
    expect(legacyMult(1)).toBeGreaterThan(1);
  });

  it('legacyCost starts at LEGACY_BASE and rises with level', () => {
    expect(num.eq(legacyCost(0), LEGACY_BASE)).toBe(true);
    expect(num.gt(legacyCost(1), legacyCost(0))).toBe(true);
    expect(num.gt(legacyCost(3), legacyCost(2))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "C:/Agent Projects/PlotArmor" && npx vitest run src/engine/content.test.ts`
Expected: FAIL — `legacyMult`/`legacyCost`/`LEGACY_BASE` not exported.

- [ ] **Step 3: Add the constants + functions in `content.ts`**

Insert immediately after the `starUpCost` function (after its closing `}` near line 242):

```ts
// --- star-prestige: the Legacy track (Edits sink past 5★) --------------------
// Once classes are maxed at 5★, surplus Edits buy global "Legacy" levels. Each
// level multiplies EVERY character's power AND ability magnitude by LEGACY_GROWTH
// (legacyMult(0) === 1, so it is neutral by default). LEGACY_BASE is high enough
// that raising stars stays the better early buy. ALL three are tunable placeholders.
export const LEGACY_GROWTH = 1.5;        // global power+ability multiplier per Legacy level
export const LEGACY_BASE = n(128);       // Edits cost of the first Legacy level
export const LEGACY_COST_GROWTH = 2;     // cost escalation per level

export function legacyMult(level: number): number {
  return Math.pow(LEGACY_GROWTH, level);
}

export function legacyCost(level: number): Num {
  return mul(LEGACY_BASE, pow(n(LEGACY_COST_GROWTH), level));
}
```

(`n`, `mul`, `pow`, `Num` are already imported in `content.ts`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "C:/Agent Projects/PlotArmor" && npx vitest run src/engine/content.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/engine/content.ts src/engine/content.test.ts
git commit -m "feat: Legacy curve (legacyMult + legacyCost) for star-prestige"
```

---

### Task 2: State field + save v6

**Files:**
- Modify: `src/engine/state.ts` (`GameState` interface; `initialState`)
- Modify: `src/engine/save.ts` (`SCHEMA_VERSION`, `SaveDTO`, `serialize`, `deserialize`, new `sanitizeLegacy`)
- Test: `src/engine/state.test.ts`, `src/engine/save.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/engine/state.test.ts`:

```ts
describe('legacy state (star-prestige)', () => {
  it('a fresh game starts at legacy 0', () => {
    expect(initialState(0).legacy).toBe(0);
  });
});
```

Append to `src/engine/save.test.ts`:

```ts
describe('save v6: legacy', () => {
  it('round-trips the legacy level', () => {
    const fresh = { ...initialState(0), legacy: 3 };
    const back = deserialize(serialize(fresh), 0);
    expect(back.legacy).toBe(3);
    expect(back.schemaVersion).toBe(6);
  });

  it('migrates a pre-v6 save (no legacy field) to legacy 0, keeping progress', () => {
    const v5 = JSON.stringify({
      schemaVersion: 5, lastSaved: 0, inspiration: '500', words: '0', royalties: '9',
      party: [{ id: 'c0', name: 'The Protagonist', classId: 'protagonist', level: 1, basePower: '1', variantWorld: null }],
      zone: { zoneIndex: 0, encounterIndex: 0 }, currentHp: '1', bookComplete: false, bookNumber: 1,
      edits: '12', stars: {}, unlockedVariants: {},
    });
    const s = deserialize(v5, 0);
    expect(s.legacy).toBe(0);
    expect(num.toNum(s.edits)).toBe(12); // other progress preserved
  });

  it('sanitizes a corrupt legacy value to a non-negative integer', () => {
    const bad = JSON.stringify({ schemaVersion: 6, lastSaved: 0, inspiration: '0', words: '0', royalties: '0',
      party: [], zone: { zoneIndex: 0, encounterIndex: 0 }, currentHp: '1', bookComplete: false, bookNumber: 1,
      edits: '0', stars: {}, unlockedVariants: {}, legacy: -4.7 });
    expect(deserialize(bad, 0).legacy).toBe(0);
  });
});
```

Also update the **existing** schema-version assertions in `save.test.ts`: every `expect(...schemaVersion).toBe(5)` becomes `toBe(6)` (there are four — around lines 24, 36, 116, 158).

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "C:/Agent Projects/PlotArmor" && npx vitest run src/engine/state.test.ts src/engine/save.test.ts`
Expected: FAIL — `legacy` missing from `GameState`/save; version mismatch.

- [ ] **Step 3: Add `legacy` to `GameState` and `initialState` (`state.ts`)**

In the `GameState` interface, after `unlockedVariants: Record<ClassId, number[]>;`, add:

```ts
  legacy: number;
```

In `initialState`, in the returned object after `unlockedVariants: makeUnlockedVariants(),`, add:

```ts
    legacy: 0,
```

- [ ] **Step 4: Bump the save to v6 (`save.ts`)**

Change line 9:

```ts
export const SCHEMA_VERSION = 5;
```

to:

```ts
export const SCHEMA_VERSION = 6;
```

In the `SaveDTO` interface, after `unlockedVariants: Record<string, number[]>;`, add:

```ts
  legacy: number;
```

Add this sanitizer next to `sanitizeStars` (e.g. after `sanitizeUnlocked`, ~line 87):

```ts
// A valid legacy level is a non-negative integer; anything else -> 0.
function sanitizeLegacy(raw: unknown): number {
  return typeof raw === 'number' && Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
}
```

In `serialize`, in the DTO object after `unlockedVariants: state.unlockedVariants,`, add:

```ts
    legacy: state.legacy,
```

In `deserialize`, in the returned object after `unlockedVariants: sanitizeUnlocked(dto.unlockedVariants),`, add:

```ts
    legacy: sanitizeLegacy(dto.legacy),
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd "C:/Agent Projects/PlotArmor" && npx vitest run src/engine/state.test.ts src/engine/save.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/engine/state.ts src/engine/save.ts src/engine/state.test.ts src/engine/save.test.ts
git commit -m "feat: persist legacy level (save schema v6, neutral migration)"
```

---

### Task 3: Economy — `canBuyLegacy` / `buyLegacy`

**Files:**
- Modify: `src/engine/prestige.ts` (import; two new functions)
- Test: `src/engine/prestige.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/engine/prestige.test.ts` (import `canBuyLegacy, buyLegacy` from `./prestige` and `LEGACY_BASE` from `./content` as needed):

```ts
import { canBuyLegacy, buyLegacy } from './prestige';
import { LEGACY_BASE } from './content';

describe('star-prestige: buying Legacy with Edits', () => {
  it('cannot buy without enough Edits, can with enough', () => {
    const broke = { ...initialState(0), edits: num.ZERO };
    const rich = { ...initialState(0), edits: LEGACY_BASE };
    expect(canBuyLegacy(broke)).toBe(false);
    expect(canBuyLegacy(rich)).toBe(true);
  });

  it('buying spends the Edits and raises the legacy level (immutably)', () => {
    const before = { ...initialState(0), edits: num.mul(LEGACY_BASE, num.n(4)) };
    const after = buyLegacy(before);
    expect(after.legacy).toBe(1);
    expect(num.lt(after.edits, before.edits)).toBe(true);
    expect(before.legacy).toBe(0); // original untouched
  });

  it('is a no-op when Edits are insufficient', () => {
    const broke = { ...initialState(0), edits: num.ZERO };
    expect(buyLegacy(broke)).toBe(broke);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "C:/Agent Projects/PlotArmor" && npx vitest run src/engine/prestige.test.ts`
Expected: FAIL — `canBuyLegacy`/`buyLegacy` not exported.

- [ ] **Step 3: Implement in `prestige.ts`**

Add `legacyCost` to the `./content` import (line 4):

```ts
import { findUpgrade, UpgradeId, ROYALTY_K, ROYALTY_W0, MAX_STAR, protagonistPromoteCost, legacyCost } from './content';
```

Append at the end of the file:

```ts
export function canBuyLegacy(state: GameState): boolean {
  return gte(state.edits, legacyCost(state.legacy));
}

export function buyLegacy(state: GameState): GameState {
  if (!canBuyLegacy(state)) return state;
  return {
    ...state,
    edits: sub(state.edits, legacyCost(state.legacy)),
    legacy: state.legacy + 1,
  };
}
```

(`sub` and `gte` are already imported in `prestige.ts`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "C:/Agent Projects/PlotArmor" && npx vitest run src/engine/prestige.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/engine/prestige.ts src/engine/prestige.test.ts
git commit -m "feat: buyLegacy / canBuyLegacy (spend Edits to raise the Legacy level)"
```

---

### Task 4: Fold `legacyMult` into the modifier read-paths

**Files:**
- Modify: `src/engine/modifiers.ts` (import; `effectiveCharacterPower`; `effectiveInspirationRate`; `effectiveBossRegen`; `effectivePartyDps`)
- Test: `src/engine/modifiers.test.ts`

Legacy scales **power** (via `effectiveCharacterPower`) and every **ability bonus term** (the `abilitySum` results + the inline Lone Wolf / Plot Armor terms). At `legacy: 0` (`legacyMult === 1`) nothing changes.

- [ ] **Step 1: Write the failing tests**

Append to `src/engine/modifiers.test.ts`:

```ts
describe('star-prestige Legacy scaling', () => {
  it('a Legacy level raises party DPS vs legacy 0', () => {
    const base = initialState(0);
    const leg = { ...base, legacy: 2 };
    expect(num.gt(M.effectivePartyDps(leg), M.effectivePartyDps(base))).toBe(true);
  });

  it('a Legacy level raises the Inspiration rate when a Sidekick is fielded (ability scaled)', () => {
    const base = { ...initialState(0), party: [makeCharacter('p', 'protagonist'), makeCharacter('k', 'sidekick', 10)] };
    const leg = { ...base, legacy: 2 };
    expect(num.gt(M.effectiveInspirationRate(leg, 0, 0), M.effectiveInspirationRate(base, 0, 0))).toBe(true);
  });

  it('is neutral at legacy 0 — effectiveCharacterPower unchanged', () => {
    const s = initialState(0);
    const c = s.party[0];
    expect(num.eq(effectiveCharacterPower(s, c), effectiveCharacterPower({ ...s, legacy: 0 }, c))).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "C:/Agent Projects/PlotArmor" && npx vitest run src/engine/modifiers.test.ts`
Expected: FAIL — the first two (legacy not yet applied; `leg` DPS/insp equal `base`). The third passes trivially but stays valid after.

- [ ] **Step 3: Import `legacyMult` in `modifiers.ts`**

In the `./content` import block (the one ending `... starStatMult, starAbilityMult,`), add `legacyMult`:

```ts
  PARTY_ABILITY_FLOOR, findClass, AbilityKind, ClassId, starStatMult, starAbilityMult, legacyMult,
```

- [ ] **Step 4: Scale power in `effectiveCharacterPower`**

Replace:

```ts
export function effectiveCharacterPower(state: GameState, c: Character): Num {
  return mul(characterPower(c), n(starStatMult(state.stars[c.classId])));
}
```

with:

```ts
export function effectiveCharacterPower(state: GameState, c: Character): Num {
  return mul(mul(characterPower(c), n(starStatMult(state.stars[c.classId]))), n(legacyMult(state.legacy)));
}
```

- [ ] **Step 5: Scale the Sidekick ability in `effectiveInspirationRate`**

Replace:

```ts
  const sidekickMult = 1 + abilitySum(s.party, 'inspRate', s.stars, zoneIndex);
```

with:

```ts
  const sidekickMult = 1 + abilitySum(s.party, 'inspRate', s.stars, zoneIndex) * legacyMult(s.legacy);
```

- [ ] **Step 6: Scale the Debuffer ability in `effectiveBossRegen`**

Replace:

```ts
  const partyReduction = abilitySum(s.party, 'regenCut', s.stars, zoneIndex);   // additional cut from Debuffers
```

with:

```ts
  const partyReduction = abilitySum(s.party, 'regenCut', s.stars, zoneIndex) * legacyMult(s.legacy);   // additional cut from Debuffers
```

- [ ] **Step 7: Scale Lone Wolf / Support / Plot Armor in `effectivePartyDps`**

Replace the whole function body with (note: `effectiveCharacterPower` already carries the power-side `legacyMult` from Step 4, so the loop does not re-apply it):

```ts
export function effectivePartyDps(s: GameState): Num {
  const zoneIndex = s.zone.zoneIndex;
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
  return mul(mul(mul(mul(sum, n(sharpMult(s))), n(supportMult)), n(plotArmorMult)), n(setMult));
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd "C:/Agent Projects/PlotArmor" && npx vitest run src/engine/modifiers.test.ts`
Expected: PASS (the legacy tests + all existing tests — the book-1 parity tests still pass because `legacy` is 0 in `initialState`).

- [ ] **Step 9: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/engine/modifiers.ts src/engine/modifiers.test.ts
git commit -m "feat: Legacy level scales all power + ability read-paths"
```

---

### Task 5: Publishing House "Legacy" section

**Files:**
- Modify: `src/ui/shop.ts` (import; `renderShop`; `wireShop`)
- Test: `src/ui/shop.test.ts`

- [ ] **Step 1: Write the failing tests**

In `src/ui/shop.test.ts`, update the row-count assertion (currently line ~25) from:

```ts
    expect(body.querySelectorAll('.shop-row').length).toBe(REPEATABLE_UPGRADES.length + ONE_TIME_UPGRADES.length + 1); // +1 for Protagonist row
```

to:

```ts
    expect(body.querySelectorAll('.shop-row').length).toBe(REPEATABLE_UPGRADES.length + ONE_TIME_UPGRADES.length + 2); // +1 Protagonist, +1 Legacy
```

Add `LEGACY_BASE` to the existing `../engine/content` import at the top of the file (line 5), so it reads:

```ts
import { REPEATABLE_UPGRADES, ONE_TIME_UPGRADES, LEGACY_BASE } from '../engine/content';
```

Then append a new describe block at the end of the file. The file already has a top-level `beforeEach(() => { document.body.innerHTML = FIXTURE; })` (line 17) that resets the DOM for every test, and already imports `num`, `initialState`, `GameState`, `renderShop`, `wireShop` — so do NOT add a `beforeEach` or re-import those:

```ts
describe('Legacy section (star-prestige)', () => {
  it('shows a Legacy buy row funded by Edits', () => {
    renderShop({ ...initialState(0), edits: LEGACY_BASE });
    const btn = document.querySelector('#shop-body [data-action="legacy"]') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.disabled).toBe(false); // affordable
  });

  it('buying a Legacy level raises state.legacy and spends Edits', () => {
    let state: GameState = { ...initialState(0), edits: num.mul(LEGACY_BASE, num.n(4)) };
    const setState = (s: GameState) => { state = s; };
    wireShop(() => state, setState);
    document.getElementById('shop-open')!.click();
    document.querySelector<HTMLButtonElement>('#shop-body [data-action="legacy"]')!.click();
    expect(state.legacy).toBe(1);
    expect(num.lt(state.edits, num.mul(LEGACY_BASE, num.n(4)))).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "C:/Agent Projects/PlotArmor" && npx vitest run src/ui/shop.test.ts`
Expected: FAIL — no `[data-action="legacy"]`; row count off by one.

- [ ] **Step 3: Add the Legacy section to `renderShop` (`shop.ts`)**

Extend the imports: add `legacyCost` to `../engine/content` and `canBuyLegacy, buyLegacy` to `../engine/prestige`:

```ts
import { REPEATABLE_UPGRADES, ONE_TIME_UPGRADES, UpgradeId, MAX_STAR, protagonistPromoteCost, legacyCost } from '../engine/content';
import { upgradeCost, canBuy, isOwned, buyUpgrade, canPromoteProtagonist, promoteProtagonist, canBuyLegacy, buyLegacy } from '../engine/prestige';
```

In `renderShop`, after the `protRow` template literal (before the `el('shop-body').innerHTML = ...` assignment), add:

```ts
  const legacyRow = `
    <div class="shop-row">
      <div class="shop-row-info">
        <div class="shop-row-name">Legacy <span class="shop-lv">Lv ${state.legacy}</span></div>
        <div class="shop-row-desc">Spend surplus Edits: permanent +power & ability to the whole roster</div>
      </div>
      <button class="shop-buy" data-action="legacy" ${canBuyLegacy(state) ? '' : 'disabled'}>✏️ ${fmt(legacyCost(state.legacy))}</button>
    </div>`;
```

Then add a Legacy section to the innerHTML — insert it after the Protagonist section and before the `Upgrades` label:

```ts
    <div class="shop-section-label">The Protagonist</div>
    ${protRow}
    <div class="shop-section-label">Legacy · ✏️ ${fmt(state.edits)}</div>
    ${legacyRow}
    <div class="shop-section-label">Upgrades</div>
    ${repeatable}
    <div class="shop-section-label">Unlocks</div>
    ${oneTime}`;
```

- [ ] **Step 4: Handle the action in `wireShop`**

In the `el('shop-body').addEventListener('click', ...)` handler, add this branch **before** the `promote` branch:

```ts
    if (target.closest('button[data-action="legacy"]')) {
      setState(buyLegacy(getState()));
      renderShop(getState());
      return;
    }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd "C:/Agent Projects/PlotArmor" && npx vitest run src/ui/shop.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/ui/shop.ts src/ui/shop.test.ts
git commit -m "feat: Publishing House Legacy section (buy with Edits)"
```

---

### Task 6: Verify, docs, ship

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Confirm balance + full suite + build**

Run: `cd "C:/Agent Projects/PlotArmor" && npx vitest run src/engine/balance.test.ts 2>&1 | grep -E "Tests " && npm test 2>&1 | grep -E "Test Files|Tests " && npm run build 2>&1 | tail -2`
Expected: balance 3 pass (legacy stays 0 in the greedy harness → loop unchanged); full suite green (169 prior + ~12 new = ~181 — report the exact number); `✓ built`.

- [ ] **Step 2: Update the README Status section**

In `README.md`, after the collection-gallery paragraph, add:

```markdown
The late game gets a sink: a **star-prestige "Legacy" track**. Once your classes are maxed at 5★, Edits
stop having anywhere to go — so surplus Edits now buy global **Legacy** levels in the Publishing House,
each permanently multiplying every character's power *and* ability magnitude (a universal extra star for
the whole roster). It's soft-gated by an escalating Edits cost, so raising stars stays the right early
buy. Neutral at level 0 (no save/balance churn for existing games); persisted via save schema v6. All
headless-tested plus a live DOM smoke; `npm run build` is green. The Legacy magnitudes are tunable
placeholders for the upcoming feel pass.
```

Add the plan link to the "Plans:" list (after the collection-gallery link):

```markdown
[collection gallery](docs/superpowers/plans/2026-06-20-plot-armor-collection-gallery.md) ·
[star-prestige](docs/superpowers/plans/2026-06-20-plot-armor-star-prestige.md).
```

- [ ] **Step 3: Commit and push**

```bash
git add README.md
git commit -m "docs: README status for the star-prestige Legacy track"
git push origin main
```

Report the final `npm test` count, the `npm run build` size line, and the pushed commit range.

---

## Notes for the controller (post-implementation)

- After Task 6, dispatch a final whole-feature review over the Legacy commit range, then update memory (`project_plotarmor.md` + the `MEMORY.md` index line), and report.
- Live DOM smoke (built `dist/`, served via the `plotarmor-dist` preview config): inject a save with a large `edits` balance, open the Publishing House (`#shop-open`), confirm the Legacy row shows `✏️ <cost>` and `Lv 0`, click `[data-action="legacy"]`, and verify (a) `Lv 0 → Lv 1`, (b) the Edits balance in the section label drops, (c) Party DPS on the battle screen rises, (d) 0 console errors. Restore the test save afterward. Pixel screenshots remain uncapturable in the headless tab — verify via `preview_eval` DOM reads.
