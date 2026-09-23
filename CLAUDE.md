# Plot Armor — agent/developer runbook

State lives in `README.md` (running status log) and `docs/superpowers/specs/` +
`docs/superpowers/plans/` (design/decision history, linked from the README).
This file is the how-to-work-here layer, not the source of truth on progress.

Forward-looking plan and status: `ROADMAP.md` + `NORTHSTAR.md` (project is
currently SHELVED as of 2026-07-07 — motivation-gated, no active tier).

## What this is

Single-user, public idle RPG / auto-battler ("the writer") — TypeScript (strict)
+ Vite, `break_eternity.js` for big numbers, `vitest`/jsdom for tests,
`localStorage` for saves. No backend, no external APIs, no secrets.

Engine/render split under `src/`:
- `src/engine/` — pure, DOM-free game logic: `num` (Decimal wrapper), `content`
  (static zone/class/genre data), `state`, `combat`, `economy`, `progression`,
  `loop` (`step(state, dt)` reducer), `offline` (fast-forward via `step`),
  `save` (versioned, tolerant migration), `prestige`, `modifiers`, `variants`,
  `analysis`/`balance.test.ts` (greedy-play tuning harness).
- `src/ui/` — thin DOM layer: `render`, `input`, `rafLoop`, `shop`, `gallery`,
  `icons`. Reads state and emits intents only; never owns game rules.
- `src/main.ts` — bootstrap (load save → offline catch-up → render → loop).

Status per README: playable core loop across 8 genre zones, class-based party
(6 classes incl. The Critic), star tiers, world-skin collection with set bonus
+ zone affinity, Legacy prestige track, Publishing House upgrade shop.

## Commands

```bash
npm install
npm run dev        # vite dev server
npm test           # vitest run (headless, single pass)
npm run test:watch
npm run build      # tsc --noEmit (strict typecheck) && vite build
npm run preview    # serve the production build
```

## Verification approach

- Tests gate everything: each engine module is colocated with a `*.test.ts`
  and is fully headless (no DOM needed for `engine/`; `ui/` tests run under
  jsdom per `vite.config.ts`). Run `npm test` before treating a change as done.
- `src/engine/balance.test.ts` is a standing regression harness — a greedy-play
  simulation asserting the loop still *closes* (book 1 publishable in single-digit
  minutes, books 1–8 all completable, no hard wall) after any balance-affecting
  change. Treat a balance.test.ts failure as a design signal, not just a bug.
- `npm run build` (tsc strict + vite build) must be green — treated as a hard
  gate in every README status entry.
- UI changes additionally get a manual "live DOM smoke" pass (documented per
  README entry, e.g. checking a HUD line updates, 0 console errors) — no
  automated screenshot harness in-repo; per global convention, verify visually
  via a cheap subagent returning a text verdict, not by loading PNGs into the
  main session.

## Conventions & safety

- CI: `.github/workflows/ci.yml` runs `npm ci`,
  `npm test`, and `npm run build` on push to `main` and on pull requests. Also
  run `npm test` / `npm run build` locally/by-agent before calling work done.
- Commit identity: plain `git commit` as `yovanmc <yovanmc@users.noreply.github.com>`
  — never override author.
- Design/plan-then-build convention: nontrivial features get a spec under
  `docs/superpowers/specs/` and a task-checklist plan under
  `docs/superpowers/plans/` before implementation.
- `num.ts` is the *only* file allowed to touch `break_eternity.js` directly —
  all other code goes through its wrapper (add/sub/mul/div/cmp/format).
- `step(state, dt)` in `loop.ts` is the single source of truth for time
  advancement — live play and offline fast-forward must call the same
  function to guarantee parity. Don't duplicate tick logic elsewhere.
- Save schema is versioned (`schemaVersion`, currently v6 per README) with
  tolerant migration (ignore unknown fields, default missing ones) — any new
  persisted field needs a schema bump and a migration path, not a silent
  shape change.

## Recurring gotchas (from design/status history)

- Big numbers are `Decimal` everywhere from day one — never fall back to
  native JS `number` math for game quantities; overflow/precision bugs hide here.
- Offline fast-forward has a clock-rewind guard (negative elapsed → 0) and a
  capped elapsed window — don't let a bad clock reward/punish the player.
- Publish (prestige reset) is a **player-gated action**, never automatic —
  including on return from offline. Reaching `bookComplete` halts progression
  and waits; it must not auto-reset the party.
- Class/skin/set-bonus/affinity systems all route through the same
  `effective*` read-paths — when adding a new modifier, compose into those
  paths rather than special-casing a system.
- The internal `scribe` class id was repurposed (Words class → The Critic)
  without a save-breaking rename — prefer reusing/pivoting existing ids over
  introducing new ones when semantics shift but persistence shouldn't break.
- Tuning changes are validated against measured target bands in
  `analysis.ts`/`balance.test.ts` (e.g. rainbow/mono and Critic/baseline
  parity ratios, book-8 duration band) — treat those assertions as the
  balance contract, not arbitrary thresholds.
