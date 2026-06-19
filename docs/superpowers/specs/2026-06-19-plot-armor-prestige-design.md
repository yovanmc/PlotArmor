# Plot Armor — Prestige Depth Design Spec (v2 systems)

- **Date:** 2026-06-19
- **Status:** Implemented (engine) — 2026-06-19; spend UI deferred
- **Repo:** `PlotArmor` (public, GitHub `yovanmc`), local `C:\Agent Projects\PlotArmor`
- **Author/owner:** Yovan Collins (single-user, personal project)
- **Builds on:** [`2026-06-19-plot-armor-design.md`](2026-06-19-plot-armor-design.md) (v1, shipped). This spec adds the second design pass: a real **prestige spend layer**.

## 1. Why this exists

In v1, **Royalties are a dead-end currency**. Publishing a book grants exactly 1 Royalty, and Royalties only feed a *passive* formula (`prestigeMultiplier = 1 + royalties × 0.5`). There is no decision attached: you publish, a number rises, you continue. In idle-game terms the prestige layer has no **spend**, which is where the genre's depth normally lives.

Relatedly, **Words are a near-dead resource**: earned per clear, they fill a bar toward "The End," then reset on publish — never spent, never consequential.

This design fixes both: Royalties become a **spendable wallet** feeding a permanent **upgrade catalog**, and a book's **Words (manuscript size)** determine the Royalty payout — so a bigger book earns a bigger check.

## 2. The four locked decisions (from brainstorming)

1. **Goal:** give Royalties a spend layer (a meta-upgrade catalog).
2. **Faucet:** *scaling yield* — Royalties earned per publish scale with **manuscript size (Words written this book)**.
3. **Escalation:** each published book is **harder and bigger** than the last, so the manuscript (and thus the payout) grows over time.
4. **Spend shape:** a **mix** — repeatable stat upgrades + a few one-time unlocks.

## 3. Goals / Non-goals

### Goals (this pass)
- A per-book difficulty/size escalation `D(b)` keyed to book number, identity at book 1 (book 1 plays exactly like shipped v1).
- A scaling Royalty payout `f(WordsThisBook)` on publish.
- Royalties as a real wallet (`+` on publish, `−` on purchase, spendable anytime).
- A permanent **upgrade catalog**: 6 repeatable stat upgrades + 2 one-time unlocks.
- A new state-aware **`modifiers.ts`** layer that folds escalation + upgrade effects into the numbers the existing reducers read, with a hard **book-1/no-upgrades parity** guarantee against v1 curves.
- New **`prestige.ts`** buy/cost/affordability logic; catalog as static data in `content.ts`.
- Save migration v1→v2 (tolerant): keep earned Royalties as the opening wallet, drop `prestigeMultiplier`, default upgrades empty.
- Full headless unit-test coverage, mirroring v1's engine discipline.

