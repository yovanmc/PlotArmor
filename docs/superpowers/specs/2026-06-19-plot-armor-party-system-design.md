# Plot Armor — Party System (Classes, Stars, Collection) Design Spec

- **Date:** 2026-06-19
- **Status:** **Slices 1, 2, 3a, 3b + the Protagonist track IMPLEMENTED** (2026-06-19) — Slice 1: Protagonist + 4 classes with composition abilities. Slice 2: per-class 5★ stars funded by global **Edits** from bosses (save v4). Slice 3a: `(class × world)` skins earned by clearing world bosses (deterministic, no gacha) + equip on cards (save v5). Slice 3b: the 2/3/5 per-world **set bonus**. §7 Protagonist track: Royalty-funded 1★→5★ promotion in the Publishing House scaling its power + Plot Armor. Slice 4 (Zone Affinity, §9) is also IMPLEMENTED (2026-06-19): a fielded character "in its element" (skin world == current zone) gets its whole contribution scaled. All shipped on `main`. **§8 Collection gallery + skin loadout is now DESIGNED + LOCKED** (2026-06-20, master-detail layout chosen via a 3-option mockup pass) — building next; not yet implemented. After §8, only tuning magnitudes/axis-mapping (§12) and the §9 "further deferred" layers remain.
- **Repo:** `PlotArmor` (public, GitHub `yovanmc`), local `C:\Agent Projects\PlotArmor`
- **Author/owner:** Yovan Collins (single-user, personal project)
- **Builds on:** v1 engine, prestige + Publishing House shop, and the balance fix + 8 genre zones (all shipped).

This is the **end-goal (north-star)** for turning the party from identical clones into a class/collection RPG layer, plus a **phased build plan** so we ship it in slices instead of one giant blob. Locked decisions are marked **[LOCKED]**; everything else is a **[PROPOSED]** starting point for you to change.

---

## 1. Vision (north-star)

A roster/collection layer on top of the idle loop:

- **[LOCKED] The Protagonist** — one permanent, central character. Unlike everyone else, you don't *acquire* them at a tier; you **unlock** stat boosts and higher stars for them through a dedicated progression track.
- **[LOCKED] Classes** — a set of role-bearing types. A class defines a stat lean + an **ability** (a party-wide effect).
- **[LOCKED] World variants** — every class has one variant per world (8 worlds). A character is a `(class × world)` skin. Cosmetic on their own; the **set bonus** (§6b) and **affinity** (Slice 4, §9 — now designed + locked) are what give skins mechanical teeth. World power-tiers remain deferred (§9 "Further deferred").
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

## 7. The Protagonist track **[LOCKED]**

The Protagonist doesn't earn stars from worlds; instead you **promote** it 1★→5★ by spending **Royalties** in the **Publishing House**, tying the singular hero to the prestige economy and giving Royalties another sink.

- **Power model (reuse the star machinery):** the Protagonist's `stars.protagonist` slot (pinned at 1 in Slice 2) is allowed to rise to `MAX_STAR`. Its base power scales for free — `effectiveCharacterPower` already applies `starStatMult(stars[classId])` to every class. **Its Plot Armor signature scales with its stars too:** `plotArmorMult = 1 + mag × distinctClassCount × starAbilityMult(stars.protagonist)` (Plot Armor stays level-independent — stars are the permanent lever).
- **Economy:** a Royalty-funded `promoteProtagonist(state)` / `canPromoteProtagonist(state)` (in `prestige.ts`, alongside `buyUpgrade`), with a rising `protagonistPromoteCost(currentStar)` Royalty curve; caps at `MAX_STAR = 5`.
- **UI:** promotion lives in the **Publishing House** modal (a small "The Protagonist" section: current ★ + a "Promote ★ (💰 cost)" button) — NOT on the card. The Protagonist's card now shows its real ★ pips (instead of "—") but keeps no card star-up button (shop-only, unlike the Edits classes).
- **No save change:** `stars.protagonist` is already serialized + sanitized. Neutral-default invariant holds (at 1★, `starStatMult`/`starAbilityMult` = 1 → fresh game unchanged). Cost magnitudes are harness-/owner-tuned placeholders.

