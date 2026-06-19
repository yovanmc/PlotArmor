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

In design → implementation. Full v1 spec:
[`docs/superpowers/specs/2026-06-19-plot-armor-design.md`](docs/superpowers/specs/2026-06-19-plot-armor-design.md).

## Stack

TypeScript + Vite, `break_eternity.js` for big numbers, `vitest` for tests,
`localStorage` for saves. No external APIs, no secrets, fully offline/local.

## Core loop (v1)

Party auto-battles on a tick → earns **Inspiration** (spend to recruit/level
characters) and writes **Words** (manuscript progress) → grow power → clear
deeper zones → beat the book's final boss → **publish** for **Royalties** (a
permanent prestige bonus) → write the next book. Offline progress accrues while
you're away.