### Non-goals (explicitly deferred)
- **No spend UI this pass.** The systems are engine-only and headless-tested; the catalog + `canBuy`/`buyUpgrade` are exposed for a *later* UI milestone. Until then the upgrades exist and are tested but are not clickable in-game. (Matches owner's "not worried about UI/visual yet.")
- No new genres/zones, no classes/roles/affinity, no loot/equipment, no skill trees, no achievements (all still deferred from v1).
- Ensemble Cast multi-tiering beyond the first (5→6) is a later data-only add.

## 4. Economy design

### 4.1 Book escalation `D(b)`
A per-book difficulty factor keyed to book number `b` (1-based):

```
D(b) = bookScale ^ (b - 1)        // D(1) = 1  → book 1 == shipped v1
```

`D(b)` multiplies three **base** content curves (on top of the existing per-zone/per-encounter scaling from v1):
- enemy HP: `effectiveMaxHp = targetMaxHp(zone, enc) × D(b)`
- boss regen: `effectiveRegen = targetRegen(zone, enc) × D(b)` (the wall scales too — bosses stay real DPS-checks)
- Words per clear: `effectiveWords = targetWords(zone, enc) × D(b)` (deeper books → bigger manuscripts)

`bookScale` is a tuning constant (gentle — the v1 per-zone curve is already steep at ~12× HP/zone).

### 4.2 Royalty payout `f(WordsThisBook)`
On publish:

```
royaltiesEarned = floor( K × sqrt( WordsThisBook / W0 ) )   // shape: monotonic, sublinear
```

Sublinear (e.g. √) so payouts rise every book without hyperinflating. `K`, `W0` are tuning constants; the **shape** is "bigger manuscript → bigger check, with diminishing returns." Because `WordsThisBook` rises with `D(b)`, each book pays more than the last. Minimum payout is clamped so an early book always grants ≥ 1.

### 4.3 The reset tension (central balance knob)
Publish still resets the party to the starting size at the starting level, **but the next book is harder** (`D(b+1) > D(b)`). Permanent upgrades are what carry you across that gap — which is precisely why the spend layer exists. The **Ghostwriter** unlock (§5) directly softens this by starting the party pre-leveled. Within any book, the rate-based Inspiration grind still lets you level up even while walled (unchanged from v1).

## 5. Upgrade catalog

All upgrades are **permanent** (survive every publish). Magnitudes/costs below are illustrative tuning, not final. Catalog lives as **static data in `content.ts`**.

### 5.1 Repeatable (buy many times; geometric Royalty cost `baseCost × growth^level`; stacking effect)

| id | Name | Effect (per level) | Notes |
|----|------|--------------------|-------|
| `prolific` | Prolific | `+P% Inspiration rate` | core income → faster leveling |
| `sharpProse` | Sharp Prose | `+S% party DPS` | clear faster, break walls |
| `pageTurner` | Page-Turner | `+W% Words per clear` | ⚠ compounds the faucet (Words→Royalties→upgrades); tune carefully |
| `muse` | Muse | `−M% boss regen` | weakens the DPS-check wall; **bounded** (cap total reduction, e.g. ≤90%, regen never ≤0) |
| `nightOwl` | Night Owl | `+H hours offline cap` | idle depth (base 12h → further) |
| `frugalDrafts` | Frugal Drafts | `−F% level/recruit costs` | stretches Inspiration; **bounded** (cap, e.g. ≤75%) |

### 5.2 One-time unlocks (buy once; fixed Royalty cost)

| id | Name | Effect | Notes |
|----|------|--------|-------|
| `ensembleCast` | Ensemble Cast | party cap `5 → 6` | punchy milestone; further tiers are later data-only adds |
| `ghostwriter` | Ghostwriter | start each new book with the party **pre-leveled** (e.g. level 5 instead of 1) | the reset-softener from §4.3; MVP = fixed bump, may become repeatable later |

**Bounding note:** any "reduction" upgrade (`muse`, `frugalDrafts`) must clamp so it cannot reach/exceed 100% — enforced in `modifiers.ts` and unit-tested.

## 6. Data model changes (`GameState`)

```ts
// NEW
interface Upgrades {
  // repeatable → level counts (default 0)
  prolific: number;
  sharpProse: number;
  pageTurner: number;
  muse: number;
  nightOwl: number;
  frugalDrafts: number;
  // one-time → owned flags (default false)
  ensembleCast: boolean;
  ghostwriter: boolean;
}

interface GameState {
  schemaVersion: number;        // bumped 1 → 2
  lastSaved: number;
  inspiration: Num;
  words: Num;                   // "WordsThisBook" — already resets on publish
  royalties: Num;               // NOW A WALLET: + on publish, − on purchase
  party: Character[];
  zone: ZoneState;
  currentHp: Num;
  bookComplete: boolean;
  bookNumber: number;           // drives D(b)
  upgrades: Upgrades;           // NEW
  // prestigeMultiplier: REMOVED
}
```

## 7. Architecture / module structure

Follows v1's engine/render split and isolation guidance. **New/changed modules:**

- **`content.ts` (changed):** add the static **upgrade catalog** (id, kind, display name/desc, base cost, cost growth, effect magnitude, and for one-times the fixed cost) + the escalation/faucet constants (`bookScale`, `K`, `W0`, bounds). Base curves stay as-is.
- **`prestige.ts` (new):** pure buy logic over the catalog —
  - `upgradeCost(state, id): Num`
  - `canBuy(state, id): boolean` (affordable **and**, for one-times, not already owned)
  - `buyUpgrade(state, id): GameState` (decrement wallet, increment level / set flag; **no-op returning same ref** when `!canBuy`)
  - `royaltiesForBook(wordsThisBook): Num` (the §4.2 faucet)
- **`modifiers.ts` (new):** state-aware effective values, each composing *base × D(bookNumber) × upgrade multiplier*, with bounds applied:
  - `bookDifficulty(state): Num` → `D(b)`
  - `effectiveInspirationRate(state, zone, enc)`
  - `effectivePartyDps(state)`
  - `effectiveBossRegen(state, zone, enc)`
  - `effectiveTargetMaxHp(state, zone, enc)`
  - `effectiveWords(state, zone, enc)`
  - `effectiveLevelCost(state, level)` / `effectiveRecruitCost(state, partySize)`
  - `effectiveOfflineCap(state): number`
  - `effectivePartyCap(state): number`
  - `startingPartyLevel(state): number`
- **`economy.ts` / `combat.ts` / `loop.ts` / `offline.ts` / `progression.ts` (changed):** read the `effective*` functions instead of raw curves. `economy.canRecruit` gates on `effectivePartyCap(state)` (Ensemble Cast raises the in-play recruit ceiling). `progression.publish` now: `royalties += royaltiesForBook(words)`, `bookNumber++`, rebuild the starting party at the **base** `STARTING_PARTY_SIZE` count but at `startingPartyLevel(state)` (Ghostwriter), persist `upgrades` + `royalties`. `offline.applyOffline` uses `effectiveOfflineCap(state)` for the clamp. (Note: the party **cap** affects recruiting *during* a book; it does **not** change how many members a book *starts* with — always the base 2.)

**Design rule:** all escalation + upgrade math is centralized in `modifiers.ts`; reducers never re-derive it. The catalog is data; `prestige.ts` is logic; `modifiers.ts` is the read-path. Each is independently testable.

## 8. Save migration (v1 → v2, tolerant)

`SCHEMA_VERSION = 2`. Migration stays tolerant (ignore unknown fields, default missing ones):

- `royalties` (v1 count) → carried forward as the **opening wallet balance** (the player keeps what they earned, to spend).
- `prestigeMultiplier` (v1) → **dropped/ignored**.
- `upgrades` → defaulted to all-zero / all-false when absent.
- All other fields round-trip as in v1.

Net effect for a returning v1 player: loses the old passive bonus but can immediately re-buy production with banked Royalties — fair, not punishing. New `SAVE_KEY` is unchanged (`plotarmor.save.v1` key string stays; `schemaVersion` inside the payload is the version of record), so existing saves load and migrate in place.

## 9. Verification plan (headless; mirrors v1)

1. **Build green:** `tsc` strict + `vite build`.
2. **`modifiers.ts` (the key regression guard):**
   - With `bookNumber = 1` and empty upgrades, **every `effective*` equals the raw v1 curve exactly** (book-1 parity).
   - `D(b)` scales HP/regen/Words across book numbers; book 2 targets exceed book 1.
   - Upgrade multipliers apply and stack; `muse`/`frugalDrafts` reductions are clamped (never ≥100%).
3. **`prestige.ts`:** cost curves grow; `canBuy` gates on affordability + one-time-not-owned; `buyUpgrade` decrements wallet and bumps level/sets flag; no-op (same ref) when unaffordable; one-time cannot be bought twice; `royaltiesForBook` monotonic + ≥1 floor.
4. **`progression.ts`:** publish adds `royaltiesForBook(words)` to the wallet, increments `bookNumber`, rebuilds the starting party at the base count (`STARTING_PARTY_SIZE`) with level from `startingPartyLevel`, persists `upgrades` + `royalties`, clears `bookComplete`. Separately, `economy.canRecruit` honors `effectivePartyCap` during play.
5. **`offline.ts` / `loop.ts`:** parity preserved (read `effective*`); offline clamp uses `effectiveOfflineCap`; clock-rewind guard unchanged.
6. **`save.ts`:** round-trips `upgrades`; v1→v2 migration keeps `royalties` as wallet, drops `prestigeMultiplier`, defaults upgrades.
7. **Full suite green** (`npm test`) — v1's 44 tests still pass (book-1 parity ensures no regression) plus the new modules.

No screenshot/visual pass this milestone (no UI changes).

## 10. Honesty / process flags (per owner CLAUDE.md)

- All formulas here are **shapes**; exact constants (`bookScale`, `K`, `W0`, per-upgrade base/growth/magnitude, bounds, Ghostwriter level, costs) are **tuning**, resolved during implementation + playtest (Karpathy: MVP numbers first).
- Illustrative TypeScript only — not production code.
- Engine work is sandbox-verifiable headless; no UI/browser/Windows-specific behavior is introduced this pass, so nothing new requires owner-machine confirmation (the v1 owner-side visual check still stands separately).
- No external APIs, no secrets, fully local — unchanged.

## 11. Open tuning parameters (non-blocking)

- `bookScale` (per-book difficulty growth); `K`, `W0` (Royalty faucet shape); minimum payout floor.
- Per-upgrade `baseCost` / `costGrowth` / effect magnitude; reduction-upgrade bounds.
- One-time unlock costs; Ghostwriter starting level (and whether it later becomes repeatable).
- Whether `bookScale` also nudges per-book Words target / pacing.
