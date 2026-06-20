# Plot Armor — The Scribe (Words-axis class) Design Spec

- **Date:** 2026-06-20
- **Status:** **SHIPPED, then PARTLY SUPERSEDED.** The Words-axis class shipped 2026-06-20, but during the tuning pass the Words ability was found to only affect royalty income (book completion is boss-gated, not words-gated). The owner pivoted the class from Words-income into a **DoT combat class, "The Critic"** (`id` unchanged, `'scribe'`). The combat identity is specified in `2026-06-20-plot-armor-tuning-pass-design.md` §5 — that supersedes §2–§4 below.
- **Repo:** `PlotArmor` (public, GitHub `yovanmc`), local `C:\Agent Projects\PlotArmor`
- **Builds on:** the party system (Slices 1–4 + Protagonist track + §8 gallery + star-prestige), all shipped on `main`.
- **Realizes:** the "more classes" item from the party-system spec §9, on the one uncovered ability axis.

## 1. Rationale

The four recruitable classes cover DPS (Anti-hero), amplify (Support), weaken-enemy (Debuffer), and Inspiration economy (Sidekick). The party-system spec §5 explicitly left **Words** (manuscript progress) untouched by any class. A sixth class on the Words axis adds a genuinely new lever — and because the party cap is 5, six classes finally force a "field 5 of 6" selection choice (the original §1 collection-vs-party vision).

Words do double duty: they fill the book (completion tempo) **and** set the royalty payout (`royaltiesForBook` scales with total words). So the Scribe is a **tempo + income** class, distinct from the Sidekick's Inspiration-economy role.

## 2. The class **[LOCKED]**

- New `AbilityKind: 'words'`.
- New `ClassId: 'scribe'`. Catalog entry: `{ id: 'scribe', name: 'Scribe', classBasePower: <support-tier placeholder>, ability: { kind: 'words', mag: <placeholder> } }`. Magnitudes follow the existing support-tier classes (base power ≈ 0.5, mag ≈ 0.025) and are harness-/owner-tuned placeholders.
- Recruitable like the other non-Protagonist classes (it appears in the recruit UI and the collection gallery automatically, since both derive from `CLASSES`). NOT in the starting party.
- Appended to `VARIANT_UNLOCK_ORDER` (so it earns world skins; it unlocks last per world, leaving the existing five classes' unlock cadence unchanged).

## 3. Combat integration **[LOCKED]**

`effectiveWords` gains the Scribe's contribution, folded in exactly like the other ability read-paths:

```
scribeMult = 1 + abilitySum(party, 'words', stars, zoneIndex) * legacyMult(state.legacy)
effectiveWords = targetWords × bookDifficulty × pageTurnerMult × setMult × scribeMult
```

This composes cleanly with everything already built: stars (`abilitySum` uses `starAbilityMult`), zone affinity (`abilitySum` applies `affinityMult` per term, so a Scribe "in its element" writes more), and the star-prestige Legacy multiplier (`* legacyMult`). No other read-path changes.

## 4. Neutral-default / no save change **[LOCKED]**

- A fresh game's starting party is unchanged (`makeStartingParty` = Protagonist + Anti-hero), and no Scribe is fielded by default → `abilitySum('words')` is 0 → `scribeMult` is 1 → every existing number (including the book-1 parity tests and the balance-harness timings) is unchanged.
- **No save-schema change.** `stars` and `unlockedVariants` derive from `CLASSES` (via `makeStars`/`makeUnlockedVariants`) and are read back through the existing CLASSES-derived sanitizers, so a pre-Scribe save simply gains the Scribe at 1★ with no skins on load. Schema stays v6.

## 5. Ripple updates (count assumptions) **[LOCKED]**

Adding a class changes a few "five classes / 40 skins / full collection" constants. These must be updated:

- Gallery completion denominator is `CLASSES.length × WORLD_COUNT` (auto-computes 48); the gallery test's hardcoded `2 / 40` becomes `2 / 48`.
- `content.test.ts`: the class-id list adds `'scribe'`; `VARIANT_UNLOCK_ORDER` length/Set-size assertions go 5 → 6.
- `balance.test.ts`: the "full collection after 8 books" assertion `5 * ZONE_COUNT` becomes `CLASSES.length * ZONE_COUNT` (= 48). The loop-closing assertions are unchanged (the harness `COMP` still recruits the existing three, so the Scribe is not fielded and timings do not move). Full collection still completes within 8 books (6 classes need 6 books of per-world unlocks).

## 6. Verification **[LOCKED approach]**

- Unit tests: `CLASSES` includes a `scribe` with a `'words'` ability; a fielded Scribe raises `effectiveWords` above the same party without it; neutral when no Scribe is fielded.
- The balance harness still closes (books 1–8 complete) — confirm timings are unchanged.
- `npm run build` + full `npm test` green; live DOM smoke (recruit the Scribe, confirm the card renders and Words income rises).

## 7. Non-goals / honesty flags

- Single axis only (Words) — no secondary effect on the Scribe.
- Party cap stays 5 (6 with Ensemble Cast); the selection tension is the intended consequence, not a bug.
- Magnitudes are placeholders, finalized in the tuning pass.
- No save-schema change; existing saves gain the Scribe at 1★/no-skins automatically.