---

## 8. Collection gallery + skin loadout **[LOCKED]**

The original §8 sketch ("collection screen + party selection") predates the shipped mechanics: the party is **per-class** (5 classes, cap 5/6), so there is no large roster to curate — "party selection" is thin. The real, currently-missing value is a place to **see the whole `(class × world)` skin collection** (today a skin is only visible while equipped on a battle card) and a **better way to equip skins** now that zone affinity (§9) makes skin choice strategic. Owner picked, after a 3-option visual mockup pass: a **master-detail** layout (Option C), scope = **gallery + skin loadout** (view collection AND equip; star-up stays on the battle cards).

**Layout (master-detail, in a modal — same pattern as the Publishing House `#shop-modal`):**
- **Entry:** a new `🎴 Collection` button (`#collection-open`) near the Publishing House button, opening `#collection-modal`.
- **Header:** "Collection" + completion `N / 40 skins` (40 = 5 classes × 8 worlds) and a thin progress bar. Count = sum of `unlockedVariants[classId].length`.
- **Left pane — the 5 characters (classes):** each row shows the worn skin's face (or ✍️ base), class name, its ★ tier (**read-only** — star-up is not moved here), and `x/8` worlds collected. Click selects; selected row highlighted. Default selection = first class (`protagonist`).
- **Right pane — selected character's skins:** a tile grid of a **Base** option (✍️, equips `null`) + the 8 world skins. Unlocked = bright with the world's accent (`ZONES[w].accent`), click-to-equip; locked = dimmed + 🔒, not clickable; the worn one gets the cyan ring + ✨. A caption shows what is worn and its effect ("Wearing Wild West 🤠 — in element in Wild West zones"). If the selected class is **not currently fielded**, skins still show (collection view) but equipping is disabled with a "recruit to equip" hint.

**Implementation:** new `src/ui/gallery.ts` (`renderGallery(state)` + `wireGallery(getState, setState)`), mirroring `shop.ts`; selected-class is module-local UI state preserved across re-renders. Equipping **reuses the existing `setVariant(state, characterId, world)`** — the gallery resolves the selected class to its fielded character (`party.find(c => c.classId === sel)`). **This slice is UI-only: NO engine change, NO save-schema change, zero balance impact.** The battle cards keep showing the worn skin (face/genre tag/accent/✨) but the 🎭 cycle button + its `data-action="variant"` handler are **removed** (the gallery replaces them).

**Non-goals:** no star-up from the gallery (battle cards keep it); duplicate-class fielding targets the first fielded member of that class; no character renaming/reordering; no party reordering.

---

## 9. Slice 4 — Zone Affinity **[LOCKED]**

A fielded character is **"in its element"** when its equipped skin's world matches the **current zone**: `c.variantWorld === state.zone.zoneIndex`. While in its element, a single multiplier `affinityMult = 1 + AFFINITY_MAG` scales that character's **whole contribution** — both its **power** in the DPS sum *and* its **class ability** (Support's party-DPS amp, Debuffer's regen cut, Sidekick's Inspiration rate, the Anti-hero's Lone Wolf self-amp). Bonus-only — there is **no off-zone penalty**.

Affinity is **distinct from the Slice 3b set bonus** (§6b): the set bonus is party-makeup-based (same-world skins, always on); affinity is current-zone-based (dynamic as the auto-battler advances zone 0→7 through a book). Both key off the **same lever** — your equipped skins — but pull in different directions across a book, which is the intended tension:

- **Mono-world loadout** → always-on set bonus **plus** a 5-character affinity spike in that one zone (great for the final-boss zone, which is always last), but dead affinity in the other 7 zones.
- **Rainbow loadout** → no set bonus, but steady ~1-character affinity in every zone (consistent clearing).

