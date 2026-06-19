# Plot Armor — Party System Slice 3a (World Variants: earn + equip + display) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each class earn cosmetic `(class × world)` skins by clearing world bosses, equip one skin per fielded character, and see it on the card — the collection-and-equip foundation, with no mechanical effect yet (the 2/3/5 set bonus is Slice 3b).

**Architecture:** A character gains an optional `variantWorld` (a world index, or `null` for the base look). Ownership is a per-class `GameState.unlockedVariants: Record<ClassId, number[]>`. Clearing a world's boss deterministically unlocks the next class's variant for that world (fixed class order, no RNG); variants are permanent (survive publishing) like stars/Edits. A new `variants.ts` module owns acquisition + equip; rendering reads a per-world face emoji + accent. Save schema bumps v4→v5 with safe defaults for older saves.

**Tech Stack:** TypeScript (strict) + Vite + Vitest (jsdom) + `break_eternity.js` behind `num.ts` + localStorage. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-06-19-plot-armor-party-system-design.md` — §1 (LOCKED: cosmetic world variants, earned from worlds), §10 Slice 3. NOTE: the §3 `[PROPOSED]` `OwnedCharacter` model is superseded — stars are per-class and the party is `Character[]` (as actually shipped in Slices 1–2); this plan follows the shipped model.

---

## Conventions (read once)

- **Commit identity:** plain `git commit` with the repo's configured global identity (`yovanmc <yovanmc@users.noreply.github.com>`). NEVER `--author`, NEVER per-commit `user.email`, NEVER `--no-verify`.
- **Do NOT push** until the final task.
- Run from `C:\Agent Projects\PlotArmor`. Verify each task with `npx tsc --noEmit` + `npm test`.
- **Variants are cosmetic in Slice 3a** — they must NOT change DPS/economy. (The set bonus is Slice 3b.) This keeps the balanced loop untouched: existing balance/combat/modifier tests stay green with no numeric changes.

## File map

| File | Change | Task |
|------|--------|------|
| `src/engine/content.ts` | `VARIANT_UNLOCK_ORDER`, `WORLD_FACE`, `worldGenre` helper | 1 |
| `src/engine/state.ts` | `Character.variantWorld`, `GameState.unlockedVariants`, `makeUnlockedVariants`, init | 2 |
| `src/engine/save.ts` | stopgap (Task 2), then schema v5 finalize | 2, 5 |
| `src/engine/variants.ts` (new) | `unlockNextVariant`, `isVariantUnlocked`, `setVariant`, `unlockedWorldsFor` | 3 |
| `src/engine/progression.ts` | `onClear` unlocks the next variant on a boss kill | 4 |
| `src/ui/render.ts` | per-card variant face/accent + skin tag + cycle button | 6 |
| `src/ui/input.ts` | `variant` cycle click handler | 6 |
| `src/styles.css` | `.card` variant accent styling | 6 |
| `src/engine/balance.test.ts` | confirm the loop still closes; acquisition unlocks over books | 7 |
| `README.md`, spec status | docs | 7 |

---

## Task 1: Variant content (`content.ts`)

**Files:**
- Modify: `src/engine/content.ts` (append after the star/Edit block from Slice 2, before `// --- party classes (Slice 1)`)
- Test: `src/engine/content.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/engine/content.test.ts` (it imports `* as num` and vitest globals; add the new names):

```ts
import { VARIANT_UNLOCK_ORDER, WORLD_FACE, worldGenre, ZONE_COUNT } from './content';

describe('world variants (Slice 3a)', () => {
  it('the variant unlock order lists every class exactly once', () => {
    expect(VARIANT_UNLOCK_ORDER).toHaveLength(5);
    expect(new Set(VARIANT_UNLOCK_ORDER).size).toBe(5);
    expect(VARIANT_UNLOCK_ORDER).toContain('protagonist');
  });

  it('there is one face emoji per world', () => {
    expect(WORLD_FACE).toHaveLength(ZONE_COUNT);
    expect(WORLD_FACE.every((e) => typeof e === 'string' && e.length > 0)).toBe(true);
  });

  it('worldGenre returns the zone genre', () => {
    expect(worldGenre(0)).toBe('Wild West');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/content.test.ts`
Expected: FAIL — `VARIANT_UNLOCK_ORDER`/`WORLD_FACE`/`worldGenre` not exported.

- [ ] **Step 3: Write minimal implementation**

In `src/engine/content.ts`, insert immediately before `// --- party classes (Slice 1) -------------------------------------------------`:

```ts
// --- world variants (Slice 3a) ----------------------------------------------
// A character can wear a cosmetic skin from any world its class has unlocked.
// Variants are (classId x worldIndex); display-only in Slice 3a (the 2/3/5 set
// bonus is Slice 3b). Clearing a world's boss unlocks the next class's variant
// for that world in this FIXED order (deterministic, no RNG):
export const VARIANT_UNLOCK_ORDER: ClassId[] = [
  'protagonist', 'antihero', 'support', 'debuffer', 'sidekick',
];

// One "writer face" emoji per world (index-aligned with ZONES). Cosmetic only.
export const WORLD_FACE: string[] = ['🤠', '🧟', '🚀', '🧙', '🏴‍☠️', '🕵️', '🐙', '🦴'];

export function worldGenre(worldIndex: number): string {
  return ZONES[worldIndex].genre;
}
```

`ClassId` is declared further down in the same file but TypeScript hoists `type`/`const` exports across the module, so referencing `ClassId` here is fine (it is already referenced earlier by the Slice-2 block too). `ZONES` is defined above.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/content.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/content.ts src/engine/content.test.ts
git commit -m "feat: variant content — unlock order, per-world face emoji, worldGenre"
```

---

## Task 2: `Character.variantWorld` + `GameState.unlockedVariants` (`state.ts`) + save stopgap

**Files:**
- Modify: `src/engine/state.ts`
- Modify: `src/engine/save.ts` (stopgap — finalized in Task 5)
- Test: `src/engine/state.test.ts`

> **Ripple note (expected):** adding `variantWorld` to `Character` and `unlockedVariants` to `GameState` breaks the `GameState` literal returned by `save.ts` `deserialize` AND the `Character` objects it builds. We stopgap both here (safe defaults) and finalize in Task 5. `initialState` (this task), `makeCharacter` (this task), and `publish` (spreads `...state`) are the other construction sites. Run `tsc` at Step 4 to confirm nothing else broke.

- [ ] **Step 1: Write the failing test**

Append to `src/engine/state.test.ts` (add `makeUnlockedVariants` to the state import):

```ts
import { makeUnlockedVariants } from './state';

