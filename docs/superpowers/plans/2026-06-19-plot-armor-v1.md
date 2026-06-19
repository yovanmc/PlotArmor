# Plot Armor v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-user idle RPG / auto-battler where an author's story characters auto-battle through genre-themed zones to each book's climax, then publish for a permanent prestige bonus — with offline progress and save/load.

**Architecture:** A pure-TS, DOM-free **engine** (numbers, content, combat, economy, progression, tick loop, offline, save) that is fully unit-tested headless, under a **thin DOM/CSS render layer**. The same `step(state, dt)` reducer drives live play and offline fast-forward, guaranteeing parity. No external APIs, no secrets, fully local.

**Tech Stack:** TypeScript (strict) · Vite · Vitest (jsdom) · `break_eternity.js` (big numbers) · `localStorage` (saves).

---

## How to read this plan

- Spec this implements: [`docs/superpowers/specs/2026-06-19-plot-armor-design.md`](../specs/2026-06-19-plot-armor-design.md).
- All commands run from the repo root `C:\Agent Projects\PlotArmor` (Windows / PowerShell).
- Tests are colocated (`src/engine/num.test.ts` next to `src/engine/num.ts`).
- Commit after each task. Commit identity is the global git config (`yovanmc <yovanmc@users.noreply.github.com>`) — use plain `git commit`.
- Run all tests: `npm test`. Run one file: `npx vitest run src/engine/<name>.test.ts`.

### HONESTY / VERIFICATION NOTES (read once)

- The code in this plan is **reasoned and designed but was NOT compiled or executed** in the planning sandbox. The **per-task TDD loop is the verification gate** — every task writes a failing test, then code, then runs the test. If a snippet has a type/typo bug, the test run catches it; fix inline and continue.
- **`break_eternity.js` is the one external dependency whose exact npm package name, default-export shape, and method names must be CONFIRMED in Task 0.2** (do not assume blindly). `num.ts` is the *only* file that touches the library — if the real API differs (e.g. named vs default export, missing `.log10()`/`.toExponential()`), adjust `num.ts` there and nowhere else. If the package has no bundled TypeScript types, add the declaration shim in Task 0.2.
- Anything requiring a real browser / Windows (the `vite dev` run, screenshots, clipboard) is verified on the owner's machine at the end (M8/M9), not in the sandbox.

---

## File structure (created across the plan)

```
PlotArmor/
  package.json
  tsconfig.json
  vite.config.ts
  index.html
  src/
    main.ts                  bootstrap: load/init -> offline catch-up -> render -> loop -> autosave
    styles.css
    break_eternity.d.ts      (only if the package ships no types — added in 0.2)
    engine/
      num.ts        num.test.ts        big-number wrapper (ONLY file touching break_eternity)
      content.ts    content.test.ts    static data (zones/genres) + scaling curves
      state.ts      state.test.ts      GameState type + initialState()
      economy.ts    economy.test.ts    party DPS, costs, level/recruit (pure)
      combat.ts     combat.test.ts     single-target damage/regen resolution (pure)
      progression.ts progression.test.ts  clear -> advance -> book-complete; publish/prestige
      loop.ts       loop.test.ts       step(state, dt) reducer (combat + accrual + progression)
      offline.ts    offline.test.ts    clamped, clock-guarded elapsed -> fast-forward via step()
      save.ts       save.test.ts       serialize/deserialize, tolerant migrate, export/import
    ui/
      render.ts                        GameState -> DOM
      input.ts                         button handlers -> engine actions
      rafLoop.ts                       requestAnimationFrame fixed-timestep driver
```

---

## Milestone 0 — Project scaffold

### Task 0.1: Initialize Node project files

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.ts`, `src/styles.css`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "plotarmor",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vite": "^5.3.0",
    "vitest": "^2.0.0",
    "jsdom": "^24.1.0"
  },
  "dependencies": {
    "break_eternity.js": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `vite.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
  },
});
```

- [ ] **Step 4: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Plot Armor</title>
  </head>
  <body>
    <h1>📚 Plot Armor</h1>
    <div id="hud"></div>
    <div id="enemy"></div>
    <button id="publish" class="publish-btn">📖 Publish your book! (Prestige)</button>
    <div id="party"></div>
    <div class="toolbar">
      <button id="export">Export save</button>
      <button id="import">Import save</button>
    </div>
    <div id="offline-modal" class="modal">
      <div class="modal-card">
        <h2>Welcome back, author</h2>
        <div id="offline-body"></div>
        <button id="offline-close">Continue writing</button>
      </div>
    </div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 5: Create placeholder `src/main.ts` and `src/styles.css`**

`src/main.ts`:
```ts
// Wired up in Milestone 8.
console.log('Plot Armor booting…');
```

`src/styles.css`:
```css
/* Filled in Milestone 8. */
```

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.json vite.config.ts index.html src/main.ts src/styles.css
git commit -m "chore: scaffold Vite + TypeScript + Vitest project"
```

### Task 0.2: Install deps and confirm the big-number library

**Files:** (possibly) Create `src/break_eternity.d.ts`

- [ ] **Step 1: Install**

Run: `npm install`
Expected: `node_modules/` populated, no errors. (If `break_eternity.js@^2.0.0` fails to resolve, see Step 2.)

- [ ] **Step 2: Confirm the package + export shape**

Verify the installed big-number library's package name, default export, and that it exposes `add/sub/mul/div/pow/gte/gt/lte/lt/eq/max/min/toString/toNumber/log10/floor/toExponential`. Quick check:

Run: `node -e "import('break_eternity.js').then(m=>{const D=m.default||m;const x=new D('1e100');console.log(x.mul(2).toString(), x.log10().toString());})"`
Expected: prints a number near `2e100` and `100`.

- If the package name differs or the default-export form differs, note it; you will import accordingly in `num.ts` (Task 1.1). If `break_eternity.js` is unavailable, `break_infinity.js` (same author, same API, handles up to ~1e(9e15) — ample for v1) is an acceptable substitute; install it and import from there in `num.ts` only.
- If TypeScript reports the module has no types when `num.ts` imports it, create `src/break_eternity.d.ts`:

```ts
declare module 'break_eternity.js' {
  export default class Decimal {
    constructor(value: number | string | Decimal);
    add(v: Decimal | number | string): Decimal;
    sub(v: Decimal | number | string): Decimal;
    mul(v: Decimal | number | string): Decimal;
    div(v: Decimal | number | string): Decimal;
    pow(v: Decimal | number): Decimal;
    gte(v: Decimal | number | string): boolean;
    gt(v: Decimal | number | string): boolean;
    lte(v: Decimal | number | string): boolean;
    lt(v: Decimal | number | string): boolean;
    eq(v: Decimal | number | string): boolean;
    max(v: Decimal | number | string): Decimal;
    min(v: Decimal | number | string): Decimal;
    log10(): Decimal;
    floor(): Decimal;
    toExponential(dp?: number): string;
    toNumber(): number;
    toString(): string;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add package-lock.json src/break_eternity.d.ts 2>$null; git add -A
git commit -m "chore: install dependencies and confirm big-number library"
```

---

## Milestone 1 — Numbers (`num.ts`)

### Task 1.1: Big-number wrapper

**Files:**
- Create: `src/engine/num.ts`
- Test: `src/engine/num.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/num.test.ts
import { describe, it, expect } from 'vitest';
import * as num from './num';

describe('num', () => {
  it('constructs and compares', () => {
    expect(num.eq(num.n(5), num.n(5))).toBe(true);
    expect(num.gt(num.n(10), num.n(5))).toBe(true);
    expect(num.lt(num.n(2), num.n(3))).toBe(true);
    expect(num.gte(num.n(5), num.n(5))).toBe(true);
  });

  it('does arithmetic', () => {
    expect(num.toNum(num.add(num.n(2), num.n(3)))).toBe(5);
    expect(num.toNum(num.sub(num.n(10), num.n(3)))).toBe(7);
    expect(num.toNum(num.mul(num.n(4), num.n(5)))).toBe(20);
    expect(num.toNum(num.div(num.n(20), num.n(4)))).toBe(5);
    expect(num.toNum(num.pow(num.n(2), 10))).toBe(1024);
  });

  it('min/max', () => {
    expect(num.toNum(num.maxN(num.n(3), num.n(7)))).toBe(7);
    expect(num.toNum(num.minN(num.n(3), num.n(7)))).toBe(3);
  });

  it('serializes round-trip including very large values', () => {
    const v = num.n('1.2345e120');
    expect(num.eq(num.strToNum(num.numToStr(v)), v)).toBe(true);
  });

  it('formats small and large magnitudes', () => {
    expect(num.fmt(num.n(0))).toBe('0');
    expect(num.fmt(num.n(42))).toBe('42');
    expect(num.fmt(num.n(1500))).toBe('1.50K');
    expect(num.fmt(num.n(2_500_000))).toBe('2.50M');
    expect(num.fmt(num.n(1_000_000_000))).toBe('1.00B');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/num.test.ts`