This is a per-book loadout decision, not a per-encounter one.

**Deliberate exclusion:** the Protagonist's **Plot Armor** signature is **not** affinity-scaled. Plot Armor is a party-variety meta-signature (distinct-class count × the Protagonist's stars) and already scales via the Protagonist track (§7); stacking affinity on it would muddy that signature. The Protagonist still benefits from affinity through its base power in the DPS loop, so a home Protagonist is stronger — only the Plot Armor term stays clean.

**No save-schema change.** Affinity is derived entirely from the existing `variantWorld` (save v5) and the live `zoneIndex` — exactly like the set bonus (§6b).

**Neutral-by-default invariant (held, as in every prior slice):** a base-skin character has `variantWorld === null`, which never equals a zone index, so a fresh game and the balance harness (which fields base skins) trigger zero affinity → zero balance churn. Only new tests exercise it.

**Code integration** (acyclic, follows the set-bonus pattern):

- `content.ts` — `AFFINITY_MAG` (placeholder `0.5`, harness-tuned).
- `variants.ts` — `affinityMult(c, zoneIndex)` → `c.variantWorld === zoneIndex ? 1 + AFFINITY_MAG : 1` (sibling of `activeSetBonus`).
- `modifiers.ts` — the module-private `abilitySum` gains a `zoneIndex` param and multiplies each ability term by `affinityMult(c, zoneIndex)`; `effectivePartyDps(s)` reads `s.zone.zoneIndex`, multiplies each character's loop term (`effectiveCharacterPower × selfMult`) by its `affinityMult`, and forwards the zone to its `abilitySum` calls; `effectiveInspirationRate` / `effectiveBossRegen` already receive `zoneIndex` and just forward it. All exported `effective*` signatures are unchanged, so combat/loop/offline (which replays the same `step`, advancing zones) pick it up for free.

**UI** (cheap emoji+CSS, mirrors the set-bonus surfacing):

- Card: a `✨` marker (reusing the accent glow) on any fielded character in its element this zone.
- HUD: an affinity summary line under the set line (e.g. `✨ In element: 2 (+50% each)`), shown only when ≥1 character is matched.

**Open tuning (non-blocking, owner feel-pass):** the `AFFINITY_MAG` magnitude — specifically whether it makes the rainbow loadout competitive with the always-on set bonus.

### Further deferred (beyond Slice 4)

- **World power-tiers** — deeper-world variants flatly stronger (alternative/addition to affinity).
- **Max-star overflow → star-prestige ("Legacy")** — now its own LOCKED spec (`2026-06-20-plot-armor-star-prestige-design.md`), building. Realizes the §6-reserved overflow: an Edits-funded global power+ability multiplier.
- **More classes / 6★+ / ascension**, richer Protagonist signature abilities, etc. (A new Words-axis class is the next planned addition after star-prestige.)

---

## 10. Phased build plan

Each slice ships working, tested software and points at the north-star.

