# Plot Armor — Party System Slice 1 (Classes + Abilities + Protagonist) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace the clone party with a Protagonist + four classes (Anti-hero, Support, Debuffer, Sidekick), each with an ability wired into the combat modifiers, choosing a class on recruit — proving the composition gameplay. No stars/collection yet (those are Slices 2–3).

**Architecture:** Pure-engine change plus a thin UI tweak. Classes are static data in `content.ts`; a `Character` gains `classId`; abilities are summed across the fielded party inside the existing `modifiers.ts` `effective*` functions (same shape as shop-upgrade mults). Recruit takes a `classId`. Save schema v2→v3 (add `classId`, migrate by reseeding the ephemeral party). The balance harness is extended to field classes and re-verify the loop closes; magnitudes are then tuned against it.

**Tech Stack:** TypeScript (strict) · Vite · Vitest (jsdom).

**Spec:** [`docs/superpowers/specs/2026-06-19-plot-armor-party-system-design.md`](../specs/2026-06-19-plot-armor-party-system-design.md) (§4 classes, §5 combat integration, §10 Slice 1).

---

## How to read this plan

- Repo root `C:\Agent Projects\PlotArmor` (Windows / PowerShell; Bash tool also available).
- Commit after each task with plain `git commit` (global identity `yovanmc <yovanmc@users.noreply.github.com>` — never override). Do NOT push until Task 8.
- One test: `npx vitest run src/engine/<name>.test.ts`. All: `npm test`. Build: `npm run build`. Harness report: `BALANCE_REPORT=1 npx vitest run src/engine/balance.test.ts`.
- **All ability magnitudes and class base powers are placeholders.** Tasks 1–7 wire the structure with starting-guess values; **Task 7 tunes them against the harness** until the pacing targets hold. Do not treat the starting numbers as final.

## File structure

```
src/engine/content.ts     (mod)  ClassId, ClassDef, CLASSES (4 + protagonist), ability magnitudes
src/engine/state.ts       (mod)  Character.classId; makeStartingParty -> Protagonist + Anti-hero; basePower from class
src/engine/modifiers.ts   (mod)  party-ability mults folded into effectivePartyDps/effectiveBossRegen/effectiveInspirationRate
src/engine/economy.ts     (mod)  recruit(state, classId); canRecruitClass
src/engine/save.ts        (mod)  schema v3: classId in DTO; migrate (reseed party) from v2
src/ui/render.ts          (mod)  party cards show class; per-class recruit buttons
src/ui/input.ts           (mod)  recruit reads data-class
src/engine/balance.test.ts(mod)  greedy sim fields/recruits classes; re-assert loop closes
README.md / spec status   (mod)  Task 8
```

---

## Task 1: Class content (`content.ts`)

**Files:** Modify `src/engine/content.ts`; Test `src/engine/content.test.ts` (append).

- [ ] **Step 1: Append the failing test** to `src/engine/content.test.ts` (inside a new `describe`):

```ts
describe('content: classes', () => {
  it('defines the four classes plus the protagonist with abilities', () => {
    expect(C.CLASSES.map((c) => c.id).sort()).toEqual(
      ['antihero', 'debuffer', 'protagonist', 'sidekick', 'support'],
    );
    for (const def of C.CLASSES) {
      expect(typeof def.name).toBe('string');
      expect(num.gt(def.classBasePower, num.ZERO)).toBe(true);
      expect(typeof def.ability.kind).toBe('string');
    }
    expect(C.findClass('protagonist').ability.kind).toBe('plotArmor');
    expect(C.findClass('debuffer').ability.kind).toBe('regenCut');
    expect(() => C.findClass('nope' as C.ClassId)).toThrow();
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/engine/content.test.ts` → FAIL (no `CLASSES`).

- [ ] **Step 3: Implement** — add to `src/engine/content.ts` (after the upgrade catalog section):

