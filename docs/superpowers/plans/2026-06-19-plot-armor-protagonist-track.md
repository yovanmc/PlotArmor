# Plot Armor — Protagonist Track Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the player promote the Protagonist 1★→5★ by spending Royalties in the Publishing House, scaling its base power (via the existing star machinery) and its Plot Armor signature.

**Architecture:** Reuse the per-class star system: the Protagonist's `stars.protagonist` slot (pinned at 1 in Slice 2) is allowed to rise. Its base power already scales for free (`effectiveCharacterPower` applies `starStatMult` to every class); we additionally scale its Plot Armor by `starAbilityMult(stars.protagonist)`. A new Royalty-funded `promoteProtagonist` action lives with the other Royalty spending in `prestige.ts`, surfaced in the existing Publishing House modal. **No save-schema change** — `stars.protagonist` is already persisted/sanitized.

**Tech Stack:** TypeScript (strict) + Vite + Vitest (jsdom) + `break_eternity.js` behind `num.ts`. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-06-19-plot-armor-party-system-design.md` §7 (Protagonist track — LOCKED).

---

## Conventions (read once)

- **Commit identity:** plain `git commit` with the repo's configured global identity (`yovanmc <yovanmc@users.noreply.github.com>`). NEVER `--author`, NEVER per-commit `user.email`, NEVER `--no-verify`.
- **Do NOT push** until the final task.
- Run from `C:\Agent Projects\PlotArmor`. Verify each task with `npx tsc --noEmit` + `npm test`.
- **Neutral-by-default invariant:** a fresh game has `stars.protagonist === 1`, so `starStatMult(1) = starAbilityMult(1) = 1` → base power and Plot Armor are unchanged → existing tests keep their exact numbers. Only new tests exercise a promoted Protagonist.
- Cost magnitudes are tunable placeholders.

## File map

| File | Change | Task |
|------|--------|------|
| `src/engine/content.ts` | `protagonistPromoteCost` + constants | 1 |
| `src/engine/prestige.ts` | `canPromoteProtagonist`, `promoteProtagonist` | 2 |
| `src/engine/modifiers.ts` | Plot Armor scales with the Protagonist's stars | 3 |
| `src/ui/shop.ts` | "The Protagonist" promote section + handler | 4 |
| `src/ui/render.ts` | Protagonist card shows real ★ pips | 4 |
| `README.md`, spec status | docs + ship | 5 |

---

## Task 1: Promotion cost curve (`content.ts`)

**Files:**
- Modify: `src/engine/content.ts` (append after the Slice-3b set-bonus block, before `// --- party classes (Slice 1)`)
- Test: `src/engine/content.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/engine/content.test.ts`:

```ts
import { protagonistPromoteCost } from './content';

describe('Protagonist promotion cost (Protagonist track)', () => {
  it('is positive and rises with the current star', () => {
    expect(num.gt(protagonistPromoteCost(1), num.ZERO)).toBe(true);
    expect(num.gt(protagonistPromoteCost(2), protagonistPromoteCost(1))).toBe(true);
    expect(num.gt(protagonistPromoteCost(4), protagonistPromoteCost(3))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/content.test.ts`
Expected: FAIL — `protagonistPromoteCost` not exported.

- [ ] **Step 3: Write minimal implementation**

In `src/engine/content.ts`, insert before `// --- party classes (Slice 1) -------------------------------------------------`:

```ts
// --- Protagonist track (Royalty-funded promotion) ---------------------------
// The Protagonist has no Edits stars; it is PROMOTED 1*->MAX_STAR with Royalties
// in the Publishing House. Cost rises per star. Tunable placeholders (Royalties
// are scarce, so this is a long-term prestige sink).
export const PROTAGONIST_PROMOTE_BASE = n(3);  // Royalties for 1*->2*
export const PROTAGONIST_PROMOTE_GROWTH = 2;   // cost escalation per star

export function protagonistPromoteCost(currentStar: number): Num {
  return mul(PROTAGONIST_PROMOTE_BASE, pow(n(PROTAGONIST_PROMOTE_GROWTH), currentStar - 1));
}
```

`n`, `mul`, `pow`, `Num` are already imported at the top of `content.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/content.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/content.ts src/engine/content.test.ts
git commit -m "feat: Royalty cost curve for Protagonist promotion"
```

---

## Task 2: Promote action (`prestige.ts`)

**Files:**
- Modify: `src/engine/prestige.ts`
- Test: `src/engine/prestige.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/engine/prestige.test.ts` (it already tests prestige; add these imports if missing: `import { canPromoteProtagonist, promoteProtagonist } from './prestige';`, `import { initialState } from './state';`, `import * as num from './num';`):

