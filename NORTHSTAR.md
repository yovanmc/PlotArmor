# Plot Armor — North Star

## What this builds up to be (end-state vision)
**Plot Armor, finished, is a full Melvor-class idle game — endgame loop, real art, shipped free on Steam as the pipeline rehearsal for Lucid.** That is Yovan's ultimate vision, chosen deliberately at maximum scope. It is also entirely motivation-gated: the project is shelved today at zero motivation, so the vision is staged in tiers, and **no tier is ever "the queue" — each is entered only when motivation for THAT tier actually exists:**

1. **Tier 1 — content-complete web game:** book-8 "The End" state designed and shipped, one balance feel-pass, GitHub Pages deploy. This is the minimum unpark outcome and makes everything after it optional-from-strength.
2. **Tier 2 — the endgame:** a designed post-book-8 loop (NG+/prestige-driven replay or endless scaling — currently *no design exists*, this is a real design milestone, not tuning), balance matured from sim-estimates to human-playtested.
3. **Tier 3 — real art:** the emoji→graphics migration, still gated on Yovan producing assets in a design tool first (swap-homes: `icons.ts` / `content.ts` / `index.html`). Emoji remains the interim style, not the destination.
4. **Tier 4 — Steam free release:** Steamworks/packaging, shipped free on the public repo, explicitly as the launch-pipeline rehearsal that de-risks Lucid's commercial release. Natural trigger: Lucid unparking.

**Honest flag:** the gap between "maximal vision" and "zero current motivation" is the widest in the portfolio. The tiers exist so Opus never confuses the dream with a work queue — advancing a tier requires Yovan saying he wants to, unprompted.

**Never:** paid release, ads, accounts, multiplayer.

## Path to v-final (rough build outline)
Every tier is motivation-gated: entered only when Yovan asks, unprompted. This is the map, never the queue.

**Tier 1 — Content-complete free web game (~days of work).**
What: a designed book-8 "The End" state (final screen, closing beat for the author premise — the writer finishes their last book); one balance feel-pass on `npm run dev`; GitHub Pages deploy workflow off the existing CI build; README + portfolio link updated to "play it here." Why: converts the repo from trust-my-tests to click-and-play and gives every later tier a live baseline. How: static Vite bundle → Pages; the CI already builds it.

**Tier 2 — Endgame design + build (~weeks).**
What: a real design doc first — NG+/prestige-replay loop vs endless scaling is an open *design* question with zero existing spec; then implementation + re-tuning with the sim harness, then human-playtested balance (the current numbers are sim-derived estimates by the tuning doc's own admission). Why design-doc-first: this is new game design, not polish — skipping the spec is how idle-game endgames become spreadsheets nobody enjoys.

**Tier 3 — Real art (self-paced).**
What: Yovan produces assets in a design tool; swap through the prepared homes (`icons.ts` / `content.ts` / `index.html`); emoji retires. Why gated on new assets: the same author-bottleneck as Lucid's prose — the pipeline is ready, the input is the scarce thing.

**Tier 4 — Steam free release (~weeks, natural trigger: Lucid unparking).**
What: desktop packaging — a web game on Steam needs a wrapper (Electron vs Tauri: **decision at tier-entry, unverified which fits Steamworks overlay/achievement needs best**); Steamworks integration (achievements map naturally to books/collections); store page + free release. Why: this is explicitly the launch-pipeline rehearsal for Lucid — the deliverable is as much the documented process as the release itself.

## North Star (operating identity)
A complete, well-tested idle RPG that served its purpose: a finished core loop, a 194-test/CI-green public repo that demonstrates the development process, and a genuinely playable game. **Status: PARKED (decision: "no motivation for it right now").** Parked without conditions or closing chores.

## Decision
**Completely shelved.** No polish backlog, no deploy requirement, no cadence promise. Yovan declined to assign it a status beyond parked; motivation is the honest gating resource and it is currently zero. That is a valid end-state for a hobby project whose core is done.

## Current state
- Core loop complete and playable: 8 genre zones/books, 6 classes, star tiers, collection + set bonuses, Legacy prestige, Publishing House shop, save schema v6 with tolerant migration.
- 194 tests green (~6.5s), CI green, build green (~85KB bundle).
- The last gameplay/balance change was the tuning pass. Everything since is docs and CI work.
- **No deployment exists** — no Pages/itch; playable only via `npm run dev`.
- Balance numbers are sim-derived provisional values (the tuning doc's own caveat); no endgame design exists past book 8. Both are acceptable open edges for a parked project.

## On unpark — first actions, in order
1. **GitHub Pages deploy (~1 hour).** The repo pitches itself to evaluators ("ask me why the save migration clamps every field…") who currently cannot play the game. A static Vite bundle + Pages workflow off the existing CI build converts the repo from "trust my tests" to "click and play." It is simply deferred with everything else.
2. Then decide: content-complete v1 (define the book-8 "The End" state, one feel-pass, done) vs. a real tuning phase with a written definition of done.

## Context notes
- Steam pursuit was already iceboxed; its stated purpose (pipeline-learning vehicle for Lucid's commercial launch) is doubly dormant now that Lucid is also parked. Neither blocks the other's unpark.
- Art direction stays parked pending self-produced assets (the same author-bottleneck pattern as Lucid's writing — worth noticing across projects). The emoji aesthetic is a defensible deliberate style if v1 is ever declared done as-is.

## Kill criteria
None. The repo is a finished-enough public artifact with real tests and a visible process trail; it costs nothing parked. If it's still untouched when Lucid unparks, reassess whether the "pipeline-learning vehicle" framing still applies or whether Plot Armor is simply done.
