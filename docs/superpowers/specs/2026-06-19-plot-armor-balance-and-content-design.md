# Plot Armor — Balance Fix + Content Expansion Design Spec

- **Date:** 2026-06-19
- **Status:** Approved direction (owner chose "map the design, fix the loop, then add genre zones") — design map for review
- **Repo:** `PlotArmor` (public, GitHub `yovanmc`), local `C:\Agent Projects\PlotArmor`
- **Author/owner:** Yovan Collins (single-user, personal project)
- **Builds on:** v1 engine, v2 prestige engine, v3 Publishing House shop (all shipped).

## 1. The problem (verified empirically)

The core economy does not close. Measured against the **real engine functions** (party of 5, no upgrades, "beatable" = kill a boss within 60s of net DPS):

| zone | boss regen | reqDPS | levels/char | inspiration needed | income/s | time stuck at boss |
|------|-----------|--------|-------------|--------------------|----------|--------------------|
| 0 (Wild West) | 3 | 10 | 2 | 125 | 6 | ~21 sec ✅ |
| 1 (Zombie) | 36 | 120 | 24 | 1.67M | 50 | ~9.4 hours ⚠️ |
| 2 (Space) | 432 | 1,440 | 288 | **4.6×10⁵²** | 404 | **~3.6×10⁴² years** ❌ |

Zone 2 is the boss you must beat to **publish book 1**. It is not completable on any timescale. Therefore:

- **The prestige engine and the Publishing House shop are unreachable in normal play** — you can never earn a single Royalty to spend.
- Adding content on this curve produces only dead, unreachable zones.

### Root cause

| quantity | growth |
|----------|--------|
| character power | **linear** in level (`basePower 1 × level`) |
| level cost | **exponential** (`1.5^level`) |
| enemy HP / boss regen | **exponential per zone** (`12^zone`) |

Linear DPS purchased with exponentially-priced levels can never catch exponentially-scaling enemies. The DPS source is structurally too weak.

## 2. Fix (this milestone)

### Fix A — Exponential power-per-level (the core change)

Change `characterPower(c)` in `state.ts`:

- **From:** `basePower × level`
- **To:** `basePower × POWER_GROWTH^(level - 1)`

At level 1 power equals `basePower` (the starting state is unchanged). Each subsequent level *multiplies* power, so leveling now buys exponential DPS — matching exponential enemy HP. New tunable `POWER_GROWTH` in `content.ts`.

**Prototype proof** (time stuck at each book-1 boss, party 5, optimal spend):

| power/level | z0 | z1 | z2 (= publish book 1) |
|-------------|----|----|----------------------|
| current (×1, linear) | 21s | 9.4h | 3.6×10⁴² yr ❌ |
| g = 1.5 | 33s | 1.2m | 1.8m ✅ gently rising |
| g = 1.8 | 23s | 25s | 18s ⚠️ flattens/inverts |

`g` at or just below the level-cost growth (1.5) keeps a *rising* curve. `g` above 1.5 makes DPS-per-inspiration accelerate and trivializes deeper content.

### Fix B — Retune enemy/income growth

`HP_GROWTH_PER_ZONE = 12` and `REGEN_GROWTH_PER_ZONE = 12` are too steep relative to income (`~8.17×` per zone). Even with exponential power, a 12-vs-8.17 gap re-walls over many zones. These constants (and possibly `INSP_GROWTH`) are **retuned empirically** (see Fix C) so the curve is *rising but always beatable* across ~8 zones and the first several books.

**Proposed starting points (to be confirmed by the harness, not guessed):** `POWER_GROWTH ≈ 1.45`, `HP_GROWTH_PER_ZONE ≈ 7`, `REGEN_GROWTH_PER_ZONE ≈ 6`. Final values come from harness iteration against the pacing targets below.

### Fix C — Balance harness (verification instrument)

A simulator that plays the **real engine** greedily — auto-spends inspiration on the cheapest beneficial level-up, recruits when worthwhile, drives `step`/`onClear`/`publish` — and reports per book: time-to-publish, per-boss DPS-vs-regen, and where (if anywhere) a wall occurs.

- Lives as an explicitly-run script/probe, **not** collected by `npm test` (so it never slows or flakes the suite).
- It is the tuning loop: adjust constants → run harness → check pacing → repeat.

### Pacing targets (the design intent — owner-tunable)