```ts
describe('Protagonist promotion (Protagonist track)', () => {
  it('promotes by spending Royalties and raising the protagonist star', () => {
    const s = { ...initialState(0), royalties: num.n('1e6') };
    const after = promoteProtagonist(s);
    expect(after.stars.protagonist).toBe(2);
    expect(num.lt(after.royalties, s.royalties)).toBe(true);
  });

  it('refuses without enough Royalties (no-op, same ref)', () => {
    const s = { ...initialState(0), royalties: num.ZERO };
    expect(canPromoteProtagonist(s)).toBe(false);
    expect(promoteProtagonist(s)).toBe(s);
  });

  it('refuses past MAX_STAR', () => {
    const fresh = initialState(0);
    const maxed = { ...fresh, royalties: num.n('1e9'), stars: { ...fresh.stars, protagonist: 5 } };
    expect(canPromoteProtagonist(maxed)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/prestige.test.ts`
Expected: FAIL — `canPromoteProtagonist`/`promoteProtagonist` not exported.

- [ ] **Step 3: Write minimal implementation**

In `src/engine/prestige.ts`, extend the content import and append the two functions. The existing num import already includes `sub` and `gte`.

```ts
import { findUpgrade, UpgradeId, ROYALTY_K, ROYALTY_W0, MAX_STAR, protagonistPromoteCost } from './content';
```

```ts
export function canPromoteProtagonist(state: GameState): boolean {
  const cur = state.stars.protagonist;
  if (cur >= MAX_STAR) return false;
  return gte(state.royalties, protagonistPromoteCost(cur));
}

export function promoteProtagonist(state: GameState): GameState {
  if (!canPromoteProtagonist(state)) return state;
  const cur = state.stars.protagonist;
  return {
    ...state,
    royalties: sub(state.royalties, protagonistPromoteCost(cur)),
    stars: { ...state.stars, protagonist: cur + 1 },
  };
}
```

- [ ] **Step 4: Run typecheck + full suite**

Run: `npx tsc --noEmit && npm test`
Expected: PASS. (Promotion persists across `publish` automatically — `publish` builds from `...state`, and `stars` is carried.)

- [ ] **Step 5: Commit**

```bash
git add src/engine/prestige.ts src/engine/prestige.test.ts
git commit -m "feat: promoteProtagonist spends Royalties to raise the Protagonist star (capped at MAX_STAR)"
```

---

## Task 3: Plot Armor scales with the Protagonist's stars (`modifiers.ts`)

**Files:**
- Modify: `src/engine/modifiers.ts`
- Test: `src/engine/modifiers.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/engine/modifiers.test.ts`:

```ts
describe('Plot Armor scales with the Protagonist star (Protagonist track)', () => {
  it('a promoted Protagonist raises party DPS vs a 1-star Protagonist', () => {
    const base = initialState(0); // protagonist at 1 star
    const promoted = { ...base, stars: { ...base.stars, protagonist: 4 } };
    expect(num.gt(effectivePartyDps(promoted), effectivePartyDps(base))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/modifiers.test.ts`
Expected: FAIL — Plot Armor (and protagonist base power... note: base power already scales via `effectiveCharacterPower`, so this test may already partially pass from base-power scaling alone). To make this test specifically prove the Plot Armor change, ALSO add this stricter assertion that isolates the ability:

```ts
  it('the Plot Armor multiplier itself grows with the Protagonist star', () => {
    // Hold base power constant by comparing the ratio contributed beyond raw sum.
    // A 1-protagonist + 1-antihero party: raise ONLY the protagonist star and
    // confirm DPS rises by MORE than the protagonist's own base-power increase.
    const base = initialState(0);
    const promoted = { ...base, stars: { ...base.stars, protagonist: 5 } };
    const baseDps = num.toNum(effectivePartyDps(base));
    const promotedDps = num.toNum(effectivePartyDps(promoted));
    // base-power-only scaling would multiply just the protagonist's share; Plot
    // Armor scaling multiplies the whole-party product, so the gain is larger.
    expect(promotedDps / baseDps).toBeGreaterThan(1.5);
  });
```

> NOTE for the implementer: base power scaling alone (already shipped) would make the first assertion pass, so the SECOND assertion is the one that actually pins the Plot Armor change. If you find the ratio threshold brittle after tuning, keep it conservative but > the ratio achievable by base-power scaling alone (compute both to pick a safe bound). The goal is a test that fails without the Plot Armor edit.

- [ ] **Step 3: Write minimal implementation**

