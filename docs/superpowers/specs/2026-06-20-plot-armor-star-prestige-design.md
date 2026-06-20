# Plot Armor — Star-Prestige ("Legacy") Design Spec

- **Date:** 2026-06-20
- **Status:** **LOCKED** — ready to plan.
- **Repo:** `PlotArmor` (public, GitHub `yovanmc`), local `C:\Agent Projects\PlotArmor`
- **Builds on:** the party system (Slices 1–4 + Protagonist track + the §8 collection gallery), all shipped on `main`.
- **Realizes:** the "max-star overflow [reserved]" hook from the party-system spec §6, listed under §9 "further deferred."

## 1. Problem

Edits are a global currency dropped by every boss kill, spent only to raise per-class stars (1★→5★). Once every class is maxed at 5★, **Edits have no sink** — boss kills keep dropping a currency that piles up unused. The late game loses a progression lever.

## 2. Solution — a global "Legacy" track

A new permanent, repeatable **Legacy** level funded by surplus Edits. Each level multiplies **every character's power AND every ability magnitude** by a single tunable factor — like applying a universal extra star to the whole roster. (Owner picked "global power + ability" over power-only / economy-snowball, consistent with the "whole contribution" choice for zone affinity.)

This gives the late game a "push deeper into books" prestige lever, reuses the existing star-scaling machinery, and does not disturb the affinity/set-bonus tension.

## 3. Mechanic **[LOCKED]**

- New constant `LEGACY_GROWTH` (tunable placeholder, e.g. `1.5`). `legacyMult(level) = LEGACY_GROWTH ** level`.
- **Neutral by default:** `legacyMult(0) === 1`, so a fresh game and the balance harness (which never buys Legacy) are numerically unchanged — only the save-version assertion changes.
- `legacyMult(state.legacy)` folds into `modifiers.ts`:
  - **Power:** multiplied into `effectiveCharacterPower` (covers every character's contribution to `effectivePartyDps`, and the card "pow" readout).
  - **Abilities:** multiplied onto each ability bonus term — the `abilitySum(...)` results in `effectiveInspirationRate` / `effectiveBossRegen` / `effectivePartyDps`, plus the inline Lone Wolf self-mult and the Plot Armor term. (Uniform factor → multiplying the summed bonus is equivalent to scaling each term.)
- Because both power and abilities scale, a Legacy level lifts the whole roster — DPS carries, Support/Debuffer/Sidekick abilities, and the Protagonist's Plot Armor alike.

## 4. Economy **[LOCKED]**

- Currency: **Edits** (reuse `state.edits`; no new currency).
- `legacyCost(level) = LEGACY_BASE × LEGACY_COST_GROWTH ** level` (Edits). `LEGACY_BASE` is set high enough that raising stars is the better early buy — Legacy becomes the natural spend only once classes are maxed and Edits would otherwise overflow. **Soft gate via cost; no special unlock logic.**
- `canBuyLegacy(state)` (= `edits >= legacyCost(state.legacy)`) and `buyLegacy(state)` (subtract the cost, `legacy + 1`) mirror the existing `canPromoteProtagonist`/`promoteProtagonist` pair. No level cap (it is the late-game infinite sink).
- All magnitudes (`LEGACY_GROWTH`, `LEGACY_BASE`, `LEGACY_COST_GROWTH`) are harness-/owner-tuned placeholders, dialed in the later tuning pass.

## 5. Storage **[LOCKED]**

- `GameState` gains `legacy: number` (default 0).
- **Save schema v5 → v6:** serialize/deserialize `legacy`; pre-v6 saves migrate to `legacy: 0` (all other progress kept). Sanitize on load: coerce to a non-negative integer (`Math.max(0, Math.floor(x))`, default 0 for missing/NaN).
- Neutral-default invariant: at `legacy: 0` the game is identical to pre-feature, so only the save-version assertions change.

## 6. UI **[LOCKED]**

- A new **"Legacy"** section in the Publishing House modal (the established "spend meta-currency on permanent upgrades" surface), shown alongside the Protagonist promotion and the Royalty upgrades.
- Shows the current Legacy level, the per-level effect, and an `✏️ <cost>` Edits buy button (disabled when `!canBuyLegacy`). Because the shop header shows the Royalties balance, the Legacy row labels its cost with the Edits icon (`✏️`) to make the currency unambiguous.
- Reuses `renderShop`/`wireShop` with a new `data-action="legacy"` handled before the existing buy/promote branches.

## 7. Verification **[LOCKED approach]**

- Unit tests: `legacyMult(0) === 1` and grows with level; `legacyCost` rises with level; `canBuyLegacy`/`buyLegacy` (affordability, Edits subtracted, level incremented, immutability); a Legacy level raises `effectivePartyDps` **and** an ability-only read-path (e.g. `effectiveInspirationRate` with a Sidekick) above the same state at `legacy: 0`.
- Save round-trip for `legacy`; pre-v6 migration → 0.
- Balance harness unchanged (legacy stays 0 in greedy play → loop closes exactly as before).
- `npm run build` + full `npm test` green; live DOM smoke (buy a Legacy level in the shop, Edits spent, Party DPS rises, 0 console errors).

## 8. Non-goals / honesty flags

- No hard unlock gate (soft-gated by cost). No level cap.
- No new currency; no change to how Edits drop or how stars work.
- Magnitudes are placeholders, finalized in the tuning pass.
- Save-schema v6 with neutral migration; no data loss for existing saves.