1. **First publish (book 1):** reachable in roughly **10–30 minutes of active play** (≤ a few hours idle). Earned, not a wall.
2. **Books stay beatable:** through at least book 5, no single boss is a multi-day hard wall; royalties + shop upgrades visibly accelerate each cycle.
3. **Shop upgrades feel impactful:** e.g. Sharp Prose (+10% DPS/level) and Prolific (+10% inspiration/level) measurably shorten the next book.

These are starting targets; the constants are placeholders the owner can retune to taste once the loop is verifiably closed.

## 3. Content expansion (after the fix verifies)

Add genre zones from 3 → 8 (pure `ZoneDef` data; engine already consumes `ZONES` dynamically). Existing three (Wild West, Zombie Apocalypse, Space) stay; append:

| genre | bg | accent | boss |
|-------|----|--------|------|
| High Fantasy 🐉 | `#1a1426` | `#c77dff` violet | Elder Dragon |
| Pirate Seas 🏴‍☠️ | `#0e1f24` | `#3fae9f` teal | The Dread Captain |
| Noir City 🕵️ | `#17171c` | `#b8bcc8` silver | Mr. Big |
| Eldritch Horror 🐙 | `#11160e` | `#9fe04a` chartreuse | The Sleeper |
| Prehistoric 🦖 | `#241a10` | `#e07b39` amber | The Tyrant King |

Each is 6 themed regular enemies (emoji + name) + 1 boss, matching `ENCOUNTERS_PER_ZONE = 6`. The one hardcoded test (`content.test.ts` `ZONE_COUNT === 3`) updates to 8. Harness confirms all 8 zones (and the longer book) stay beatable on the retuned curve. Genres are trivially editable data — owner can rename/reorder/cut.

> Note: 8 zones × 7 = 56 encounters per book. The retune (Fix B) accounts for the longer book; pacing targets are validated at 8 zones, not 3.

## 4. Test impact (known ripple)

Changing `characterPower` to exponential invalidates tests that bake in linear power. These get updated to the new formula (values recomputed, behavior assertions preserved):

- `state.test.ts` (`characterPower` numeric expectation)
- `combat.test.ts`, `loop.test.ts`, `progression.test.ts` (any assertion depending on absolute party DPS / HP numbers)

The *structure* of these tests stays; only the expected numbers change to match `basePower × POWER_GROWTH^(level-1)` and the retuned growth constants. New harness-backed assertions verify the loop closes (book 1 publishable within the pacing target).

## 5. Deferred — the deeper gameplay gap (future milestone, needs owner design input)

Every party character is currently an identical clone (`basePower 1`, differs only by name). The biggest *gameplay* deepening is to differentiate them. Options to discuss when the owner is back (NOT in this milestone):

1. **Stat-variety archetypes** — characters have different `basePower` / growth (e.g., a high-base "Hero" vs a cheap, weak "Sidekick"); recruiting becomes a roster choice.
2. **Role abilities** — support roles buff party DPS, "muse" roles cut boss regen, tanks blunt regen spikes; the party becomes a composition puzzle.
3. **Genre affinity** — characters gain bonus DPS in matching genres, rewarding a varied roster across the 8 genres.

This is flagged here so it isn't lost, but it is explicitly out of scope for the balance/content milestone.

## 6. Non-goals

- No UI/visual changes (the shop and battle screen are untouched).
- No new prestige mechanics or shop entries (the catalog stays as shipped).
- No character differentiation (deferred, §5).
- No save-schema change (constants and the power *formula* change, but the saved fields are identical — existing saves still load; their characters simply become stronger under the new formula).

## 7. Verification

1. `npm run build` green; full `npm test` green (with updated numeric expectations).
2. **Balance harness**: book 1 publishable within the pacing target; books 1–5 beatable with no multi-day wall; all 8 zones clearable.
3. Best-effort live DOM smoke (static-served `dist/`, `preview_eval`) — same approach as the shop milestone (pixel screenshots remain uncapturable in this sandbox; flagged honestly).
4. Owner's live play pass on `npm run dev` for final feel/tuning.

## 8. Honesty / process flags (per owner CLAUDE.md)

- The diagnosis numbers are computed from the real engine functions (verified, not estimated).
- The exact retuned constants are **empirical** (harness-driven), presented with before/after numbers for owner approval — not hand-waved.
- `POWER_GROWTH` and the growth constants are MVP tunables; expect a feel pass after live play.
- No new dependencies, no network, no secrets — fully local.