In `src/engine/modifiers.ts`, scale the Plot Armor multiplier in `effectivePartyDps` by the Protagonist's `starAbilityMult` (`starAbilityMult` is already imported from Slice 2):

```ts
  const plotArmorMult = hasProtagonist
    ? 1 + findClass('protagonist').ability.mag * distinctClassCount(s.party) * starAbilityMult(s.stars.protagonist)
    : 1;
```

(At `stars.protagonist === 1`, `starAbilityMult(1) === 1`, so this is identical to the current formula — existing tests unchanged.)

- [ ] **Step 4: Run typecheck + full suite**

Run: `npx tsc --noEmit && npm test`
Expected: PASS — existing tests unchanged (1★ protagonist → neutral); new tests green.

- [ ] **Step 5: Commit**

```bash
git add src/engine/modifiers.ts src/engine/modifiers.test.ts
git commit -m "feat: Plot Armor signature scales with the Protagonist's star tier"
```

---

## Task 4: Publishing House promote UI + card pips (`shop.ts`, `render.ts`)

**Files:**
- Modify: `src/ui/shop.ts`
- Modify: `src/ui/render.ts`
- Test: `src/ui/shop.test.ts`, `src/ui/render.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/ui/shop.test.ts` (match its existing setup; it renders into a jsdom `#shop-body` and uses `initialState` + `* as num` — add imports as needed):

```ts
import { canPromoteProtagonist } from '../engine/prestige';

describe('Protagonist promote section (Protagonist track)', () => {
  it('renders a Protagonist section with a promote button', () => {
    renderShop({ ...initialState(0), royalties: num.n('1e6') });
    expect(document.getElementById('shop-body')!.textContent).toContain('The Protagonist');
    expect(document.querySelector('#shop-body button[data-action="promote"]')).not.toBeNull();
  });

  it('disables promote when Royalties are insufficient', () => {
    renderShop({ ...initialState(0), royalties: num.ZERO });
    const btn = document.querySelector('#shop-body button[data-action="promote"]') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
```

Append to `src/ui/render.test.ts`:

```ts
describe('Protagonist card pips (Protagonist track)', () => {
  it('shows star pips for the Protagonist instead of a dash', () => {
    render(initialState(0));
    const party = document.getElementById('party')!;
    expect(party.textContent).toContain('★');
    // the Protagonist card has no card-level star-up button (promotion is shop-only)
    expect(document.querySelector('#party [data-action="starup"][data-class="protagonist"]')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/ui/shop.test.ts src/ui/render.test.ts`
Expected: FAIL — no promote section; the Protagonist card currently shows "—".

- [ ] **Step 3: Write minimal implementation**

(a) `src/ui/render.ts` — make the star row show pips for every class (the Protagonist now has a real star); keep the card star-up button hidden for the Protagonist. Replace the `starRow` definition:

```ts
      const stars = state.stars[c.classId];
      const isProtagonist = c.classId === 'protagonist';
      const starRow = `<div class="cstars">${'★'.repeat(stars)}${'☆'.repeat(MAX_STAR - stars)}</div>`;
      const starBtn = (!isProtagonist && stars < MAX_STAR)
        ? `<button data-action="starup" data-class="${c.classId}" ${canStarUp(state, c.classId) ? '' : 'disabled'}>★ Up (✏️${fmt(starUpCost(stars))})</button>`
        : '';
```

(`isProtagonist` is still used by `starBtn`, so no unused-var error.)

(b) `src/ui/shop.ts` — extend imports and add the Protagonist section + click handling. Imports:

```ts
import { REPEATABLE_UPGRADES, ONE_TIME_UPGRADES, UpgradeId, MAX_STAR, protagonistPromoteCost } from '../engine/content';
import { upgradeCost, canBuy, isOwned, buyUpgrade, canPromoteProtagonist, promoteProtagonist } from '../engine/prestige';
```

Build the Protagonist row and insert it as its own section. In `renderShop`, before the `el('shop-body').innerHTML = ...` assignment:

```ts
  const protStars = state.stars.protagonist;
  const promoteControl = protStars >= MAX_STAR
    ? '<span class="shop-owned">★★★★★ Max</span>'
    : `<button class="shop-buy" data-action="promote" ${canPromoteProtagonist(state) ? '' : 'disabled'}>💰 ${fmt(protagonistPromoteCost(protStars))}</button>`;
  const protRow = `
    <div class="shop-row">
      <div class="shop-row-info">
        <div class="shop-row-name">The Protagonist <span class="shop-lv">${'★'.repeat(protStars)}${'☆'.repeat(MAX_STAR - protStars)}</span></div>
        <div class="shop-row-desc">Promote the lead: +stats and a stronger Plot Armor</div>
      </div>
      ${promoteControl}
    </div>`;
```

