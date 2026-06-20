# Plot Armor — Tuning Pass Design Spec

- **Date:** 2026-06-20
- **Status:** **LOCKED** — ready to plan.
- **Repo:** `PlotArmor` (public, GitHub `yovanmc`), local `C:\Agent Projects\PlotArmor`
- **Builds on:** the full party system (Slices 1–4 + Protagonist track + §8 gallery + star-prestige Legacy + Scribe), all shipped on `main`.
- **Realizes:** the "tuning/feel pass" that follows the two depth extras. The magnitudes shipped so far were explicitly flagged as placeholders; this pass sets them from data and fixes one structural imbalance.

## 1. Rationale

Three owner-chosen targets, each grounded in a measured or structural problem:

1. **Rainbow must compete with mono.** The party-system design intended a per-book "mono (same-world) vs rainbow (diverse-world) loadout tension." Measurement of the shipped magnitudes shows it does not exist: a mono tier-3 DPS set averages **≈ ×1.86** party-DPS across a book, while a rainbow loadout averages **≈ ×1.06**. Mono dominates by ~+86% to ~+6%. The cause is structural, not a slightly-off number (see §3).
2. **Steeper late grind.** Greedy-play pacing is currently ~7.7 min to publish book 1, rising to ~36 min for book 8. The owner wants the endgame to be a longer idle commitment: **book 8 ≈ 1–2 h**, with the early game unchanged.
3. **The Critic — pivot the Scribe into a combat class, on par with the other combat slots.** Investigation during this pass found the Scribe's Words boost only raises royalty income; it does **not** speed books — completion is gated on clearing the final zone boss, not on words (verified in `progression.ts:21-22`, `render.ts:29-31,103`; the manuscript bar is *encounters cleared*, not words). Rather than leave it a niche income class, the owner chose to convert it into a genuine combat class: **The Critic**, a damage-over-time (DoT) boss-slayer (see §5). It must pull its weight versus the existing combat classes.

## 2. The Ensemble (diversity) set bonus **[LOCKED]**

A new always-on set that mirrors the existing same-world set, but rewards **distinct** worlds instead of identical ones. This is the structural lever that gives rainbow loadouts a whole-party, always-on reward to set against mono's same-world set.