- **Slice 1 — Classes + abilities + Protagonist (no collection yet). ✅ IMPLEMENTED 2026-06-19.** Replaced the clone party with the Protagonist + the 4 classes (fixed 1★), abilities wired into `modifiers`, choose-a-class on recruit (Protagonist always fielded), save schema v3, full rebalance via the harness. Proves the composition gameplay. *(This is the MVP.)*
- **Slice 2 — Stars + Edits. ✅ IMPLEMENTED 2026-06-19.** Per-class 5★ stars; global **Edits** dropped by bosses; star-up (escalating cost) scaling class base power + ability magnitude on top of leveling; max-star overflow reserved (prestige deferred); star pips + star-up buttons on cards; save schema v4 with migration. Harness funds stars from boss Edits and confirms the loop still closes (greedy book 1 ~8m, books 1–8 complete). 108 tests, build green, live DOM smoke passed.
- **Slice 3a — Cosmetic variants (earn + equip). ✅ IMPLEMENTED 2026-06-19.** Deterministic earned acquisition (each world-boss clear unlocks the next class's variant for that world, fixed order, permanent — no gacha; full 5×8 collection over ~5 books); `Character.variantWorld` + `GameState.unlockedVariants`; equip any unlocked skin per fielded character (per-world face emoji + genre tag + accent on the card); save schema v5 with migration. Cosmetic only — NO mechanical effect (set bonus is 3b). 129 tests, build green, live DOM smoke passed (skin cycle equips face/tag/accent).
- **Slice 3b — The 2/3/5 set bonus. ✅ IMPLEMENTED 2026-06-19.** Per-world set bonus at uniform 2/3/5 fielded-same-world-variant thresholds (tier 1/2/3); bonus axis differs per world (`WORLD_SET_BONUS` table — dps/insp/words/editDrop multiplicative, regenCut additive); `activeSetBonus(party)`/`setBonusBreakdown(party)` in `variants.ts` fold into `effectivePartyDps`/`effectiveInspirationRate`/`effectiveWords`/`effectiveBossRegen` + the boss Edit drop in `onClear`; HUD lists active sets. Neutral when no set is fielded (zero balance churn). 142 tests, build green, live DOM smoke passed (2-member Space set = +15% DPS, HUD shows/hides correctly). Axis mapping + magnitudes are tunable placeholders.
- **Protagonist track (§7). ✅ IMPLEMENTED 2026-06-19.** Royalty-funded `promoteProtagonist` 1★→5★ in the Publishing House (`protagonistPromoteCost` curve in content, `canPromoteProtagonist`/`promoteProtagonist` in prestige); reuses `starStatMult` for base power (no modifier change) + scales Plot Armor by `starAbilityMult(stars.protagonist)`; card shows the Protagonist's real ★ pips, promotion is shop-only. No save change. Neutral at 1★. 151 tests, build green, live DOM smoke passed (promote → ★★☆☆☆, Royalties spent, DPS 2.4→3.3 reflecting both stat + Plot Armor scaling).
- **Slice 4 — Zone Affinity (§9). ✅ IMPLEMENTED 2026-06-19.** A fielded character "in its element" (skin world == current zone) gets its **whole contribution** (power + class ability) scaled by `1 + AFFINITY_MAG`; bonus-only, derived from existing `variantWorld` + live `zoneIndex` (no save change), neutral-by-default (base skins never match), Plot Armor excluded. Distinct from the makeup-based set bonus (§6b) — creates a per-book mono-vs-rainbow loadout tension. `affinityMult` in `variants.ts` folds into `effectivePartyDps` + `abilitySum` in `modifiers.ts`. 163 tests, build green, live DOM smoke passed (home antihero DPS 3.3→3.9; off-zone clears).
- **§8 Collection gallery + skin loadout. DESIGNED + LOCKED 2026-06-20 (building next).** Master-detail modal (Option C, chosen via a 3-option mockup pass): left = 5 characters (worn face + name + ★ + x/8 collected), right = selected character's Base + 8 world skins (unlocked/locked, worn one ringed), header completion N/40. UI-only — new `src/ui/gallery.ts` reuses `setVariant` (no engine/save change); replaces the battle-card 🎭 cycle button.
- **Slice 5+ — Further deferred layers (§9):** world power-tiers, more classes / 6★+ / ascension, star-prestige overflow, etc.

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

- Affinity is now designed + locked as Slice 4 (§9); world-tier mechanics remain deferred (§9 "Further deferred").
- The per-book leveling loop and its balance are preserved, not reworked (§2).
- UI: battle screen is built; the collection gallery + skin loadout is now designed + locked (§8, master-detail) and building next.
- All magnitudes (class stats, ability mags, star/Edits curves) are **harness-tuned placeholders**, not final.
- Save-schema v3 with migration; no data loss for existing saves.
- No new dependencies, no network, no secrets — fully local.