```ts
// --- party classes (Slice 1) -------------------------------------------------
export type ClassId = 'protagonist' | 'antihero' | 'support' | 'debuffer' | 'sidekick';
export type AbilityKind = 'plotArmor' | 'loneWolf' | 'partyDps' | 'regenCut' | 'inspRate';

export interface ClassDef {
  id: ClassId;
  name: string;
  classBasePower: Num;
  ability: { kind: AbilityKind; mag: number }; // mag is per-level (× star later); placeholder values
}

// ALL magnitudes + base powers are placeholders, tuned in Task 7 against the harness.
export const CLASSES: ClassDef[] = [
  { id: 'protagonist', name: 'The Protagonist', classBasePower: n(1.5), ability: { kind: 'plotArmor', mag: 0.10 } },
  { id: 'antihero',    name: 'Anti-hero',       classBasePower: n(1.5), ability: { kind: 'loneWolf', mag: 0.04 } },
  { id: 'support',     name: 'Support',         classBasePower: n(0.8), ability: { kind: 'partyDps', mag: 0.03 } },
  { id: 'debuffer',    name: 'Debuffer',        classBasePower: n(0.7), ability: { kind: 'regenCut', mag: 0.03 } },
  { id: 'sidekick',    name: 'Sidekick',        classBasePower: n(0.7), ability: { kind: 'inspRate', mag: 0.03 } },
];

export const PARTY_ABILITY_FLOOR = 0.10; // regen-cut floor shared with the shop `muse` upgrade

export function findClass(id: ClassId): ClassDef {
  const def = CLASSES.find((c) => c.id === id);
  if (!def) throw new Error(`Unknown class: ${id}`);
  return def;
}
```

- [ ] **Step 4: Run to verify it passes** — `npx vitest run src/engine/content.test.ts` → PASS.
- [ ] **Step 5: Type-check** — `npx tsc --noEmit` → clean.
- [ ] **Step 6: Commit**

```bash
git add src/engine/content.ts src/engine/content.test.ts
git commit -m "feat: add party class definitions (4 classes + protagonist)"
```

---

## Task 2: `Character.classId` + class-seeded party (`state.ts`)

**Files:** Modify `src/engine/state.ts`; Test `src/engine/state.test.ts`.

- [ ] **Step 1: Append the failing test** to `src/engine/state.test.ts`:

```ts
  it('starting party is the Protagonist (slot 0) plus an Anti-hero, each with a classId', () => {
    const party = makeStartingParty();
    expect(party[0].classId).toBe('protagonist');
    expect(party[1].classId).toBe('antihero');
    expect(party.every((c) => num.gt(c.basePower, num.ZERO))).toBe(true);
  });
```

(`makeStartingParty` is already imported in this test file.)

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/engine/state.test.ts` → FAIL (`classId` undefined).

- [ ] **Step 3: Implement** in `src/engine/state.ts`:

Add `classId` to the interface and import the class catalog:

```ts
import { STARTING_PARTY_SIZE, targetMaxHp, POWER_GROWTH, ClassId, findClass } from './content';
```

```ts
export interface Character {
  id: string;
  name: string;
  classId: ClassId;
  level: number;
  basePower: Num;
}
```

Add a factory and rewrite `makeStartingParty` (the Protagonist always takes slot 0):

```ts
export function makeCharacter(id: string, classId: ClassId, level = 1): Character {
  const def = findClass(classId);
  return { id, name: def.name, classId, level, basePower: def.classBasePower };
}

export function makeStartingParty(level = 1): Character[] {
  // Slot 0 is always the Protagonist; the starter companion is an Anti-hero.
  return [
    makeCharacter('c0', 'protagonist', level),
    makeCharacter('c1', 'antihero', level),
  ];
}
```

(`characterPower` is unchanged — it already reads `basePower`. `CHARACTER_NAMES` may be removed if unused; if `tsc` flags it as unused, delete the constant.)

- [ ] **Step 4: Run to verify it passes** — `npx vitest run src/engine/state.test.ts` → PASS.
- [ ] **Step 5: Type-check** — `npx tsc --noEmit`. NOTE: this will surface downstream type errors in `economy.ts`/`save.ts` that construct `Character` without `classId`; those are fixed in Tasks 4 and 5. To keep this task green in isolation, also do the minimal `classId` additions the compiler demands in any file you touch here ONLY if needed to compile — otherwise leave them for their tasks and accept that `tsc` is clean only after Task 5. (If you prefer strict green-at-every-commit, jump to Task 4/5's `classId` edits now; either order is fine as long as the suite is green at Task 5.)
- [ ] **Step 6: Commit**

```bash
git add src/engine/state.ts src/engine/state.test.ts
git commit -m "feat: characters carry a classId; party starts Protagonist + Anti-hero"
```

---

## Task 3: Party abilities in the modifiers (`modifiers.ts`)

**Files:** Modify `src/engine/modifiers.ts`; Test `src/engine/modifiers.test.ts` (append).

Abilities are summed across the fielded party and folded into the existing `effective*` functions, the same way shop-upgrade mults already are.

- [ ] **Step 1: Append failing tests** to `src/engine/modifiers.test.ts`:

```ts
  it('a Support raises party DPS above raw character power', () => {
    const base = { ...initialState(0) };
    const withSupport = {
      ...base,
      party: [...base.party, makeCharacter('s', 'support', 10)],
    };
    // Support adds its own power AND a party-wide multiplier, so DPS exceeds the bare sum.
    const bareSum = withSupport.party.reduce((acc, c) => num.add(acc, characterPower(c)), num.ZERO);
    expect(num.gt(effectivePartyDps(withSupport), bareSum)).toBe(true);
  });

  it('a Debuffer reduces effective boss regen', () => {
    const base = { ...initialState(0), zone: { zoneIndex: 1, encounterIndex: BOSS_INDEX } };
    const withDebuffer = { ...base, party: [...base.party, makeCharacter('d', 'debuffer', 10)] };
    expect(num.lt(
      effectiveBossRegen(withDebuffer, 1, BOSS_INDEX),
      effectiveBossRegen(base, 1, BOSS_INDEX),
    )).toBe(true);
  });

  it('a Sidekick raises the inspiration rate', () => {
    const base = { ...initialState(0) };
    const withSidekick = { ...base, party: [...base.party, makeCharacter('k', 'sidekick', 10)] };
    expect(num.gt(
      effectiveInspirationRate(withSidekick, 0, 0),
      effectiveInspirationRate(base, 0, 0),
    )).toBe(true);
  });