- **Trigger:** count the **distinct** non-base (`variantWorld !== null`) worlds among **fielded** characters. Thresholds `ENSEMBLE_THRESHOLDS = [3, 4, 5]` → Ensemble tier 1 / 2 / 3 (mirrors `SET_THRESHOLDS = [2, 3, 5]` and `setTier`).
- **Effect — amplify affinity** (owner's pick over flat-DPS / mixed-economy): the Ensemble bonus multiplies the **zone-affinity magnitude**. An in-element character's contribution multiplier becomes
  `1 + AFFINITY_MAG × (1 + ensembleAmp(tier))`
  where `ensembleAmp(0) = 0` (no Ensemble → affinity unchanged) and `ENSEMBLE_AFFINITY_AMP = [a1, a2, a3]` are the per-tier amplifications (placeholders, tuned in §3).
- **Theme:** "go broad — the wider your cast, the harder your in-element characters hit each zone." It ties rainbow's two mechanics (collection breadth + zone affinity) together so they reinforce instead of competing.
- **Mono interaction:** a mono party fields one world → distinct-world count 1 → Ensemble tier 0 → no amplification. Mono keeps its same-world set + its single-zone affinity spike; rainbow gets the Ensemble amplification across the several zones it covers. That is the intended trade.
- **Hybrid is allowed:** e.g. 3 same-world + 2 others = same-world tier 2 **and** Ensemble tier 1 (3 distinct). Both bonuses stack; no special-casing. The harness and math handle it.
- **Protagonist:** affinity already excludes the Protagonist's Plot-Armor signature but does scale the Protagonist's own in-element power; Ensemble amplifies that same already-affinity-scaled term. Plot Armor stays unscaled. No new Protagonist rule.

### Code shape

- `content.ts`: `ENSEMBLE_THRESHOLDS`, `ensembleTier(distinctCount)`, `ENSEMBLE_AFFINITY_AMP` (3-tuple).
- `variants.ts`: `distinctWorldsFielded(party): number` (count distinct non-null `variantWorld`); `ensembleAffinityAmp(party): number` (returns the amp number for the current tier, `0` at tier 0).
- `variants.ts`: extend `affinityMult` to take an optional `ensembleAmp = 0` param: `isInElement(c, zoneIndex) ? 1 + AFFINITY_MAG * (1 + ensembleAmp) : 1`. Default `0` keeps every existing caller/test byte-identical.
- `modifiers.ts`: each read-path that applies affinity (`effectivePartyDps`, the private `abilitySum`, and the inspiration/regen paths that forward zone) computes `const eAmp = ensembleAffinityAmp(s.party)` once and threads it into `affinityMult(...)`. No double counting (compute once per call, pass down).

## 3. Rebalance to parity **[LOCKED approach; magnitudes harness-derived]**

The coverage arithmetic that makes magnitude-only fixes impossible, and dictates the rebalance:

- Mono's same-world set is always-on, whole-party, all 8 zones → ~**40** character-zone "slots" of bonus per book.
- Rainbow's affinity reaches at most one in-element character in the zones it covers, capped by the 5-character party → ~**5** slots.

An ~8:1 coverage gap means amplifying affinity *alone* would need each in-element character at ~×7 to reach parity — thematically absurd. Therefore parity requires the same-world set to come **down** while base affinity and Ensemble amplification come **up**:

- **Lower** `WORLD_SET_BONUS` tier magnitudes (the always-on mono reward). Starting point for the DPS axis: roughly halve toward tier-3 ≈ `+0.30–0.40` (from `+0.75`); other axes scaled comparably. Mono stays meaningfully strong (always-on set + a big home-zone affinity spike) but is no longer strictly dominant.
- **Raise** `AFFINITY_MAG` (from `0.5`) and set `ENSEMBLE_AFFINITY_AMP` so a fully-committed rainbow's in-element characters stay within a sane ceiling (in-element ≤ ~×3, i.e. effective per-character affinity ≤ ~`2.0`).
- **Target band:** a mono party and a rainbow party, compared on a representative DPS-axis book at equal power/levels, land within **±15%** of each other on total book output. Exact magnitudes are chosen from the §6 harness comparison, not guessed.

Honesty flag: this is a deliberate nerf to the Slice-3b same-world set bonus. The owner has approved it as the necessary cost of making rainbow a real choice.

## 4. Steeper late-game pacing **[LOCKED approach]**

- **Primary knob:** `BOOK_SCALE` (per-book difficulty `D(b) = BOOK_SCALE^(b-1)`). It is identity at book 1, so raising it leaves the early game untouched and steepens every later book — exactly "steeper late grind."
- **Target:** greedy-play **book 8 ≈ 1–2 h**, with books 1–8 all still completing (no hard wall). Book 1 stays ~7–8 min.
- **Interplay to watch:** royalty payout scales with manuscript size, which scales with `D(b)`; raising `BOOK_SCALE` raises both the wall *and* the player's income/power tools. The harness must confirm the loop still closes. If `BOOK_SCALE` alone over-inflates HP faster than purchasable power can follow, secondarily nudge `POWER_GROWTH` or the repeatable-upgrade magnitudes — `BOOK_SCALE` is the first lever, these are fallback. Magnitudes are harness-derived.

## 5. The Critic — Scribe combat pivot **[LOCKED]**

The Scribe is converted from a Words-income class into a damage-over-time combat class, **The Critic** (display name; internal `id` stays `'scribe'` → no save/collection churn, existing saves keep the class at its current stars/skins). Theme: a scathing review that festers and tears the work apart over the long fight.

**Revert the Words ability.** No class uses the `'words'` `AbilityKind` after this pivot:
- Remove `'words'` from the `AbilityKind` union.
- Remove the `scribeMult` term from `effectiveWords`, reverting it to `targetWords × bookDifficulty × pageTurnerMult × setMult`. Words remain a royalty-income mechanic — the High-Fantasy `'words'` **set** axis (a `SetAxis`, distinct from `AbilityKind`) and the `pageTurner` upgrade still feed `effectiveWords`; only the per-class boost is removed.

**The DoT ability — "% max-HP bleed".** New `AbilityKind: 'dot'`. The continuous-DPS engine has no tick/status system, so the DoT is a damage *rate* proportional to the **current encounter's max HP**:

```
dotSum   = abilitySum(party, 'dot', stars, zoneIndex, ensembleAmp) * legacyMult(legacy)
dotBonus = dotSum × effectiveTargetMaxHp(state, zoneIndex, encounterIndex)
effectivePartyDps = (sum × sharp × support × plotArmor × set) + dotBonus
```

- Added at the **end**, independent of the party multipliers (Support / Plot Armor / Sharp / set) — a bleed is a separate damage source, not an amplified attack. It carries its own scaling (stars / affinity / Ensemble / Legacy) through `abilitySum`.
- Because it is a fraction of *max* HP, it is automatically a **boss-slayer** (bosses dwarf trash in HP), it **caps clear-time against the exponential HP wall** (synergy with §4's steeper pacing), and it **punches through boss regen** (flat DPS the boss can't out-heal). No hard boss-only gate needed.
- `effectivePartyDps` reads `s.zone.encounterIndex` (already on state) to fetch the current encounter's max HP via the in-module `effectiveTargetMaxHp`; no signature change.
- Catalog: `{ id: 'scribe', name: 'The Critic', classBasePower: n(0.5), ability: { kind: 'dot', mag: <placeholder> } }`.

**Neutral-default:** no Critic fielded → `dotSum = 0` → `dotBonus = 0` → `effectivePartyDps` unchanged → book-1 parity and the default harness loop unaffected.

**Parity metric (now a true combat comparison):** since The Critic is combat, compare head-to-head — a comp fielding The Critic vs the same comp fielding another combat class — book publish times within **±15%** on a representative book (§6). The Critic should shine on boss-heavy / late books and lag on quick-trash books; "on par" means comparable overall, not identical per-zone. Knobs: `classBasePower` and the DoT `mag` (placeholders, harness-derived).

## 6. The measurement instrument **[LOCKED]**

Tuning is done from numbers, not vibes. Extend the existing greedy-play balance harness (`src/engine/balance.test.ts`, which already simulates real-engine play and reports per-book timings) with two comparisons. Keep pure analysis helpers in a small sibling module `src/engine/analysis.ts` (DOM-free, imports only num/content/state/variants/modifiers) so they are unit-testable and reusable; the test file drives them.

1. **`compareLoadouts()`** — build a mono party and a rainbow party at fixed equal power/level on a representative zone set, compute each one's total book output (sum of `effectivePartyDps` across the book's zones, or time-to-clear a representative book), and return the rainbow/mono ratio. The §3 parity assertion checks this ratio is within the ±15% band.
2. **`compareCriticVsCombat()`** — simulate a book with The Critic in the comp vs another combat class in the comp, return the publish-time ratio. The §5 assertion checks the ±15% band. Requires parameterizing the greedy `simulate`/`COMP` to accept a comp override; keep the existing default `simulate(8, …)` call unchanged.
3. **Pacing assertions** — extend the existing simulation report to surface book-8 time; assert book 8 is both **above a floor** (steeper than today) and **completes** (below a ceiling). Avoid a tight point-assertion on book-8 minutes (greedy-sim noise); assert a range.