Expected: FAIL — cannot resolve `./num`.

- [ ] **Step 3: Write the implementation**

```ts
// src/engine/num.ts
import Decimal from 'break_eternity.js';

export type Num = Decimal;

export const ZERO: Num = new Decimal(0);
export const ONE: Num = new Decimal(1);

export function n(v: number | string | Num): Num {
  return new Decimal(v as number);
}

export const add = (a: Num, b: Num): Num => a.add(b);
export const sub = (a: Num, b: Num): Num => a.sub(b);
export const mul = (a: Num, b: Num): Num => a.mul(b);
export const div = (a: Num, b: Num): Num => a.div(b);
export const pow = (base: Num, exp: number): Num => base.pow(exp);

export const gte = (a: Num, b: Num): boolean => a.gte(b);
export const gt = (a: Num, b: Num): boolean => a.gt(b);
export const lte = (a: Num, b: Num): boolean => a.lte(b);
export const lt = (a: Num, b: Num): boolean => a.lt(b);
export const eq = (a: Num, b: Num): boolean => a.eq(b);

export const maxN = (a: Num, b: Num): Num => a.max(b);
export const minN = (a: Num, b: Num): Num => a.min(b);

export const toNum = (v: Num): number => v.toNumber();
export const numToStr = (v: Num): string => v.toString();
export const strToNum = (s: string): Num => new Decimal(s);

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

export function fmt(v: Num): string {
  if (v.lt(1000)) {
    const x = v.toNumber();
    return Number.isInteger(x) ? String(x) : x.toFixed(1);
  }
  const exp = Math.floor(v.log10().toNumber());
  const tier = Math.floor(exp / 3);
  if (tier > 0 && tier < SUFFIXES.length) {
    const scaled = v.div(new Decimal(10).pow(tier * 3)).toNumber();
    return scaled.toFixed(2) + SUFFIXES[tier];
  }
  return v.toExponential(2);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/num.test.ts`
Expected: PASS (all 6 cases). If `fmt` formatting differs because the library's `log10`/`toExponential` behave differently, adjust `fmt` here until the asserted strings match.

- [ ] **Step 5: Commit**

```bash
git add src/engine/num.ts src/engine/num.test.ts
git commit -m "feat: add big-number wrapper (num)"
```

---

## Milestone 2 — Content & state

### Task 2.1: Static content and scaling curves

**Files:**
- Create: `src/engine/content.ts`
- Test: `src/engine/content.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/content.test.ts
import { describe, it, expect } from 'vitest';
import * as num from './num';
import * as C from './content';

describe('content', () => {
  it('has 3 zones with full encounter/boss metadata', () => {
    expect(C.ZONE_COUNT).toBe(3);
    for (const z of C.ZONES) {
      expect(z.enemyEmojis.length).toBe(C.ENCOUNTERS_PER_ZONE);
      expect(z.enemyNames.length).toBe(C.ENCOUNTERS_PER_ZONE);
      expect(typeof z.bossName).toBe('string');
    }
  });

  it('encounter HP grows within a zone and across zones', () => {
    expect(num.gt(C.encounterHp(0, 1), C.encounterHp(0, 0))).toBe(true);
    expect(num.gt(C.encounterHp(1, 0), C.encounterHp(0, 0))).toBe(true);
  });

  it('boss index is the slot after the last regular encounter', () => {
    expect(C.BOSS_INDEX).toBe(C.ENCOUNTERS_PER_ZONE);
    expect(C.isBossIndex(C.BOSS_INDEX)).toBe(true);
    expect(C.isBossIndex(0)).toBe(false);
  });

  it('boss target has more HP than the last regular encounter and nonzero regen', () => {
    const lastReg = C.targetMaxHp(0, C.ENCOUNTERS_PER_ZONE - 1);
    const boss = C.targetMaxHp(0, C.BOSS_INDEX);
    expect(num.gt(boss, lastReg)).toBe(true);
    expect(num.gt(C.targetRegen(0, C.BOSS_INDEX), num.ZERO)).toBe(true);
    expect(num.eq(C.targetRegen(0, 0), num.ZERO)).toBe(true);
  });

  it('inspiration rate rises with tier; boss grants more words than a regular clear', () => {
    expect(num.gt(C.targetInspirationRate(0, 1), C.targetInspirationRate(0, 0))).toBe(true);
    expect(num.gt(C.targetWords(0, C.BOSS_INDEX), C.targetWords(0, 0))).toBe(true);
  });

  it('counts targets cleared within a book', () => {
    expect(C.TARGETS_PER_BOOK).toBe(C.ZONE_COUNT * (C.BOSS_INDEX + 1));
    expect(C.targetsClearedInBook(0, 0)).toBe(0);
    expect(C.targetsClearedInBook(1, 0)).toBe(C.BOSS_INDEX + 1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/content.test.ts`
Expected: FAIL — cannot resolve `./content`.

- [ ] **Step 3: Write the implementation**

```ts
// src/engine/content.ts
import { Num, n, mul, pow, ZERO } from './num';

export const ENCOUNTERS_PER_ZONE = 6;
export const BOSS_INDEX = ENCOUNTERS_PER_ZONE; // 6 (slot after the 6 regulars)
export const RECRUIT_CAP = 5;
export const STARTING_PARTY_SIZE = 2;
export const TICK_SECONDS = 0.1;
export const OFFLINE_CAP_SECONDS = 12 * 3600;
export const AUTOSAVE_INTERVAL_MS = 15_000;
export const OFFLINE_MAX_ITERS = 200_000;
export const ROYALTY_BONUS = 0.5; // permanent +50% production per royalty

export interface ZoneDef {
  genre: string;
  bg: string;
  accent: string;
  enemyEmojis: string[];
  enemyNames: string[];
  bossEmoji: string;
  bossName: string;
}

export const ZONES: ZoneDef[] = [
  {
    genre: 'Wild West', bg: '#3a2a1a', accent: '#d9a441',
    enemyEmojis: ['🤠', '🐍', '🌵', '🐎', '🦅', '💰'],
    enemyNames: ['Bandit', 'Rattlesnake', 'Cactus Golem', 'Wild Stallion', 'Vulture', 'Claim Jumper'],
    bossEmoji: '🤵', bossName: 'The Black Hat Kingpin',
  },
  {
    genre: 'Zombie Apocalypse', bg: '#1c2a1c', accent: '#6abf69',
    enemyEmojis: ['🧟', '🏃', '🦴', '🩸', '📢', '☣️'],
    enemyNames: ['Shambler', 'Runner', 'Crawler', 'Bloater', 'Screamer', 'Infected Horde'],
    bossEmoji: '🧠', bossName: 'Patient Zero',
  },
  {
    genre: 'Space', bg: '#0b1020', accent: '#5ad7ff',
    enemyEmojis: ['👽', '🛸', '🤖', '☄️', '🪐', '⭐'],
    enemyNames: ['Xeno Scout', 'Drone Swarm', 'War Mech', 'Asteroid', 'Void Spawn', 'Star Reaver'],
    bossEmoji: '👾', bossName: 'The Hollow Star',
  },
];

export const ZONE_COUNT = ZONES.length;
export const TARGETS_PER_BOOK = ZONE_COUNT * (BOSS_INDEX + 1);

// --- tunable scaling curves ---
const BASE_ENCOUNTER_HP = n(10);
const HP_GROWTH_PER_ENCOUNTER = 1.6;
const HP_GROWTH_PER_ZONE = 12;
const BOSS_HP_MULT = n(4);
const BASE_BOSS_REGEN = n(3);
const REGEN_GROWTH_PER_ZONE = 12;
const BASE_INSP_RATE = n(1);
const INSP_GROWTH = 1.35; // per tier index
const BASE_WORDS = n(50);
const BOSS_WORDS_MULT = n(20);

export function tierIndex(zoneIndex: number, encounterIndex: number): number {
  return zoneIndex * (BOSS_INDEX + 1) + encounterIndex;
}

export function isBossIndex(encounterIndex: number): boolean {
  return encounterIndex >= BOSS_INDEX;
}

export function encounterHp(zoneIndex: number, encounterIndex: number): Num {
  return mul(
    mul(BASE_ENCOUNTER_HP, pow(n(HP_GROWTH_PER_ZONE), zoneIndex)),
    pow(n(HP_GROWTH_PER_ENCOUNTER), encounterIndex),
  );
}

export function targetMaxHp(zoneIndex: number, encounterIndex: number): Num {
  if (isBossIndex(encounterIndex)) {
    return mul(encounterHp(zoneIndex, ENCOUNTERS_PER_ZONE - 1), BOSS_HP_MULT);
  }
  return encounterHp(zoneIndex, encounterIndex);
}

export function targetRegen(zoneIndex: number, encounterIndex: number): Num {
  if (!isBossIndex(encounterIndex)) return ZERO;
  return mul(BASE_BOSS_REGEN, pow(n(REGEN_GROWTH_PER_ZONE), zoneIndex));
}

export function targetInspirationRate(zoneIndex: number, encounterIndex: number): Num {
  return mul(BASE_INSP_RATE, pow(n(INSP_GROWTH), tierIndex(zoneIndex, encounterIndex)));
}

export function targetWords(zoneIndex: number, encounterIndex: number): Num {
  const base = mul(BASE_WORDS, pow(n(HP_GROWTH_PER_ZONE), zoneIndex));
  return isBossIndex(encounterIndex) ? mul(base, BOSS_WORDS_MULT) : base;
}

export function targetName(zoneIndex: number, encounterIndex: number): string {
  const z = ZONES[zoneIndex];
  return isBossIndex(encounterIndex) ? z.bossName : z.enemyNames[encounterIndex];
}

export function targetEmoji(zoneIndex: number, encounterIndex: number): string {
  const z = ZONES[zoneIndex];
  return isBossIndex(encounterIndex) ? z.bossEmoji : z.enemyEmojis[encounterIndex];
}

export function targetsClearedInBook(zoneIndex: number, encounterIndex: number): number {
  return zoneIndex * (BOSS_INDEX + 1) + encounterIndex;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/content.test.ts`
