# Plot Armor Publishing House (spend UI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a parchment-themed "Publishing House" modal that lets the player spend Royalties on the prestige upgrade catalog.

**Architecture:** One new UI module `src/ui/shop.ts` (`renderShop` + `wireShop`) that consumes the existing `prestige`/`content`/`num`/`state` APIs — no engine changes. Plus markup in `index.html`, parchment CSS scoped to `#shop-modal`/`#shop-open` in `styles.css`, a `wireShop` call in `main.ts`, and one null-guarded line in `render.ts` to keep the entry button's balance live.

**Tech Stack:** TypeScript (strict) · Vite · Vitest (jsdom) · DOM/CSS.

---

## How to read this plan

- Spec: [`docs/superpowers/specs/2026-06-19-plot-armor-shop-ui-design.md`](../specs/2026-06-19-plot-armor-shop-ui-design.md).
- Repo root `C:\Agent Projects\PlotArmor` (Windows / PowerShell; Bash tool also available).
- Commit after each task with plain `git commit` (global identity `yovanmc <yovanmc@users.noreply.github.com>` — never override).
- Run one test: `npx vitest run src/ui/<name>.test.ts`. All: `npm test`.
- **Engine is untouched.** `shop.ts` only calls already-shipped, already-tested functions: `content` (`REPEATABLE_UPGRADES`, `ONE_TIME_UPGRADES`, `UpgradeId`), `prestige` (`upgradeCost`, `canBuy`, `isOwned`, `buyUpgrade`), `num.fmt`, `state.GameState`.
- Each task ends green: `shop.test` uses its own DOM fixture (independent of `index.html`); the full suite + build are run at the end.

## File structure

```
src/ui/shop.ts        (NEW)  renderShop(state) + wireShop(getState,setState)
src/ui/shop.test.ts   (NEW)  jsdom tests (own fixture)
index.html            (mod)  + #shop-open button (above .toolbar); + #shop-modal/.modal-card.shop-card/#shop-body/#shop-close
src/styles.css        (mod)  + parchment styles scoped to #shop-modal/#shop-open/.shop-* (appended)
src/ui/render.ts      (mod)  + one null-guarded line: keep #shop-open label balance live
src/main.ts           (mod)  + wireShop(getState, setState)
```

---

## Task 1: `shop.ts` — render the catalog + wire open/close/buy

**Files:**
- Create: `src/ui/shop.ts`
- Test: `src/ui/shop.test.ts`

- [ ] **Step 1: Write the failing test** `src/ui/shop.test.ts`:

```ts
// src/ui/shop.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as num from '../engine/num';
import { initialState, emptyUpgrades, GameState } from '../engine/state';
import { REPEATABLE_UPGRADES, ONE_TIME_UPGRADES } from '../engine/content';
import { renderShop, wireShop } from './shop';

const FIXTURE = `
  <button id="shop-open"></button>
  <div id="shop-modal" class="modal">
    <div class="modal-card shop-card">
      <div id="shop-body"></div>
      <button id="shop-close"></button>
    </div>
  </div>`;

beforeEach(() => { document.body.innerHTML = FIXTURE; });

describe('renderShop', () => {
  it('renders a row for every upgrade (6 repeatable + 2 one-time) with the balance', () => {
    renderShop({ ...initialState(0), royalties: num.n(12) });
    const body = document.getElementById('shop-body')!;
    expect(body.textContent).toContain('Publishing House');
    expect(body.textContent).toContain('💰 12');
    expect(body.querySelectorAll('.shop-row').length).toBe(REPEATABLE_UPGRADES.length + ONE_TIME_UPGRADES.length);
    expect(body.textContent).toContain('Prolific');
    expect(body.textContent).toContain('Ensemble Cast');
  });

  it('disables buy buttons the player cannot afford', () => {
    renderShop({ ...initialState(0), royalties: num.ZERO });
    const buyButtons = document.querySelectorAll<HTMLButtonElement>('.shop-buy');
    expect(buyButtons.length).toBeGreaterThan(0);
    expect([...buyButtons].every((b) => b.disabled)).toBe(true);
  });

  it('enables affordable buy buttons', () => {
    renderShop({ ...initialState(0), royalties: num.n('1e9') });
    const buyButtons = document.querySelectorAll<HTMLButtonElement>('.shop-buy');
    expect([...buyButtons].some((b) => !b.disabled)).toBe(true);
  });

  it('shows owned (no buy button) for an owned one-time unlock', () => {
    renderShop({ ...initialState(0), royalties: num.n('1e9'), upgrades: { ...emptyUpgrades(), ensembleCast: true } });
    const body = document.getElementById('shop-body')!;
    expect(body.textContent).toContain('Owned');
    expect(document.querySelector('button[data-id="ensembleCast"]')).toBeNull();
  });
});

describe('wireShop', () => {
  it('opens and closes the modal', () => {
    let state: GameState = { ...initialState(0), royalties: num.n('1e9') };
    wireShop(() => state, (s) => { state = s; });
    const modal = document.getElementById('shop-modal')!;
    document.getElementById('shop-open')!.click();
    expect(modal.style.display).toBe('flex');
    document.getElementById('shop-close')!.click();
    expect(modal.style.display).toBe('none');
  });

  it('buying an upgrade calls setState with the purchase applied', () => {
    let state: GameState = { ...initialState(0), royalties: num.n('1e9') };
    const setState = vi.fn((s: GameState) => { state = s; });
    wireShop(() => state, setState);
    document.getElementById('shop-open')!.click(); // renders the rows
    const prolificBtn = document.querySelector<HTMLButtonElement>('button[data-id="prolific"]')!;
    prolificBtn.click();
    expect(setState).toHaveBeenCalled();
    expect(state.upgrades.prolific).toBe(1);
    expect(num.lt(state.royalties, num.n('1e9'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/ui/shop.test.ts`
