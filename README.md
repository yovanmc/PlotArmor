# Plot Armor

A personal, single-user **idle RPG / auto-battler**. You're an author; the
characters in your stories are your party. They auto-battle through genre-themed
chapters (Wild West, Space, Zombies, …) to each zone's boss. Finishing the final
boss means the author finishes the book — it goes on sale for a prestige point,
and you start writing the next one.

The name is the joke: the author's characters survive because he's *writing* them
— plot armor. (In v1, party members can't die. That's the point.)

> Idle RPG / auto-battler-progression (Melvor-Idle style), **not** a clicker.
> Combat auto-resolves and is lightly visualized (health bars, panels, emoji
> stand-ins) — systems-and-numbers, no combat renderer.

## Status

**Playable loop, balanced, 8 genres, class-based party with stars + collectible world skins, set bonuses & zone affinity.** On top of v1, Royalties are a spendable
wallet feeding a permanent upgrade catalog (6 repeatable + 2 one-time), spent
in-game via the **Publishing House** (a parchment modal opened from a live-balance
entry button); books escalate in difficulty/size each publish, and the royalty
payout scales with manuscript size.

The core economy is now **tuned so the loop actually closes** — character power grows
multiplicatively per level (`POWER_GROWTH`), so bought DPS keeps pace with exponential
enemies. A greedy-play balance harness (`src/engine/balance.test.ts`) verifies book 1
is publishable in ~10 minutes and books 1–8 all complete with no hard wall. Content is
expanded from 3 to **8 genre zones** (Wild West, Zombie Apocalypse, Space, High Fantasy,
Pirate Seas, Noir City, Eldritch Horror, Prehistoric).

The party is now **class-based (Slice 1 of the party system)**: a fixed **Protagonist**
plus four recruitable classes — **Anti-hero** (Lone Wolf: amps only its own DPS),
**Support** (amps the whole party's DPS), **Debuffer** (cuts boss regen), and
**Sidekick** (raises the Inspiration rate). You choose which class to recruit, and the
Protagonist's **Plot Armor** scales the party's DPS by the number of *distinct* classes
fielded, so a varied roster beats a stack of clones.

Classes now also carry **per-class star tiers (Slice 2 of the party system)**: 1★–5★
ratings funded by **Edits**, a global currency dropped by **boss kills**. Spending Edits
raises a class's star, which multiplies both its base power and its ability magnitude on
top of per-book leveling (the Protagonist grows on its own track instead). Stars are a
permanent, earned mid-game boost — the harness verifies the loop still closes (book 1 in
~8 minutes, books 1–8 complete) with stars funded from boss drops.

Characters now also collect `(class × world)` skins (Slice 3 of the party system): clearing
a world's boss deterministically unlocks the next class's variant for that world (fixed
order, no gacha; a full 5×8 collection fills in over ~5 books), and each fielded character
can wear any skin its class has unlocked — shown as a per-world face emoji, a genre tag, and
the world's accent on the card. Fielding a cohesive themed party then pays off: **2 / 3 / 5
characters wearing the same world's skin grant a tier 1 / 2 / 3 set bonus**, whose effect
type differs per world (e.g. Space → DPS, Wild West → Inspiration, Eldritch → boss-regen
cut, Pirate Seas → Edit drop), folded into the same `effective*` read-paths as everything
else. Multiple sets can stack, and the HUD lists the active ones. All headless-tested (142
passing tests; the loop still closes with set bonuses, which only ever help a deliberately
themed party) plus a live DOM smoke (a 2-member Space set raised Party DPS +15% and the HUD
reflected it, 0 console errors); `npm run build` is green. The per-world axis mapping and all
magnitudes are tunable placeholders.

The **Protagonist** has its own growth path — it earns no Edits stars; instead you **promote**
it 1★→5★ by spending **Royalties** in the Publishing House. Each promotion scales its base
power and strengthens its **Plot Armor** signature, tying the lead to the prestige economy and
giving Royalties another sink. All headless-tested (151 passing tests) plus a live DOM smoke (a
promotion raised the lead ★☆☆☆☆→★★☆☆☆, spent the Royalties, and lifted Party DPS 2.4→3.3 —
reflecting both the stat and Plot Armor scaling, 0 console errors); `npm run build` is green.
Promotion costs are tunable placeholders.

Skins now also have **mechanical teeth in the current zone (Slice 4 of the party system)**: a fielded
character "in its element" — its equipped skin's world matches the zone you're currently fighting in —
has its **whole contribution** (its own damage *and* its class ability) scaled by a flat affinity bonus.
This is distinct from the set bonus: the set bonus rewards a cohesive same-world party (always on);
affinity rewards matching the *current* zone (dynamic as you advance zone-to-zone through a book). The
two pull on the same lever — your equipped skins — so each book is a loadout choice: commit to one world
for an always-on set bonus plus a big affinity spike in that one zone, or spread skins across worlds for
steady affinity everywhere. The Protagonist's Plot Armor signature is deliberately left unscaled. Derived
entirely from existing data (no save change), neutral when nobody is in their element (the balance harness
is unaffected — book 1 still publishes in ~7.7 min, books 1–8 complete). All headless-tested (163 passing
tests); `npm run build` is green. The affinity magnitude is a tunable placeholder.

The skins finally get a home: a **Collection screen (§8 of the party system)**. A `🎴 Collection`
button opens a master-detail modal — your five characters on the left (each with its worn skin, star
tier, and worlds-collected count, plus an `N / 40` completion bar), and the selected character's full
set of world skins on the right (unlocked ones in the world's accent, locked ones dimmed with 🔒, the
worn one ringed). Click any unlocked skin to equip it on that character — this replaces the old per-card
cycle button, which matters now that zone affinity makes skin choice strategic. It's a pure UI layer over
the existing data (no save change, no balance impact). All headless-tested (169 passing tests) plus a live
DOM smoke (equipping from the gallery updated the worn tile and the battle card, 0 console errors);
`npm run build` is green.

The late game gets a sink: a **star-prestige "Legacy" track**. Once your classes are maxed at 5★, Edits
stop having anywhere to go — so surplus Edits now buy global **Legacy** levels in the Publishing House,
each permanently multiplying every character's power *and* ability magnitude (a universal extra star for
the whole roster). It's soft-gated by an escalating Edits cost, so raising stars stays the right early
buy. Neutral at level 0 (no save/balance churn for existing games); persisted via save schema v6. All
headless-tested (183 passing tests) plus a live DOM smoke; `npm run build` is green. The Legacy
magnitudes are tunable placeholders for the upcoming feel pass.

