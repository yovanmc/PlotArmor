# Party System Slice 4 — Zone Affinity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A fielded character "in its element" (its equipped skin's world matches the current zone) has its **whole contribution** — power *and* class ability — scaled by `1 + AFFINITY_MAG`, creating a per-book mono-vs-rainbow loadout tension on top of the makeup-based set bonus.

**Architecture:** A single pure helper `affinityMult(c, zoneIndex)` in `variants.ts` (sibling of `activeSetBonus`) folds into the existing `effective*` read-paths in `modifiers.ts` — the same pattern as the set bonus and shop upgrades. It is derived entirely from the existing `variantWorld` (save v5) and the live `zoneIndex`, so there is **no save-schema change**. Base-skin characters (`variantWorld === null`) never match a zone index, so affinity is **neutral by default** — fresh games and the balance harness see zero change.

**Tech Stack:** TypeScript (strict) + Vite + Vitest (jsdom) + `break_eternity.js` behind `src/engine/num.ts` + localStorage saves.

**Spec:** `docs/superpowers/specs/2026-06-19-plot-armor-party-system-design.md` §9 (Slice 4, LOCKED).

---

## File Structure

| File | Responsibility | Change |
|------|----------------|--------|
| `src/engine/content.ts` | Tunable constants | **Modify** — add `AFFINITY_MAG`. |
| `src/engine/variants.ts` | Variant ownership/equip + set bonus + (new) affinity | **Modify** — add `affinityMult(c, zoneIndex)`. |
| `src/engine/variants.test.ts` | Variant/set/affinity unit tests | **Modify** — add affinity helper tests. |
| `src/engine/modifiers.ts` | `effective*` read-paths | **Modify** — thread `zoneIndex` into the private `abilitySum`; apply affinity in `effectivePartyDps` + forward zone from `effectiveInspirationRate`/`effectiveBossRegen`. |
| `src/engine/modifiers.test.ts` | Modifier unit tests | **Modify** — add affinity boost / neutrality / Plot-Armor-exclusion tests. |
| `src/ui/render.ts` | DOM render layer | **Modify** — card `✨` marker + HUD affinity line. |
| `src/ui/render.test.ts` | Render unit tests | **Modify** — affinity UI tests. |
| `README.md` | Status | **Modify** — Slice 4 status paragraph. |

**Layering stays acyclic:** content → variants → modifiers → render. No new module, no new dependency.

**Key facts the implementer needs:**
- `Character` has `variantWorld: number | null` (null = base look). `GameState.zone` is `{ zoneIndex, encounterIndex }`. `initialState(0)` starts in `zoneIndex: 0` with party `[protagonist, antihero]` (both `variantWorld: null`).
- `makeCharacter(id, classId, level = 1)` returns a `Character` with `variantWorld: null`.
- `effectivePartyDps(s)` takes only the state; it must read `s.zone.zoneIndex` itself. `effectiveInspirationRate(s, zoneIndex, encounterIndex)` and `effectiveBossRegen(s, zoneIndex, encounterIndex)` already receive `zoneIndex`.
- `abilitySum` is **module-private** in `modifiers.ts` — changing its signature touches only its 3 in-file callers, no exported API changes.
- `num` helpers: `num.toNum`, `num.eq`, `num.gt`, `num.lt`, `num.mul`, `num.n`, `num.add`, `num.ZERO`.

---

### Task 1: `AFFINITY_MAG` constant + `affinityMult` helper

**Files:**
- Modify: `src/engine/content.ts` (after the `WORLD_SET_BONUS` block, ~line 300, before the `--- Protagonist track` section)
- Modify: `src/engine/variants.ts` (import line 4; new function after `setBonusBreakdown`, ~line 87)
- Test: `src/engine/variants.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/engine/variants.test.ts`. Add `affinityMult` to the import from `./variants` on line 3, and `AFFINITY_MAG` import from `./content`:

```ts
import { affinityMult } from './variants';
import { AFFINITY_MAG } from './content';

describe('zone affinity helper (Slice 4)', () => {
  it('boosts a character whose skin matches the current zone', () => {
    const c = { ...makeCharacter('c', 'antihero'), variantWorld: 2 };
    expect(affinityMult(c, 2)).toBeCloseTo(1 + AFFINITY_MAG, 6);
  });

  it('is neutral (1) when the skin does not match the current zone', () => {
    const c = { ...makeCharacter('c', 'antihero'), variantWorld: 2 };
    expect(affinityMult(c, 5)).toBe(1);
  });

  it('is neutral (1) for a base-skin character (variantWorld null) in any zone', () => {
    const c = makeCharacter('c', 'antihero'); // variantWorld null
    expect(affinityMult(c, 0)).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "C:/Agent Projects/PlotArmor" && npx vitest run src/engine/variants.test.ts`
