# Plot Armor

[![CI](https://github.com/yovanmc/PlotArmor/actions/workflows/ci.yml/badge.svg)](https://github.com/yovanmc/PlotArmor/actions/workflows/ci.yml)

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

## How this was built

This repo was designed, specified, and reviewed by me, and implemented through my multi-agent development workflow: AI subagents execute written plans, with adversarial review gates (plan critique, code review, test verification) between phases. Every architectural decision is mine, and the process is left visible in the git history on purpose.

The productized form of that workflow is [backend-harness](https://github.com/yovanmc/backend-harness). If you're evaluating my work: ask me why the save migration clamps every field against the class catalog instead of trusting localStorage — I'll defend the design from first principles.

## Status

**Status: shelved.** No development is planned right now.

The game is playable and balanced across **8 genre zones** (Wild West, Zombie Apocalypse, Space,
High Fantasy, Pirate Seas, Noir City, Eldritch Horror, Prehistoric). The party is class-based: a
fixed **Protagonist** plus five recruitable classes (**Anti-hero**, **Support**, **Debuffer**,
**Sidekick** and **The Critic**) with a party cap of 5 (6 with the Ensemble Cast upgrade). Classes
earn 1★ to 5★ star tiers funded by
**Edits** from boss kills, and the Protagonist is promoted with **Royalties** instead. Characters
collect `(class × world)` skins, browsed and equipped from the **Collection** screen. Same-world skins
grant set bonuses, distinct worlds grant the **Ensemble** set, and a character wearing the current
zone's skin gets a zone affinity bonus. Royalties buy permanent upgrades in the **Publishing House**,
and surplus Edits buy global **Legacy** levels. A greedy-play balance harness
(`src/engine/balance.test.ts`, with the loadout analyzer in `analysis.ts`) checks that books 1 to 8
all complete with no hard wall. Saves use schema v6 with tolerant migration. 194 headless tests.

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
