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

**Playable loop, balanced, 8 genres.** On top of v1, Royalties are a spendable
wallet feeding a permanent upgrade catalog (6 repeatable + 2 one-time), spent
in-game via the **Publishing House** (a parchment modal opened from a live-balance
entry button); books escalate in difficulty/size each publish, and the royalty
payout scales with manuscript size.

The core economy is now **tuned so the loop actually closes** — character power grows
multiplicatively per level (`POWER_GROWTH`), so bought DPS keeps pace with exponential
enemies. A greedy-play balance harness (`src/engine/balance.test.ts`) verifies book 1
is publishable in ~13 minutes and books 1–8 all complete with no hard wall. Content is
expanded from 3 to **8 genre zones** (Wild West, Zombie Apocalypse, Space, High Fantasy,
Pirate Seas, Noir City, Eldritch Horror, Prehistoric). All headless-tested (78 passing
tests); `npm run build` is green. Balance constants are tunable placeholders.

Specs: [v1 design](docs/superpowers/specs/2026-06-19-plot-armor-design.md) ·
[prestige design](docs/superpowers/specs/2026-06-19-plot-armor-prestige-design.md) ·
[spend UI design](docs/superpowers/specs/2026-06-19-plot-armor-shop-ui-design.md) ·
[balance + content design](docs/superpowers/specs/2026-06-19-plot-armor-balance-and-content-design.md).
Plans: [v1](docs/superpowers/plans/2026-06-19-plot-armor-v1.md) ·
[prestige](docs/superpowers/plans/2026-06-19-plot-armor-prestige.md) ·
[spend UI](docs/superpowers/plans/2026-06-19-plot-armor-shop-ui.md).

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