Expected: PASS (6 cases).

- [ ] **Step 5: Commit**

```bash
git add src/engine/content.ts src/engine/content.test.ts
git commit -m "feat: add static content and scaling curves"
```

### Task 2.2: Game state + initial state

**Files:**
- Create: `src/engine/state.ts`
- Test: `src/engine/state.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/state.test.ts
import { describe, it, expect } from 'vitest';
import * as num from './num';
import { initialState, makeStartingParty } from './state';
import { STARTING_PARTY_SIZE, targetMaxHp } from './content';

describe('state', () => {
  it('starts a fresh game with the right defaults', () => {
    const s = initialState(1000);
    expect(s.party.length).toBe(STARTING_PARTY_SIZE);
    expect(s.bookNumber).toBe(1);
    expect(s.bookComplete).toBe(false);
    expect(s.zone).toEqual({ zoneIndex: 0, encounterIndex: 0 });
    expect(s.lastSaved).toBe(1000);
    expect(num.eq(s.inspiration, num.ZERO)).toBe(true);
    expect(num.eq(s.royalties, num.ZERO)).toBe(true);
    expect(num.eq(s.prestigeMultiplier, num.ONE)).toBe(true);
    expect(num.eq(s.currentHp, targetMaxHp(0, 0))).toBe(true);
  });

  it('starting party members are level 1 with base power 1', () => {
    const party = makeStartingParty();
    expect(party.every((c) => c.level === 1)).toBe(true);
    expect(party.every((c) => num.eq(c.basePower, num.ONE))).toBe(true);
    expect(new Set(party.map((c) => c.id)).size).toBe(party.length); // unique ids
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/state.test.ts`
Expected: FAIL — cannot resolve `./state`.

- [ ] **Step 3: Write the implementation**

```ts
// src/engine/state.ts
import { Num, n, ZERO, ONE } from './num';
import { STARTING_PARTY_SIZE, targetMaxHp } from './content';

export interface Character {
  id: string;
  name: string;
  level: number;
  basePower: Num;
}

export interface ZoneState {
  zoneIndex: number;
  encounterIndex: number;
}

export interface GameState {
  schemaVersion: number;
  lastSaved: number; // epoch ms
  inspiration: Num;
  words: Num;
  royalties: Num;
  party: Character[];
  zone: ZoneState;
  currentHp: Num; // remaining HP of the current target
  bookComplete: boolean;
  bookNumber: number;
  prestigeMultiplier: Num;
}

export const CHARACTER_NAMES = [
  'Quill', 'Inkheart', 'Margin', 'Verse', 'Footnote', 'Epilogue', 'Prologue',
];

export function makeStartingParty(): Character[] {
  const party: Character[] = [];
  for (let i = 0; i < STARTING_PARTY_SIZE; i++) {
    party.push({ id: `c${i}`, name: CHARACTER_NAMES[i], level: 1, basePower: ONE });
  }
  return party;
}

export function initialState(nowMs: number): GameState {
  const zone: ZoneState = { zoneIndex: 0, encounterIndex: 0 };
  return {
    schemaVersion: 1,
    lastSaved: nowMs,
    inspiration: ZERO,
    words: ZERO,
    royalties: ZERO,
    party: makeStartingParty(),
    zone,
    currentHp: targetMaxHp(zone.zoneIndex, zone.encounterIndex),
    bookComplete: false,
    bookNumber: 1,
    prestigeMultiplier: ONE,
  };
}
```

> Note: `n` is imported for symmetry with other engine modules; if `noUnusedLocals` flags it, remove the `n` from the import list. Keep `Num, ZERO, ONE`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/state.test.ts`
Expected: PASS (2 cases).

- [ ] **Step 5: Commit**

```bash
git add src/engine/state.ts src/engine/state.test.ts
git commit -m "feat: add game state and initial-state factory"
```

---

## Milestone 3 — Economy (`economy.ts`)

### Task 3.1: Party DPS, costs, level & recruit

**Files:**
- Create: `src/engine/economy.ts`
- Test: `src/engine/economy.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/economy.test.ts
import { describe, it, expect } from 'vitest';
import * as num from './num';
import { initialState } from './state';
import * as eco from './economy';
import { RECRUIT_CAP } from './content';