Expected: FAIL — cannot resolve `./shop`.

- [ ] **Step 3: Write the implementation** `src/ui/shop.ts`:

```ts
// src/ui/shop.ts
import { GameState } from '../engine/state';
import { fmt } from '../engine/num';
import { REPEATABLE_UPGRADES, ONE_TIME_UPGRADES, UpgradeId } from '../engine/content';
import { upgradeCost, canBuy, isOwned, buyUpgrade } from '../engine/prestige';

function el(id: string): HTMLElement {
  return document.getElementById(id)!;
}

function rowHtml(state: GameState, id: UpgradeId, name: string, desc: string, levelLabel: string): string {
  const control = isOwned(state, id)
    ? `<span class="shop-owned">✓ Owned</span>`
    : `<button class="shop-buy" data-action="buy" data-id="${id}" ${canBuy(state, id) ? '' : 'disabled'}>💰 ${fmt(upgradeCost(state, id))}</button>`;
  return `
    <div class="shop-row">
      <div class="shop-row-info">
        <div class="shop-row-name">${name}${levelLabel}</div>
        <div class="shop-row-desc">${desc}</div>
      </div>
      ${control}
    </div>`;
}

export function renderShop(state: GameState): void {
  const repeatable = REPEATABLE_UPGRADES
    .map((u) => rowHtml(state, u.id, u.name, u.desc, ` <span class="shop-lv">Lv ${state.upgrades[u.id]}</span>`))
    .join('');
  const oneTime = ONE_TIME_UPGRADES
    .map((u) => rowHtml(state, u.id, u.name, u.desc, ''))
    .join('');

  el('shop-body').innerHTML = `
    <div class="shop-head">
      <span class="shop-title">Publishing House</span>
      <span class="shop-balance">💰 ${fmt(state.royalties)}</span>
    </div>
    <div class="shop-section-label">Upgrades</div>
    ${repeatable}
    <div class="shop-section-label">Unlocks</div>
    ${oneTime}`;
}

export function wireShop(getState: () => GameState, setState: (s: GameState) => void): void {
  const modal = el('shop-modal');

  el('shop-open').addEventListener('click', () => {
    renderShop(getState());
    modal.style.display = 'flex';
  });

  el('shop-close').addEventListener('click', () => {
    modal.style.display = 'none';
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
  });

  el('shop-body').addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('button[data-action="buy"]');
    if (!btn) return;
    const id = btn.getAttribute('data-id') as UpgradeId | null;
    if (!id) return;
    setState(buyUpgrade(getState(), id));
    renderShop(getState());
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/ui/shop.test.ts`
Expected: PASS (4 + 2 cases). If a test fails for a real reason, fix `shop.ts` only (do not change asserted values).

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: clean (exit 0). `state.upgrades[u.id]` for a `RepeatableUpgradeId` is a `number` (the level); `upgradeCost` returns a `Num` for `fmt`. If tsc flags the computed `data-id` or index access, the cause is real — report it.

- [ ] **Step 6: Commit**

```bash
git add src/ui/shop.ts src/ui/shop.test.ts
git commit -m "feat: add Publishing House shop (renderShop + wireShop)"
```

---

## Task 2: Markup + parchment styles

