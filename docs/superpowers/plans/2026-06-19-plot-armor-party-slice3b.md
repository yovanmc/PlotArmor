# Plot Armor — Party System Slice 3b (World Set Bonus) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reward a cohesive themed party — fielding 2 / 3 / 5 characters wearing the same world's variant grants a tier 1 / 2 / 3 set bonus, whose effect type differs per world, folded into the existing `effective*` read-paths.

**Architecture:** A static per-world `WORLD_SET_BONUS` table (axis + per-tier magnitude). `variants.ts` computes the aggregated `activeSetBonus(party)` from each fielded character's `variantWorld` (Slice 3a already gave characters a `variantWorld`). Modifiers multiply that bonus into DPS / Inspiration / Words / boss-regen; `onClear` multiplies the Edit-drop axis. When no set is fielded (the default — fresh characters wear the base look), every multiplier is neutral, so the balanced loop is unchanged. **No save-schema change** — the bonus is derived from already-persisted `variantWorld`s.

**Tech Stack:** TypeScript (strict) + Vite + Vitest (jsdom) + `break_eternity.js` behind `num.ts`. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-06-19-plot-armor-party-system-design.md` §6b (World set bonus — LOCKED): uniform 2/3/5 thresholds, bonus type differs per world, Protagonist's cosmetic variant counts toward a set.

---

## Conventions (read once)

- **Commit identity:** plain `git commit` with the repo's configured global identity (`yovanmc <yovanmc@users.noreply.github.com>`). NEVER `--author`, NEVER per-commit `user.email`, NEVER `--no-verify`.
- **Do NOT push** until the final task.
- Run from `C:\Agent Projects\PlotArmor`. Verify each task with `npx tsc --noEmit` + `npm test`.
- **Neutral-by-default invariant:** with no fielded set (all characters on the base look, as in every existing test and the harness), `activeSetBonus` returns all-neutral, so existing balance/combat/modifier numbers are unchanged. This is the property that keeps the slice low-risk — only NEW tests exercise the bonus.
- **All magnitudes + the per-world axis mapping are tunable placeholders** for the owner's feel-pass.

## File map

| File | Change | Task |
|------|--------|------|
| `src/engine/content.ts` | `SetAxis`, `SetBonusDef`, `WORLD_SET_BONUS`, `SET_THRESHOLDS`, `setTier` | 1 |
| `src/engine/variants.ts` | `SetBonus`, `activeSetBonus`, `setBonusBreakdown` | 2 |
| `src/engine/modifiers.ts` | fold set bonus into DPS / Insp / Words / boss-regen | 3 |
| `src/engine/progression.ts` | `onClear` multiplies the Edit-drop set axis | 4 |
| `src/ui/render.ts` | HUD set-bonus readout | 5 |
| `README.md`, spec status | docs + ship | 6 |

---

## Task 1: Set-bonus content table (`content.ts`)

**Files:**
- Modify: `src/engine/content.ts` (append after the Slice-3a variant block, before `// --- party classes (Slice 1)`)
- Test: `src/engine/content.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/engine/content.test.ts`:

```ts
import { WORLD_SET_BONUS, SET_THRESHOLDS, setTier } from './content';

describe('set-bonus content (Slice 3b)', () => {
  it('has one set-bonus def per world with 3 ascending tiers', () => {
    expect(WORLD_SET_BONUS).toHaveLength(ZONE_COUNT);
    for (const def of WORLD_SET_BONUS) {
      expect(def.tiers).toHaveLength(3);
      expect(def.tiers[0]).toBeLessThan(def.tiers[1]);
      expect(def.tiers[1]).toBeLessThan(def.tiers[2]);
    }
  });

  it('thresholds are 2/3/5 and setTier maps counts to tiers', () => {
    expect(SET_THRESHOLDS).toEqual([2, 3, 5]);
    expect(setTier(1)).toBe(0);
    expect(setTier(2)).toBe(1);
    expect(setTier(3)).toBe(2);
    expect(setTier(4)).toBe(2);
    expect(setTier(5)).toBe(3);
  });
});
```

