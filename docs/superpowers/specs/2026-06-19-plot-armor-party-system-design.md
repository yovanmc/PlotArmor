# Plot Armor — Party System (Classes, Stars, Collection) Design Spec

- **Date:** 2026-06-19
- **Status:** **Slices 1, 2, 3a & 3b IMPLEMENTED** (2026-06-19) — Slice 1: Protagonist + 4 classes with composition abilities. Slice 2: per-class 5★ stars funded by global **Edits** from bosses (save v4). Slice 3a: `(class × world)` skins earned by clearing world bosses (deterministic, no gacha) + equip on cards (save v5). Slice 3b: the 2/3/5 per-world **set bonus** folded into the `effective*` read-paths. All shipped on `main`. North-star essentially complete; remaining deferred follow-ups: the full collection gallery / party-selection visual pass (§8), the Protagonist Royalties track (§7), and Slice 4 (affinity, §9). Only tuning magnitudes/axis-mapping remain open (§12).
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

## 6. Star system & the Edits economy **[LOCKED — Slice 2]**

- **Stars are PER-CLASS, 1★ → 5★** (thematically "review ratings" — a 5★ class is a perfectly-reviewed character). Investing a star raises *every* variant of that class; variants are skins over the class, so stars are never re-ground per variant. `starStatMult(s) = STAR_GROWTH^(s-1)` multiplies the class's base power AND a parallel `starAbilityMult` multiplies its ability magnitude, so stars **stack on top of** per-book leveling. (`STAR_GROWTH` harness-tuned; ~1.6 starting guess.) The **Protagonist has no stars** — its growth is the Royalties track (§7).
- **Material — "Edits":** a new **global** currency (one shared wallet, not per-character). Dropped by **boss kills only** (a chunk per boss, scaling with book difficulty); regular clears drop nothing. You choose which class to spend the shared pool on — an allocation decision.
- **Single sink:** Edits do exactly one thing — raise a class's star. No secondary sinks (deliberate; YAGNI).
- **Star-up cost:** rising Edits per star (`EDITS_BASE × COST_GROWTH^(currentStar-1)`), so 4★→5★ is a real investment.
- **Max-star overflow [reserved, NOT built in Slice 2]:** once a class is 5★, further Edits overflow into a future **star-prestige** track (a later slice). Slice 2 only banks the overflow value; the prestige mechanic itself is deferred.
- **Visual:** a starred class shows its rating on the card (★ pips / tier frame) — cheap in the existing emoji+CSS layer, no art pipeline.
- Edits persist across publishes (meta-currency, like Royalties).

---

## 6b. World set bonus **[LOCKED — Slice 3]**

Fielding multiple variants (skins) of the **same world** grants a **set bonus**, based on **party makeup** — independent of the current zone (that's affinity, §9/Slice 4, kept separate). Breakpoints are **uniform across all worlds: 2 / 3 / 5** same-world variants fielded → tier 1 / 2 / 3. Tier 3 = the full 5-slot party themed (the Protagonist's cosmetic variant counts toward the set). The bonus *type* differs per world so each collection has its own identity (e.g., Space → DPS/"speed", Wild West → Inspiration income, Eldritch Horror → boss-regen cut, High Fantasy → Edit drop). Each bonus is a multiplier folded into the existing `modifiers.ts` `effective*` read-paths — the same pattern as shop upgrades and class abilities. Magnitudes harness-tuned.

In Slice 3 alone a set bonus has no opportunity cost (per-class stars + free skin swaps → once collected you just run it), so it functions as the **payoff for completing a world's collection**. The moment-to-moment "set cohesion vs. zone affinity" tension is what Slice 4 (affinity) adds on top.

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

- **Affinity (Slice 4)** — a variant is stronger when fighting **in its home zone** (current-zone-matched). This is **distinct from the Slice 3 set bonus** (§6b), which is party-makeup-based; affinity adds the "field for cohesion vs. match the current zone" tension on top.
- **World power-tiers** — alternatively/additionally, deeper-world variants flatly stronger.
- **More classes / 6★+ / ascension**, richer Protagonist signature abilities, etc.

---

## 10. Phased build plan

Each slice ships working, tested software and points at the north-star.