Expected: FAIL — `affinityMult` / `AFFINITY_MAG` are not exported.

- [ ] **Step 3: Add the constant in `content.ts`**

Insert immediately **after** the `WORLD_SET_BONUS` array (after the closing `];` near line 300) and **before** the `// --- Protagonist track` comment:

```ts
// --- zone affinity (Slice 4) ------------------------------------------------
// A fielded character is "in its element" when its equipped skin's world matches
// the CURRENT zone. While in its element, its WHOLE contribution (power + class
// ability) is scaled by 1 + AFFINITY_MAG. Distinct from the makeup-based set
// bonus (§6b): affinity is dynamic per-zone. Harness-/owner-tuned placeholder.
export const AFFINITY_MAG = 0.5;
```

- [ ] **Step 4: Add the helper in `variants.ts`**

Extend the content import on line 4 to include `AFFINITY_MAG`:

```ts
import { ClassId, VARIANT_UNLOCK_ORDER, WORLD_SET_BONUS, setTier, AFFINITY_MAG } from './content';
```

Append after `setBonusBreakdown` (end of file):

```ts
// --- zone affinity (Slice 4) ------------------------------------------------
// A fielded character is "in its element" when its equipped skin's world matches
// the CURRENT zone (c.variantWorld === zoneIndex). While in its element, its whole
// contribution is scaled by 1 + AFFINITY_MAG. Base-skin characters (variantWorld
// === null) never equal a zone index, so affinity is neutral by default.
export function affinityMult(c: Character, zoneIndex: number): number {
  return c.variantWorld === zoneIndex ? 1 + AFFINITY_MAG : 1;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd "C:/Agent Projects/PlotArmor" && npx vitest run src/engine/variants.test.ts`
Expected: PASS (all variant tests, including the 3 new affinity tests).

- [ ] **Step 6: Typecheck**

Run: `cd "C:/Agent Projects/PlotArmor" && npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 7: Commit**

```bash
git add src/engine/content.ts src/engine/variants.ts src/engine/variants.test.ts
git commit -m "feat: AFFINITY_MAG + affinityMult helper (zone affinity, Slice 4)"
```

---

### Task 2: Fold affinity into the `effective*` modifier read-paths

**Files:**
- Modify: `src/engine/modifiers.ts` (import line 12; `abilitySum` line 25; `effectiveInspirationRate` line 38; `effectiveBossRegen` line 51; `effectivePartyDps` line 69)
- Test: `src/engine/modifiers.test.ts`

This is the core of the slice: a home character's **power** (DPS loop) and **class ability** (`abilitySum`) are both scaled. The Protagonist's **Plot Armor** signature is deliberately **not** scaled.

- [ ] **Step 1: Write the failing tests**

Append to `src/engine/modifiers.test.ts`. Add `AFFINITY_MAG` and `BOSS_INDEX` (BOSS_INDEX is already imported on line 6) — extend the `./content` import to include `AFFINITY_MAG`:

```ts
import { AFFINITY_MAG } from './content';