describe('variants state (Slice 3a)', () => {
  it('characters start on the base look (variantWorld null)', () => {
    const s = initialState(0);
    expect(s.party.every((c) => c.variantWorld === null)).toBe(true);
  });

  it('initial unlockedVariants has an empty list for every class', () => {
    const s = initialState(0);
    expect(s.unlockedVariants.protagonist).toEqual([]);
    expect(s.unlockedVariants.support).toEqual([]);
  });

  it('makeUnlockedVariants seeds an empty array per class', () => {
    const u = makeUnlockedVariants();
    expect(Object.values(u).every((arr) => Array.isArray(arr) && arr.length === 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/state.test.ts`
Expected: FAIL — `variantWorld`/`unlockedVariants`/`makeUnlockedVariants` do not exist.

- [ ] **Step 3: Write minimal implementation**

(a) In `src/engine/state.ts`, add `variantWorld` to `Character`:

```ts
export interface Character {
  id: string;
  name: string;
  classId: ClassId;
  level: number;
  basePower: Num;
  variantWorld: number | null; // cosmetic world skin (null = base look)
}
```

(b) Set it in `makeCharacter`:

```ts
export function makeCharacter(id: string, classId: ClassId, level = 1): Character {
  const def = findClass(classId);
  return { id, name: def.name, classId, level, basePower: def.classBasePower, variantWorld: null };
}
```

(c) Add `unlockedVariants` to `GameState` (after `stars`):

```ts
  edits: Num;
  stars: Record<ClassId, number>;
  unlockedVariants: Record<ClassId, number[]>;
```

(d) Add the helper (next to `makeStars`):

```ts
// Per-class unlocked world-variant indices, all empty at the start. Derived from
// CLASSES so it can never drift out of sync with the class catalog.
export function makeUnlockedVariants(): Record<ClassId, number[]> {
  const u = {} as Record<ClassId, number[]>;
  for (const c of CLASSES) u[c.id] = [];
  return u;
}
```

(e) Initialize it in `initialState` (after `stars: makeStars(),`):

```ts
    edits: ZERO,
    stars: makeStars(),
    unlockedVariants: makeUnlockedVariants(),
```

(f) **Stopgap** in `src/engine/save.ts`. Add `makeUnlockedVariants` to the state import, and in the `deserialize` return add the new field after the Slice-2 `stars` line; also add `variantWorld: null` to the `Character` objects built in the `isV3Party` branch.

State import:
```ts
import { GameState, Character, Upgrades, initialState, emptyUpgrades, makeStartingParty, makeStars, makeUnlockedVariants } from './state';
```

In the `party` mapping (the `isV3Party ? (...).map(...)` branch), add `variantWorld: null` to each built character:
```ts
    ? (dto.party as CharDTO[]).map((c, i) => ({
        id: c.id ?? `c${i}`,
        name: c.name ?? `Character ${i + 1}`,
        classId: c.classId as ClassId,
        level: typeof c.level === 'number' ? c.level : 1,
        basePower: numOr(c.basePower, findClass(c.classId as ClassId).classBasePower),
        variantWorld: null, // STOPGAP — Task 5 reads c.variantWorld
      }))
```

In the returned object, after the Slice-2 `stars:` line:
```ts
    edits: numOr(dto.edits, ZERO),
    stars: sanitizeStars(dto.stars),
    unlockedVariants: makeUnlockedVariants(), // STOPGAP — Task 5 reads dto.unlockedVariants
```

- [ ] **Step 4: Run typecheck + full suite**

Run: `npx tsc --noEmit && npm test`
Expected: tsc clean. If it flags any OTHER `Character`/`GameState` literal, add `variantWorld: null` / `unlockedVariants: makeUnlockedVariants()` there and note it. All tests PASS (existing tests unaffected — variants are inert).

- [ ] **Step 5: Commit**

```bash
git add src/engine/state.ts src/engine/save.ts src/engine/state.test.ts
git commit -m "feat: characters carry a cosmetic variantWorld; state tracks unlockedVariants (save stopgap)"
```

---

## Task 3: Variant acquisition + equip module (`variants.ts`)

**Files:**
- Create: `src/engine/variants.ts`
- Test: `src/engine/variants.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/engine/variants.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { initialState, makeCharacter } from './state';
import { unlockNextVariant, isVariantUnlocked, setVariant, unlockedWorldsFor } from './variants';
import { makeUnlockedVariants } from './state';

describe('variant acquisition', () => {
  it('unlocks the next class (fixed order) for the cleared world', () => {
    let u = makeUnlockedVariants();
    u = unlockNextVariant(u, 2);          // world 2 (Space)
    expect(u.protagonist).toEqual([2]);   // protagonist is first in VARIANT_UNLOCK_ORDER
    u = unlockNextVariant(u, 2);
    expect(u.antihero).toEqual([2]);      // then antihero
  });

  it('is a no-op once every class owns that world', () => {
    let u = makeUnlockedVariants();
    for (let i = 0; i < 5; i++) u = unlockNextVariant(u, 0);
    const before = JSON.stringify(u);
    u = unlockNextVariant(u, 0);          // 6th clear: nothing left to unlock
    expect(JSON.stringify(u)).toBe(before);
  });

  it('does not mutate the input map', () => {
    const u = makeUnlockedVariants();
    unlockNextVariant(u, 3);
    expect(u.protagonist).toEqual([]);    // original untouched
  });
});

describe('equip / query', () => {
  it('equips an unlocked variant on a fielded character', () => {
    const base = { ...initialState(0), unlockedVariants: { ...makeUnlockedVariants(), antihero: [2] } };
    const after = setVariant(base, 'c1', 2); // c1 is the starting Anti-hero
    expect(after.party.find((c) => c.id === 'c1')!.variantWorld).toBe(2);
  });

  it('refuses to equip a variant the class has not unlocked', () => {
    const base = initialState(0);
    expect(setVariant(base, 'c1', 4)).toBe(base); // no-op, same reference
  });

  it('allows equipping the base look (null) regardless of unlocks', () => {
    const start = { ...initialState(0), party: [makeCharacter('c0', 'protagonist'), { ...makeCharacter('c1', 'antihero'), variantWorld: 2 }] };
    const after = setVariant(start, 'c1', null);
    expect(after.party.find((c) => c.id === 'c1')!.variantWorld).toBeNull();
  });

  it('unlockedWorldsFor returns the class list', () => {
    const s = { ...initialState(0), unlockedVariants: { ...makeUnlockedVariants(), support: [1, 5] } };
    expect(unlockedWorldsFor(s, 'support')).toEqual([1, 5]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/variants.test.ts`
Expected: FAIL — module `./variants` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `src/engine/variants.ts`:

```ts
// src/engine/variants.ts
// Variant ownership (per-class unlocked world skins) + equip. Cosmetic in
// Slice 3a; the 2/3/5 set bonus is Slice 3b. Pure functions over GameState.
import { ClassId, VARIANT_UNLOCK_ORDER } from './content';
import { GameState } from './state';

// On clearing world `worldIndex`'s boss, unlock the next class's variant for that
// world in VARIANT_UNLOCK_ORDER. Returns a NEW map (or the same one if the
// world's set is already complete for every class). Never mutates the input.
export function unlockNextVariant(
  unlocked: Record<ClassId, number[]>,
  worldIndex: number,
): Record<ClassId, number[]> {
  for (const classId of VARIANT_UNLOCK_ORDER) {
    if (!unlocked[classId].includes(worldIndex)) {
      return { ...unlocked, [classId]: [...unlocked[classId], worldIndex] };
    }
  }
  return unlocked;
}

export function isVariantUnlocked(state: GameState, classId: ClassId, worldIndex: number): boolean {
  return state.unlockedVariants[classId].includes(worldIndex);
}

export function unlockedWorldsFor(state: GameState, classId: ClassId): number[] {
  return state.unlockedVariants[classId];
}

// Equip a world skin on a fielded character (null = base look). Equips a
// non-null world only if that character's class has unlocked it; otherwise the
// state is returned unchanged (same reference).
export function setVariant(state: GameState, characterId: string, worldIndex: number | null): GameState {
  const c = state.party.find((p) => p.id === characterId);
  if (!c) return state;
  if (worldIndex !== null && !isVariantUnlocked(state, c.classId, worldIndex)) return state;
  return {
    ...state,
    party: state.party.map((p) => (p.id === characterId ? { ...p, variantWorld: worldIndex } : p)),
  };
}
```

- [ ] **Step 4: Run typecheck + full suite**

Run: `npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/variants.ts src/engine/variants.test.ts
git commit -m "feat: variant acquisition (deterministic) + equip/query helpers"
```

---

## Task 4: Bosses unlock the next variant (`progression.ts`)

**Files:**
- Modify: `src/engine/progression.ts`
- Test: `src/engine/progression.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/engine/progression.test.ts`:

```ts
import { unlockNextVariant } from './variants';

describe('boss variant unlocks (Slice 3a)', () => {
  it('clearing a boss unlocks the next variant for that world; a regular clear does not', () => {
    const atBoss = { ...initialState(0), zone: { zoneIndex: 2, encounterIndex: BOSS_INDEX } };
    const after = onClear(atBoss);
    expect(after.unlockedVariants.protagonist).toEqual([2]); // world 2's first variant

    const atReg = { ...initialState(0), zone: { zoneIndex: 2, encounterIndex: 0 } };
    expect(onClear(atReg).unlockedVariants.protagonist).toEqual([]);
  });

  it('unlocks on the final boss (book-complete branch) too', () => {
    const finalBoss = { ...initialState(0), zone: { zoneIndex: ZONE_COUNT - 1, encounterIndex: BOSS_INDEX } };
    const after = onClear(finalBoss);
    expect(after.bookComplete).toBe(true);
    expect(after.unlockedVariants.protagonist).toEqual([ZONE_COUNT - 1]);
  });
});
```

(`BOSS_INDEX`, `ZONE_COUNT`, `initialState` are already imported by `progression.test.ts` from the Slice-2 work; if not, add them.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/progression.test.ts`
Expected: FAIL — `unlockedVariants` is unchanged on boss clears.

- [ ] **Step 3: Write minimal implementation**

In `src/engine/progression.ts`, import `unlockNextVariant` and apply it on a boss clear, in both the final-boss and normal-advance branches:

```ts
import { unlockNextVariant } from './variants';
```

```ts
export function onClear(state: GameState): GameState {
  const { zoneIndex, encounterIndex } = state.zone;
  const words = add(state.words, effectiveWords(state, zoneIndex, encounterIndex));
  const clearedBoss = isBossIndex(encounterIndex);
  const edits = clearedBoss ? add(state.edits, bossEditDrop(state.bookNumber)) : state.edits;
  const unlockedVariants = clearedBoss
    ? unlockNextVariant(state.unlockedVariants, zoneIndex)
    : state.unlockedVariants;

  if (clearedBoss && zoneIndex >= ZONE_COUNT - 1) {
    return { ...state, words, edits, unlockedVariants, bookComplete: true };
  }

  const nz = clearedBoss ? zoneIndex + 1 : zoneIndex;
  const ne = clearedBoss ? 0 : encounterIndex + 1;
  const advanced = { ...state, words, edits, unlockedVariants, zone: { zoneIndex: nz, encounterIndex: ne } };
  return { ...advanced, currentHp: effectiveTargetMaxHp(advanced, nz, ne) };
}
```

> Layering note: `progression.ts` may now import `variants.ts`. `variants.ts` imports only `content` + `state`, so no cycle is introduced.

- [ ] **Step 4: Run typecheck + full suite**

Run: `npx tsc --noEmit && npm test`
Expected: PASS. (Unlocked variants persist across `publish` automatically — `publish` builds from `...state`.)

- [ ] **Step 5: Commit**

```bash
git add src/engine/progression.ts src/engine/progression.test.ts
git commit -m "feat: clearing a world boss unlocks that world's next variant"
```

---

## Task 5: Save schema v5 — persist variants (`save.ts`)

**Files:**
- Modify: `src/engine/save.ts`
- Test: `src/engine/save.test.ts`

- [ ] **Step 1: Write the failing test**

(a) Update the TWO existing version assertions in `save.test.ts` from `4` to `5` (`expect(back.schemaVersion).toBe(5)` in the round-trip test, and `expect(s.schemaVersion).toBe(5)` in the v1-migration test).

(b) Append:

```ts
describe('save v5: variants', () => {
  it('round-trips variantWorld and unlockedVariants', () => {
    const fresh = initialState(0);
    const s = {
      ...fresh,
      party: [{ ...fresh.party[0] }, { ...fresh.party[1], variantWorld: 2 }],
      unlockedVariants: { ...makeUnlockedVariants(), antihero: [2], support: [1, 5] },
    };
    const back = deserialize(serialize(s), 0);
    expect(back.party[1].variantWorld).toBe(2);
    expect(back.unlockedVariants.antihero).toEqual([2]);
    expect(back.unlockedVariants.support).toEqual([1, 5]);
    expect(back.schemaVersion).toBe(5);
  });

  it('migrates a pre-v5 save: base look + empty unlocks, keeps progress', () => {
    const v4 = JSON.stringify({
      schemaVersion: 4, lastSaved: 0, inspiration: '500', words: '0', royalties: '9',
      party: [{ id: 'c0', name: 'The Protagonist', classId: 'protagonist', level: 2, basePower: '1' }],
      zone: { zoneIndex: 0, encounterIndex: 0 }, currentHp: '10', bookComplete: false, bookNumber: 1,
      upgrades: {}, edits: '3', stars: { protagonist: 1, antihero: 1, support: 1, debuffer: 1, sidekick: 1 },
    });
    const s = deserialize(v4, 0);
    expect(s.party[0].variantWorld).toBeNull();
    expect(s.unlockedVariants.protagonist).toEqual([]);
    expect(num.toNum(s.royalties)).toBe(9);
    expect(num.toNum(s.edits)).toBe(3);
  });

  it('sanitizes corrupt variant data (drops unknown classes + out-of-range worlds, dedups)', () => {
    const corrupt = JSON.stringify({
      schemaVersion: 5, lastSaved: 0, inspiration: '0', words: '0', royalties: '0',
      party: [{ id: 'c0', name: 'The Protagonist', classId: 'protagonist', level: 1, basePower: '1', variantWorld: 999 }],
      zone: { zoneIndex: 0, encounterIndex: 0 }, currentHp: '10', bookComplete: false, bookNumber: 1,
      upgrades: {}, edits: '0', stars: {},
      unlockedVariants: { support: [1, 1, 99, -3, 2], wizard: [0] },
    });
    const s = deserialize(corrupt, 0);
    expect(s.unlockedVariants.support).toEqual([1, 2]);     // dedup + drop out-of-range
    expect((s.unlockedVariants as Record<string, number[]>).wizard).toBeUndefined(); // unknown class dropped
    expect(s.party[0].variantWorld).toBeNull();             // out-of-range world -> base
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/save.test.ts`
Expected: FAIL — version still 4 and variants stopgapped.

- [ ] **Step 3: Write minimal implementation**

In `src/engine/save.ts`:

(a) Bump version:
```ts
export const SCHEMA_VERSION = 5;
```

(b) Add `ZONE_COUNT` to the content import (it already imports `ClassId, findClass, CLASSES, MAX_STAR`):
```ts
import { ClassId, findClass, CLASSES, MAX_STAR, ZONE_COUNT } from './content';
```

(c) Add `variantWorld` to `CharDTO` and `unlockedVariants` to `SaveDTO`:
```ts
interface CharDTO { id: string; name: string; classId: string; level: number; basePower: string; variantWorld: number | null; }
```
```ts
  edits: string;
  stars: Record<string, number>;
  unlockedVariants: Record<string, number[]>;
```

(d) Write them in `serialize`:
```ts
    party: state.party.map((c) => ({ id: c.id, name: c.name, classId: c.classId, level: c.level, basePower: numToStr(c.basePower), variantWorld: c.variantWorld })),
```
and after the `stars:` line in the DTO:
```ts
    edits: numToStr(state.edits),
    stars: state.stars,
    unlockedVariants: state.unlockedVariants,
```

(e) Add a helper to read/clamp a single world index, and one to sanitize the whole unlocked map (place near `sanitizeStars`):
```ts
// A valid world index is an integer in [0, ZONE_COUNT); anything else -> null.
function validWorld(v: unknown): number | null {
  if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < ZONE_COUNT) return v;
  return null;
}

// Read per-class unlocked worlds defensively: drop unknown class keys, drop
// out-of-range worlds, dedup, default each class to []. Derived from CLASSES.
function sanitizeUnlocked(raw: unknown): Record<ClassId, number[]> {
  const out = makeUnlockedVariants();
  if (raw && typeof raw === 'object') {
    for (const c of CLASSES) {
      const list = (raw as Record<string, unknown>)[c.id];
      if (Array.isArray(list)) {
        const seen = new Set<number>();
        for (const v of list) {
          const w = validWorld(v);
          if (w !== null && !seen.has(w)) { seen.add(w); out[c.id].push(w); }
        }
      }
    }
  }
  return out;
}
```

(f) In `deserialize`, replace the Task-2 stopgaps. In the `isV3Party` party mapping, read `variantWorld`:
```ts
        basePower: numOr(c.basePower, findClass(c.classId as ClassId).classBasePower),
        variantWorld: validWorld((c as { variantWorld?: unknown }).variantWorld),
```
and in the returned object:
```ts
    edits: numOr(dto.edits, ZERO),
    stars: sanitizeStars(dto.stars),
    unlockedVariants: sanitizeUnlocked(dto.unlockedVariants),
```

- [ ] **Step 4: Run typecheck + full suite**

Run: `npx tsc --noEmit && npm test`
Expected: PASS — round-trip, migration, and corruption tests all green.

- [ ] **Step 5: Commit**

```bash
git add src/engine/save.ts src/engine/save.test.ts
git commit -m "feat: save schema v5 persists variantWorld + unlockedVariants; migrate + sanitize"
```

---

## Task 6: UI — wear + switch variants (`render.ts`, `input.ts`, `styles.css`)

**Files:**
- Modify: `src/ui/render.ts`
- Modify: `src/ui/input.ts`
- Modify: `src/styles.css`
- Test: `src/ui/render.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/ui/render.test.ts`:

```ts
describe('variant UI (Slice 3a)', () => {
  it('shows a skin tag and the world face when a character wears a variant', () => {
    const base = { ...initialState(0), unlockedVariants: { ...require('../engine/state').makeUnlockedVariants(), antihero: [0] } };
    base.party = base.party.map((c) => (c.classId === 'antihero' ? { ...c, variantWorld: 0 } : c));
    render(base);
    const party = document.getElementById('party')!;
    expect(party.textContent).toContain('Wild West'); // skin tag
  });

  it('offers a variant cycle button only when the class has an unlocked variant', () => {
    render(initialState(0)); // nothing unlocked
    expect(document.querySelector('#party [data-action="variant"]')).toBeNull();

    const withUnlock = { ...initialState(0), unlockedVariants: { ...require('../engine/state').makeUnlockedVariants(), antihero: [0] } };
    render(withUnlock);
    expect(document.querySelector('#party [data-action="variant"][data-id="c1"]')).not.toBeNull();
  });
});
```

(If your test style prefers a static import over `require`, add `import { makeUnlockedVariants } from '../engine/state';` at the top and use it directly. Avoid an unused import — tsconfig has `noUnusedLocals`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/render.test.ts`
Expected: FAIL — no skin tag, no `variant` button.

- [ ] **Step 3: Write minimal implementation**

(a) In `src/ui/render.ts`, extend the content import to add `WORLD_FACE, worldGenre`:
```ts
import {
  ZONES, TARGETS_PER_BOOK,
  isBossIndex, targetName, targetEmoji, targetsClearedInBook, CLASSES, MAX_STAR, starUpCost,
  WORLD_FACE, worldGenre,
} from '../engine/content';
```
and import the variant query:
```ts
import { unlockedWorldsFor } from '../engine/variants';
```

(b) Replace the `cards` block so each card reflects its variant (face emoji + skin tag + accent) and offers a cycle button when the class owns at least one variant. The cycle order is `[null, ...unlockedWorlds]`; the button advances to the next entry and stores it in `data-next` (`"base"` or a world index):

```ts
  const cards = state.party
    .map((c) => {
      const stars = state.stars[c.classId];
      const isProtagonist = c.classId === 'protagonist';
      const starRow = isProtagonist
        ? '<div class="cstars">—</div>'
        : `<div class="cstars">${'★'.repeat(stars)}${'☆'.repeat(MAX_STAR - stars)}</div>`;
      const starBtn = (!isProtagonist && stars < MAX_STAR)
        ? `<button data-action="starup" data-class="${c.classId}" ${canStarUp(state, c.classId) ? '' : 'disabled'}>★ Up (✏️${fmt(starUpCost(stars))})</button>`
        : '';

      const face = c.variantWorld !== null ? WORLD_FACE[c.variantWorld] : '✍️';
      const skinTag = c.variantWorld !== null ? `<div class="cskin">${worldGenre(c.variantWorld)}</div>` : '';
      const accentStyle = c.variantWorld !== null ? ` style="border-color:${ZONES[c.variantWorld].accent}"` : '';
      const worlds = unlockedWorldsFor(state, c.classId);
      let variantBtn = '';
      if (worlds.length > 0) {
        const cycle: (number | null)[] = [null, ...worlds];
        const idx = cycle.findIndex((w) => w === c.variantWorld);
        const next = cycle[(idx + 1) % cycle.length];
        variantBtn = `<button data-action="variant" data-id="${c.id}" data-next="${next === null ? 'base' : next}">🎭 Skin</button>`;
      }

      return `
      <div class="card"${accentStyle}>
        <div class="cemoji">${face}</div>
        <div class="cname">${c.name}</div>
        ${skinTag}
        ${starRow}
        <div class="clevel">Lv ${c.level} · pow ${fmt(effectiveCharacterPower(state, c))}</div>
        <button data-action="level" data-id="${c.id}" ${canLevel(state, c.id) ? '' : 'disabled'}>Develop (✒️${fmt(effectiveLevelCost(state, c.level))})</button>
        ${starBtn}
        ${variantBtn}
      </div>`;
    })
    .join('');
```

(c) In `src/ui/input.ts`, add the `variant` branch and import `setVariant`:
```ts
import { setVariant } from '../engine/variants';
```
```ts
    } else if (action === 'starup') {
      const classId = btn.getAttribute('data-class');
      if (classId) setState(starUp(getState(), classId as ClassId));
    } else if (action === 'variant') {
      const id = btn.getAttribute('data-id');
      const next = btn.getAttribute('data-next');
      if (id) setState(setVariant(getState(), id, next === 'base' || next === null ? null : Number(next)));
    }
```

(d) In `src/styles.css`, append a small skin-tag style:
```css
.cskin {
  font-size: 0.75rem;
  opacity: 0.8;
  font-style: italic;
}
```

- [ ] **Step 4: Run typecheck + full suite**

Run: `npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/render.ts src/ui/input.ts src/styles.css src/ui/render.test.ts
git commit -m "feat: party cards wear world skins (face + accent + tag) with a cycle button"
```

---

## Task 7: Harness check + docs + ship (controller-driven)

> Steps 1–2 are a normal subagent task; Steps 3–5 are done by the controller inline.

**Files:**
- Modify: `src/engine/balance.test.ts`
- Modify: `README.md`, `docs/superpowers/specs/2026-06-19-plot-armor-party-system-design.md`

- [ ] **Step 1: Add an acquisition regression to the harness**

In `src/engine/balance.test.ts`, after the existing `describe('balance: the core loop closes', ...)` block (the `simulate(8, ...)` results are already computed there as `results`), add a test that variants accrue through real play. Because variants are cosmetic in Slice 3a, the loop assertions are unchanged; this only confirms the earn loop fires. Reuse the existing module-level `simulate` by adding a fresh call:

```ts
import { initialState } from './state';
import { ZONE_COUNT } from './content';

describe('balance: variants are earned through play (Slice 3a)', () => {
  it('clearing 8 books unlocks variants for every world', () => {
    // Re-run a short greedy sim and inspect the FINAL state's unlocks.
    // (simulate() returns per-book timings; here we re-walk to grab end state.)
    let s = initialState(0);
    let totalUnlocked = 0;
    for (const classId of Object.keys(s.unlockedVariants) as (keyof typeof s.unlockedVariants)[]) {
      totalUnlocked += s.unlockedVariants[classId].length;
    }
    expect(totalUnlocked).toBe(0); // starts empty
  });
});
```

> NOTE for the implementer: the existing harness keeps its own state inside `simulate()` and only returns timings, so the simplest *meaningful* assertion that exercises real acquisition is to expose the end-state. If `simulate` does not already return the final `GameState`, change its return type to also include the final state (`{ results, finalState }`) and assert `finalState.unlockedVariants` has entries for several worlds after 8 books. Pick whichever is cleaner; the goal is one test proving boss clears actually populate `unlockedVariants` end-to-end. Keep the two existing loop-closure assertions intact and green.

- [ ] **Step 2: Run typecheck + full suite**

Run: `npx tsc --noEmit && npm test`
Expected: PASS — loop-closure assertions unchanged; new acquisition test green.

- [ ] **Step 3: Live DOM smoke (controller)**

`npm run build`, serve the built `dist/` (`plotarmor-dist` preview), and `preview_eval`: with a save that has an unlocked variant, confirm the card shows the world face + skin tag + accent, the 🎭 Skin button cycles base → world → base, and equipping persists in the rendered card, with no console errors. (Pixel screenshots remain uncapturable — flag honestly.)

- [ ] **Step 4: Docs**

- `README.md` Status: note characters now **earn and wear cosmetic `(class × world)` skins**, unlocked by clearing world bosses (Slice 3a); the 2/3/5 set bonus is the next slice. Bump the test count.
- Spec: in §10, mark **Slice 3a implemented**; update the top Status line. (Leave Slice 3b — set bonus — as the next step.)

- [ ] **Step 5: Commit + push + report**

```bash
git add README.md docs/superpowers/specs/2026-06-19-plot-armor-party-system-design.md
git commit -m "feat: party system Slice 3a — earn + wear world variant skins"
git push origin main
```

Report final `npm run build` + `npm test` output and the pushed commit range. Flag the live visual/feel pass as the owner's on `npm run dev`.

---

## Self-review (completed during planning)

- **Spec coverage:** cosmetic `(class × world)` variants (§1 LOCKED) → Tasks 1,2,6; earned-from-worlds acquisition, no gacha (§1 LOCKED) → Tasks 3,4; collection is persistent (survives publish) → Tasks 2,4 (via `...state`), 5 (save); fields a limited party from the look it owns → Task 6. **Set bonus (§6b), full collection gallery (§8), and the Protagonist Royalties track (§7) are intentionally OUT of scope for 3a** — set bonus is Slice 3b; gallery + Protagonist track are deferred follow-ups.
- **No balance impact:** variants are cosmetic in 3a, so every combat/economy/balance test keeps its exact numbers; only save-version assertions change (Task 5). This is the safety property that makes 3a low-risk.
- **Green sequencing:** Task 2 changes `Character` + `GameState`; the only literals that break are in `save.ts` (stopgapped in Task 2, finalized in Task 5). `initialState`/`makeCharacter`/`publish` are handled. Task 5 flips two `schemaVersion` assertions 4→5 (called out).
- **No data loss:** v4→v5 migration defaults `variantWorld` to null and `unlockedVariants` to empty, preserving every permanent field; corrupt world indices/unknown classes are dropped, never crash.
- **DRY / layering:** `makeUnlockedVariants` (state) and `sanitizeUnlocked` (save) derive from `CLASSES`; acquisition/equip live in one `variants.ts` module (imports only content + state → acyclic: content → state → variants → progression/ui).
- **Type consistency:** `variantWorld: number | null`, `unlockedVariants: Record<ClassId, number[]>`, `unlockNextVariant(map, world)`, `setVariant(state, id, world|null)`, `isVariantUnlocked(state, class, world)`, `unlockedWorldsFor(state, class)`, `validWorld`, `sanitizeUnlocked` — consistent across all tasks.