All verbose output stays gated behind `BALANCE_REPORT=1` (existing pattern; read via the existing `globalThis` cast, no `@types/node`).

## 7. Neutral-default, save, and test impact **[LOCKED]**

- **No save-schema change.** The Ensemble set, like the same-world set, derives entirely from fielded `variantWorld`s. Schema stays **v6**.
- **Default game still neutral where it should be.** A fresh game wears no skins → affinity, same-world set, and Ensemble are all inert (tier 0); `BOOK_SCALE` is identity at book 1. So the **book-1 no-upgrades parity tests stay byte-identical**, and the `affinityMult` default-param keeps every current caller unchanged.
- **Intentional test churn.** The §3 rebalance deliberately moves the live-number assertions that field a set or affinity (e.g. the "Space ×2 → +15% dps" style tests in `modifiers.test.ts`): those expected values change to the new magnitudes. The §4 pacing change moves book-2-plus timing assertions. The §5 pivot: rename the class display to **The Critic** (grep `src` for the `'Scribe'` string and update display assertions; the `id` stays `'scribe'`, so collection/save/recruit-by-id are untouched), change its ability kind `'words'`→`'dot'` (update the content-test ability-kind assertion), remove the `'words'` `AbilityKind`, and replace the earlier `effectiveWords`-Scribe tests with DoT tests on `effectivePartyDps`. This churn is expected and part of the work — update assertions to the new values; do **not** weaken assertions to `toBeGreaterThan(0)` to dodge the update.

## 8. Verification **[LOCKED]**

- Unit tests: Ensemble tiering (`distinctWorldsFielded`/`ensembleTier`), `affinityMult` amplification (a rainbow party's in-element character beats the same character in a mono party), neutral at <3 distinct worlds.
- The harness comparisons (§6) pass their ±15% bands.
- The greedy harness still closes (books 1–8 complete) at the new pacing, with book 8 in the target range.
- Full `npm test` green; `npm run build` green; `npx tsc --noEmit` clean.
- Live DOM smoke: field a rainbow party, confirm an "Ensemble" set line appears in the HUD and affinity reads higher than the same in-element character in a mono party; confirm 0 console errors.

## 9. Non-goals / honesty flags

- Magnitudes in this spec are **starting points / ceilings**, not final values — the final numbers come from the harness and the owner's feel-test.
- Parity is a **±15% band**, not exact equality; mono and rainbow remain different shapes (burst-in-home-zone vs spread), just no longer one strictly dominating.
- No new world axes, no new classes, no save-schema change, no UI restructure (only an added HUD line for the Ensemble set, mirroring the existing set line).
- The Scribe's *identity* changes this pass (Words-income → DoT combat "The Critic"). That is intentional, not scope creep — it corrects a feature whose shipped mechanic (Words) never matched its stated premise (tempo). The `id` stays `'scribe'`, so there is no save-schema change and the collection/stars/skins carry over.
- The harness is a greedy approximation of play, not a human; "on par" is approximate by construction. Final feel is the owner's call on `npm run dev`.
