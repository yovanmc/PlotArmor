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

**v2 (prestige depth) engine complete.** On top of v1, Royalties are now a spendable
wallet feeding a permanent upgrade catalog (6 repeatable + 2 one-time), books escalate
in difficulty/size each publish, and the royalty payout scales with manuscript size.
All headless-tested (68 passing tests); `npm run build` is green. No spend UI yet —
engine systems only.

Specs: [v1 design](docs/superpowers/specs/2026-06-19-plot-armor-design.md) ·
[prestige design](docs/superpowers/specs/2026-06-19-plot-armor-prestige-design.md).
Plans: [v1](docs/superpowers/plans/2026-06-19-plot-armor-v1.md) ·
[prestige](docs/superpowers/plans/2026-06-19-plot-armor-prestige.md).

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
