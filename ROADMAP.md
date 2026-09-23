# Plot Armor — Roadmap
<!-- roadmap-schema: whitelist-v3 -->

## Definition

Single-user, public idle RPG / auto-battler ("the writer"): TypeScript (strict) + Vite, `break_eternity.js`,
`vitest`, `localStorage` saves. Playable core loop across 8 genre zones with a 6-class party, star tiers,
world-skin collection, set bonuses, zone affinity, Legacy prestige and the Publishing House shop.
No deploy exists yet, it is playable only via `npm run dev`.
**Status: SHELVED.** No polish backlog, no deploy requirement, no cadence promise, no chores attached.
Unparking happens only on an unprompted request. This file is the map, never the queue. Every tier row
below is entered only when that specific tier is requested. Read `NORTHSTAR.md` for vision and tiers.
Never in scope, any tier: paid release, ads, accounts, multiplayer.

## Milestones

| # | Title | Status | Ready | Plan | Notes |
|---|-------|--------|-------|------|-------|
| T1 | Content-complete free web game | [ ] | DEFERRED: shelved until this tier is requested | — | Book-8 **"The End"** state (a real closing beat, not just a stop). One balance feel-pass. GitHub Pages deploy off the CI build. README "play it here" link. The minimum unpark outcome and the baseline every later tier builds on |
| T2 | The endgame | [ ] | DEFERRED: shelved, after T1 | — | **Design doc first.** No endgame design exists past book 8: NG+/prestige replay vs endless scaling is an open design question. Then implementation re-tuned with `analysis.ts` / `balance.test.ts`, then human-playtested balance (current numbers are sim-derived, not playtested) |
| T3 | Real art | [ ] | BLOCKED: art assets from a design tool | — | Emoji-to-graphics migration. Emoji is the interim style. Swap homes prepared in advance: `icons.ts`, `content.ts`, `index.html` |
| T4 | Steam free release | [ ] | BLOCKED: Lucid unparks | — | Desktop wrapper: Electron vs Tauri decided at tier entry, UNVERIFIED which fits Steamworks overlay/achievements best. Steamworks achievements map onto books/collections. Store page + free release. A launch-pipeline rehearsal for Lucid |

## Pointers

- Vision, tiers and kill criteria: [NORTHSTAR.md](NORTHSTAR.md) · Commands, conventions and gotchas: [CLAUDE.md](CLAUDE.md)
- CI: `.github/workflows/ci.yml` runs `npm ci` / `npm test` / `npm run build` on push to `main` and on pull requests
- Save schema v6 with tolerant migration. Balance contract: `src/engine/balance.test.ts` and `analysis.ts`