- **Slice 1 — Classes + abilities + Protagonist (no collection yet). ✅ IMPLEMENTED 2026-06-19.** Replaced the clone party with the Protagonist + the 4 classes (fixed 1★), abilities wired into `modifiers`, choose-a-class on recruit (Protagonist always fielded), save schema v3, full rebalance via the harness. Proves the composition gameplay. *(This is the MVP.)*
- **Slice 2 — Stars + Edits. ✅ IMPLEMENTED 2026-06-19.** Per-class 5★ stars; global **Edits** dropped by bosses; star-up (escalating cost) scaling class base power + ability magnitude on top of leveling; max-star overflow reserved (prestige deferred); star pips + star-up buttons on cards; save schema v4 with migration. Harness funds stars from boss Edits and confirms the loop still closes (greedy book 1 ~8m, books 1–8 complete). 108 tests, build green, live DOM smoke passed.
- **Slice 3a — Cosmetic variants (earn + equip). ✅ IMPLEMENTED 2026-06-19.** Deterministic earned acquisition (each world-boss clear unlocks the next class's variant for that world, fixed order, permanent — no gacha; full 5×8 collection over ~5 books); `Character.variantWorld` + `GameState.unlockedVariants`; equip any unlocked skin per fielded character (per-world face emoji + genre tag + accent on the card); save schema v5 with migration. Cosmetic only — NO mechanical effect (set bonus is 3b). 129 tests, build green, live DOM smoke passed (skin cycle equips face/tag/accent).
- **Slice 3b — The 2/3/5 set bonus. ✅ IMPLEMENTED 2026-06-19.** Per-world set bonus at uniform 2/3/5 fielded-same-world-variant thresholds (tier 1/2/3); bonus axis differs per world (`WORLD_SET_BONUS` table — dps/insp/words/editDrop multiplicative, regenCut additive); `activeSetBonus(party)`/`setBonusBreakdown(party)` in `variants.ts` fold into `effectivePartyDps`/`effectiveInspirationRate`/`effectiveWords`/`effectiveBossRegen` + the boss Edit drop in `onClear`; HUD lists active sets. Neutral when no set is fielded (zero balance churn). 142 tests, build green, live DOM smoke passed (2-member Space set = +15% DPS, HUD shows/hides correctly). Axis mapping + magnitudes are tunable placeholders.
- **Deferred follow-ups (not yet built):** full collection gallery / party-selection visual pass (§8 — wants a design-options pass with the owner); the Protagonist Royalties unlock track (§7); Slice 4 affinity (§9).
- **Slice 4+ — Deferred layers (§9):** affinity, etc.

> Decomposition rationale: each slice is independently testable and valuable. Slice 1 alone already transforms the party from clones into a composition puzzle.

---

## 11. Verification **[LOCKED approach]**

- The **balance harness** (`src/engine/balance.test.ts`) is extended so the greedy sim understands party composition (it must choose/field classes), and continues to assert the loop closes (book 1 publishable, books 1–8 complete) after each slice.
- `npm run build` + full `npm test` green per slice.
- Best-effort live DOM smoke on the built `dist/` (pixel screenshots remain uncapturable in this sandbox — flagged).
- Owner's live play pass for feel.

---

## 12. Open questions

Slices 1–3 are now designed and locked. **Resolved across the design:** class list + abilities (§4); Protagonist "Plot Armor" (§4); stars are **per-class**, 5★, multiplicative on power + ability (§6); **Edits** are a **global** pool, **boss-drop only**, single sink = star-up, max-star overflow reserved for a deferred prestige (§6); acquisition is **deterministic/earned** (per world-boss clear, fixed order, permanent — no gacha) (Slice 3, §10); world **set bonus** at uniform **2/3/5** thresholds with per-world bonus types (§6b); **party cap stays 5**; affinity is Slice 4 and distinct from the set bonus (§9).

Remaining are **tuning magnitudes only** (harness-set, not blocking): `STAR_GROWTH`, the Edit boss-drop amount + `EDITS_BASE`/`COST_GROWTH`, the per-world set-bonus magnitudes per tier, and the acquisition cadence. These are dialed against the balance harness during each slice, not decided up front.

---

## 13. Non-goals (this design) / honesty flags

- No affinity/world-tier mechanics yet (variants cosmetic — §1 caveat).
- The per-book leveling loop and its balance are preserved, not reworked (§2).
- UI is sketched, not designed — it gets its own pass (§8).
- All magnitudes (class stats, ability mags, star/Edits curves) are **harness-tuned placeholders**, not final.
- Save-schema v3 with migration; no data loss for existing saves.
- No new dependencies, no network, no secrets — fully local.
