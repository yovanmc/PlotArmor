# Plot Armor — Party System (Classes, Stars, Collection) Design Spec

- **Date:** 2026-06-19
- **Status:** Design APPROVED for Slice 1 (MVP) — ready for implementation planning. North-star locked; Slices 2–4 details still open (§12).
- **Repo:** `PlotArmor` (public, GitHub `yovanmc`), local `C:\Agent Projects\PlotArmor`
- **Author/owner:** Yovan Collins (single-user, personal project)
- **Builds on:** v1 engine, prestige + Publishing House shop, and the balance fix + 8 genre zones (all shipped).

This is the **end-goal (north-star)** for turning the party from identical clones into a class/collection RPG layer, plus a **phased build plan** so we ship it in slices instead of one giant blob. Locked decisions are marked **[LOCKED]**; everything else is a **[PROPOSED]** starting point for you to change.

---

## 1. Vision (north-star)

A roster/collection layer on top of the idle loop:

- **[LOCKED] The Protagonist** — one permanent, central character. Unlike everyone else, you don't *acquire* them at a tier; you **unlock** stat boosts and higher stars for them through a dedicated progression track.
- **[LOCKED] Classes** — a set of role-bearing types. A class defines a stat lean + an **ability** (a party-wide effect).
- **[LOCKED] World variants** — every class has one **cosmetic** variant per world (8 worlds). A character is a `(class × world)` skin. *Mechanically identical per class+star for now*; affinity/world-tiers are a deferred layer (§9).
- **[LOCKED] Star tiers** — every non-Protagonist character has a star rating; higher stars = higher stats **and** stronger ability (rarity → power).
- **[LOCKED] Collection vs. party** — you accumulate owned characters and **field a limited party** (cap 5, or 6 with Ensemble Cast) chosen from the collection.
- **[LOCKED] Acquisition** — **earned from worlds**: clearing a world unlocks its variants; a star-up material earned from play raises tiers. No gacha/RNG.

### Honest caveat (cosmetic variants)
Because variants are cosmetic, the *mechanical* progression is **class + stars** — collecting all 8 world-skins of a class is flavor/completion until affinity (§9) gives it teeth. Accepted for the MVP.

---

## 2. Power model **[LOCKED]**

Stars **stack on top of** the existing per-book Inspiration leveling:

```
characterPower(c) = c.classBasePower × POWER_GROWTH^(level - 1) × starStatMult(c.stars)
```

- **level** — per-book, bought with Inspiration, resets to 1 on publish (the loop we just balanced — unchanged).
- **stars** — permanent (from the collection); multiply stats and ability magnitude.
- Class **abilities** scale with both the character's **level** and **stars**, and feed the existing `effective*` modifier hooks (§5).

This preserves the balanced loop: levels are the in-book climb, stars are the permanent meta-layer between books.

---

## 3. Entities & data model **[PROPOSED]**

```
ClassDef        { id, name, role, classBasePower, ability: { hook, magPerLevelStar } }   // static content
WorldVariant    cosmetic: per (classId × worldIndex) -> { name, emoji }                    // static content
OwnedCharacter  { uid, classId, worldIndex, stars }                                        // collection entry (persistent)
PartySlot       { uid (ref to OwnedCharacter | 'protagonist'), level }                     // fielded; level resets per book
Protagonist     { statTier, stars, level } with its own unlock track                       // singular, persistent
```

GameState gains: `collection: OwnedCharacter[]`, `party` becomes `PartySlot[]` (refs + per-book level), `protagonist` block, and a `materials` count (Edits, §6). This is a **save-schema bump (v3)** with a migration that seeds a starting Protagonist + converts any existing generic party into starter class characters.

---

## 4. Classes **[LOCKED]** (names are working titles)

Four classes; abilities mirror the existing modifier axes so they plug into combat cleanly and create tension with the shop upgrades. They cover four distinct axes — DPS / amplify / weaken-enemy / economy — so composition is a real choice.

| Class | Role | Stat lean | Ability (scales w/ level × stars) |
|-------|------|-----------|-----------------------------------|
| **Anti-hero** | DPS carry | high | "Lone Wolf" — bonus to its OWN damage; scales hard, helps only itself |
| **Support** | amplifier | medium | +% whole-party DPS (force-multiplier) |
| **Debuffer** | boss-breaker | low–med | −% boss regen (sums with the shop `muse` upgrade, shared floor; future home for other enemy debuffs) |
| **Sidekick** | economy | low–med | +% Inspiration rate → faster leveling/recruiting |

