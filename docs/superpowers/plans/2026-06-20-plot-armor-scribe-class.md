# The Scribe (Words-axis class) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sixth class, the **Scribe**, on the previously-uncovered **Words** ability axis — boosting manuscript Words (book tempo + royalty income) — composing cleanly with stars, affinity, set bonus, and the Legacy track.

**Architecture:** A new `AbilityKind: 'words'` and a `'scribe'` entry in the `CLASSES` catalog. `effectiveWords` folds in the Scribe's contribution the same way the other `effective*` paths fold their abilities. Because the recruit UI, the collection gallery, `stars`, and `unlockedVariants` all derive from `CLASSES`, the class wires itself in everywhere with no save-schema change. The only manual ripples are a few test assertions that hardcoded "5 classes / 40 skins."

**Tech Stack:** TypeScript (strict) + Vite + Vitest (jsdom). Big numbers behind `src/engine/num.ts`.

**Spec:** `docs/superpowers/specs/2026-06-20-plot-armor-scribe-class-design.md` (LOCKED).

---

## File Structure

| File | Responsibility | Change |
|------|----------------|--------|
| `src/engine/content.ts` | `AbilityKind`, `ClassId`, `CLASSES`, `VARIANT_UNLOCK_ORDER` | **Modify** |
| `src/engine/modifiers.ts` | `effectiveWords` folds the Scribe ability | **Modify** |
| `src/engine/content.test.ts` | class-list + unlock-order assertions | **Modify** |
| `src/ui/gallery.test.ts` | completion denominator 40 → 48 | **Modify** |
| `src/engine/balance.test.ts` | full-collection count | **Modify** |
| `src/engine/modifiers.test.ts` | Scribe raises `effectiveWords` | **Modify** |
| `README.md` | Status paragraph | **Modify** |

**Unchanged (important):** no `save.ts`/`state.ts` change (the class auto-appears in CLASSES-derived maps and is read back through existing sanitizers — pre-Scribe saves gain it at 1★/no-skins). The balance harness `COMP` stays `['debuffer','support','sidekick']` — the Scribe is intentionally NOT fielded by the greedy sim, so the loop timings do not move.

**Key facts:** `num` helpers `n`, `mul`, `gt`, `eq`. `abilitySum(party, kind, stars, zoneIndex)` and `legacyMult` are already in `modifiers.ts`. `makeCharacter(id, classId, level)` builds a party member. The Scribe placeholders mirror the support-tier classes (`classBasePower: n(0.5)`, `mag: 0.025`).

---

### Task 1: Add the Scribe to the catalog + fix the count-assumption ripples

**Files:**
- Modify: `src/engine/content.ts` (`AbilityKind` line 339; `ClassId` line 338; `CLASSES` line 354–355; `VARIANT_UNLOCK_ORDER` line 273)
- Test: `src/engine/content.test.ts`, `src/ui/gallery.test.ts`, `src/engine/balance.test.ts`

