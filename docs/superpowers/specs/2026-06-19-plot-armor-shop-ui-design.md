# Plot Armor — Publishing House (spend UI) Design Spec

- **Date:** 2026-06-19
- **Status:** Approved (brainstorming complete) — ready for implementation planning
- **Repo:** `PlotArmor` (public, GitHub `yovanmc`), local `C:\Agent Projects\PlotArmor`
- **Author/owner:** Yovan Collins (single-user, personal project)
- **Builds on:** [`2026-06-19-plot-armor-prestige-design.md`](2026-06-19-plot-armor-prestige-design.md) (prestige engine, shipped). This spec adds the **spend UI** that engine deferred.

## 1. Why this exists

The prestige engine shipped with a Royalty wallet, an 8-entry upgrade catalog, and pure `prestige` APIs (`upgradeCost`/`canBuy`/`isOwned`/`buyUpgrade`) — all headless-tested but **not clickable in-game**. This milestone adds the UI that lets the player actually spend Royalties.

## 2. Locked decisions (from brainstorming)

1. **Surface:** a **modal "shop"** (reuses the existing `.modal` overlay pattern), opened by a persistent button. Keeps the single-screen battle layout uncluttered while housing all 8 upgrades.
2. **Visual style:** **Parchment** — warm cream/sepia card, serif headings, gold accents — giving the prestige shop its own book-like identity, distinct from the cold cyan battle screen.
3. **Entry point:** a persistent button that **doubles as a Royalty readout** (`📖 Publishing House · 💰 N`).

## 3. Goals / Non-goals

### Goals
- A persistent entry button (`#shop-open`) showing the live Royalty balance; opens the shop.
- A parchment-themed modal listing all 8 upgrades in two groups (**Upgrades** = 6 repeatable, **Unlocks** = 2 one-time), each row with name, level (repeatable), description, and a buy control reflecting affordability / owned state.
- Buying spends Royalties via `prestige.buyUpgrade` and immediately reflects the new balance/level/cost.
- One new UI module `src/ui/shop.ts`; small additions to `index.html`, `styles.css`, `main.ts`, and one guarded line in `render.ts`. **No engine changes.**
- Headless `jsdom` tests for the shop's rendering + buy interaction.

### Non-goals (deferred)
- No engine/balance changes (the catalog, costs, and effects are as shipped).
- No re-theming of the battle UI (HUD/party/enemy stay cyan); only the shop is parchment.
- No "royalty income preview" / book-difficulty readout in the shop (the HUD already shows the wallet; keep the shop focused on spending).
- No animations beyond the existing modal show/hide.

## 4. UX