**The Protagonist** is its own unit (not one of these): high base power, always available, upgraded via §7. Signature ability **"Plot Armor"** — +% party DPS for each DISTINCT class currently fielded (rewards a varied cast; deliberately distinct from Support's flat buff).

Composition tension: party cap 5–6 means you can't field everything plus a good star spread. Pure-Anti-hero melts regulars but stalls on regen bosses (no Debuffer); a balanced party kills slower but breaks bosses and earns more; the Protagonist rewards fielding variety. Every class still deals *some* damage via its stats, so no one is dead weight.

---

## 5. Combat / modifier integration **[PROPOSED]**

Class abilities are summed across the fielded party and folded into the existing `modifiers.ts` `effective*` functions, exactly like shop-upgrade multipliers are today:

- **Anti-hero / Protagonist stats** → `effectivePartyDps` (sum of `characterPower`); the Anti-hero's "Lone Wolf" is a per-character multiplier on its own `characterPower` in that sum.
- **Support** → an extra party-DPS multiplier in `effectivePartyDps` (sum of each Support's contribution).
- **Protagonist "Plot Armor"** → a party-DPS multiplier in `effectivePartyDps` scaling with the count of DISTINCT classes fielded.
- **Debuffer** → extra reduction in `effectiveBossRegen` (sums with the shop `muse` upgrade; shared floor).
- **Sidekick** → extra multiplier in `effectiveInspirationRate` (sums with the shop `prolific` upgrade).

Each ability contribution ≈ `magPerLevelStar × level × starAbilityMult(stars)` (exact form set by the harness). This is the same shape as the shipped upgrade mults, so it's a known, testable pattern. (Words and per-zone affinity are intentionally NOT covered by a class yet — Words still come from clears + the shop `pageTurner` upgrade.)

---

## 6. Star system & the Edits economy **[PROPOSED]**

- **Stars:** 1★ → 5★. `starStatMult(s) = STAR_GROWTH^(s-1)` and a parallel `starAbilityMult`. (`STAR_GROWTH` tuned by the harness; ~1.6 is a starting guess.)
- **Material — "Edits":** a new currency earned from clears (small per regular clear, a chunk per boss). Spent to raise a character's star.
- **Star-up cost:** rising Edits per star (e.g., `EDITS_BASE × COST_GROWTH^(currentStar-1)`), so 4★→5★ is a real investment.
- Edits persist across publishes (meta-currency, like Royalties).

---

## 7. The Protagonist track **[PROPOSED]**

The Protagonist doesn't earn stars from worlds; instead you spend **Royalties** in the **Publishing House** (reusing the shop) on a dedicated upgrade line that raises the Protagonist's stat tier and stars. This ties the singular hero to the prestige economy and gives Royalties another sink.

---

## 8. UI surfaces **[PROPOSED — own design pass later]**

- **Collection screen** — owned characters grouped by class, showing star tier; spend Edits to star up. (New modal, parchment-adjacent or its own style.)
- **Party selection** — choose which owned characters (+ Protagonist) to field, cap 5–6.
- Battle screen party cards show class + stars.

These get a dedicated visual design pass (with side-by-side mockup options) when we reach them — not designed in this doc.

---

## 9. Deferred (post-MVP layers toward the north-star)

- **Affinity** — turn world-variants mechanical: a variant is stronger in its home world. This is what makes the full 8-per-class collection a *power* reason, not just flavor.
- **World power-tiers** — alternatively/additionally, deeper-world variants flatly stronger.
- **More classes / 6★+ / ascension**, richer Protagonist signature abilities, etc.

---

## 10. Phased build plan

Each slice ships working, tested software and points at the north-star.

- **Slice 1 — Classes + abilities + Protagonist (no collection yet).** Replace the clone party with the Protagonist + the 4 classes (fixed 1★), abilities wired into `modifiers`, choose-a-class on recruit (Protagonist always fielded), full rebalance via the harness. Proves the composition gameplay. *(This is the MVP.)*
- **Slice 2 — Stars + Edits.** Add star tiers, the Edits currency, star-up, and the permanent stat/ability scaling. Re-balance.
- **Slice 3 — Collection + acquisition from worlds.** Unlock variants by clearing worlds, the cosmetic `(class × world)` roster, the collection UI, the Protagonist Royalties track.
- **Slice 4+ — Deferred layers (§9):** affinity, etc.

> Decomposition rationale: each slice is independently testable and valuable. Slice 1 alone already transforms the party from clones into a composition puzzle.

---

## 11. Verification **[LOCKED approach]**

- The **balance harness** (`src/engine/balance.test.ts`) is extended so the greedy sim understands party composition (it must choose/field classes), and continues to assert the loop closes (book 1 publishable, books 1–8 complete) after each slice.
- `npm run build` + full `npm test` green per slice.
- Best-effort live DOM smoke on the built `dist/` (pixel screenshots remain uncapturable in this sandbox — flagged).
- Owner's live play pass for feel.

---

## 12. Open questions (for later slices — Slice 1 is fully specified)

Slice 1 (the MVP) is locked. **Resolved:** class list + abilities (§4), Protagonist signature = "Plot Armor" (§4), Protagonist track = Royalties in the shop (§7), MVP scope = classes + abilities + Protagonist, fixed 1★, no collection. These remain open and will be decided when we design Slices 2–3:

1. **Star count & curve (§6)** — 5★ ceiling? `STAR_GROWTH` feel (how much stronger is a 5★)?
2. **Edits source/sink (§6)** — drop rates, star-up cost shape.
3. **Acquisition unlock rule (Slice 3)** — does clearing a world unlock that world's variants of *all* classes at 1★, or something more paced?
4. **Party cap** — keep 5/6, or rethink now that slots carry classes?

---

## 13. Non-goals (this design) / honesty flags

- No affinity/world-tier mechanics yet (variants cosmetic — §1 caveat).
- The per-book leveling loop and its balance are preserved, not reworked (§2).
- UI is sketched, not designed — it gets its own pass (§8).
- All magnitudes (class stats, ability mags, star/Edits curves) are **harness-tuned placeholders**, not final.
- Save-schema v3 with migration; no data loss for existing saves.
- No new dependencies, no network, no secrets — fully local.