```

Ensure the test file imports what it needs: `makeCharacter`, `characterPower` from `../engine/state` (adjust the existing import line) and `BOSS_INDEX` from `../engine/content`, and `* as num`.

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/engine/modifiers.test.ts` → FAIL.

- [ ] **Step 3: Implement** in `src/engine/modifiers.ts`. Add imports:

```ts
import { GameState, characterPower, Character } from './state';
import {
  /* ...existing... */ CLASSES, PARTY_ABILITY_FLOOR, findClass,
} from './content';
```

Add helpers that sum a given ability's contribution across the party (contribution = `mag × level`, summed; stars arrive in Slice 2):

```ts
function abilitySum(party: Character[], kind: string): number {
  let total = 0;
  for (const c of party) {
    const ab = findClass(c.classId).ability;
    if (ab.kind === kind) total += ab.mag * c.level;
  }
  return total;
}

function distinctClassCount(party: Character[]): number {
  return new Set(party.map((c) => c.classId)).size;
}
```

Rewrite `effectivePartyDps` to apply Lone Wolf per-character, then Support and Plot Armor party-wide:

```ts
export function effectivePartyDps(s: GameState): Num {
  let sum = ZERO;
  for (const c of s.party) {
    const ab = findClass(c.classId).ability;
    const selfMult = ab.kind === 'loneWolf' ? 1 + ab.mag * c.level : 1; // Lone Wolf amps only itself
    sum = add(sum, mul(characterPower(c), n(selfMult)));
  }
  const supportMult = 1 + abilitySum(s.party, 'partyDps');
  const hasProtagonist = s.party.some((c) => c.classId === 'protagonist');
  const plotArmorMult = hasProtagonist
    ? 1 + findClass('protagonist').ability.mag * distinctClassCount(s.party)
    : 1;
  return mul(mul(mul(sum, n(sharpMult(s))), n(supportMult)), n(plotArmorMult));
}
```

Fold the Debuffer into `effectiveBossRegen` (combine with the shop `muse` reduction under a shared floor):

```ts
export function effectiveBossRegen(s: GameState, zoneIndex: number, encounterIndex: number): Num {
  const shopReduction = 1 - museMult(s);                       // museMult already floored; this is the shop's cut
  const partyReduction = abilitySum(s.party, 'regenCut');      // additional cut from Debuffers
  const combined = Math.max(PARTY_ABILITY_FLOOR, 1 - (shopReduction + partyReduction));
  return mul(mul(targetRegen(zoneIndex, encounterIndex), bookDifficulty(s)), n(combined));
}
```

Fold the Sidekick into `effectiveInspirationRate`:

```ts
export function effectiveInspirationRate(s: GameState, zoneIndex: number, encounterIndex: number): Num {
  const sidekickMult = 1 + abilitySum(s.party, 'inspRate');
  return mul(
    mul(mul(targetInspirationRate(zoneIndex, encounterIndex), bookDifficulty(s)), n(prolificMult(s))),
    n(sidekickMult),
  );
}
```