### 4.1 Entry point
- A button `#shop-open`, always visible, placed **above the existing `.toolbar`**. Label: `📖 Publishing House · 💰 <royalties>`.
- Styled gold (parchment-family) so it reads as the "prestige" affordance, distinct from cyan battle buttons.
- `render()` (already runs every frame) updates this button's label so the balance stays live. The update is **null-guarded** — if `#shop-open` isn't in the DOM (e.g. the render unit test's minimal fixture), `render()` skips it and does not throw.

### 4.2 The modal
- Reuses `.modal` (full-screen overlay, `background:#000a`) containing a parchment `.modal-card.shop-card`.
- Contents (all rendered by `renderShop`, inside `#shop-body`):
  - **Header:** title "Publishing House" + Royalty balance `💰 N`.
  - **Section "Upgrades"** — the 6 repeatable upgrades, each row:
    - left: name + `Lv N` (current level) + one-line description (from the catalog `desc`).
    - right: a **buy button** labelled `💰 <upgradeCost>` (next-level cost). Disabled (greyed) when `!canBuy` (unaffordable).
  - **Section "Unlocks"** — the 2 one-time unlocks, each row:
    - left: name + description.
    - right: a **buy button** `💰 <cost>` when not owned (disabled if unaffordable), or a muted `✓ Owned` label when owned.
- **Close:** a `#shop-close` button, plus clicking the backdrop (`#shop-modal` itself) dismisses it.

### 4.3 Visual style (parchment — concrete tokens, scoped to `#shop-modal`)
- card background `#f1e3c6`; text `#43341c`; border `2px solid #b8923c`; corner radius `12px`.
- row divider `1px solid #d2b878`.
- heading + balance accent `#7a5a16`; heading font `Georgia, 'Times New Roman', serif`.
- buy button: background `#b8923c`, text `#3a2a0e`; `:disabled` → `opacity:.38; cursor:not-allowed`.
- owned label: `opacity:.6`.
- The entry button `#shop-open`: background `#b8923c`, text `#3a2a0e`.
- All shop styles are scoped under `#shop-modal` / `#shop-open` so the per-zone `--accent` battle theme is untouched.

## 5. Architecture

```
src/ui/shop.ts        (NEW)  renderShop(state) + wireShop(getState,setState)
index.html            (mod)  + #shop-open button, + #shop-modal/.modal-card.shop-card/#shop-body/#shop-close
src/styles.css        (mod)  + parchment styles scoped to #shop-modal/#shop-open
src/main.ts           (mod)  import + call wireShop(getState, setState)
src/ui/render.ts       (mod)  one null-guarded line: keep #shop-open label's balance live
```

- **`shop.ts` consumes only existing public APIs:** `content` (`REPEATABLE_UPGRADES`, `ONE_TIME_UPGRADES`, `UpgradeId`), `prestige` (`upgradeCost`, `canBuy`, `isOwned`, `buyUpgrade`), `num.fmt`, and `state.GameState`. It owns no game rules.
- **`renderShop(state: GameState): void`** — writes `#shop-body.innerHTML` (header + the two sections). Buy controls are `<button data-action="buy" data-id="<UpgradeId>">`, `disabled` when `!canBuy`. Owned one-times render a `✓ Owned` span instead of a button.
- **`wireShop(getState, setState): void`** — attaches:
  - `#shop-open` click → show `#shop-modal` + `renderShop(getState())`.
  - `#shop-close` click and backdrop click (`e.target === #shop-modal`) → hide.
  - delegated click on `#shop-body` → `closest('button[data-action="buy"]')` → `id = data-id` → `setState(buyUpgrade(getState(), id))` then `renderShop(getState())`.

### 5.1 Re-render strategy
Royalties change only on **buy** or **publish**, so `renderShop` runs on **open** and **after each buy** — no per-frame cost. The `#shop-open` label's balance is refreshed each frame by `render()` (4.1). (Publishing while the shop is open is a non-case: publish is its own button on the battle screen.)

## 6. Verification

1. **Build:** `npm run build` green (tsc strict + vite build).
2. **`jsdom` unit tests** (`src/ui/shop.test.ts`), mounting a minimal DOM fixture (`#shop-open`, `#shop-modal`, `#shop-body`, `#shop-close`):
   - `renderShop` produces a row for every catalog entry (6 + 2 = 8); repeatable rows show `Lv N` and a cost; one-time rows show a cost or `✓ Owned`.
   - Affordability: with low royalties, buy buttons are `disabled`; with ample royalties, enabled.
   - Owned: a purchased one-time renders `✓ Owned` (no buy button).
   - Interaction: a `wireShop` buy click drives `setState` with the upgrade purchased (level incremented / flag set, royalties reduced) — assert via the captured `setState` argument.
3. **Full suite** `npm test` stays green (existing 68 + new shop tests).
4. **Owner visual check** on `npm run dev` (the parchment look, open/close, buying).

## 7. Honesty / process flags (per owner CLAUDE.md)

- All visual tokens are concrete but **tunable**; expect a polish pass after the owner sees it live.
- **Browser screenshot likely not capturable in this sandbox** (the headless preview tab runs `visibilityState:"hidden"`, suspending the compositor — same limitation hit on the v1 verification). The automated gate is the `jsdom` tests; the pixel-level visual pass is the owner's on `npm run dev`. This will be flagged at handoff.
- No new dependencies, no network, no secrets — fully local. The only DOM APIs used are standard (`getElementById`, `addEventListener`, `closest`, `innerHTML`).