- [ ] **Step 1: Update the failing assertions first (the class doesn't exist yet, so these define the target)**

In `src/engine/content.test.ts`, change the class-id list assertion (around line 73) from:

```ts
    expect(C.CLASSES.map((c) => c.id).sort()).toEqual(
      ['antihero', 'debuffer', 'protagonist', 'sidekick', 'support'],
    );
```

to:

```ts
    expect(C.CLASSES.map((c) => c.id).sort()).toEqual(
      ['antihero', 'debuffer', 'protagonist', 'scribe', 'sidekick', 'support'],
    );
```

And add a Scribe-axis assertion inside that same `describe('content: classes', …)` block (after the existing `findClass('debuffer')` assertion):

```ts
    expect(C.findClass('scribe').ability.kind).toBe('words');
```

Change the `VARIANT_UNLOCK_ORDER` assertions (around lines 130–131) from:

```ts
    expect(VARIANT_UNLOCK_ORDER).toHaveLength(5);
    expect(new Set(VARIANT_UNLOCK_ORDER).size).toBe(5);
```

to:

```ts
    expect(VARIANT_UNLOCK_ORDER).toHaveLength(6);
    expect(new Set(VARIANT_UNLOCK_ORDER).size).toBe(6);
```

In `src/ui/gallery.test.ts`, change the completion assertion (around line 43) from:

```ts
    expect(body).toMatch(/2 \/ 40/); // 2 unlocked of 40
```

to:

```ts
    expect(body).toMatch(/2 \/ 48/); // 2 unlocked of 48 (6 classes x 8 worlds)
```

In `src/engine/balance.test.ts`, make the full-collection assertion derive from the catalog. Add `CLASSES` to the `./content` import (it currently imports `ClassId, MAX_STAR, ZONE_COUNT`):

```ts
import { CLASSES, ClassId, MAX_STAR, ZONE_COUNT } from './content';
```

Then change (around line 161):

```ts
    expect(total).toBe(5 * ZONE_COUNT);
```

to:

```ts
    expect(total).toBe(CLASSES.length * ZONE_COUNT);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd "C:/Agent Projects/PlotArmor" && npx vitest run src/engine/content.test.ts`
Expected: FAIL — no `scribe` class / unlock-order length is 5.

- [ ] **Step 3: Add the Scribe to `content.ts`**

Add `'words'` to the `AbilityKind` union (line 339):

```ts
export type AbilityKind = 'plotArmor' | 'loneWolf' | 'partyDps' | 'regenCut' | 'inspRate' | 'words';
```

Add `'scribe'` to the `ClassId` union (line 338):

```ts
export type ClassId = 'protagonist' | 'antihero' | 'support' | 'debuffer' | 'sidekick' | 'scribe';
```

Add the Scribe entry to `CLASSES` (after the `sidekick` line, before the closing `];`):

```ts
  { id: 'sidekick',    name: 'Sidekick',        classBasePower: n(0.5), ability: { kind: 'inspRate', mag: 0.025 } },
  { id: 'scribe',      name: 'Scribe',          classBasePower: n(0.5), ability: { kind: 'words', mag: 0.025 } },
];
```

Append `'scribe'` to `VARIANT_UNLOCK_ORDER` (line 273), so the Scribe earns skins last per world (existing classes' cadence unchanged):

```ts
export const VARIANT_UNLOCK_ORDER: ClassId[] = [
  'protagonist', 'antihero', 'support', 'debuffer', 'sidekick', 'scribe',
];
```

- [ ] **Step 4: Run the full suite**

Run: `cd "C:/Agent Projects/PlotArmor" && npx tsc --noEmit && npm test 2>&1 | grep -E "Test Files|Tests "`
Expected: tsc clean; all tests pass. The Scribe now exists in the catalog (recruit UI, gallery, `stars`, `unlockedVariants` all include it automatically). Its `'words'` ability is inert until Task 2 (nothing reads it yet), so no fielded-Scribe test fails, and the balance harness still closes (the Scribe is not in `COMP`, so timings are unchanged; the full collection reaches `6 × 8 = 48` within 8 books).

- [ ] **Step 5: Commit**

```bash
git add src/engine/content.ts src/engine/content.test.ts src/ui/gallery.test.ts src/engine/balance.test.ts
git commit -m "feat: add the Scribe class (Words axis) to the catalog"
```

---

### Task 2: Wire the Scribe ability into `effectiveWords`

**Files:**
- Modify: `src/engine/modifiers.ts` (`effectiveWords`)
- Test: `src/engine/modifiers.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/engine/modifiers.test.ts` (`makeCharacter` and `targetWords` are already imported):

```ts
describe('Scribe (Words-axis class)', () => {
  it('a fielded Scribe raises effectiveWords above the same party without it', () => {
    const base = initialState(0);
    const withScribe = { ...base, party: [...base.party, makeCharacter('w', 'scribe', 10)] };
    expect(num.gt(M.effectiveWords(withScribe, 0, 0), M.effectiveWords(base, 0, 0))).toBe(true);
  });

  it('is neutral with no Scribe fielded — effectiveWords equals the raw curve at book 1', () => {
    expect(num.eq(M.effectiveWords(initialState(0), 0, 0), targetWords(0, 0))).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "C:/Agent Projects/PlotArmor" && npx vitest run src/engine/modifiers.test.ts`
Expected: FAIL on the first test — the Scribe's ability isn't read by `effectiveWords` yet (with-Scribe equals without-Scribe). The second passes (and stays valid).

- [ ] **Step 3: Fold the Scribe ability into `effectiveWords`**

Replace:

```ts
export function effectiveWords(s: GameState, zoneIndex: number, encounterIndex: number): Num {
  const setMult = activeSetBonus(s.party).wordsMult;
  return mul(mul(mul(targetWords(zoneIndex, encounterIndex), bookDifficulty(s)), n(pageTurnerMult(s))), n(setMult));
}
```

with:

```ts
export function effectiveWords(s: GameState, zoneIndex: number, encounterIndex: number): Num {
  const scribeMult = 1 + abilitySum(s.party, 'words', s.stars, zoneIndex) * legacyMult(s.legacy);
  const setMult = activeSetBonus(s.party).wordsMult;
  return mul(mul(mul(mul(targetWords(zoneIndex, encounterIndex), bookDifficulty(s)), n(pageTurnerMult(s))), n(scribeMult)), n(setMult));
}
```

(`abilitySum` and `legacyMult` are already in scope in `modifiers.ts`.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "C:/Agent Projects/PlotArmor" && npx vitest run src/engine/modifiers.test.ts`
Expected: PASS (the new tests + all existing — the book-1 parity test still holds because no Scribe is fielded in `initialState`, so `scribeMult` is 1).

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/engine/modifiers.ts src/engine/modifiers.test.ts
git commit -m "feat: Scribe boosts effectiveWords (composes with stars/affinity/legacy)"
```

---

### Task 3: Verify, docs, ship

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Confirm balance + full suite + build**

Run: `cd "C:/Agent Projects/PlotArmor" && npx vitest run src/engine/balance.test.ts 2>&1 | grep -E "Tests " && npm test 2>&1 | grep -E "Test Files|Tests " && npm run build 2>&1 | tail -2`
Expected: balance 3 pass (books 1–8 still complete; timings unchanged since the Scribe isn't fielded by the harness); full suite green (183 prior + ~4 new = ~187 — report the exact number); `✓ built`.

- [ ] **Step 2: Update the README Status section**

In `README.md`, after the star-prestige paragraph, add:

```markdown
A sixth class joins the roster: the **Scribe**, on the one ability axis no class touched before —
**Words**. A fielded Scribe boosts manuscript output, which both finishes books faster and raises the
royalty payout (royalties scale with words written). Because the party cap is 5 and there are now six
classes, you finally have to choose which five to field — a real composition decision. It composes with
everything already built (stars, zone affinity, set bonus, and the Legacy multiplier all flow through the
same ability path). No save change — existing games gain the Scribe at 1★ automatically. All
headless-tested plus a live DOM smoke; `npm run build` is green. The Scribe's magnitudes are tunable
placeholders for the upcoming feel pass.
```

Add the plan link to the "Plans:" list (after the star-prestige link):

```markdown
[star-prestige](docs/superpowers/plans/2026-06-20-plot-armor-star-prestige.md) ·
[Scribe class](docs/superpowers/plans/2026-06-20-plot-armor-scribe-class.md).
```

And add the spec link to the "Specs:" list (after the star-prestige design link):

```markdown
[star-prestige design](docs/superpowers/specs/2026-06-20-plot-armor-star-prestige-design.md) ·
[Scribe class design](docs/superpowers/specs/2026-06-20-plot-armor-scribe-class-design.md).
```

- [ ] **Step 3: Commit and push**

```bash
git add README.md
git commit -m "docs: README status for the Scribe class"
git push origin main
```

Report the final `npm test` count, the `npm run build` size line, and the pushed commit range.

---

## Notes for the controller (post-implementation)

- After Task 3, dispatch a final whole-feature review over the Scribe commit range, then update memory (`project_plotarmor.md` + the `MEMORY.md` index line), and report — then this completes both depth extras, leaving the tuning/feel pass.
- Live DOM smoke (built `dist/`, served via `plotarmor-dist`): the recruit card should now offer a Scribe button (5 recruitable classes); inject a save / recruit so a Scribe is fielded, confirm its card renders (name "Scribe", ✍️ base face), open the Collection gallery and confirm a 6th character row and an `N / 48` completion denominator, and confirm Words income (📖 Words in the HUD) rises with a Scribe vs without. 0 console errors. Restore the test save afterward. Pixel screenshots remain uncapturable — verify via `preview_eval` DOM reads.
