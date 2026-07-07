# Plot Armor — Roadmap

## North Star (2026-07-07) — read NORTHSTAR.md

**Status: SHELVED** (owner decision 2026-07-07 — no motivation for it right now).
No polish backlog, no deploy requirement, no cadence promise, no chores attached
to this park. **Unparking requires the owner asking, unprompted** — this file is
the map, never the queue. See `NORTHSTAR.md` for the full grilling-session record
(vision, tiers, state-at-parking, kill criteria — there are none).

## The future roadmap (motivation-gated tiers)

Every tier below is entered only when the owner asks for that specific tier,
unprompted. None of this is scheduled or implied by being written down.

### Tier 1 — Content-complete free web game
- Design and ship a book-8 **"The End"** state: a real closing beat for the
  author premise (the writer finishes their last book), not just a stop.
- One balance feel-pass on top of the current sim-derived tuning.
- GitHub Pages deploy workflow off the existing CI build (static Vite bundle).
- README/portfolio updated to a "play it here" link.
- This is the minimum unpark outcome — it converts the repo from
  trust-my-tests to click-and-play and is the baseline every later tier
  builds on.

### Tier 2 — The endgame
- **Design doc first.** No endgame design exists past book 8 today — NG+/
  prestige-driven replay vs. endless scaling is an open design question, not
  a tuning task. Skipping the spec is how idle-game endgames become
  spreadsheets nobody enjoys.
- Then implementation, re-tuned with the sim harness (`analysis.ts` /
  `balance.test.ts`).
- Then human-playtested balance — current numbers are sim-derived estimates
  by the tuning doc's own admission, not playtested.

### Tier 3 — Real art
- The emoji-to-graphics migration. Emoji is the interim style, not the
  destination.
- **Gated on the owner producing assets in a design tool first** — same
  owner-bottleneck pattern as Lucid's prose: the pipeline is ready, the input
  is the scarce thing.
- Swap-homes prepared in advance: `icons.ts`, `content.ts`, `index.html`.

### Tier 4 — Steam free release
- Desktop packaging: a web game on Steam needs a wrapper. **Electron vs.
  Tauri is a decision at tier-entry, UNVERIFIED which fits Steamworks
  overlay/achievement needs best** — do not assume either before checking at
  that time.
- Steamworks integration — achievements map naturally onto books/collections.
- Store page + free release.
- Natural trigger: **Lucid unparking** (this tier is explicitly the
  launch-pipeline rehearsal that de-risks Lucid's commercial release; the
  deliverable is as much the documented process as the release itself).
- Never in scope, any tier: paid release, ads, accounts, multiplayer.

## Shipped history (what's DONE)

Derived from the README status log and `docs/superpowers/` spec/plan titles.
One line each — see README for full narrative detail per milestone.

| Area | Status |
|---|---|
| Core loop | Playable end to end: auto-battle tick → Inspiration/Words → power growth → zone clears → boss → publish for Royalties → next book. Balance harness verifies book 1 publishable in minutes, books 1–8 complete, no hard wall. |
| Content | **8 genre zones** (Wild West, Zombie Apocalypse, Space, High Fantasy, Pirate Seas, Noir City, Eldritch Horror, Prehistoric). |
| Classes | **6 classes**: Protagonist (fixed lead), Anti-hero, Support, Debuffer, Sidekick, and The Critic (a DoT boss-slayer; pivoted from an earlier "Scribe" concept, same internal id, no save break). |
| Star tiers | Per-class 1★–5★ ratings funded by Edits (boss-kill currency); multiplies base power + ability magnitude on top of per-book leveling. |
| Collection + set bonuses | `(class × world)` skin collection (5×8 grid) via a Collection screen; 2/3/5-character same-world sets grant tiered bonuses; zone affinity separately rewards matching the *current* zone; an Ensemble (diversity) set rewards spreading skins across distinct worlds. |
| Protagonist track | Independent promotion path (★→★★★★★) spent via Royalties in the Publishing House, scaling base power and the Plot Armor signature. |
| Legacy prestige | Star-prestige track: surplus Edits (once classes are maxed) buy global Legacy levels, permanently multiplying every character's power and ability magnitude. Neutral at level 0. |
| Publishing House | Royalties wallet feeding a permanent upgrade catalog (6 repeatable + 2 one-time), spent via a parchment shop modal. |
| Save schema | v6, tolerant migration (ignores unknown fields, defaults missing ones); no save-breaking changes across the class/skin/prestige feature additions. |
| Tests | **194 passing tests** (~6.5s), including the greedy-play `balance.test.ts` regression harness and loadout/parity analysis (`analysis.ts`). |
| CI | **Green since 2026-07-02** — `.github/workflows/ci.yml` runs `npm ci` / `npm test` / `npm run build` on push to `main` and on pull requests. |
| Build | `npm run build` (tsc strict + vite build) green, ~85KB bundle. |
| Deploy | **None exists** — no GitHub Pages/itch; playable only via `npm run dev`. This is Tier 1's first item. |

History detail: README status log + docs/superpowers (predates this file).