**Files:**
- Modify: `index.html`
- Modify: `src/styles.css`

> No unit test (markup/CSS). Gate = `npm run build` green + the Task 1 tests still pass. The `#shop-open` button will be visible but inert until Task 4 wires it — acceptable intermediate state.

- [ ] **Step 1: Edit `index.html`** — insert the `#shop-open` button immediately BEFORE the `<div class="toolbar">` line:

```html
    <button id="shop-open" class="shop-open-btn">📖 Publishing House</button>
```

- [ ] **Step 2: Edit `index.html`** — add the shop modal immediately AFTER the closing `</div>` of `#offline-modal` (i.e. just before `<script type="module" src="/src/main.ts"></script>`):

```html
    <div id="shop-modal" class="modal">
      <div class="modal-card shop-card">
        <div id="shop-body"></div>
        <button id="shop-close" class="shop-close-btn">Close</button>
      </div>
    </div>
```

- [ ] **Step 3: Append parchment styles to `src/styles.css`** (after the existing `.modal-card` rule, so `.shop-card` overrides win):

```css
/* Publishing House — parchment shop (scoped; does not touch the cyan battle theme) */
.shop-open-btn { display: block; margin: 1.25rem auto 0; background: #b8923c; color: #3a2a0e; font-size: 1rem; padding: 0.55rem 1rem; }
.shop-card {
  background: #f1e3c6; color: #43341c; border: 2px solid #b8923c;
  max-width: 460px; width: 92%; text-align: left;
  font-family: Georgia, 'Times New Roman', serif;
}
.shop-head { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #d2b878; padding-bottom: 0.5rem; }
.shop-title { font-size: 1.15rem; font-weight: 700; color: #7a5a16; }
.shop-balance { font-size: 1.15rem; font-weight: 700; color: #7a5a16; }
.shop-section-label { font-size: 0.78rem; letter-spacing: 0.06em; text-transform: uppercase; color: #8a6e2e; margin: 0.85rem 0 0.1rem; }
.shop-row { display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; padding: 0.5rem 0; border-bottom: 1px solid #d2b878; }
.shop-row:last-child { border-bottom: none; }
.shop-row-info { min-width: 0; }
.shop-row-name { font-weight: 700; font-size: 0.95rem; }
.shop-lv { font-weight: 400; opacity: 0.55; }
.shop-row-desc { font-size: 0.78rem; opacity: 0.75; }
.shop-buy { background: #b8923c; color: #3a2a0e; white-space: nowrap; }
.shop-buy:disabled { opacity: 0.38; cursor: not-allowed; }
.shop-owned { font-size: 0.8rem; font-weight: 700; opacity: 0.6; white-space: nowrap; }
.shop-close-btn { background: #b8923c; color: #3a2a0e; display: block; margin: 1rem auto 0; }
```

- [ ] **Step 4: Build + full suite**

Run: `npm run build`
Expected: green (tsc + vite build write `dist/`).

Run: `npm test`
Expected: green (68 engine/render + the new shop tests).

- [ ] **Step 5: Commit**

```bash
git add index.html src/styles.css
git commit -m "feat: add Publishing House markup and parchment styles"
```

---

## Task 3: Keep the entry button's balance live (`render.ts`)

**Files:**
- Modify: `src/ui/render.ts`
- Test: `src/ui/render.test.ts` (append one case)

- [ ] **Step 1: Append a failing test** to `src/ui/render.test.ts`. First ensure the file imports `num` — if it does not already, add at the top:

```ts
import * as num from '../engine/num';
```

Then add this `it` block inside the existing `describe('render', …)`:

```ts
  it('keeps the #shop-open button balance in sync when the button is present', () => {
    document.body.innerHTML = HTML + '<button id="shop-open"></button>';
    render({ ...initialState(0), royalties: num.n(7) });
    expect(document.getElementById('shop-open')!.textContent).toContain('💰 7');
  });

  it('does not throw when #shop-open is absent (the default fixture)', () => {
    expect(() => render(initialState(0))).not.toThrow();
  });
```

- [ ] **Step 2: Run to verify the new case fails**

Run: `npx vitest run src/ui/render.test.ts`
Expected: FAIL — the `#shop-open` text is empty (render does not update it yet). The "does not throw" case passes already.

- [ ] **Step 3: Implement** — add these lines at the END of the `render` function body in `src/ui/render.ts` (just before its closing `}`). `fmt` is already imported:

```ts
  const shopOpen = document.getElementById('shop-open');
  if (shopOpen) shopOpen.textContent = `📖 Publishing House · 💰 ${fmt(state.royalties)}`;
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/ui/render.test.ts`
Expected: PASS (the original 2 + the 2 new cases).

- [ ] **Step 5: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: clean.

```bash
git add src/ui/render.ts src/ui/render.test.ts
git commit -m "feat: keep Publishing House button balance live via render"
```

---

## Task 4: Wire it into the app + verify + ship

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Edit `src/main.ts`** — add the import alongside the other `ui` imports:

```ts
import { wireShop } from './ui/shop';
```

- [ ] **Step 2: Edit `src/main.ts`** — call `wireShop` right after the existing `wireInput(getState, setState);` line:

```ts
wireShop(getState, setState);
```

- [ ] **Step 3: Build + full suite**

Run: `npm run build`
Expected: green (tsc + vite build).

Run: `npm test`
Expected: green — full suite (engine + render + shop).

- [ ] **Step 4: Manual run (owner / best-effort screenshot)**

Run: `npm run dev`, open the local URL. Confirm: the `📖 Publishing House · 💰 N` button shows below the party; clicking opens the parchment modal; affordable upgrades have enabled buy buttons; buying spends Royalties and the balance/level/cost update; owned one-times show "✓ Owned"; close button and backdrop click dismiss.

> Honesty flag: an automated browser screenshot likely will NOT capture in this sandbox (headless preview tab runs `visibilityState:"hidden"`, suspending the compositor — same limit hit before). The automated gate is the `jsdom` tests above; the pixel-level visual pass is the owner's on `npm run dev`. If a screenshot subagent IS attempted, it must return a TEXT verdict + file paths only (do not load PNGs into the main session unless the owner says "show me").

- [ ] **Step 5: Update README + spec status**
  - In `README.md`, update the status paragraph to note the spend UI shipped (e.g. add: "Royalties are now spendable in-game via the **Publishing House** shop." and drop the "No spend UI yet" caveat).
  - In `docs/superpowers/specs/2026-06-19-plot-armor-shop-ui-design.md`, change the status line to `- **Status:** Implemented — 2026-06-19` (use the env date).

- [ ] **Step 6: Commit + push**

```bash
git add src/main.ts README.md docs/superpowers/specs/2026-06-19-plot-armor-shop-ui-design.md
git commit -m "feat: wire Publishing House shop into the app; mark spend UI complete"
git push origin main
```

- [ ] **Step 7: Report** the final `npm run build` + `npm test` output and the pushed commit range. Flag what was not verified here (the live browser/visual pass — owner runs `npm run dev`).

---

## Self-review (completed during planning)

- **Spec coverage** (vs `2026-06-19-plot-armor-shop-ui-design.md`):
  - §4.1 entry button (`#shop-open`, balance label, above toolbar, gold) → Task 2 markup + Task 3 live label.
  - §4.2 modal (header+balance, Upgrades/Unlocks sections, per-row name/Lv/desc/buy, disabled-when-unaffordable, ✓ Owned, close + backdrop) → Task 1 `renderShop`/`wireShop` + Task 2 modal markup.
  - §4.3 parchment tokens (scoped to `#shop-modal`/`#shop-open`) → Task 2 CSS.
  - §5 architecture (`shop.ts` consuming only existing APIs; index/styles/main/render touches) → Tasks 1–4.
  - §5.1 re-render on open + after buy; per-frame label via render → Task 1 (`wireShop`) + Task 3.
  - §6 verification (build, jsdom tests for rows/affordability/owned/buy-interaction, full suite, owner run) → Tasks 1–4.
- **Placeholder scan:** none — complete code in every step; all CSS tokens concrete.
- **Type/name consistency:** `renderShop(state)` / `wireShop(getState,setState)` identical across `shop.ts`, `shop.test.ts`, and `main.ts`. DOM ids identical across `index.html`, `shop.ts`, `shop.test.ts` fixture: `#shop-open`, `#shop-modal`, `#shop-body`, `#shop-close`; classes `.shop-row`/`.shop-buy`/`.shop-owned`/`.shop-card`. Engine APIs used by `shop.ts` (`upgradeCost`/`canBuy`/`isOwned`/`buyUpgrade`, `REPEATABLE_UPGRADES`/`ONE_TIME_UPGRADES`/`UpgradeId`, `fmt`) all exist as shipped.
- **Green-at-every-commit:** Task 1 adds an isolated module (own test fixture); Task 2 is markup/CSS (build green); Task 3's null-guard keeps the original render tests passing; Task 4 is the wiring. No red windows.