describe('zone affinity (Slice 4)', () => {
  // initialState(0) starts in zoneIndex 0.
  it('a home Anti-hero (skin matches current zone) raises party DPS vs off-zone', () => {
    const base = initialState(0);
    const home = { ...base, party: base.party.map((c) => (c.classId === 'antihero' ? { ...c, variantWorld: 0 } : c)) };
    const away = { ...base, party: base.party.map((c) => (c.classId === 'antihero' ? { ...c, variantWorld: 3 } : c)) };
    expect(num.gt(M.effectivePartyDps(home), M.effectivePartyDps(away))).toBe(true);
  });

  it('is neutral for a base-skin party — DPS is identical regardless of current zone', () => {
    const z0 = initialState(0);                       // all base looks, zone 0
    const z5 = { ...z0, zone: { ...z0.zone, zoneIndex: 5 } };
    expect(num.eq(M.effectivePartyDps(z0), M.effectivePartyDps(z5))).toBe(true);
  });

  it('a home Support raises party DPS vs the same Support off-zone', () => {
    const base = { ...initialState(0), party: [makeCharacter('p', 'protagonist'), makeCharacter('s', 'support', 10)] };
    const home = { ...base, party: base.party.map((c) => (c.classId === 'support' ? { ...c, variantWorld: 0 } : c)) };
    const away = { ...base, party: base.party.map((c) => (c.classId === 'support' ? { ...c, variantWorld: 3 } : c)) };
    expect(num.gt(M.effectivePartyDps(home), M.effectivePartyDps(away))).toBe(true);
  });

  it('a home Sidekick raises the Inspiration rate vs off-zone (inspRate ability scaled)', () => {
    const base = { ...initialState(0), party: [makeCharacter('p', 'protagonist'), makeCharacter('k', 'sidekick', 10)] };
    const home = { ...base, party: base.party.map((c) => (c.classId === 'sidekick' ? { ...c, variantWorld: 0 } : c)) };
    const away = { ...base, party: base.party.map((c) => (c.classId === 'sidekick' ? { ...c, variantWorld: 3 } : c)) };
    expect(num.gt(M.effectiveInspirationRate(home, 0, 0), M.effectiveInspirationRate(away, 0, 0))).toBe(true);
  });

  it('a home Debuffer cuts boss regen MORE than off-zone (regenCut ability scaled)', () => {
    const base = { ...initialState(0), party: [makeCharacter('p', 'protagonist'), makeCharacter('d', 'debuffer', 10)] };
    const home = { ...base, party: base.party.map((c) => (c.classId === 'debuffer' ? { ...c, variantWorld: 1 } : c)) };
    const away = { ...base, party: base.party.map((c) => (c.classId === 'debuffer' ? { ...c, variantWorld: 3 } : c)) };
    expect(num.lt(M.effectiveBossRegen(home, 1, BOSS_INDEX), M.effectiveBossRegen(away, 1, BOSS_INDEX))).toBe(true);
  });

  it('does NOT scale Plot Armor: a lone home Protagonist gains exactly 1 + AFFINITY_MAG (power only)', () => {
    // Single-protagonist party: no set, no support/loneWolf terms. Away DPS =
    // power x plotArmor. Home DPS = (power x affinity) x plotArmor (plotArmor
    // unchanged). So home/away == 1 + AFFINITY_MAG exactly. If affinity ALSO
    // scaled Plot Armor, this ratio would exceed 1 + AFFINITY_MAG.
    const base = { ...initialState(0), party: [makeCharacter('p', 'protagonist')] };
    const home = { ...base, party: [{ ...base.party[0], variantWorld: 0 }] };
    const away = { ...base, party: [{ ...base.party[0], variantWorld: 3 }] };
    const ratio = num.toNum(M.effectivePartyDps(home)) / num.toNum(M.effectivePartyDps(away));
    expect(ratio).toBeCloseTo(1 + AFFINITY_MAG, 6);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "C:/Agent Projects/PlotArmor" && npx vitest run src/engine/modifiers.test.ts`
Expected: FAIL — affinity not yet applied (home == away for the boost tests; the Plot-Armor ratio test fails because the ratio is currently 1).

- [ ] **Step 3: Import the helper in `modifiers.ts`**

Change line 12 from:

```ts
import { activeSetBonus } from './variants';
```

to:

```ts
import { activeSetBonus, affinityMult } from './variants';
```

- [ ] **Step 4: Thread `zoneIndex` into `abilitySum` and scale each ability term**

Replace the `abilitySum` function (lines 25–32) with:

```ts
function abilitySum(party: Character[], kind: AbilityKind, stars: Record<ClassId, number>, zoneIndex: number): number {
  let total = 0;
  for (const c of party) {
    const ab = findClass(c.classId).ability;
    if (ab.kind === kind) total += ab.mag * c.level * starAbilityMult(stars[c.classId]) * affinityMult(c, zoneIndex);
  }
  return total;
}
```

- [ ] **Step 5: Forward `zoneIndex` from the two ability callers that already have it**

In `effectiveInspirationRate` (line 39), change:

```ts
  const sidekickMult = 1 + abilitySum(s.party, 'inspRate', s.stars);
```

to:

```ts
  const sidekickMult = 1 + abilitySum(s.party, 'inspRate', s.stars, zoneIndex);
```

In `effectiveBossRegen` (line 54), change:

```ts
  const partyReduction = abilitySum(s.party, 'regenCut', s.stars);   // additional cut from Debuffers
```

to:

```ts
  const partyReduction = abilitySum(s.party, 'regenCut', s.stars, zoneIndex);   // additional cut from Debuffers
```

- [ ] **Step 6: Apply affinity to power + ability in `effectivePartyDps`**

Replace the body of `effectivePartyDps` (lines 69–85) with:

```ts
export function effectivePartyDps(s: GameState): Num {
  const zoneIndex = s.zone.zoneIndex;
  let sum = ZERO;
  for (const c of s.party) {
    const ab = findClass(c.classId).ability;
    const selfMult = ab.kind === 'loneWolf'
      ? 1 + ab.mag * c.level * starAbilityMult(s.stars[c.classId]) // Lone Wolf amps only itself
      : 1;
    const aff = affinityMult(c, zoneIndex); // home character: scale its whole contribution (power + Lone Wolf)
    sum = add(sum, mul(mul(effectiveCharacterPower(s, c), n(selfMult)), n(aff)));
  }
  const supportMult = 1 + abilitySum(s.party, 'partyDps', s.stars, zoneIndex);
  const hasProtagonist = s.party.some((c) => c.classId === 'protagonist');
  const plotArmorMult = hasProtagonist
    ? 1 + findClass('protagonist').ability.mag * distinctClassCount(s.party) * starAbilityMult(s.stars.protagonist)
    : 1; // Plot Armor is a party-variety signature — deliberately NOT affinity-scaled (§9)
  const setMult = activeSetBonus(s.party).dpsMult;
  return mul(mul(mul(mul(sum, n(sharpMult(s))), n(supportMult)), n(plotArmorMult)), n(setMult));
}
```

- [ ] **Step 7: Run the modifier tests to verify they pass**

Run: `cd "C:/Agent Projects/PlotArmor" && npx vitest run src/engine/modifiers.test.ts`
Expected: PASS (all existing tests + the 6 new affinity tests). The existing book-1 parity tests still pass because the starting party wears base skins (affinity neutral).

- [ ] **Step 8: Typecheck**

Run: `cd "C:/Agent Projects/PlotArmor" && npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 9: Commit**

```bash
git add src/engine/modifiers.ts src/engine/modifiers.test.ts
git commit -m "feat: zone affinity scales a home character's whole contribution (Slice 4)"
```

---

### Task 3: UI — card `✨` marker + HUD affinity line

**Files:**
- Modify: `src/ui/render.ts` (import line 3–8; HUD block ~line 40; card map ~line 56)
- Test: `src/ui/render.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/ui/render.test.ts`:

```ts
describe('zone affinity UI (Slice 4)', () => {
  beforeEach(() => { document.body.innerHTML = HTML; });

  it('marks a fielded character in its element and shows the HUD affinity line', () => {
    const s = initialState(0); // zone 0
    s.party = s.party.map((c) => (c.classId === 'antihero' ? { ...c, variantWorld: 0 } : c));
    render(s);
    expect(document.getElementById('party')!.textContent).toContain('✨');
    expect(document.getElementById('hud')!.textContent).toMatch(/in element/i);
  });

  it('shows no affinity line when nobody matches the current zone', () => {
    const s = initialState(0); // zone 0
    s.party = s.party.map((c) => (c.classId === 'antihero' ? { ...c, variantWorld: 3 } : c)); // skin != zone
    render(s);
    expect(document.getElementById('hud')!.textContent).not.toMatch(/in element/i);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "C:/Agent Projects/PlotArmor" && npx vitest run src/ui/render.test.ts`
Expected: FAIL — no `✨` marker / no "In element" line yet.

- [ ] **Step 3: Import `AFFINITY_MAG` in `render.ts`**

Extend the `../engine/content` import (lines 4–8) to include `AFFINITY_MAG`. The current import block ends with `WORLD_FACE, worldGenre, WORLD_SET_BONUS,` — add `AFFINITY_MAG`:

```ts
import {
  ZONES, TARGETS_PER_BOOK,
  isBossIndex, targetName, targetEmoji, targetsClearedInBook, CLASSES, MAX_STAR, starUpCost,
  WORLD_FACE, worldGenre, WORLD_SET_BONUS, AFFINITY_MAG,
} from '../engine/content';
```

- [ ] **Step 4: Add the HUD affinity line**

In `render`, after the `setLine` declaration (the block ending `: '';` near line 38) and before `el('hud').innerHTML = ...`, add:

```ts
  const inElementCount = state.party.filter((c) => c.variantWorld !== null && c.variantWorld === zoneIndex).length;
  const affinityLine = inElementCount > 0
    ? `<div>✨ In element: ${inElementCount} (+${Math.round(AFFINITY_MAG * 100)}% each)</div>`
    : '';
```

Then add `${affinityLine}` to the HUD template, right after `${setLine}`:

```ts
    ⚔️ Party DPS: ${fmt(effectivePartyDps(state))}</div>
    ${setLine}
    ${affinityLine}`;
```

(`zoneIndex` is already destructured at the top of `render` from `state.zone`.)

- [ ] **Step 5: Add the per-card `✨` marker**

In the `cards` map, after the `skinTag` line (~line 66), add:

```ts
      const inElement = c.variantWorld !== null && c.variantWorld === zoneIndex;
      const affinityTag = inElement ? `<div class="caffinity">✨ In element</div>` : '';
```

Then insert `${affinityTag}` into the card markup, right after `${skinTag}`:

```ts
      return `
      <div class="card"${accentStyle}>
        <div class="cemoji">${face}</div>
        <div class="cname">${c.name}</div>
        ${skinTag}
        ${affinityTag}
        ${starRow}
```

- [ ] **Step 6: Run the render tests to verify they pass**

Run: `cd "C:/Agent Projects/PlotArmor" && npx vitest run src/ui/render.test.ts`
Expected: PASS (all existing render tests + the 2 new affinity tests).

- [ ] **Step 7: Typecheck**

Run: `cd "C:/Agent Projects/PlotArmor" && npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 8: Commit**

```bash
git add src/ui/render.ts src/ui/render.test.ts
git commit -m "feat: card ✨ marker + HUD affinity line (Slice 4)"
```

---

### Task 4: Verify balance unchanged, full suite + build, docs, ship

**Files:**
- Modify: `README.md` (Status section)

- [ ] **Step 1: Confirm the balance harness pacing is unchanged**

Affinity is neutral-by-default and the greedy harness fields base skins, so the loop must close exactly as before.

Run: `cd "C:/Agent Projects/PlotArmor" && npx vitest run src/engine/balance.test.ts`
Expected: PASS (book 1 publishable, books 1–8 complete) with no change to the assertions.

Optional verbose check: `cd "C:/Agent Projects/PlotArmor" && BALANCE_REPORT=1 npx vitest run src/engine/balance.test.ts` — the per-book timings should match the pre-Slice-4 report (affinity never fires).

- [ ] **Step 2: Run the full test suite**

Run: `cd "C:/Agent Projects/PlotArmor" && npm test 2>&1 | grep -E "Test Files|Tests "`
Expected: all tests pass (152 prior + 3 Task 1 + 6 Task 2 + 2 Task 3 = **163**).

- [ ] **Step 3: Build**

Run: `cd "C:/Agent Projects/PlotArmor" && npm run build 2>&1 | tail -2`
Expected: `✓ built` with no TypeScript errors.

- [ ] **Step 4: Update the README Status section**

In `README.md`, after the Protagonist-track paragraph (the one ending "Promotion costs are tunable placeholders."), add a new paragraph:

```markdown
Skins now also have **mechanical teeth in the current zone (Slice 4 of the party system)**: a fielded
character "in its element" — its equipped skin's world matches the zone you're currently fighting in —
has its **whole contribution** (its own damage *and* its class ability) scaled by a flat affinity bonus.
This is distinct from the set bonus: the set bonus rewards a cohesive same-world party (always on);
affinity rewards matching the *current* zone (dynamic as you advance zone-to-zone through a book). The
two pull on the same lever — your equipped skins — so each book is a loadout choice: commit to one world
for an always-on set bonus plus a big affinity spike in that one zone, or spread skins across worlds for
steady affinity everywhere. The Protagonist's Plot Armor signature is deliberately left unscaled. Derived
entirely from existing data (no save change), neutral when nobody is in their element (the balance harness
is unaffected). All headless-tested (163 passing tests) plus a live DOM smoke; `npm run build` is green.
The affinity magnitude is a tunable placeholder.
```

Then update the headline Status sentence (line 18) to mention affinity — change the trailing "collectible world skins & set bonuses" to "collectible world skins, set bonuses & zone affinity".

Add the plan link to the "Plans:" list near the bottom: append `· [party Slice 4](docs/superpowers/plans/2026-06-19-plot-armor-party-slice4.md)` after the Protagonist track link.

- [ ] **Step 5: Commit and push**

```bash
git add README.md
git commit -m "docs: README status for Slice 4 zone affinity"
git push origin main
```

Report the final `npm test` count, `npm run build` size line, and the pushed commit range.

---

## Notes for the controller (post-implementation)

- After Task 4, dispatch a final whole-feature reviewer over the Slice 4 commit range, then update memory (`project_plotarmor.md` + the `MEMORY.md` index line) with a Slice 4 entry, and report.
- Live DOM smoke (built `dist/`, served via the `plotarmor-dist` preview config): inject a save with a fielded character whose `variantWorld` matches the starting zone (0), confirm the card `✨` + HUD "In element" line appear and Party DPS reflects the boost; then set `variantWorld` to a non-zero world and confirm the marker/line clear. Pixel screenshots remain uncapturable in the headless tab — verify via `preview_eval` DOM reads (synchronous), consistent with prior slices.