Then add the section to the template (place it first, above Upgrades):

```ts
  el('shop-body').innerHTML = `
    <div class="shop-head">
      <span class="shop-title">Publishing House</span>
      <span class="shop-balance">💰 ${fmt(state.royalties)}</span>
    </div>
    <div class="shop-section-label">The Protagonist</div>
    ${protRow}
    <div class="shop-section-label">Upgrades</div>
    ${repeatable}
    <div class="shop-section-label">Unlocks</div>
    ${oneTime}`;
```

Update the `shop-body` click handler to handle promote as well as buy:

```ts
  el('shop-body').addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('button[data-action="promote"]')) {
      setState(promoteProtagonist(getState()));
      renderShop(getState());
      return;
    }
    const btn = target.closest('button[data-action="buy"]');
    if (!btn) return;
    const id = btn.getAttribute('data-id') as UpgradeId | null;
    if (!id) return;
    setState(buyUpgrade(getState(), id));
    renderShop(getState());
  });
```

- [ ] **Step 4: Run typecheck + full suite**

Run: `npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/shop.ts src/ui/render.ts src/ui/shop.test.ts src/ui/render.test.ts
git commit -m "feat: Publishing House promotes the Protagonist; card shows its star pips"
```

---

## Task 5: Verify + docs + ship (controller-driven)

**Files:**
- Modify: `README.md`, `docs/superpowers/specs/2026-06-19-plot-armor-party-system-design.md`

- [ ] **Step 1: Full verification**

Run: `npx tsc --noEmit && npm test`, and `BALANCE_REPORT=1 npx vitest run src/engine/balance.test.ts`.
Expected: all green; harness pacing UNCHANGED — the greedy sim doesn't spend Royalties (same as it ignores shop upgrades), so the Protagonist stays 1★ and Plot Armor stays neutral. Note this in the report (promotion is an optional Royalty sink the sim doesn't use).

- [ ] **Step 2: Live DOM smoke (controller)**

`npm run build`, serve the built `dist/` (`plotarmor-dist`), and `preview_eval` with a save that has Royalties: open the Publishing House, confirm a "The Protagonist" section with a promote button, click it, and verify the protagonist star pip increments, Royalties drop, and Party DPS rises — with the protagonist card now showing pips. No console errors. (Pixel screenshots remain uncapturable — flag honestly.)

- [ ] **Step 3: Docs**

- `README.md` Status: note the Protagonist now has its own **Royalty-funded promotion track** (1★→5★ in the Publishing House) that scales its power and Plot Armor. Bump the test count.
- Spec: in §10, mark the Protagonist track implemented; update the top Status line (remove it from the deferred follow-ups).

- [ ] **Step 4: Commit + push + report**

```bash
git add README.md docs/superpowers/specs/2026-06-19-plot-armor-party-system-design.md
git commit -m "feat: Protagonist Royalty promotion track"
git push origin main
```

Report final `npm run build` + `npm test`, the cost-curve placeholders, and the pushed commit range. Flag the live visual/feel + cost tuning as the owner's on `npm run dev`.

---

## Self-review (completed during planning)

- **Spec coverage (§7):** promote 1★→5★ with Royalties → Tasks 1,2; base power scales via existing `starStatMult` (no change needed) + Plot Armor scales via `starAbilityMult` → Task 3; promotion in the Publishing House, not the card → Task 4 (shop section + card shows pips but no card button); caps at MAX_STAR → Task 2; no save change → confirmed (`stars.protagonist` already persisted/sanitized).
- **Neutral-by-default invariant:** fresh `stars.protagonist === 1` → `starStatMult(1) = starAbilityMult(1) = 1` → base power + Plot Armor identical → existing tests unchanged. Only new tests exercise a promoted Protagonist. (Task 3's second assertion is specifically designed to fail without the Plot Armor edit.)
- **Layering:** `prestige.ts` already imports `content` + `state`; `modifiers.ts` already imports `starAbilityMult`; `shop.ts` imports `content` + `prestige`. No new modules, no cycles.
- **Type consistency:** `protagonistPromoteCost(currentStar): Num`, `canPromoteProtagonist(state): boolean`, `promoteProtagonist(state): GameState` — consistent across tasks. Promotion reuses `MAX_STAR` (shared cap) and the `stars` record (shared shape).
- **Placeholder honesty:** `PROTAGONIST_PROMOTE_BASE`/`_GROWTH` are explicit tunable placeholders.
