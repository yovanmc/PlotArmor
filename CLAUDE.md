# Plot Armor runbook

Plan and status live in `ROADMAP.md`. Read `NORTHSTAR.md` when planning or judging scope.
This file is the how-to-work-here layer.

## What this is

Single-user, public idle RPG / auto-battler ("the writer"): TypeScript (strict)
+ Vite, `break_eternity.js` for big numbers, `vitest`/jsdom for tests,
`localStorage` for saves. No backend, no external APIs, no secrets.

Engine/render split under `src/`:
- `src/engine/` holds pure, DOM-free game logic, each module with a colocated `*.test.ts`.
- `src/ui/` is a thin DOM layer. It reads state and emits intents only, and game rules stay in `engine/`.
- `src/main.ts` bootstraps: load save → offline catch-up → render → loop.

Scripts live in `package.json`: `npm test` (vitest, one headless pass), `npm run build`
(`tsc --noEmit` strict typecheck, then `vite build`), `npm run dev`.

## Verification approach

Test gate: `.github/workflows/ci.yml` · whole · ci · 0.4 min [V 2026-09-28 d5532c0f]

- CI (`.github/workflows/ci.yml`) runs `npm ci`, `npm test` and `npm run build`
  on push to `main` (the default branch) and on pull requests.
- Tests gate everything. `engine/` tests need no DOM, and `ui/` tests run under
  jsdom per `vite.config.ts`.
- `src/engine/balance.test.ts` is a standing regression harness: a greedy-play
  simulation asserting the loop still *closes* (book 1 publishable in single-digit
  minutes, books 1 to 8 all completable, no hard wall) after any balance-affecting
  change. Treat a balance.test.ts failure as a design signal, not just a bug.
- `npm run build` (tsc strict + vite build) must be green (hard gate).
- UI changes also get a manual live-DOM smoke pass (e.g. a HUD line updates,
  0 console errors). The repo has no screenshot harness.

## Conventions & safety

- Nontrivial features get a spec and a task-checklist plan before implementation.
- `num.ts` is the *only* file allowed to touch `break_eternity.js` directly.
  All other code goes through its wrapper (add/sub/mul/div/cmp/format).
- `step(state, dt)` in `loop.ts` is the single source of truth for time
  advancement. Live play and offline fast-forward call that same function
  to guarantee parity, so tick logic lives only there.
- Save schema is versioned (`SCHEMA_VERSION` in `save.ts`) with tolerant migration
  (ignore unknown fields, default missing ones). Any new persisted field needs a schema
  bump and a migration path, not a silent shape change.

## Recurring gotchas

- Big numbers are `Decimal` everywhere. Game quantities always use the `num` wrapper,
  never native JS `number` math, since overflow and precision bugs hide there.
- Offline fast-forward has a clock-rewind guard (negative elapsed → 0) and a
  capped elapsed window, so a bad clock neither rewards nor punishes the player.
- Publish (prestige reset) is a **player-gated action**, never automatic,
  including on return from offline. Reaching `bookComplete` halts progression
  and waits. It must not auto-reset the party.
- Class/skin/set-bonus/affinity systems all route through the same
  `effective*` read-paths in `modifiers.ts`. A new modifier composes into those
  paths rather than special-casing a system.
- The internal `scribe` class id is The Critic (it kept its id so saves load).
  When semantics shift but persistence must not break, reuse existing ids.
- Tuning changes are validated against measured target bands in
  `analysis.ts`/`balance.test.ts` (e.g. rainbow/mono and Critic/baseline
  parity ratios, book-8 duration band). Treat those assertions as the
  balance contract, not arbitrary thresholds.