(`ZONE_COUNT` is already imported by `content.test.ts` from the Slice-3a work; if not, add it.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/content.test.ts`
Expected: FAIL — `WORLD_SET_BONUS`/`SET_THRESHOLDS`/`setTier` not exported.

- [ ] **Step 3: Write minimal implementation**

In `src/engine/content.ts`, insert before `// --- party classes (Slice 1) -------------------------------------------------`:

```ts
// --- world set bonus (Slice 3b) ---------------------------------------------
// Fielding 2 / 3 / 5 characters wearing the SAME world's variant grants a tier
// 1 / 2 / 3 bonus. Thresholds are uniform across worlds; the bonus AXIS differs
// per world so each collection has its own identity. ALL magnitudes + the axis
// mapping are harness-/owner-tuned placeholders.
export type SetAxis = 'dps' | 'insp' | 'words' | 'editDrop' | 'regenCut';

export interface SetBonusDef {
  axis: SetAxis;
  tiers: [number, number, number]; // magnitude at tier 1 / 2 / 3
}

export const SET_THRESHOLDS: [number, number, number] = [2, 3, 5];

// How many same-world variants are fielded -> tier (0 = none).
export function setTier(count: number): number {
  if (count >= SET_THRESHOLDS[2]) return 3;
  if (count >= SET_THRESHOLDS[1]) return 2;
  if (count >= SET_THRESHOLDS[0]) return 1;
  return 0;
}

// Index-aligned with ZONES. `dps`/`insp`/`words`/`editDrop` are +fraction
// multipliers; `regenCut` is an additive reduction to boss regen (shares the
// PARTY_ABILITY_FLOOR with the shop `muse` upgrade + Debuffers).
export const WORLD_SET_BONUS: SetBonusDef[] = [
  { axis: 'insp',     tiers: [0.15, 0.35, 0.75] }, // 0 Wild West — frontier hustle
  { axis: 'regenCut', tiers: [0.05, 0.12, 0.25] }, // 1 Zombie Apocalypse — break the horde
  { axis: 'dps',      tiers: [0.15, 0.35, 0.75] }, // 2 Space — "speed"
  { axis: 'words',    tiers: [0.20, 0.50, 1.00] }, // 3 High Fantasy — epic tomes
  { axis: 'editDrop', tiers: [0.25, 0.60, 1.20] }, // 4 Pirate Seas — plunder
  { axis: 'dps',      tiers: [0.15, 0.35, 0.75] }, // 5 Noir City — sharp investigation
  { axis: 'regenCut', tiers: [0.05, 0.12, 0.25] }, // 6 Eldritch Horror — dread weakens foes
  { axis: 'insp',     tiers: [0.15, 0.35, 0.75] }, // 7 Prehistoric — primal abundance
];
```

`ZONES` is defined above; the table is hand-aligned to the 8 entries.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/content.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/content.ts src/engine/content.test.ts
git commit -m "feat: per-world set-bonus table + 2/3/5 tier thresholds"
```

---

## Task 2: Compute the active set bonus (`variants.ts`)

**Files:**
- Modify: `src/engine/variants.ts`
- Test: `src/engine/variants.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/engine/variants.test.ts`:

```ts
import { activeSetBonus, setBonusBreakdown } from './variants';

function partyOnWorlds(worlds: (number | null)[]) {
  return worlds.map((w, i) => ({ ...makeCharacter(`c${i}`, 'antihero'), variantWorld: w }));
}

describe('set bonus', () => {
  it('is neutral when fewer than 2 share a world', () => {
    const b = activeSetBonus(partyOnWorlds([2, null, 0, null]));
    expect(b.dpsMult).toBe(1);
    expect(b.inspMult).toBe(1);
    expect(b.wordsMult).toBe(1);
    expect(b.editDropMult).toBe(1);
    expect(b.regenCutAdd).toBe(0);
  });

  it('applies the world axis at the right tier (Space = DPS)', () => {
    // 5 on Space (world 2, dps tier 3 = +0.75)
    expect(activeSetBonus(partyOnWorlds([2, 2, 2, 2, 2])).dpsMult).toBeCloseTo(1.75, 5);
    // 3 on Space (tier 2 = +0.35)
    expect(activeSetBonus(partyOnWorlds([2, 2, 2, null, null])).dpsMult).toBeCloseTo(1.35, 5);
    // 2 on Space (tier 1 = +0.15)
    expect(activeSetBonus(partyOnWorlds([2, 2, null, null, null])).dpsMult).toBeCloseTo(1.15, 5);
  });

  it('regenCut worlds add to regenCutAdd', () => {
    // 2 on Zombie (world 1, regenCut tier 1 = 0.05)
    expect(activeSetBonus(partyOnWorlds([1, 1])).regenCutAdd).toBeCloseTo(0.05, 5);
  });

  it('stacks two different world sets at once', () => {
    // 2 Space (dps tier1) + 2 Pirate (world 4, editDrop tier1)
    const b = activeSetBonus(partyOnWorlds([2, 2, 4, 4]));
    expect(b.dpsMult).toBeCloseTo(1.15, 5);
    expect(b.editDropMult).toBeCloseTo(1.25, 5);
  });

  it('breakdown lists qualifying worlds with their count + tier', () => {
    const bd = setBonusBreakdown(partyOnWorlds([2, 2, 2, 4, 4]));
    expect(bd).toContainEqual({ world: 2, count: 3, tier: 2 });
    expect(bd).toContainEqual({ world: 4, count: 2, tier: 1 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/variants.test.ts`
Expected: FAIL — `activeSetBonus`/`setBonusBreakdown` not exported.

- [ ] **Step 3: Write minimal implementation**

In `src/engine/variants.ts`, extend the content import and append:

```ts
import { ClassId, VARIANT_UNLOCK_ORDER, WORLD_SET_BONUS, setTier } from './content';
import { GameState, Character } from './state';
```

```ts
export interface SetBonus {
  dpsMult: number;
  inspMult: number;
  wordsMult: number;
  editDropMult: number;
  regenCutAdd: number; // additive reduction to boss regen (shares the floor)
}

// How many fielded characters wear each world's variant (base look ignored).
function worldCounts(party: Character[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const c of party) {
    if (c.variantWorld !== null) counts.set(c.variantWorld, (counts.get(c.variantWorld) ?? 0) + 1);
  }
  return counts;
}

// Aggregate the active set bonuses across all fielded same-world groups.
export function activeSetBonus(party: Character[]): SetBonus {
  const b: SetBonus = { dpsMult: 1, inspMult: 1, wordsMult: 1, editDropMult: 1, regenCutAdd: 0 };
  for (const [world, count] of worldCounts(party)) {
    const tier = setTier(count);
    if (tier === 0) continue;
    const def = WORLD_SET_BONUS[world];
    const mag = def.tiers[tier - 1];
    switch (def.axis) {
      case 'dps': b.dpsMult *= 1 + mag; break;
      case 'insp': b.inspMult *= 1 + mag; break;
      case 'words': b.wordsMult *= 1 + mag; break;
      case 'editDrop': b.editDropMult *= 1 + mag; break;
      case 'regenCut': b.regenCutAdd += mag; break;
    }
  }
  return b;
}

// UI helper: the worlds currently granting a bonus, with count + tier.
export function setBonusBreakdown(party: Character[]): { world: number; count: number; tier: number }[] {
  const out: { world: number; count: number; tier: number }[] = [];
  for (const [world, count] of worldCounts(party)) {
    const tier = setTier(count);
    if (tier > 0) out.push({ world, count, tier });
  }
  return out;
}
```

- [ ] **Step 4: Run typecheck + full suite**

Run: `npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/variants.ts src/engine/variants.test.ts
git commit -m "feat: compute aggregated world set bonus + UI breakdown from the fielded party"
```

---

## Task 3: Fold the set bonus into the modifiers (`modifiers.ts`)

**Files:**
- Modify: `src/engine/modifiers.ts`
- Test: `src/engine/modifiers.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/engine/modifiers.test.ts` (add `makeCharacter` to the `./state` import if not present):

```ts
describe('set bonus in modifiers (Slice 3b)', () => {
  // build a 5-Space party (world 2 = DPS set)
  function spaceParty() {
    const five = (['protagonist', 'antihero', 'support', 'debuffer', 'sidekick'] as const)
      .map((cls, i) => ({ ...makeCharacter(`c${i}`, cls), variantWorld: 2 }));
    return { ...initialState(0), party: five };
  }

  it('a full DPS set raises effectivePartyDps vs the same party on base looks', () => {
    const set = spaceParty();
    const base = { ...set, party: set.party.map((c) => ({ ...c, variantWorld: null })) };
    expect(num.gt(effectivePartyDps(set), effectivePartyDps(base))).toBe(true);
  });

  it('a full Wild West set (Inspiration axis) raises effectiveInspirationRate', () => {
    const wildwest = spaceParty();
    wildwest.party = wildwest.party.map((c) => ({ ...c, variantWorld: 0 }));
    const base = { ...wildwest, party: wildwest.party.map((c) => ({ ...c, variantWorld: null })) };
    expect(num.gt(effectiveInspirationRate(wildwest, 0, 0), effectiveInspirationRate(base, 0, 0))).toBe(true);
  });

  it('a full Eldritch set (regenCut axis) lowers effectiveBossRegen', () => {
    const eldritch = spaceParty();
    eldritch.party = eldritch.party.map((c) => ({ ...c, variantWorld: 6 }));
    const base = { ...eldritch, party: eldritch.party.map((c) => ({ ...c, variantWorld: null })) };
    // boss encounter (zone 0, BOSS_INDEX) so regen is non-zero
    expect(num.lt(effectiveBossRegen(eldritch, 0, BOSS_INDEX), effectiveBossRegen(base, 0, BOSS_INDEX))).toBe(true);
  });
});
```

(Add `BOSS_INDEX` and `makeCharacter` to the existing imports in `modifiers.test.ts` if missing: `import { BOSS_INDEX } from './content';`, `import { makeCharacter } from './state';`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/modifiers.test.ts`
Expected: FAIL — set bonus not applied yet.

- [ ] **Step 3: Write minimal implementation**

In `src/engine/modifiers.ts`, import the set-bonus computation:

```ts
import { activeSetBonus } from './variants';
```

> Layering note: `variants.ts` imports only `content` + `state` (NOT `modifiers`), so `modifiers → variants` introduces no cycle.

Apply each axis. **`effectivePartyDps`** — multiply the final result by the set DPS mult:

```ts
export function effectivePartyDps(s: GameState): Num {
  let sum = ZERO;
  for (const c of s.party) {
    const ab = findClass(c.classId).ability;
    const selfMult = ab.kind === 'loneWolf'
      ? 1 + ab.mag * c.level * starAbilityMult(s.stars[c.classId])
      : 1;
    sum = add(sum, mul(effectiveCharacterPower(s, c), n(selfMult)));
  }
  const supportMult = 1 + abilitySum(s.party, 'partyDps', s.stars);
  const hasProtagonist = s.party.some((c) => c.classId === 'protagonist');
  const plotArmorMult = hasProtagonist
    ? 1 + findClass('protagonist').ability.mag * distinctClassCount(s.party)
    : 1;
  const setMult = activeSetBonus(s.party).dpsMult;
  return mul(mul(mul(mul(sum, n(sharpMult(s))), n(supportMult)), n(plotArmorMult)), n(setMult));
}
```

**`effectiveInspirationRate`** — multiply by the Insp mult:

```ts
export function effectiveInspirationRate(s: GameState, zoneIndex: number, encounterIndex: number): Num {
  const sidekickMult = 1 + abilitySum(s.party, 'inspRate', s.stars);
  const setMult = activeSetBonus(s.party).inspMult;
  return mul(
    mul(mul(mul(targetInspirationRate(zoneIndex, encounterIndex), bookDifficulty(s)), n(prolificMult(s))), n(sidekickMult)),
    n(setMult),
  );
}
```

**`effectiveWords`** — multiply by the Words mult:

```ts
export function effectiveWords(s: GameState, zoneIndex: number, encounterIndex: number): Num {
  const setMult = activeSetBonus(s.party).wordsMult;
  return mul(mul(mul(targetWords(zoneIndex, encounterIndex), bookDifficulty(s)), n(pageTurnerMult(s))), n(setMult));
}
```

**`effectiveBossRegen`** — add the set regen-cut to the combined reduction (still floored):

```ts
export function effectiveBossRegen(s: GameState, zoneIndex: number, encounterIndex: number): Num {
  const shopReduction = 1 - museMult(s);
  const partyReduction = abilitySum(s.party, 'regenCut', s.stars);
  const setReduction = activeSetBonus(s.party).regenCutAdd;
  const combined = Math.max(PARTY_ABILITY_FLOOR, 1 - (shopReduction + partyReduction + setReduction));
  return mul(mul(targetRegen(zoneIndex, encounterIndex), bookDifficulty(s)), n(combined));
}
```

- [ ] **Step 4: Run typecheck + full suite**

Run: `npx tsc --noEmit && npm test`
Expected: PASS — existing tests unchanged (every existing state has all `variantWorld === null` → `activeSetBonus` is neutral → DPS/insp/words/regen identical).

- [ ] **Step 5: Commit**

```bash
git add src/engine/modifiers.ts src/engine/modifiers.test.ts
git commit -m "feat: world set bonus folds into DPS / Inspiration / Words / boss-regen"
```

---

## Task 4: Edit-drop set axis (`progression.ts`)

**Files:**
- Modify: `src/engine/progression.ts`
- Test: `src/engine/progression.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/engine/progression.test.ts` (add `makeCharacter` to the `./state` import if missing):

```ts
import { makeCharacter } from './state';

describe('Edit-drop set bonus (Slice 3b)', () => {
  it('a Pirate Seas set (world 4, editDrop axis) boosts the boss Edit drop', () => {
    // 2 on world 4 = editDrop tier 1 (+0.25)
    const party = [
      { ...makeCharacter('c0', 'protagonist'), variantWorld: 4 },
      { ...makeCharacter('c1', 'antihero'), variantWorld: 4 },
    ];
    const withSet = { ...initialState(0), party, zone: { zoneIndex: 0, encounterIndex: BOSS_INDEX } };
    const noSet = { ...withSet, party: party.map((c) => ({ ...c, variantWorld: null })) };
    expect(num.gt(onClear(withSet).edits, onClear(noSet).edits)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/progression.test.ts`
Expected: FAIL — Edit drop ignores the set bonus.

- [ ] **Step 3: Write minimal implementation**

In `src/engine/progression.ts`, import `activeSetBonus` and the num multiplier helper, then scale the boss Edit drop:

```ts
import { ZERO, add, mul, n } from './num';
```
```ts
import { unlockNextVariant, activeSetBonus } from './variants';
```

Update the `edits` computation in `onClear`:

```ts
  const edits = clearedBoss
    ? add(state.edits, mul(bossEditDrop(state.bookNumber), n(activeSetBonus(state.party).editDropMult)))
    : state.edits;
```

(The rest of `onClear` is unchanged. `ZERO` may already be imported; ensure `mul` and `n` are added to the `./num` import.)

- [ ] **Step 4: Run typecheck + full suite**

Run: `npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/progression.ts src/engine/progression.test.ts
git commit -m "feat: Edit-drop set axis scales boss Edit drops"
```

---

## Task 5: HUD set-bonus readout (`render.ts`)

**Files:**
- Modify: `src/ui/render.ts`
- Test: `src/ui/render.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/ui/render.test.ts`:

```ts
describe('set-bonus HUD (Slice 3b)', () => {
  it('shows an active world set in the HUD when 2+ share a world', () => {
    const s = initialState(0);
    s.party = s.party.map((c) => ({ ...c, variantWorld: 2 })); // both starters on Space
    render(s);
    const hud = document.getElementById('hud')!.textContent!;
    expect(hud).toContain('Space');
    expect(hud).toMatch(/set/i);
  });

  it('shows no set line when nobody is in a set', () => {
    render(initialState(0)); // all base looks
    expect(document.getElementById('hud')!.textContent).not.toMatch(/set bonus/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/render.test.ts`
Expected: FAIL — no set-bonus HUD line.

- [ ] **Step 3: Write minimal implementation**

In `src/ui/render.ts`, import the breakdown helper and the set table, then add a HUD line. Extend imports:

```ts
import {
  ZONES, TARGETS_PER_BOOK,
  isBossIndex, targetName, targetEmoji, targetsClearedInBook, CLASSES, MAX_STAR, starUpCost,
  WORLD_FACE, worldGenre, WORLD_SET_BONUS,
} from '../engine/content';
```
```ts
import { unlockedWorldsFor, setBonusBreakdown } from '../engine/variants';
```

Build a set-bonus line and add it to the HUD. Insert just before the `el('hud').innerHTML = ...` assignment:

```ts
  const sets = setBonusBreakdown(state.party);
  const setLine = sets.length
    ? `<div>🎭 Sets: ${sets
        .map((s) => `${worldGenre(s.world)} ×${s.count} (+${Math.round(WORLD_SET_BONUS[s.world].tiers[s.tier - 1] * 100)}% ${WORLD_SET_BONUS[s.world].axis})`)
        .join(', ')}</div>`
    : '';
```

Then add `${setLine}` to the HUD template, after the Party DPS line:

```ts
    <div>⚔️ Party DPS: ${fmt(effectivePartyDps(state))}</div>
    ${setLine}`;
```

- [ ] **Step 4: Run typecheck + full suite**

Run: `npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/render.ts src/ui/render.test.ts
git commit -m "feat: HUD shows active world set bonuses"
```

---

## Task 6: Harness check + docs + ship (controller-driven)

**Files:**
- Modify: `README.md`, `docs/superpowers/specs/2026-06-19-plot-armor-party-system-design.md`

- [ ] **Step 1: Confirm the loop still closes**

Run: `npx tsc --noEmit && npm test`, and `BALANCE_REPORT=1 npx vitest run src/engine/balance.test.ts`.
Expected: the harness fields distinct classes on the base look (no set), so its pacing is unchanged from Slice 3a and the two loop-closure assertions hold. (The set bonus only ever helps a player who deliberately fields a themed party.) No harness code change is required; confirm and note the pacing table.

- [ ] **Step 2: Live DOM smoke (controller)**

`npm run build`, serve the built `dist/` (`plotarmor-dist`), and `preview_eval` with a save where 2+ party members wear the same world's variant: confirm the HUD shows the set line, Party DPS reflects a DPS-axis set (e.g., a Space pair), and switching one member off the world drops the bonus — no console errors. (Pixel screenshots remain uncapturable — flag honestly.)

- [ ] **Step 3: Docs**

- `README.md` Status: variants are no longer purely cosmetic — fielding 2/3/5 same-world skins now grants a tiered set bonus whose effect differs per world (Slice 3b). Bump the test count.
- Spec: mark **Slice 3b implemented** in §10 + the top Status line. Note Slice 3 (collection gallery §8 + Protagonist Royalties track §7) and Slice 4 (affinity §9) remain.

- [ ] **Step 4: Commit + push + report**

```bash
git add README.md docs/superpowers/specs/2026-06-19-plot-armor-party-system-design.md
git commit -m "feat: party system Slice 3b — world set bonus"
git push origin main
```

Report final `npm run build` + `npm test`, the per-world axis mapping + tier magnitudes used, and the pushed commit range. Flag the live visual/feel + axis-mapping tuning as the owner's on `npm run dev`.

---

## Self-review (completed during planning)

- **Spec coverage (§6b):** uniform 2/3/5 thresholds → Task 1 (`setTier`/`SET_THRESHOLDS`); bonus type differs per world → Task 1 (`WORLD_SET_BONUS` axis per world); computed from the fielded party incl. Protagonist's cosmetic variant → Task 2 (`worldCounts` counts every party member with a non-null `variantWorld`); folds into the existing `effective*` read-paths → Tasks 3 (DPS/insp/words/regen) + 4 (editDrop). Stacking multiple sets is supported (Task 2 test).
- **Neutral-by-default invariant:** every existing test/state has all `variantWorld === null` → `activeSetBonus` returns all-neutral → DPS/insp/words/regen/editDrop unchanged → ZERO churn to existing numbers. Only new tests exercise the bonus. No save-schema change (derived from Slice-3a state).
- **Layering:** `variants.ts` imports only `content` + `state`; `modifiers.ts` and `progression.ts` import `variants` → acyclic (content → state → variants → {modifiers, progression, ui}).
- **Placeholder honesty:** the 8-world axis mapping and all tier magnitudes are explicit tunable placeholders (3 worlds reuse an axis — Space/Noir = DPS, Zombie/Eldritch = regenCut, Wild West/Prehistoric = Insp — acceptable for MVP; owner can re-map).
- **Type consistency:** `SetAxis`, `SetBonusDef { axis, tiers:[3] }`, `WORLD_SET_BONUS` (len ZONE_COUNT), `setTier(count)`, `SetBonus { dpsMult, inspMult, wordsMult, editDropMult, regenCutAdd }`, `activeSetBonus(party)`, `setBonusBreakdown(party)` — consistent across all tasks. Note `regenCutAdd` is additive (matches how Debuffer/muse reductions combine), the other four are multiplicative.