(`CLASSES` import may be unnecessary if only `findClass` is used — drop it if `tsc` flags it unused.)

- [ ] **Step 4: Run to verify it passes** — `npx vitest run src/engine/modifiers.test.ts` → PASS.
- [ ] **Step 5: Commit**

```bash
git add src/engine/modifiers.ts src/engine/modifiers.test.ts
git commit -m "feat: party-class abilities feed effective DPS / regen / inspiration"
```

---

## Task 4: Recruit a chosen class (`economy.ts`)

**Files:** Modify `src/engine/economy.ts`; Test `src/engine/economy.test.ts` (append + adjust).

- [ ] **Step 1: Append the failing test** to `src/engine/economy.test.ts`:

```ts
  it('recruit(classId) adds a level-1 character of that class and charges inspiration', () => {
    const s = { ...initialState(0), inspiration: num.n('1e9') };
    const before = s.party.length;
    const after = recruit(s, 'debuffer');
    expect(after.party.length).toBe(before + 1);
    expect(after.party[after.party.length - 1].classId).toBe('debuffer');
    expect(num.lt(after.inspiration, s.inspiration)).toBe(true);
  });
```

(If existing economy tests call `recruit(s)` with no class, update them to `recruit(s, 'antihero')`.)

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/engine/economy.test.ts` → FAIL.

- [ ] **Step 3: Implement** in `src/engine/economy.ts`. Import `makeCharacter`, `ClassId`:

```ts
import { GameState, Character, makeCharacter } from './state';
import { ClassId } from './content';
```

Replace `recruit`:

```ts
export function recruit(state: GameState, classId: ClassId): GameState {
  if (!canRecruit(state)) return state;
  const cost = effectiveRecruitCost(state, state.party.length);
  const idx = state.party.length;
  const newChar: Character = makeCharacter(`c${idx}`, classId);
  return { ...state, inspiration: sub(state.inspiration, cost), party: [...state.party, newChar] };
}
```

(`canRecruit`/`canLevel`/`levelUp` are unchanged. The now-unused `CHARACTER_NAMES` and `n` imports: drop whatever `tsc` flags.)

- [ ] **Step 4: Run to verify it passes** — `npx vitest run src/engine/economy.test.ts` → PASS.
- [ ] **Step 5: Commit**

```bash
git add src/engine/economy.ts src/engine/economy.test.ts
git commit -m "feat: recruit takes a classId"
```

---

## Task 5: Save schema v3 (`save.ts`)

**Files:** Modify `src/engine/save.ts`; Test `src/engine/save.test.ts` (append + adjust).

Migration rule: keep ALL permanent progress; reseed the (ephemeral) party into the class system. A pre-v3 character DTO has no `classId` → we discard the old party array and rebuild from `makeStartingParty(...)` preserving the current party's *count* is unnecessary (party resets each book), so just reseed fresh. New saves round-trip `classId`.

- [ ] **Step 1: Append/adjust tests** in `src/engine/save.test.ts`:

```ts
  it('round-trips classId for a v3 save', () => {
    const s = { ...initialState(0), party: [makeCharacter('c0', 'protagonist', 2), makeCharacter('c1', 'debuffer', 3)] };
    const back = deserialize(serialize(s), 0);
    expect(back.party.map((c) => c.classId)).toEqual(['protagonist', 'debuffer']);
    expect(back.party[1].level).toBe(3);
  });

  it('migrates a pre-v3 (classless) save by reseeding the party but keeping progress', () => {
    const legacy = JSON.stringify({
      schemaVersion: 2, lastSaved: 0, inspiration: '500', words: '1234', royalties: '7',
      party: [{ id: 'c0', name: 'Quill', level: 5, basePower: '1' }],
      zone: { zoneIndex: 1, encounterIndex: 2 }, currentHp: '10', bookComplete: false, bookNumber: 3,
      upgrades: { prolific: 2 },
    });
    const s = deserialize(legacy, 0);
    expect(num.toNum(s.royalties)).toBe(7);          // progress kept
    expect(s.bookNumber).toBe(3);
    expect(s.upgrades.prolific).toBe(2);
    expect(s.party[0].classId).toBe('protagonist');  // party reseeded into the class system
  });
```

Ensure `makeCharacter` is imported in the test.

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/engine/save.test.ts` → FAIL.

- [ ] **Step 3: Implement** in `src/engine/save.ts`:

- Bump `export const SCHEMA_VERSION = 3;`
- Add `classId` to `CharDTO`: `interface CharDTO { id: string; name: string; classId: string; level: number; basePower: string; }`
- In `serialize`, include `classId: c.classId` in the mapped party.
- Import `makeStartingParty`, `ClassId`, `findClass` (or `CLASSES`) as needed, plus `makeCharacter`.
- In `deserialize`, replace the party reconstruction with a version-aware one:

```ts
  const isV3Party =
    Array.isArray(dto.party) && dto.party.length > 0 &&
    dto.party.every((c) => typeof (c as { classId?: unknown }).classId === 'string' &&
      // guard: must be a known class
      ['protagonist', 'antihero', 'support', 'debuffer', 'sidekick'].includes((c as { classId: string }).classId));

  const party: Character[] = isV3Party
    ? (dto.party as CharDTO[]).map((c, i) => ({
        id: c.id ?? `c${i}`,
        name: c.name ?? `Character ${i + 1}`,
        classId: c.classId as ClassId,
        level: typeof c.level === 'number' ? c.level : 1,
        basePower: numOr(c.basePower, findClass(c.classId as ClassId).classBasePower),
      }))
    : makeStartingParty(); // pre-v3: reseed the ephemeral party into the class system
```

Keep everything else (inspiration/words/royalties/zone/bookNumber/upgrades) as-is so progress is preserved.

- [ ] **Step 4: Run to verify it passes** — `npx vitest run src/engine/save.test.ts` → PASS.
- [ ] **Step 5: Type-check + full suite** — `npx tsc --noEmit` clean; `npm test` green (all engine tests now compile with `classId`).
- [ ] **Step 6: Commit**

```bash
git add src/engine/save.ts src/engine/save.test.ts
git commit -m "feat: save schema v3 (classId); migrate pre-v3 by reseeding the party"
```

---

## Task 6: UI — class on cards, recruit-by-class (`render.ts` + `input.ts`)

**Files:** Modify `src/ui/render.ts`, `src/ui/input.ts`; Test `src/ui/render.test.ts` (append).

- [ ] **Step 1: Append the failing test** to `src/ui/render.test.ts`:

```ts
  it('party cards show the class name and the recruit area offers a per-class button', () => {
    render(initialState(0));
    expect(document.getElementById('party')!.textContent).toContain('The Protagonist');
    // a recruit control carrying a data-class attribute exists
    expect(document.querySelector('#party [data-action="recruit"][data-class]')).not.toBeNull();
  });
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/ui/render.test.ts` → FAIL.

- [ ] **Step 3: Implement** in `src/ui/render.ts`:

- Import the class catalog: `import { /* ...existing... */ CLASSES } from '../engine/content';`
- In the party-card map, show the class name (add a line, e.g. under `cname`): `<div class="cclass">${findClass(c.classId).name}</div>` — import `findClass` too, or read from the character's name (the name already equals the class name from `makeCharacter`, so you may simply keep `c.name`). Minimal: ensure each card renders `c.name` (already does).
- Replace the single recruit card with per-class recruit buttons (exclude `protagonist` — it's never recruited):

```ts
  const recruitable = CLASSES.filter((cl) => cl.id !== 'protagonist');
  const recruitCard =
    state.party.length < effectivePartyCap(state)
      ? `<div class="card recruit">
           <div class="cemoji">➕</div>
           ${recruitable
             .map((cl) =>
               `<button data-action="recruit" data-class="${cl.id}" ${canRecruit(state) ? '' : 'disabled'}>` +
               `${cl.name} (✒️${fmt(effectiveRecruitCost(state, state.party.length))})</button>`)
             .join('')}
         </div>`
      : '';
```

- [ ] **Step 4: Implement** in `src/ui/input.ts` — read the chosen class:

```ts
    } else if (action === 'recruit') {
      const classId = btn.getAttribute('data-class');
      if (classId) setState(recruit(getState(), classId as ClassId));
    }
```

Import `ClassId`: `import { ClassId } from '../engine/content';`

- [ ] **Step 5: Run to verify it passes** — `npx vitest run src/ui/render.test.ts` → PASS. Then `npx tsc --noEmit` clean.
- [ ] **Step 6: Commit**

```bash
git add src/ui/render.ts src/ui/input.ts src/ui/render.test.ts
git commit -m "feat: party cards show class; recruit picks a class"
```

---

## Task 7: Extend the balance harness + TUNE

**Files:** Modify `src/engine/balance.test.ts`; then tune `src/engine/content.ts` magnitudes.

The greedy sim must now choose recruits-by-class and field a sensible composition, then we tune the new magnitudes/base-powers so the loop still closes.

- [ ] **Step 1: Update the harness** `src/engine/balance.test.ts`:
  - `recruit(...)` calls now take a `classId`. Give the sim a fixed sensible recruit order that exercises composition, e.g.: `['debuffer', 'support', 'antihero', 'sidekick']` (the Protagonist + starter Anti-hero already occupy slots 0–1; recruit up to the cap from this list, cycling).
  - In `bestAffordablePurchase`, when considering `recruit`, pick the next class from that order (compute `ΔDPS` via `characterPower` of a fresh `makeCharacter(next, classId)`); apply with `recruit(cur, nextClassId)`.
  - Keep the rest of the greedy loop intact.

- [ ] **Step 2: Run the report** — `BALANCE_REPORT=1 npx vitest run src/engine/balance.test.ts`. Observe per-book times.

- [ ] **Step 3: TUNE** `src/engine/content.ts` — adjust `CLASSES` `classBasePower` and ability `mag` values (and, only if needed, `POWER_GROWTH`/zone-growth from the prior milestone) until:
  - book 1 publishes within ~10–30 min greedy,
  - books 1–8 all complete with no multi-day wall,
  - the two harness assertions pass.
  Re-run the report after each change. Document the final values in a comment.

- [ ] **Step 4: Full suite** — `npm test` green (the two balance assertions included). Some earlier modifier/combat/loop tests may shift numerically from the new base powers; if any assert absolute DPS, update them to match the tuned values (preserve the test's intent).

- [ ] **Step 5: Commit**

```bash
git add src/engine/balance.test.ts src/engine/content.ts
git commit -m "feat: harness fields classes; tune class powers/abilities so the loop closes"
```

---

## Task 8: Wire-up check, docs, ship

**Files:** `src/main.ts` (verify only), `README.md`, spec status.

- [ ] **Step 1: Verify `main.ts`** needs no change (it calls `wireInput`/`render` generically). Build: `npm run build` green.
- [ ] **Step 2: Full suite** — `npm test` green.
- [ ] **Step 3: Best-effort live DOM smoke** — `npm run build`, then start the static `dist/` preview and `preview_eval`: confirm the party shows the Protagonist + class cards, per-class recruit buttons exist, recruiting a class adds it, no console errors. (Pixel screenshots remain uncapturable in this sandbox — flag honestly; do not load PNGs into the main session.)
- [ ] **Step 4: Docs** — in `README.md` Status, note the party is now Protagonist + four classes with composition abilities (Slice 1 of the party system); in the party-system spec, mark Slice 1 status Implemented. Bump the test count.
- [ ] **Step 5: Commit + push**

```bash
git add src/main.ts README.md docs/superpowers/specs/2026-06-19-plot-armor-party-system-design.md
git commit -m "feat: party system Slice 1 — classes + abilities + Protagonist"
git push origin main
```

- [ ] **Step 6: Report** final `npm run build` + `npm test` output, the tuned magnitudes, the greedy pacing table, and the pushed commit range. Flag the live visual/feel pass as the owner's on `npm run dev`.

---

## Self-review (completed during planning)

- **Spec coverage:** §4 classes+abilities → Tasks 1,3; Protagonist Plot Armor → Task 3; §5 modifier integration → Task 3; choose-on-recruit → Tasks 4,6; save migration (§3 data model) → Task 5; harness re-verify (§11) → Task 7; no stars/collection (Slice 1 scope) → respected throughout.
- **Type/name consistency:** `ClassId`/`ClassDef`/`CLASSES`/`findClass` consistent across content/state/economy/save/modifiers/input; `makeCharacter(id, classId, level?)` signature identical at all call sites; `recruit(state, classId)` updated at every caller (input.ts, harness, economy tests).
- **Green sequencing:** Tasks 1,3,4,6 are append-only-test + isolated impl. Task 2 changes the `Character` shape, which forces `classId` into economy/save constructors — full-suite green is guaranteed only at Task 5 (noted in Task 2 Step 5); per-file tests stay green earlier. Task 7 may shift a few numeric assertions (noted).
- **Placeholder honesty:** all magnitudes/base-powers are explicitly placeholder → tuned in Task 7 against the harness; not presented as final.
- **No data loss:** v2→v3 migration preserves all permanent progress; only the ephemeral party is reseeded (Task 5).