describe('economy', () => {
  it('party DPS = sum of (basePower*level) * prestigeMultiplier', () => {
    const s = initialState(0); // 2 chars, level 1, basePower 1, prestige 1
    expect(num.toNum(eco.partyDps(s))).toBe(2);
    const boosted = { ...s, prestigeMultiplier: num.n(1.5) };
    expect(num.toNum(eco.partyDps(boosted))).toBe(3);
  });

  it('level cost grows with level', () => {
    expect(num.gt(eco.levelCost(2), eco.levelCost(1))).toBe(true);
  });

  it('levelUp spends inspiration and raises the level when affordable', () => {
    const s = { ...initialState(0), inspiration: num.n(1000) };
    const id = s.party[0].id;
    const cost = eco.levelCost(s.party[0].level);
    const next = eco.levelUp(s, id);
    expect(next.party[0].level).toBe(2);
    expect(num.eq(next.inspiration, num.sub(num.n(1000), cost))).toBe(true);
  });

  it('levelUp is a no-op when unaffordable', () => {
    const s = { ...initialState(0), inspiration: num.ZERO };
    const next = eco.levelUp(s, s.party[0].id);
    expect(next).toBe(s); // same reference -> nothing changed
  });

  it('recruit adds a character and respects the cap', () => {
    let s = { ...initialState(0), inspiration: num.n('1e9') };
    while (s.party.length < RECRUIT_CAP) {
      const before = s.party.length;
      s = eco.recruit(s);
      expect(s.party.length).toBe(before + 1);
    }
    expect(eco.canRecruit(s)).toBe(false); // at cap
    const afterCap = eco.recruit(s);
    expect(afterCap.party.length).toBe(RECRUIT_CAP);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/economy.test.ts`
Expected: FAIL — cannot resolve `./economy`.

- [ ] **Step 3: Write the implementation**

```ts
// src/engine/economy.ts
import { Num, n, ZERO, add, sub, mul, pow, gte } from './num';
import { GameState, Character, CHARACTER_NAMES } from './state';
import { RECRUIT_CAP } from './content';

const LEVEL_BASE_COST = n(10);
const LEVEL_COST_GROWTH = 1.5;
const RECRUIT_BASE_COST = n(100);
const RECRUIT_COST_GROWTH = 6;

export function characterPower(c: Character): Num {
  return mul(c.basePower, n(c.level));
}

export function partyDps(state: GameState): Num {
  let sum = ZERO;
  for (const c of state.party) sum = add(sum, characterPower(c));
  return mul(sum, state.prestigeMultiplier);
}

export function levelCost(level: number): Num {
  return mul(LEVEL_BASE_COST, pow(n(LEVEL_COST_GROWTH), level - 1));
}

// cost to add the (partySize+1)-th member; partySize starts at STARTING_PARTY_SIZE (2)
export function recruitCost(partySize: number): Num {
  return mul(RECRUIT_BASE_COST, pow(n(RECRUIT_COST_GROWTH), partySize - 2));
}

export function canLevel(state: GameState, id: string): boolean {
  const c = state.party.find((p) => p.id === id);
  if (!c) return false;
  return gte(state.inspiration, levelCost(c.level));
}

export function levelUp(state: GameState, id: string): GameState {
  if (!canLevel(state, id)) return state;
  const c = state.party.find((p) => p.id === id)!;
  const cost = levelCost(c.level);
  return {
    ...state,
    inspiration: sub(state.inspiration, cost),
    party: state.party.map((p) => (p.id === id ? { ...p, level: p.level + 1 } : p)),
  };
}

export function canRecruit(state: GameState): boolean {
  return (
    state.party.length < RECRUIT_CAP &&
    gte(state.inspiration, recruitCost(state.party.length))
  );
}

export function recruit(state: GameState): GameState {
  if (!canRecruit(state)) return state;
  const cost = recruitCost(state.party.length);
  const idx = state.party.length;
  const newChar: Character = {
    id: `c${idx}`,
    name: CHARACTER_NAMES[idx] ?? `Character ${idx + 1}`,
    level: 1,
    basePower: n(1),
  };
  return {
    ...state,
    inspiration: sub(state.inspiration, cost),
    party: [...state.party, newChar],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/economy.test.ts`
Expected: PASS (5 cases).

- [ ] **Step 5: Commit**

```bash
git add src/engine/economy.ts src/engine/economy.test.ts
git commit -m "feat: add economy (party DPS, costs, level, recruit)"
```

---

## Milestone 4 — Combat & progression

### Task 4.1: Single-target combat resolution

**Files:**
- Create: `src/engine/combat.ts`
- Test: `src/engine/combat.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/combat.test.ts
import { describe, it, expect } from 'vitest';
import * as num from './num';
import { initialState } from './state';
import { targetInfo, advanceTarget } from './combat';
import { BOSS_INDEX, targetMaxHp } from './content';

describe('combat', () => {
  it('targetInfo reflects regular vs boss', () => {
    const s = initialState(0);
    const reg = targetInfo(s);
    expect(reg.isBoss).toBe(false);
    expect(num.eq(reg.regen, num.ZERO)).toBe(true);

    const atBoss = { ...s, zone: { zoneIndex: 0, encounterIndex: BOSS_INDEX } };
    const boss = targetInfo(atBoss);
    expect(boss.isBoss).toBe(true);
    expect(num.gt(boss.regen, num.ZERO)).toBe(true);
  });

  it('chips HP when dt is too small to clear', () => {
    const s = initialState(0); // dps 2, encounter(0,0) hp 10
    const info = targetInfo(s);
    const r = advanceTarget(num.n(10), info, 3); // 2 dps * 3s = 6 dmg
    expect(r.cleared).toBe(false);
    expect(num.toNum(r.hp)).toBeCloseTo(4, 6);
    expect(r.timeUsed).toBe(3);
  });

  it('clears exactly and reports the partial time used', () => {
    const s = initialState(0); // dps 2
    const info = targetInfo(s);
    const r = advanceTarget(num.n(10), info, 6); // would clear at t=5
    expect(r.cleared).toBe(true);
    expect(num.toNum(r.hp)).toBe(0);
    expect(r.timeUsed).toBeCloseTo(5, 6);
  });

  it('boss wall: when dps <= regen the boss never clears and regenerates toward max', () => {
    // default dps = 2; zone-0 boss regen = 3 -> net = -1
    const atBoss = { ...initialState(0), zone: { zoneIndex: 0, encounterIndex: BOSS_INDEX } };
    const info = targetInfo(atBoss);
    const max = targetMaxHp(0, BOSS_INDEX);
    const damaged = num.sub(max, num.n(5));
    const r = advanceTarget(damaged, info, 10);
    expect(r.cleared).toBe(false);
    expect(num.lte(r.hp, max)).toBe(true);
    expect(num.gt(r.hp, damaged)).toBe(true); // regenerated upward
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/combat.test.ts`
Expected: FAIL — cannot resolve `./combat`.

- [ ] **Step 3: Write the implementation**

```ts
// src/engine/combat.ts
import { Num, n, ZERO, sub, mul, div, gt, minN } from './num';
import { GameState } from './state';
import { targetMaxHp, targetRegen, isBossIndex } from './content';
import { partyDps } from './economy';

export interface TargetInfo {
  maxHp: Num;
  regen: Num;
  isBoss: boolean;
  netDps: Num; // partyDps - regen (regen is 0 for regular encounters)
}

export function targetInfo(state: GameState): TargetInfo {
  const { zoneIndex, encounterIndex } = state.zone;
  const regen = targetRegen(zoneIndex, encounterIndex);
  return {
    maxHp: targetMaxHp(zoneIndex, encounterIndex),
    regen,
    isBoss: isBossIndex(encounterIndex),
    netDps: sub(partyDps(state), regen),
  };
}

export interface AdvanceResult {
  hp: Num;
  cleared: boolean;
  timeUsed: number; // seconds of `dt` consumed (== ttc on clear, else == dt)
}

// Apply up to `dt` seconds of combat to the current target.
export function advanceTarget(currentHp: Num, info: TargetInfo, dt: number): AdvanceResult {
  if (gt(info.netDps, ZERO)) {
    const ttc = div(currentHp, info.netDps).toNumber();
    if (ttc <= dt) {
      return { hp: ZERO, cleared: true, timeUsed: ttc };
    }
    return { hp: sub(currentHp, mul(info.netDps, n(dt))), cleared: false, timeUsed: dt };
  }
  // netDps <= 0 (boss wall): regenerate toward maxHp, never clears
  const regened = sub(currentHp, mul(info.netDps, n(dt))); // subtracting a non-positive => increase
  return { hp: minN(regened, info.maxHp), cleared: false, timeUsed: dt };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/combat.test.ts`
Expected: PASS (4 cases).

- [ ] **Step 5: Commit**

```bash
git add src/engine/combat.ts src/engine/combat.test.ts
git commit -m "feat: add single-target combat resolution"
```

### Task 4.2: Progression and prestige

**Files:**
- Create: `src/engine/progression.ts`
- Test: `src/engine/progression.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/progression.test.ts
import { describe, it, expect } from 'vitest';
import * as num from './num';
import { initialState } from './state';
import { onClear, publish } from './progression';
import { BOSS_INDEX, ZONE_COUNT, targetMaxHp, targetWords, ROYALTY_BONUS } from './content';

describe('progression', () => {
  it('advances to the next encounter on a regular clear and grants words', () => {
    const s = initialState(0);
    const next = onClear(s);
    expect(next.zone).toEqual({ zoneIndex: 0, encounterIndex: 1 });
    expect(num.eq(next.words, targetWords(0, 0))).toBe(true);
    expect(num.eq(next.currentHp, targetMaxHp(0, 1))).toBe(true);
  });

  it('advances to the next zone when a non-final boss is cleared', () => {
    const s = { ...initialState(0), zone: { zoneIndex: 0, encounterIndex: BOSS_INDEX } };
    const next = onClear(s);
    expect(next.zone).toEqual({ zoneIndex: 1, encounterIndex: 0 });
    expect(next.bookComplete).toBe(false);
    expect(num.eq(next.currentHp, targetMaxHp(1, 0))).toBe(true);
  });

  it('flags bookComplete when the final zone boss is cleared', () => {
    const s = { ...initialState(0), zone: { zoneIndex: ZONE_COUNT - 1, encounterIndex: BOSS_INDEX } };
    const next = onClear(s);
    expect(next.bookComplete).toBe(true);
  });

  it('publish awards a royalty, bumps the multiplier, resets the book, keeps royalties', () => {
    const done = {
      ...initialState(0),
      bookComplete: true,
      inspiration: num.n(5000),
      words: num.n(99999),
      zone: { zoneIndex: ZONE_COUNT - 1, encounterIndex: BOSS_INDEX },
    };
    const next = publish(done);
    expect(num.eq(next.royalties, num.ONE)).toBe(true);
    expect(num.eq(next.prestigeMultiplier, num.n(1 + ROYALTY_BONUS))).toBe(true);
    expect(next.bookNumber).toBe(2);
    expect(next.bookComplete).toBe(false);
    expect(next.zone).toEqual({ zoneIndex: 0, encounterIndex: 0 });
    expect(num.eq(next.inspiration, num.ZERO)).toBe(true);
    expect(num.eq(next.words, num.ZERO)).toBe(true);
    expect(next.party.length).toBe(initialState(0).party.length);
  });

  it('publish is a no-op when the book is not complete', () => {
    const s = initialState(0);
    expect(publish(s)).toBe(s);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/progression.test.ts`
Expected: FAIL — cannot resolve `./progression`.

- [ ] **Step 3: Write the implementation**

```ts
// src/engine/progression.ts
import { ZERO, ONE, n, add, mul } from './num';
import { GameState, makeStartingParty } from './state';
import { ZONE_COUNT, ROYALTY_BONUS, isBossIndex, targetMaxHp, targetWords } from './content';

// Called when the current target's HP reaches 0.
export function onClear(state: GameState): GameState {
  const { zoneIndex, encounterIndex } = state.zone;
  const words = add(state.words, targetWords(zoneIndex, encounterIndex));
  const clearedBoss = isBossIndex(encounterIndex);

  if (clearedBoss && zoneIndex >= ZONE_COUNT - 1) {
    // final boss of the final zone -> book complete, await player's Publish
    return { ...state, words, bookComplete: true };
  }

  const nz = clearedBoss ? zoneIndex + 1 : zoneIndex;
  const ne = clearedBoss ? 0 : encounterIndex + 1;
  return {
    ...state,
    words,
    zone: { zoneIndex: nz, encounterIndex: ne },
    currentHp: targetMaxHp(nz, ne),
  };
}

// Player action: publish the finished book and start the next one.
export function publish(state: GameState): GameState {
  if (!state.bookComplete) return state;
  const royalties = add(state.royalties, ONE);
  const prestigeMultiplier = add(ONE, mul(royalties, n(ROYALTY_BONUS)));
  const zone = { zoneIndex: 0, encounterIndex: 0 };
  return {
    ...state,
    royalties,
    prestigeMultiplier,
    bookNumber: state.bookNumber + 1,
    inspiration: ZERO,
    words: ZERO,
    party: makeStartingParty(),
    zone,
    currentHp: targetMaxHp(zone.zoneIndex, zone.encounterIndex),
    bookComplete: false,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/progression.test.ts`
Expected: PASS (5 cases).

- [ ] **Step 5: Commit**

```bash
git add src/engine/progression.ts src/engine/progression.test.ts
git commit -m "feat: add progression and prestige (publish)"
```

---

## Milestone 5 — The tick reducer (`loop.ts`)

### Task 5.1: `step(state, dt)`

**Files:**
- Create: `src/engine/loop.ts`
- Test: `src/engine/loop.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/loop.test.ts
import { describe, it, expect } from 'vitest';
import * as num from './num';
import { initialState } from './state';
import { step } from './loop';
import { BOSS_INDEX, ZONE_COUNT, targetMaxHp, targetInspirationRate } from './content';

describe('loop.step', () => {
  it('accrues inspiration continuously and clears the first encounter', () => {
    const s = initialState(0); // dps 2, encounter(0,0) hp 10 -> clears at t=5
    const r = step(s, 6);
    expect(r.clears).toBeGreaterThanOrEqual(1);
    expect(num.gt(r.state.inspiration, num.ZERO)).toBe(true);
    expect(r.state.zone.encounterIndex).toBeGreaterThan(0); // advanced
  });

  it('halts at bookComplete and does not auto-publish', () => {
    const atFinalBoss = {
      ...initialState(0),
      zone: { zoneIndex: ZONE_COUNT - 1, encounterIndex: BOSS_INDEX },
      // give enough dps to beat the final boss quickly
      party: [{ id: 'x', name: 'Hero', level: 1, basePower: num.n('1e30') }],
      currentHp: num.n(1),
    };
    const r = step(atFinalBoss, 10);
    expect(r.state.bookComplete).toBe(true);
    expect(r.state.bookNumber).toBe(1); // NOT auto-published
  });

  it('boss wall still earns inspiration (rate-based) without clearing', () => {
    const atBoss = {
      ...initialState(0), // dps 2 < zone-0 boss regen 3 -> wall
      zone: { zoneIndex: 0, encounterIndex: BOSS_INDEX },
      currentHp: targetMaxHp(0, BOSS_INDEX),
    };
    const r = step(atBoss, 10);
    expect(r.clears).toBe(0);
    const rate = targetInspirationRate(0, BOSS_INDEX);
    expect(num.toNum(r.state.inspiration)).toBeCloseTo(num.toNum(num.mul(rate, num.n(10))), 4);
  });

  it('is deterministic across timestep granularity at a boss wall (constant rate)', () => {
    const base = {
      ...initialState(0),
      zone: { zoneIndex: 0, encounterIndex: BOSS_INDEX },
      currentHp: targetMaxHp(0, BOSS_INDEX),
    };
    const oneShot = step(base, 100).state.inspiration;
    let acc = base;
    for (let i = 0; i < 1000; i++) acc = step(acc, 0.1).state;
    expect(num.toNum(acc.inspiration)).toBeCloseTo(num.toNum(oneShot), 4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/loop.test.ts`
Expected: FAIL — cannot resolve `./loop`.

- [ ] **Step 3: Write the implementation**

```ts
// src/engine/loop.ts
import { n, add, mul } from './num';
import { GameState } from './state';
import { targetInspirationRate, OFFLINE_MAX_ITERS } from './content';
import { targetInfo, advanceTarget } from './combat';
import { onClear } from './progression';

export interface StepResult {
  state: GameState;
  clears: number;
  cappedOut: boolean; // hit the iteration guard (very long offline)
}

// Advance the simulation by `dt` seconds. Inspiration accrues continuously at the
// current target's rate; HP is chipped by net DPS; clears advance progression.
// Resolves multiple clears within one call so it is exact for large offline dt.
export function step(state: GameState, dt: number): StepResult {
  let s = state;
  let remaining = dt;
  let clears = 0;
  let iters = 0;
  let cappedOut = false;

  while (remaining > 1e-9 && !s.bookComplete) {
    if (iters++ >= OFFLINE_MAX_ITERS) {
      cappedOut = true;
      break;
    }
    const info = targetInfo(s);
    const rate = targetInspirationRate(s.zone.zoneIndex, s.zone.encounterIndex);
    const res = advanceTarget(s.currentHp, info, remaining);

    s = {
      ...s,
      inspiration: add(s.inspiration, mul(rate, n(res.timeUsed))),
      currentHp: res.hp,
    };
    remaining -= res.timeUsed;

    if (res.cleared) {
      s = onClear(s);
      clears++;
    } else {
      break; // advanceTarget consumed all remaining time (chip or wall)
    }
  }

  return { state: s, clears, cappedOut };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/loop.test.ts`
Expected: PASS (4 cases).

- [ ] **Step 5: Commit**

```bash
git add src/engine/loop.ts src/engine/loop.test.ts
git commit -m "feat: add step(state, dt) tick reducer"
```

---

## Milestone 6 — Offline progress (`offline.ts`)

### Task 6.1: Elapsed-time math + fast-forward

**Files:**
- Create: `src/engine/offline.ts`
- Test: `src/engine/offline.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/offline.test.ts
import { describe, it, expect } from 'vitest';
import * as num from './num';
import { initialState } from './state';
import { offlineSeconds, applyOffline } from './offline';
import { OFFLINE_CAP_SECONDS } from './content';

describe('offline', () => {
  it('computes elapsed seconds', () => {
    expect(offlineSeconds(60_000, 0)).toBe(60);
  });

  it('clamps to the offline cap', () => {
    const huge = OFFLINE_CAP_SECONDS * 1000 * 5;
    expect(offlineSeconds(huge, 0)).toBe(OFFLINE_CAP_SECONDS);
  });

  it('guards against a rewound clock (lastSaved in the future)', () => {
    expect(offlineSeconds(0, 10_000)).toBe(0);
  });

  it('applyOffline accrues resources and updates lastSaved', () => {
    const s = { ...initialState(0), lastSaved: 0 };
    const { state, summary } = applyOffline(s, 3_600_000); // 1 hour
    expect(summary.seconds).toBe(3600);
    expect(num.gt(state.inspiration, num.ZERO)).toBe(true);
    expect(state.lastSaved).toBe(3_600_000);
    expect(num.eq(summary.inspirationGained, state.inspiration)).toBe(true);
  });

  it('applyOffline with no elapsed time only bumps lastSaved', () => {
    const s = { ...initialState(0), lastSaved: 5000 };
    const { state, summary } = applyOffline(s, 4000); // clock went backwards
    expect(summary.seconds).toBe(0);
    expect(num.eq(state.inspiration, num.ZERO)).toBe(true);
    expect(state.lastSaved).toBe(4000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/offline.test.ts`
Expected: FAIL — cannot resolve `./offline`.

- [ ] **Step 3: Write the implementation**

```ts
// src/engine/offline.ts
import { Num, ZERO, sub } from './num';
import { GameState } from './state';
import { step } from './loop';
import { OFFLINE_CAP_SECONDS } from './content';

export function offlineSeconds(nowMs: number, lastSavedMs: number): number {
  const raw = (nowMs - lastSavedMs) / 1000;
  if (!Number.isFinite(raw) || raw <= 0) return 0; // rewound/zero/invalid
  return Math.min(raw, OFFLINE_CAP_SECONDS);
}

export interface OfflineSummary {
  seconds: number;
  inspirationGained: Num;
  wordsGained: Num;
  clears: number;
  cappedOut: boolean;
}

export function applyOffline(
  state: GameState,
  nowMs: number,
): { state: GameState; summary: OfflineSummary } {
  const seconds = offlineSeconds(nowMs, state.lastSaved);
  if (seconds === 0) {
    return {
      state: { ...state, lastSaved: nowMs },
      summary: { seconds: 0, inspirationGained: ZERO, wordsGained: ZERO, clears: 0, cappedOut: false },
    };
  }
  const before = state;
  const res = step(state, seconds);
  return {
    state: { ...res.state, lastSaved: nowMs },
    summary: {
      seconds,
      inspirationGained: sub(res.state.inspiration, before.inspiration),
      wordsGained: sub(res.state.words, before.words),
      clears: res.clears,
      cappedOut: res.cappedOut,
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/offline.test.ts`
Expected: PASS (5 cases).

- [ ] **Step 5: Commit**

```bash
git add src/engine/offline.ts src/engine/offline.test.ts
git commit -m "feat: add offline progress (clock-guarded fast-forward)"
```

---

## Milestone 7 — Save / load (`save.ts`)

### Task 7.1: Serialize, deserialize (tolerant), export/import

**Files:**
- Create: `src/engine/save.ts`
- Test: `src/engine/save.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/save.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import * as num from './num';
import { initialState } from './state';
import { serialize, deserialize, save, load, exportSave, importSave, SAVE_KEY } from './save';

describe('save', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a non-trivial state', () => {
    const s = { ...initialState(1234), inspiration: num.n('1.5e40'), royalties: num.n(3), prestigeMultiplier: num.n(2.5) };
    const back = deserialize(serialize(s), 0);
    expect(num.eq(back.inspiration, s.inspiration)).toBe(true);
    expect(num.eq(back.royalties, s.royalties)).toBe(true);
    expect(num.eq(back.prestigeMultiplier, s.prestigeMultiplier)).toBe(true);
    expect(back.zone).toEqual(s.zone);
    expect(back.party.length).toBe(s.party.length);
    expect(back.lastSaved).toBe(1234);
  });

  it('tolerates missing fields (defaults) and ignores unknown fields', () => {
    const partial = deserialize('{"inspiration":"500","mysteryField":42}', 7);
    expect(num.eq(partial.inspiration, num.n(500))).toBe(true);
    expect(num.eq(partial.royalties, num.ZERO)).toBe(true); // defaulted
    expect(partial.party.length).toBe(initialState(0).party.length); // defaulted
  });

  it('returns a fresh state on malformed JSON', () => {
    const fresh = deserialize('not json', 9);
    expect(num.eq(fresh.inspiration, num.ZERO)).toBe(true);
    expect(fresh.lastSaved).toBe(9);
  });

  it('save() then load() persists through localStorage', () => {
    const s = { ...initialState(0), inspiration: num.n(777) };
    save(s);
    expect(localStorage.getItem(SAVE_KEY)).toBeTruthy();
    const loaded = load(0)!;
    expect(num.eq(loaded.inspiration, num.n(777))).toBe(true);
  });

  it('load() returns null when nothing is saved', () => {
    expect(load(0)).toBeNull();
  });

  it('export/import round-trips via an opaque string', () => {
    const s = { ...initialState(0), words: num.n('1e12') };
    const code = exportSave(s);
    const back = importSave(code, 0);
    expect(num.eq(back.words, num.n('1e12'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/save.test.ts`
Expected: FAIL — cannot resolve `./save`.

- [ ] **Step 3: Write the implementation**

```ts
// src/engine/save.ts
import { Num, n, ZERO, ONE, numToStr, strToNum } from './num';
import { GameState, Character, initialState } from './state';

export const SAVE_KEY = 'plotarmor.save.v1';
export const SCHEMA_VERSION = 1;

interface CharDTO { id: string; name: string; level: number; basePower: string; }
interface SaveDTO {
  schemaVersion: number;
  lastSaved: number;
  inspiration: string;
  words: string;
  royalties: string;
  party: CharDTO[];
  zone: { zoneIndex: number; encounterIndex: number };
  currentHp: string;
  bookComplete: boolean;
  bookNumber: number;
  prestigeMultiplier: string;
}

export function serialize(state: GameState): string {
  const dto: SaveDTO = {
    schemaVersion: SCHEMA_VERSION,
    lastSaved: state.lastSaved,
    inspiration: numToStr(state.inspiration),
    words: numToStr(state.words),
    royalties: numToStr(state.royalties),
    party: state.party.map((c) => ({
      id: c.id, name: c.name, level: c.level, basePower: numToStr(c.basePower),
    })),
    zone: { zoneIndex: state.zone.zoneIndex, encounterIndex: state.zone.encounterIndex },
    currentHp: numToStr(state.currentHp),
    bookComplete: state.bookComplete,
    bookNumber: state.bookNumber,
    prestigeMultiplier: numToStr(state.prestigeMultiplier),
  };
  return JSON.stringify(dto);
}

// Tolerant: missing fields fall back to a fresh state; unknown fields are ignored.
export function deserialize(raw: string, nowMs: number): GameState {
  const fresh = initialState(nowMs);
  let dto: Partial<SaveDTO>;
  try {
    dto = JSON.parse(raw) as Partial<SaveDTO>;
  } catch {
    return fresh;
  }
  const numOr = (s: string | undefined, fallback: Num): Num =>
    typeof s === 'string' ? strToNum(s) : fallback;

  const party: Character[] =
    Array.isArray(dto.party) && dto.party.length > 0
      ? dto.party.map((c, i) => ({
          id: c?.id ?? `c${i}`,
          name: c?.name ?? `Character ${i + 1}`,
          level: typeof c?.level === 'number' ? c.level : 1,
          basePower: numOr(c?.basePower, n(1)),
        }))
      : fresh.party;

  return {
    schemaVersion: SCHEMA_VERSION,
    lastSaved: typeof dto.lastSaved === 'number' ? dto.lastSaved : nowMs,
    inspiration: numOr(dto.inspiration, ZERO),
    words: numOr(dto.words, ZERO),
    royalties: numOr(dto.royalties, ZERO),
    party,
    zone: {
      zoneIndex: dto.zone?.zoneIndex ?? 0,
      encounterIndex: dto.zone?.encounterIndex ?? 0,
    },
    currentHp: numOr(dto.currentHp, fresh.currentHp),
    bookComplete: typeof dto.bookComplete === 'boolean' ? dto.bookComplete : false,
    bookNumber: typeof dto.bookNumber === 'number' ? dto.bookNumber : 1,
    prestigeMultiplier: numOr(dto.prestigeMultiplier, ONE),
  };
}

export function save(state: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, serialize(state));
  } catch {
    /* storage unavailable/full — ignore for a single-user local game */
  }
}

export function load(nowMs: number): GameState | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(SAVE_KEY);
  } catch {
    raw = null;
  }
  if (!raw) return null;
  return deserialize(raw, nowMs);
}

export function exportSave(state: GameState): string {
  return btoa(unescape(encodeURIComponent(serialize(state))));
}

export function importSave(encoded: string, nowMs: number): GameState {
  const json = decodeURIComponent(escape(atob(encoded)));
  return deserialize(json, nowMs);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/save.test.ts`
Expected: PASS (6 cases). (`localStorage`, `atob`, `btoa` are provided by the jsdom test environment configured in Task 0.1.)

- [ ] **Step 5: Run the full engine suite**

Run: `npm test`
Expected: PASS — all engine modules (num, content, state, economy, combat, progression, loop, offline, save).

- [ ] **Step 6: Commit**

```bash
git add src/engine/save.ts src/engine/save.test.ts
git commit -m "feat: add save/load with tolerant migration and export/import"
```

---

## Milestone 8 — UI (render + input + loop driver) and run

> The engine is complete and fully tested. This milestone wires the DOM. UI is
> verified by building, running `vite dev` on the owner's machine, and a
> screenshot subagent (M9) — not by unit tests, except one render smoke test.

### Task 8.1: Render layer

**Files:**
- Create: `src/ui/render.ts`
- Test: `src/ui/render.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/ui/render.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { initialState } from '../engine/state';
import { render } from './render';

const HTML = `
  <div id="hud"></div>
  <div id="enemy"></div>
  <button id="publish"></button>
  <div id="party"></div>
`;

describe('render', () => {
  beforeEach(() => { document.body.innerHTML = HTML; });

  it('renders the current genre, a party card, and the enemy name without throwing', () => {
    render(initialState(0));
    expect(document.getElementById('hud')!.textContent).toContain('Wild West');
    expect(document.getElementById('party')!.querySelectorAll('.card').length).toBeGreaterThan(0);
    expect(document.getElementById('enemy')!.textContent).toContain('Bandit');
  });

  it('shows the publish button only when the book is complete', () => {
    render({ ...initialState(0), bookComplete: false });
    expect(document.getElementById('publish')!.style.display).toBe('none');
    render({ ...initialState(0), bookComplete: true });
    expect(document.getElementById('publish')!.style.display).not.toBe('none');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/render.test.ts`
Expected: FAIL — cannot resolve `./render`.

- [ ] **Step 3: Write the implementation**

```ts
// src/ui/render.ts
import { GameState } from '../engine/state';
import { fmt, div, toNum } from '../engine/num';
import {
  ZONES, RECRUIT_CAP, TARGETS_PER_BOOK,
  isBossIndex, targetMaxHp, targetName, targetEmoji, targetRegen, targetsClearedInBook,
} from '../engine/content';
import { partyDps, characterPower, levelCost, recruitCost, canLevel, canRecruit } from '../engine/economy';

function el(id: string): HTMLElement {
  return document.getElementById(id)!;
}

export function render(state: GameState): void {
  const { zoneIndex, encounterIndex } = state.zone;
  const zone = ZONES[zoneIndex];
  document.body.style.setProperty('--bg', zone.bg);
  document.body.style.setProperty('--accent', zone.accent);

  const maxHp = targetMaxHp(zoneIndex, encounterIndex);
  const hpPct = Math.max(0, Math.min(100, toNum(div(state.currentHp, maxHp)) * 100));
  const isBoss = isBossIndex(encounterIndex);
  const progress = state.bookComplete
    ? 100
    : Math.round((targetsClearedInBook(zoneIndex, encounterIndex) / TARGETS_PER_BOOK) * 100);

  el('hud').innerHTML = `
    <div>Book #${state.bookNumber} — <strong>${zone.genre}</strong></div>
    <div>📜 Manuscript: ${progress}%</div>
    <div>✒️ Inspiration: <strong>${fmt(state.inspiration)}</strong></div>
    <div>📖 Words: ${fmt(state.words)}</div>
    <div>💰 Royalties: ${fmt(state.royalties)} (×${fmt(state.prestigeMultiplier)})</div>
    <div>⚔️ Party DPS: ${fmt(partyDps(state))}</div>`;

  el('enemy').innerHTML = `
    <div class="enemy-emoji">${targetEmoji(zoneIndex, encounterIndex)}</div>
    <div class="enemy-name">${targetName(zoneIndex, encounterIndex)} ${isBoss ? '<span class="boss-tag">BOSS</span>' : ''}</div>
    <div class="hpbar"><div class="hpfill" style="width:${hpPct}%"></div></div>
    <div class="hptext">${fmt(state.currentHp)} / ${fmt(maxHp)} HP${isBoss ? ` · regen ${fmt(targetRegen(zoneIndex, encounterIndex))}/s` : ''}</div>`;

  const cards = state.party
    .map(
      (c) => `
      <div class="card">
        <div class="cemoji">✍️</div>
        <div class="cname">${c.name}</div>
        <div class="clevel">Lv ${c.level} · pow ${fmt(characterPower(c))}</div>
        <button data-action="level" data-id="${c.id}" ${canLevel(state, c.id) ? '' : 'disabled'}>Develop (✒️${fmt(levelCost(c.level))})</button>
      </div>`,
    )
    .join('');
  const recruitCard =
    state.party.length < RECRUIT_CAP
      ? `<div class="card recruit"><div class="cemoji">➕</div><button data-action="recruit" ${canRecruit(state) ? '' : 'disabled'}>Introduce character (✒️${fmt(recruitCost(state.party.length))})</button></div>`
      : '';
  el('party').innerHTML = cards + recruitCard;

  el('publish').style.display = state.bookComplete ? 'block' : 'none';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/render.test.ts`
Expected: PASS (2 cases).

- [ ] **Step 5: Commit**

```bash
git add src/ui/render.ts src/ui/render.test.ts
git commit -m "feat: add DOM render layer"
```

### Task 8.2: Input handlers + rAF loop driver

**Files:**
- Create: `src/ui/input.ts`, `src/ui/rafLoop.ts`

- [ ] **Step 1: Write `src/ui/input.ts`**

```ts
// src/ui/input.ts
import { GameState } from '../engine/state';
import { levelUp, recruit } from '../engine/economy';
import { publish } from '../engine/progression';
import { exportSave, importSave } from '../engine/save';

export function wireInput(getState: () => GameState, setState: (s: GameState) => void): void {
  el('party').addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('button');
    if (!btn) return;
    const action = btn.getAttribute('data-action');
    if (action === 'level') {
      const id = btn.getAttribute('data-id');
      if (id) setState(levelUp(getState(), id));
    } else if (action === 'recruit') {
      setState(recruit(getState()));
    }
  });

  el('publish').addEventListener('click', () => setState(publish(getState())));

  el('export').addEventListener('click', () => {
    const code = exportSave(getState());
    if (navigator.clipboard) navigator.clipboard.writeText(code).catch(() => {});
    window.prompt('Your save code (copy it somewhere safe):', code);
  });

  el('import').addEventListener('click', () => {
    const code = window.prompt('Paste a save code:');
    if (!code) return;
    try {
      setState(importSave(code.trim(), Date.now()));
    } catch {
      window.alert('That save code could not be read.');
    }
  });
}

function el(id: string): HTMLElement {
  return document.getElementById(id)!;
}
```

- [ ] **Step 2: Write `src/ui/rafLoop.ts`**

```ts
// src/ui/rafLoop.ts
import { GameState } from '../engine/state';
import { step } from '../engine/loop';
import { TICK_SECONDS } from '../engine/content';

// Fixed-timestep accumulator decoupled from render. Big real-time gaps (tab
// backgrounded) are clamped here — long absences are handled by offline.applyOffline.
export function startLoop(
  getState: () => GameState,
  setState: (s: GameState) => void,
  onFrame: (s: GameState) => void,
): () => void {
  let last = performance.now();
  let acc = 0;
  let rafId = 0;

  const frame = (now: number) => {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 1) dt = 1; // clamp huge gaps
    acc += dt;

    let s = getState();
    while (acc >= TICK_SECONDS) {
      s = step(s, TICK_SECONDS).state;
      acc -= TICK_SECONDS;
    }
    setState(s);
    onFrame(s);
    rafId = requestAnimationFrame(frame);
  };

  rafId = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(rafId);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/ui/input.ts src/ui/rafLoop.ts
git commit -m "feat: add input handlers and rAF tick driver"
```

### Task 8.3: Bootstrap + styles

**Files:**
- Modify: `src/main.ts` (replace placeholder)
- Modify: `src/styles.css` (replace placeholder)

- [ ] **Step 1: Replace `src/main.ts`**

```ts
// src/main.ts
import './styles.css';
import { initialState, GameState } from './engine/state';
import { load, save } from './engine/save';
import { applyOffline } from './engine/offline';
import { AUTOSAVE_INTERVAL_MS } from './engine/content';
import { fmt } from './engine/num';
import { render } from './ui/render';
import { wireInput } from './ui/input';
import { startLoop } from './ui/rafLoop';

let state: GameState = load(Date.now()) ?? initialState(Date.now());

// Offline catch-up (also runs on a fresh save where elapsed == 0).
const { state: caughtUp, summary } = applyOffline(state, Date.now());
state = caughtUp;

const getState = (): GameState => state;
const setState = (s: GameState): void => {
  state = s;
  render(state);
};

render(state);
wireInput(getState, setState);
startLoop(getState, setState, () => {});

// "While you were writing…" summary.
if (summary.seconds > 1) {
  const modal = document.getElementById('offline-modal')!;
  document.getElementById('offline-body')!.innerHTML =
    `While you were writing for ${Math.round(summary.seconds / 60)} min:<br>` +
    `✒️ +${fmt(summary.inspirationGained)} Inspiration<br>` +
    `📖 +${fmt(summary.wordsGained)} Words<br>` +
    `⚔️ ${summary.clears} encounters cleared`;
  modal.style.display = 'flex';
  document.getElementById('offline-close')!.addEventListener('click', () => {
    modal.style.display = 'none';
  });
}

// Persistence.
setInterval(() => save(state), AUTOSAVE_INTERVAL_MS);
window.addEventListener('beforeunload', () => save(state));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) save(state);
});
```

- [ ] **Step 2: Replace `src/styles.css`**

```css
:root { --bg: #0b1020; --accent: #5ad7ff; }
* { box-sizing: border-box; }
body {
  margin: 0; padding: 1rem; min-height: 100vh;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  background: var(--bg); color: #eee; transition: background 0.6s ease;
}
h1 { text-align: center; margin: 0.25rem 0 1rem; }
#hud {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 0.5rem; background: #0003; padding: 0.75rem; border-radius: 8px;
}
#enemy { text-align: center; margin: 1.25rem auto; max-width: 440px; }
.enemy-emoji { font-size: 4rem; line-height: 1; }
.enemy-name { font-size: 1.2rem; margin: 0.35rem 0; }
.boss-tag { background: crimson; color: #fff; padding: 0 0.4rem; border-radius: 4px; font-size: 0.7rem; vertical-align: middle; }
.hpbar { height: 18px; background: #222; border-radius: 9px; overflow: hidden; border: 1px solid var(--accent); }
.hpfill { height: 100%; background: linear-gradient(90deg, #e74c3c, #f39c12); transition: width 0.1s linear; }
.hptext { font-size: 0.8rem; opacity: 0.85; margin-top: 0.3rem; }
#party { display: flex; flex-wrap: wrap; gap: 0.75rem; justify-content: center; margin-top: 1rem; }
.card {
  background: #0004; border: 1px solid var(--accent); border-radius: 8px;
  padding: 0.75rem; width: 160px; text-align: center;
}
.cemoji { font-size: 2rem; }
.cname { font-weight: 700; margin: 0.2rem 0; }
.clevel { font-size: 0.8rem; opacity: 0.85; margin-bottom: 0.5rem; }
button {
  cursor: pointer; background: var(--accent); color: #001018; border: none;
  border-radius: 6px; padding: 0.4rem 0.6rem; font-weight: 600; font-size: 0.85rem;
}
button:disabled { opacity: 0.4; cursor: not-allowed; }
.publish-btn { display: none; margin: 1rem auto; font-size: 1.1rem; padding: 0.6rem 1rem; }
.toolbar { display: flex; gap: 0.5rem; justify-content: center; margin-top: 1.5rem; }
.modal { display: none; position: fixed; inset: 0; background: #000a; align-items: center; justify-content: center; }
.modal-card { background: #161b29; border: 1px solid var(--accent); border-radius: 10px; padding: 1.5rem; max-width: 360px; text-align: center; line-height: 1.6; }
```

- [ ] **Step 3: Type-check and build**

Run: `npm run build`
Expected: `tsc --noEmit` passes (no type errors) and `vite build` writes `dist/`. Fix any type errors surfaced (e.g. unused imports) before continuing.

- [ ] **Step 4: Full test suite**

Run: `npm test`
Expected: PASS — all engine + render tests.

- [ ] **Step 5: Commit**

```bash
git add src/main.ts src/styles.css
git commit -m "feat: wire bootstrap, offline summary, autosave, and styles"
```

---

## Milestone 9 — Verification & handoff

### Task 9.1: Manual run (owner's machine)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: Vite prints a local URL (e.g. `http://localhost:5173`). Open it.

- [ ] **Step 2: Confirm the core loop by observation**
  - Inspiration ticks up continuously; the enemy HP bar depletes; on clear the enemy advances (name/emoji change) and Words increases.
  - "Develop" buttons enable once you can afford them; clicking spends Inspiration and raises a character's level; Party DPS rises and clears speed up.
  - "Introduce character" recruits up to 5; the button disables at the cap.
  - Reaching a zone boss shows the BOSS tag + regen; if DPS ≤ regen the boss does not die until you level up (the wall).
  - Beating the final zone boss reveals the **Publish** button; clicking it grants a Royalty (×multiplier rises), increments Book #, and resets the party/zone.

### Task 9.2: Simulated offline-progress check

- [ ] **Step 1: Drive some progress, then force an offline gap**

In the browser devtools console on the running app:
```js
// read the save, rewind lastSaved by 2 hours, write it back, reload
const k = 'plotarmor.save.v1';
const s = JSON.parse(localStorage.getItem(k));
s.lastSaved = Date.now() - 2 * 3600 * 1000;
localStorage.setItem(k, JSON.stringify(s));
location.reload();
```
Expected: on reload, the "While you were writing…" modal reports a non-zero Inspiration gain consistent with ~2 hours at the current rate (and any clears). This exercises the same `applyOffline` path covered by `offline.test.ts`.

- [ ] **Step 2: Clock-rewind safety**

In the console: set `s.lastSaved = Date.now() + 3600*1000` (future), save, reload.
Expected: no offline modal / zero gain (guarded), game continues normally.

### Task 9.3: Screenshot verification (Sonnet subagent)

- [ ] **Step 1: Dispatch a Sonnet subagent** to load the running app (or `vite preview` of `dist/`), capture screenshots of: the main battle screen, a boss encounter, and the publish-ready state, and return a **text verdict + file paths** (do NOT load the PNGs into the main session). The verdict should confirm: HUD readouts present and readable, enemy panel + HP bar render, party cards with working-looking buttons, genre theming visible, no overflow/contrast problems.

- [ ] **Step 2:** Address any issues the verdict raises by editing `render.ts`/`styles.css`, rebuild, re-verify. Commit fixes.

### Task 9.4: Finalize

- [ ] **Step 1: Final full build + test**

Run: `npm run build && npm test`
Expected: both green.

- [ ] **Step 2: Commit any remaining changes and push**

```bash
git add -A
git commit -m "chore: v1 verification fixes"
git push
```

- [ ] **Step 3:** Update `README.md` status line from "In design → implementation" to "v1 complete" and commit/push.

---

## Self-review (completed during planning)

- **Spec coverage:** stack (M0), engine/render split (M1–M8), big numbers (M1), continuous-Inspiration + per-clear-Words economy (M2/M3/M5), no-death throughput + boss DPS-check (M4.1), progression + book climax (M4.2), prestige/publish (M4.2), tick loop (M5), offline w/ clock guard (M6), save/migration/export-import (M7), light DOM visualization (M8), verification incl. simulated-offline + screenshot-subagent (M9). 3 genres, 2→5 party — all covered.
- **Placeholders:** none — every code step contains complete code; the only deliberately-deferred item is the optional `break_eternity.d.ts` shim (conditional, full code given).
- **Type consistency:** names verified across modules — `Num/n/ZERO/ONE/add/sub/mul/div/pow/gte/gt/lte/lt/eq/maxN/minN/toNum/numToStr/strToNum/fmt`; `step`→`{state,clears,cappedOut}`; `advanceTarget`→`{hp,cleared,timeUsed}`; `targetInfo`→`{maxHp,regen,isBoss,netDps}`; `GameState` fields (`inspiration/words/royalties/party/zone/currentHp/bookComplete/bookNumber/prestigeMultiplier/lastSaved/schemaVersion`) used identically in `state`, `economy`, `combat`, `progression`, `loop`, `offline`, `save`, `render`.
```
