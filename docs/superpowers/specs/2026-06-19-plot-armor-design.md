# Plot Armor — v1 Design Spec

- **Date:** 2026-06-19
- **Status:** Approved (brainstorming complete) — ready for implementation planning
- **Repo:** `PlotArmor` (public, GitHub `yovanmc`), local `C:\Agent Projects\PlotArmor`
- **Author/owner:** Yovan Collins (single-user, personal project)

## 1. Premise

You are an author. The characters in your stories are your party members. The
game's point of view is the party **auto-battling** through a written adventure.
Because the world is written by the author, **each zone is a different genre**
(Wild West, Space, Zombies, Fantasy, …). Beating a book's final boss means the
author **finishes the book**; it goes on sale and grants a **prestige point**.
Then you write the next book.

The name is the joke: the author's characters survive because he's writing them
— **Plot Armor**. This is made mechanical: party members **cannot die** in v1.

Genre: **idle RPG / auto-battler-progression** (Melvor-Idle / idle-hero style),
**not** a Cookie-Clicker resource clicker. Combat **auto-resolves** (it's idle)
and is **lightly visualized only** (health bars, simple panels, emoji/sprite
stand-ins). There is **no combat renderer** — the game stays systems-and-numbers.

## 2. Goals / Non-goals

### v1 goals
- A complete idle core loop: party auto-battles on a tick → earns a writing
  resource → spend it to recruit/level characters → grow power → clear deeper →
  beat bosses.
- One **book** = **3 themed zones** in different genres, each a sequence of
  auto-resolved encounters ending in a **zone boss**; the final zone boss is the
  book's climax.
- A party of **2 starting characters**, recruit up to **5**.
- **Offline progress** accrual while away (elapsed-time math, clock-guarded).
- **One prestige layer**: beat the final boss → publish → **Royalties** currency
  + a permanent meta-bonus → reset to write the next book.
- **Save/load** (localStorage, versioned, backward-tolerant) + manual
  export/import of a save string.

### Explicitly deferred (NOT in v1)
Many genres; multiple simultaneous books; deep/tactical combat; skill trees;
loot/equipment; character classes/roles; genre-affinity bonuses; auto-XP
leveling; narrative text generation; art polish; audio; cloud sync; achievements.

## 3. Stack decision

**Web — TypeScript + Vite.** Decided with the owner after weighing WPF/.NET.

Rationale:
- **Big-number problem** (the genre's scariest gotcha) is solved on web by mature
  libraries (`break_eternity.js`); .NET has **no mature equivalent** (would
  require rolling a custom mantissa/exponent type). This was the deciding factor.
- The **light visualization** the owner wants is effectively free in DOM/CSS
  (health bar = a `<div>` width; panels = flexbox; sprites = emoji/CSS). No
  renderer work, ever.
- Same testable **engine/render split** is achievable, with fast headless unit
  tests (`vitest`).
- Bonus: a public repo can be made playable via GitHub Pages later.
- Cost (accepted): not the owner's primary stack — but this project is explicitly
  filed under fun/learning, not job-focused, and TS is C-family.

Concrete choices:
- **Language:** TypeScript (strict).
- **Bundler/dev server:** Vite.
- **Big numbers:** `break_eternity.js` `Decimal`, used **everywhere** from day one
  behind a thin `num.ts` wrapper (no `number → Decimal` migration later).
  *(Honesty flag: confirm exact npm package name + version at setup; do not assume
  blind.)*
- **Tests:** `vitest` (headless, fast).
- **Persistence:** `localStorage` JSON + manual export/import string.
- **No external APIs, no secrets, no network calls.** Fully offline/local.

## 4. Architecture — engine/render split

A **pure-TS engine** (zero DOM, fully headless-testable) under a **thin DOM/CSS
render layer**. This is the core structural decision: it makes the simulated
offline check and unit tests clean, and keeps combat as systems-and-numbers.

```
src/
  engine/                 pure, no DOM, unit-tested
    num.ts                break_eternity Decimal wrapper: make/add/sub/mul/div/cmp/format
    content.ts            STATIC data: zones (genres), encounters, bosses, character
                          archetypes, cost/scaling curves. Data-driven: new genre = data.
    state.ts              GameState type + initialState() factory
    combat.ts             one tick of combat: partyDPS vs encounter HP, clears, boss DPS-check
    economy.ts            recruit/level costs + effects (pure)
    progression.ts        advance encounter -> zone -> boss gate -> publish/prestige
    loop.ts               step(state, dtSeconds) reducer + fixed-timestep accumulator
    offline.ts            clamped, clock-guarded elapsed -> fast-forward via step()
    save.ts               serialize (Decimal<->string), versioned + tolerant migrate, export/import
  ui/                     thin render layer
    render.ts             read GameState -> update DOM panels (party, enemy, resources, zone, controls)
    input.ts              handlers: recruit, level, publish, export/import
    rafLoop.ts            requestAnimationFrame driver -> step() with real dt -> render()
  main.ts                 wiring + bootstrap (load save, start loop)
index.html
```

Design principles (per owner's isolation/clarity guidance):
- Each engine module has one purpose, a small interface, and is testable alone.
- The render layer **reads** state and **emits intents**; it never owns game rules.
- `step(state, dt)` is the single source of truth for time advancement and is the
  same function used live **and** for offline fast-forward (guarantees parity).

## 5. Data model (GameState — shape, illustrative)

> Illustrative TypeScript — final field names settled during implementation.
> All large quantities are `Decimal` (via `num.ts`), serialized as strings.

```ts
interface Character {
  id: string;
  name: string;
  level: number;            // small int; power derived from level
  basePower: Decimal;       // contribution to party DPS at level 1
}

interface ZoneState {
  zoneIndex: number;        // which genre/chapter
  encounterIndex: number;   // position in the encounter track (0..n-1, then boss)
  bossDefeated: boolean;
}

interface GameState {
  schemaVersion: number;    // for tolerant migration
  lastSaved: number;        // epoch ms, for offline math
  resources: {
    inspiration: Decimal;   // spend currency
    wordsThisBook: Decimal; // manuscript progress (this book)
    royalties: Decimal;     // prestige currency (persists across books)
  };
  party: Character[];
  zone: ZoneState;
  currentEncounterHp: Decimal;   // remaining HP of the thing being fought
  bookNumber: number;            // increments on publish
  prestigeMultiplier: Decimal;   // permanent global bonus from royalties
  settings: { /* e.g., number format */ };
}
```

## 6. Core systems

### 6.1 Resources & spend sinks
- **Inspiration** — the spend currency. Accrues from combat. Spent to:
  - **Recruit** a new character (flat-ish escalating cost per recruit, up to cap 5).
  - **Level** a character (geometric cost curve, e.g. `cost = base * r^level`).
  - No separate XP track — **every spend is a deliberate decision**.
- **Words** — manuscript progress. Each clear adds Words; a manuscript bar climbs
  toward a per-book target ("The End"). Progress only; never spent, so it never
  competes with Inspiration.
- **Royalties** — prestige currency from publishing (see 6.4).

### 6.2 Combat math (no-death "Plot Armor" throughput)
- Party effective **DPS** = `Σ characterPower(level)`. v1 uses a single power stat
  per character; `characterPower = basePower * f(level)` (e.g. `basePower * level`
  or a gentle exponential — tuned in implementation).
- **Regular encounter** = an HP pool. Each tick: `currentEncounterHp -=
  partyDPS * dt`. When it reaches 0 → **clear**: award Inspiration + Words, then
  **auto-advance** to the next encounter (higher HP). `clearTime ≈ HP / partyDPS`.
- Income accrues per clear (and/or continuously by damage), so the player is
  **never at zero income** — a slow clear is the signal to go spend/level.
- **Boss = DPS-check gate.** Boss has HP **plus regen** (or an enrage reset):
  effective damage per second = `partyDPS - bossRegen`. If `partyDPS <= bossRegen`,
  the boss never dies (heals/resets faster than you damage it) → a hard
  "not strong enough yet" wall **with no death state**. Once `partyDPS > bossRegen`
  by enough, boss HP falls to 0 → boss defeated → zone cleared.
- **No party HP, no wipes, no retreat/retry** — deleted by design (theme-justified).

### 6.3 Progression
- A **zone** = ordered `~6 regular encounters` + `1 boss`. Clearing the boss marks
  `bossDefeated` and advances to the next zone (next genre).
- A **book** = the 3 zones in sequence. Clearing the **final** zone's boss = book
  climax → triggers publish (6.4).

### 6.4 Prestige (publish → next book)
- On final-boss defeat: show a **publish summary** ("Your book is on sale!").
- Award **Royalties**, scaled by book performance (e.g. function of total Words
  written and/or book number). Each Royalty grants a **permanent global
  multiplier** (`prestigeMultiplier`) applied to production/power.
- **Reset for next book:** party levels, recruited members beyond the starting 2,
  Inspiration, Words, and zone progress reset; **Royalties + prestigeMultiplier +
  bookNumber persist**. `bookNumber++`. Zones regenerate (same 3 genres in v1;
  reshuffle/new genres are a later add).

## 7. Gotchas handled deliberately

- **Big numbers:** `Decimal` from day one behind `num.ts`. No native `+`; all math
  goes through the wrapper. Formatting handles small numbers (plain) and large
  (scientific / suffixed). Avoids any overflow surprise.
- **Offline progress:** on load, `elapsed = clamp(now - lastSaved, 0, OFFLINE_CAP)`
  with `OFFLINE_CAP ≈ 12h`. **Clock-rewind guard:** negative elapsed → 0 (never
  punish/reward a backwards clock). Fast-forward the **same** `step()` in coarse
  bounded chunks (e.g. `N` steps of `elapsed/N`, capped iteration budget) →
  produce a "While you were writing…" summary (Inspiration/Words gained, encounters
  cleared). Parity with live play is guaranteed because it's the same reducer.
- **Tick loop:** fixed logic timestep (e.g. **100 ms**) via an accumulator,
  decoupled from `requestAnimationFrame` render. Render reads current state each
  frame; logic advances in fixed steps. Robust to frame-rate variance.
- **Combat is a numeric model**, not a tactical engine (see 6.2).
- **Save format:** JSON with `schemaVersion`; migration is **tolerant** (ignore
  unknown fields, default missing ones). Manual **export/import** of a (base64 or
  plain JSON) save string for backup/restore — matches owner's data-safety values
  (recoverable saves). Autosave on an interval + on visibility change/unload.

## 8. v1 content (tuning defaults — easy to change, data-driven)

- **1 book = 3 zones:** **Wild West → Zombie Apocalypse → Space** (final boss =
  climax). Genre is mostly cosmetic (colors, enemy/boss names, emoji), so
  swapping/adding genres later is **data-only**.
- **~6 regular encounters + 1 boss** per zone.
- **2 starting characters**, recruit up to **5**.
- Cost/HP/reward curves: start from a minimum-viable set of constants in
  `content.ts`, tuned by playtest + the offline/throughput tests. (Karpathy: MVP
  numbers first, iterate.)

## 9. UI / visualization (light, DOM/CSS only)

- **Party panel:** each character as a card — emoji/sprite stand-in, name, level,
  (cosmetic) HP bar, level-up button (cost in Inspiration).
- **Enemy panel:** current encounter/boss — emoji, name, **HP bar** (the real one
  that depletes), boss regen indicator when applicable.
- **Resource readouts:** Inspiration, Words (manuscript progress bar toward target),
  Royalties, book number, current zone/genre.
- **Controls:** recruit, publish (enabled at climax), export/import save, (dev)
  reset.
- **Genre theming:** background/accent colors + emoji set per zone, swapped on
  zone change. No canvas, no sprites-as-images required (emoji acceptable for v1).

## 10. Verification plan (owner's workflow)

1. **Build green:** `tsc` (strict) + `vite build` succeed.
2. **Unit tests green (`vitest`):**
   - `num`: round-trip + formatting across magnitudes.
   - `combat`: clear-time math; boss DPS-check (below threshold never dies, above
     does).
   - `economy`: cost curves; recruit cap; spend correctness.
   - `progression`: encounter→zone→boss→publish transitions; prestige reset keeps
     Royalties.
   - `offline`: **determinism/parity** — `elapsed` fast-forward ≈ equivalent live
     run; **clock-rewind guard** (negative → no change); cap respected.
   - `save`: round-trip (incl. `Decimal`); tolerant migration (missing/unknown
     fields).
3. **Run it:** `vite dev`, exercise the loop manually.
4. **Simulated offline check:** load a save with `lastSaved` set back N hours;
   assert resources advanced as expected (and matches an online run of the same
   duration). This is both a unit test and a manual smoke check.
5. **Screenshot-verify the UI in a Sonnet subagent** that returns a **text verdict
   + file paths** (do not load PNGs into the main session unless owner says
   "show me"). Catches render/layout regressions cheaply.

## 11. Process / honesty flags (per owner CLAUDE.md hard rules)

- This spec contains **illustrative** TS (data shapes, formulas) — labeled as such,
  not production code.
- `break_eternity.js` package name/version to be **confirmed at setup**, not
  assumed.
- The build environment here is sandboxed; **owner must confirm** the dev server,
  browser run, and any Windows-specific behavior on his machine. Anything not
  actually executed will be flagged at handoff.
- No hallucinated APIs: only standard DOM, Vite, vitest, and the confirmed
  big-number library are used.

## 12. Open tuning parameters (resolved during implementation, not blocking)

- Exact power/level formula, cost curves, HP/reward scaling, boss regen thresholds.
- `OFFLINE_CAP` value (default ~12h), autosave interval, logic tick (default 100ms).
- Words-per-clear and per-book Words target; Royalty award formula and multiplier
  magnitude.
- Final genre order / names (default Wild West → Zombie → Space).