Specs: [v1 design](docs/superpowers/specs/2026-06-19-plot-armor-design.md) ·
[prestige design](docs/superpowers/specs/2026-06-19-plot-armor-prestige-design.md) ·
[spend UI design](docs/superpowers/specs/2026-06-19-plot-armor-shop-ui-design.md) ·
[balance + content design](docs/superpowers/specs/2026-06-19-plot-armor-balance-and-content-design.md) ·
[party system design](docs/superpowers/specs/2026-06-19-plot-armor-party-system-design.md) ·
[star-prestige design](docs/superpowers/specs/2026-06-20-plot-armor-star-prestige-design.md).
Plans: [v1](docs/superpowers/plans/2026-06-19-plot-armor-v1.md) ·
[prestige](docs/superpowers/plans/2026-06-19-plot-armor-prestige.md) ·
[spend UI](docs/superpowers/plans/2026-06-19-plot-armor-shop-ui.md) ·
[party Slice 1](docs/superpowers/plans/2026-06-19-plot-armor-party-slice1.md) ·
[party Slice 2](docs/superpowers/plans/2026-06-19-plot-armor-party-slice2.md) ·
[party Slice 3a](docs/superpowers/plans/2026-06-19-plot-armor-party-slice3a.md) ·
[party Slice 3b](docs/superpowers/plans/2026-06-19-plot-armor-party-slice3b.md) ·
[Protagonist track](docs/superpowers/plans/2026-06-19-plot-armor-protagonist-track.md) ·
[party Slice 4](docs/superpowers/plans/2026-06-19-plot-armor-party-slice4.md) ·
[collection gallery](docs/superpowers/plans/2026-06-20-plot-armor-collection-gallery.md) ·
[star-prestige](docs/superpowers/plans/2026-06-20-plot-armor-star-prestige.md).

Run it locally: `npm install` then `npm run dev`.

## Stack

TypeScript + Vite, `break_eternity.js` for big numbers, `vitest` for tests,
`localStorage` for saves. No external APIs, no secrets, fully offline/local.

## Core loop (v1)

Party auto-battles on a tick → earns **Inspiration** (spend to recruit/level
characters) and writes **Words** (manuscript progress) → grow power → clear
deeper zones → beat the book's final boss → **publish** for **Royalties** (a
permanent prestige bonus) → write the next book. Offline progress accrues while
you're away.
