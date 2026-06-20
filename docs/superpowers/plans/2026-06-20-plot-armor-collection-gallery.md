# Collection Gallery + Skin Loadout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `🎴 Collection` modal (master-detail) that shows the full 5×8 `(class × world)` skin collection with completion and lets you equip any unlocked skin per fielded character, replacing the per-card 🎭 cycle button.

**Architecture:** A new `src/ui/gallery.ts` (`renderGallery` + `wireGallery`) mirrors `src/ui/shop.ts` exactly — a modal opened from a button, delegated click handling, `getState`/`setState`. Equipping **reuses the existing engine `setVariant(state, characterId, world)`** by resolving the selected class to its fielded character. **UI-only: no engine change, no save-schema change, zero balance impact.**

**Tech Stack:** TypeScript (strict) + Vite + Vitest (jsdom). DOM/CSS render layer over the pure engine.

**Spec:** `docs/superpowers/specs/2026-06-19-plot-armor-party-system-design.md` §8 (LOCKED).

---

## File Structure

| File | Responsibility | Change |
|------|----------------|--------|
| `src/ui/gallery.ts` | Collection modal: render + wire | **Create** |
| `src/ui/gallery.test.ts` | Gallery unit tests (jsdom) | **Create** |
| `index.html` | `🎴 Collection` button + `#collection-modal` | **Modify** |
| `src/styles.css` | Gallery styles (dark battle theme) | **Modify** |
| `src/main.ts` | Call `wireGallery` | **Modify** |
| `src/ui/render.ts` | Remove the 🎭 cycle button + its now-unused `unlockedWorldsFor` import | **Modify** |
| `src/ui/input.ts` | Remove the `data-action="variant"` branch + its now-unused `setVariant` import | **Modify** |
| `src/ui/render.test.ts` | Remove the obsolete cycle-button test | **Modify** |
| `README.md` | Status paragraph | **Modify** |

**Unchanged (important):** the engine `src/engine/variants.ts` is NOT touched — `setVariant` and `unlockedWorldsFor` stay exported (the latter is still covered by `variants.test.ts`). No `save.ts`/`state.ts`/`modifiers.ts` change.

**Key facts the implementer needs:**
- `CLASSES` (order: `protagonist, antihero, support, debuffer, sidekick`) each `{ id, name, ... }`. `ClassId` union. `MAX_STAR === 5`.
- `WORLD_FACE: string[]` (8 faces), `worldGenre(w): string`, `ZONES[w].accent` (per-world hex). 8 worlds total = `WORLD_FACE.length`.
- `GameState`: `unlockedVariants: Record<ClassId, number[]>`, `stars: Record<ClassId, number>`, `party: Character[]`. `Character`: `{ id, classId, variantWorld: number|null, ... }`.
- `setVariant(state, characterId, worldIndex|null): GameState` — equips only if that class has unlocked the world (non-null); `null` (base) always allowed; returns same ref on no-op.
- The shop modal pattern to mirror is in `src/ui/shop.ts` (`renderShop`/`wireShop`) and `index.html` (`#shop-modal`).
- Test fixture pattern: `shop.test.ts` / `render.test.ts` inject `document.body.innerHTML` in `beforeEach`.

---

### Task 1: The gallery module (`gallery.ts`) + tests

**Files:**
- Create: `src/ui/gallery.ts`
- Create: `src/ui/gallery.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/ui/gallery.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { initialState, makeCharacter, makeUnlockedVariants, GameState } from '../engine/state';
import { renderGallery, wireGallery } from './gallery';

const HTML = `
  <button id="collection-open"></button>
  <div id="collection-modal" class="modal">
    <div class="modal-card">
      <div id="collection-body"></div>
      <button id="collection-close"></button>
    </div>
  </div>
`;

// Wires the gallery over a mutable state and opens the modal (which renders it).
// Use this for any test that CLICKS a row/tile — clicks only work once wireGallery
// has attached the delegated listener. `select`/`equip` re-render via the handler.
function open(initial: GameState) {
  let state = initial;
  const getState = () => state;
  const setState = (s: GameState) => { state = s; };
  wireGallery(getState, setState);
  document.getElementById('collection-open')!.click(); // renders into #collection-body
  return { getState, setState };
}

function selectClass(classId: string) {
  document.querySelector<HTMLElement>(`[data-action="select"][data-class="${classId}"]`)!.click();
}

describe('collection gallery', () => {
  beforeEach(() => { document.body.innerHTML = HTML; });

  it('lists all five characters and the completion count', () => {
    const s = { ...initialState(0), unlockedVariants: { ...makeUnlockedVariants(), antihero: [0, 1] } };
    renderGallery(s); // no clicks needed -> direct render is fine
    const body = document.getElementById('collection-body')!.textContent!;
    expect(body).toContain('The Protagonist');
    expect(body).toContain('Anti-hero');
    expect(body).toContain('Support');
    expect(body).toContain('Debuffer');
    expect(body).toContain('Sidekick');
    expect(body).toMatch(/2 \/ 40/); // 2 unlocked of 40
  });

  it('renders a Base tile plus eight world tiles in the detail pane', () => {
    renderGallery(initialState(0));
    const tiles = document.querySelectorAll('#collection-body [data-action="equip"]');
    expect(tiles.length).toBe(9); // base + 8 worlds, for whichever class is selected
  });

  it('disables locked world tiles and enables unlocked ones for a fielded class', () => {
    // antihero (fielded as c1) has world 0 unlocked, world 3 locked
    const s = { ...initialState(0), unlockedVariants: { ...makeUnlockedVariants(), antihero: [0] } };
    open(s);
    selectClass('antihero');
    const w0 = document.querySelector<HTMLButtonElement>('#collection-body [data-action="equip"][data-world="0"]')!;
    const w3 = document.querySelector<HTMLButtonElement>('#collection-body [data-action="equip"][data-world="3"]')!;
    expect(w0.disabled).toBe(false);
    expect(w3.disabled).toBe(true);
  });

  it('selecting a class swaps the detail pane to that class', () => {
    open(initialState(0));
    selectClass('protagonist'); // select explicitly — module-local selection may carry over between tests
    expect(document.querySelector('#collection-body .gal-detail-head')!.textContent).toContain('The Protagonist');
    selectClass('support');
    expect(document.querySelector('#collection-body .gal-detail-head')!.textContent).toContain('Support');
  });

  it('clicking an unlocked world tile equips that skin on the fielded character', () => {
    const s = { ...initialState(0), unlockedVariants: { ...makeUnlockedVariants(), antihero: [2] } };
    const { getState } = open(s);
    selectClass('antihero');
    document.querySelector<HTMLButtonElement>('#collection-body [data-action="equip"][data-world="2"]')!.click();
    expect(getState().party.find((c) => c.classId === 'antihero')!.variantWorld).toBe(2);
  });

  it('clicking the Base tile equips the base look (null)', () => {
    const start = {
      ...initialState(0),
      unlockedVariants: { ...makeUnlockedVariants(), antihero: [2] },
      party: [makeCharacter('c0', 'protagonist'), { ...makeCharacter('c1', 'antihero'), variantWorld: 2 }],
    };
    const { getState } = open(start);
    selectClass('antihero');
    document.querySelector<HTMLButtonElement>('#collection-body [data-action="equip"][data-world="base"]')!.click();
    expect(getState().party.find((c) => c.classId === 'antihero')!.variantWorld).toBeNull();
  });

  it('disables equipping for a class that is not in the party', () => {
    // a fresh party is [protagonist, antihero]; support is not fielded
    const s = { ...initialState(0), unlockedVariants: { ...makeUnlockedVariants(), support: [0] } };
    open(s);
    selectClass('support');
    const w0 = document.querySelector<HTMLButtonElement>('#collection-body [data-action="equip"][data-world="0"]')!;
    expect(w0.disabled).toBe(true); // unlocked but not fielded -> cannot equip
    expect(document.getElementById('collection-body')!.textContent).toMatch(/recruit/i);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "C:/Agent Projects/PlotArmor" && npx vitest run src/ui/gallery.test.ts`
Expected: FAIL — `./gallery` does not exist.

- [ ] **Step 3: Create `src/ui/gallery.ts`**

```ts
// src/ui/gallery.ts
import { GameState, Character } from '../engine/state';
import { CLASSES, ClassId, MAX_STAR, WORLD_FACE, worldGenre, ZONES } from '../engine/content';
import { setVariant } from '../engine/variants';

const WORLD_COUNT = WORLD_FACE.length;

// Which class the detail pane is showing. Module-local UI state, preserved across
// re-renders (equipping re-renders but keeps you on the same character).
let selectedClass: ClassId = 'protagonist';

function el(id: string): HTMLElement {
  return document.getElementById(id)!;
}

function fieldedOf(state: GameState, classId: ClassId): Character | undefined {
  return state.party.find((c) => c.classId === classId);
}

function pips(n: number): string {
  return '★'.repeat(n) + '☆'.repeat(MAX_STAR - n);
}

export function renderGallery(state: GameState): void {
  const collected = CLASSES.reduce((sum, c) => sum + state.unlockedVariants[c.id].length, 0);
  const total = CLASSES.length * WORLD_COUNT;

  const list = CLASSES.map((c) => {
    const fielded = fieldedOf(state, c.id);
    const face = fielded && fielded.variantWorld !== null ? WORLD_FACE[fielded.variantWorld] : '✍️';
    const count = state.unlockedVariants[c.id].length;
    const sel = c.id === selectedClass ? ' gal-row-sel' : '';
    return `
      <div class="gal-row${sel}" data-action="select" data-class="${c.id}">
        <span class="gal-face">${face}</span>
        <span class="gal-row-info">
          <span class="gal-name">${c.name}</span>
          <span class="gal-stars">${pips(state.stars[c.id])}</span>
        </span>
        <span class="gal-count">${count}/${WORLD_COUNT}</span>
      </div>`;
  }).join('');

  const sel = CLASSES.find((c) => c.id === selectedClass)!;
  const fielded = fieldedOf(state, selectedClass);
  const worn = fielded ? fielded.variantWorld : null;
  const unlocked = state.unlockedVariants[selectedClass];

  const baseWorn = !!fielded && worn === null;
  const baseTile = `
    <button class="gal-tile${baseWorn ? ' gal-tile-worn' : ''}" data-action="equip" data-world="base" ${fielded ? '' : 'disabled'}>
      <span class="gal-tile-face">✍️</span>
      <span class="gal-tile-label">Base</span>
      ${baseWorn ? '<span class="gal-spark">✨</span>' : ''}
    </button>`;

  const worldTiles = WORLD_FACE.map((face, w) => {
    const isUnlocked = unlocked.includes(w);
    const isWorn = !!fielded && worn === w;
    const canEquip = isUnlocked && !!fielded;
    return `
      <button class="gal-tile${isUnlocked ? '' : ' gal-tile-locked'}${isWorn ? ' gal-tile-worn' : ''}"
              data-action="equip" data-world="${w}" ${canEquip ? '' : 'disabled'}
              ${isUnlocked ? `style="border-color:${ZONES[w].accent}"` : ''}>
        <span class="gal-tile-face">${face}</span>
        <span class="gal-tile-label">${worldGenre(w)}</span>
        ${isUnlocked ? '' : '<span class="gal-lock">🔒</span>'}
        ${isWorn ? '<span class="gal-spark">✨</span>' : ''}
      </button>`;
  }).join('');

  const caption = !fielded
    ? `Recruit the ${sel.name} to wear its skins.`
    : worn === null
      ? `Wearing the base look — no zone affinity.`
      : `Wearing ${worldGenre(worn)} ${WORLD_FACE[worn]} — in element in ${worldGenre(worn)} zones.`;

  el('collection-body').innerHTML = `
    <div class="gal-head">
      <span class="gal-title">Collection</span>
      <span class="gal-completion">${collected} / ${total} skins</span>
    </div>
    <div class="gal-bar"><div class="gal-bar-fill" style="width:${total ? (collected / total) * 100 : 0}%"></div></div>
    <div class="gal-body">
      <div class="gal-list">${list}</div>
      <div class="gal-detail">
        <div class="gal-detail-head">${sel.name} <span class="gal-stars">${pips(state.stars[selectedClass])}</span></div>
        <div class="gal-tiles">${baseTile}${worldTiles}</div>
        <div class="gal-caption">${caption}</div>
      </div>
    </div>`;
}

export function wireGallery(getState: () => GameState, setState: (s: GameState) => void): void {
  const modal = el('collection-modal');

  el('collection-open').addEventListener('click', () => {
    renderGallery(getState());
    modal.style.display = 'flex';
  });

  el('collection-close').addEventListener('click', () => {
    modal.style.display = 'none';
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
  });

  el('collection-body').addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    const selBtn = target.closest('[data-action="select"]');
    if (selBtn) {
      selectedClass = selBtn.getAttribute('data-class') as ClassId;
      renderGallery(getState());
      return;
    }

    const equipBtn = target.closest('button[data-action="equip"]') as HTMLButtonElement | null;
    if (!equipBtn || equipBtn.disabled) return;
    const fielded = getState().party.find((c) => c.classId === selectedClass);
    if (!fielded) return;
    const worldAttr = equipBtn.getAttribute('data-world');
    const world = worldAttr === 'base' ? null : Number(worldAttr);
    setState(setVariant(getState(), fielded.id, world));
    renderGallery(getState());
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "C:/Agent Projects/PlotArmor" && npx vitest run src/ui/gallery.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Typecheck**

Run: `cd "C:/Agent Projects/PlotArmor" && npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 6: Commit**

```bash
git add src/ui/gallery.ts src/ui/gallery.test.ts
git commit -m "feat: collection gallery + skin loadout module (master-detail)"
```

---

### Task 2: Wire the gallery into the app shell

**Files:**
- Modify: `index.html` (add button after `#shop-open` line 14; add modal after `#shop-modal` block)
- Modify: `src/styles.css` (append gallery styles)
- Modify: `src/main.ts` (import + call `wireGallery`)

- [ ] **Step 1: Add the button + modal to `index.html`**

Change the `#shop-open` line (line 14) from:

```html
    <button id="shop-open" class="shop-open-btn">📖 Publishing House</button>
```

to (add the Collection button right after it):

```html
    <button id="shop-open" class="shop-open-btn">📖 Publishing House</button>
    <button id="collection-open" class="collection-open-btn">🎴 Collection</button>
```

Then add a new modal right after the `#shop-modal` block (after its closing `</div>` on line 31), before `<script type="module" ...>`:

```html
    <div id="collection-modal" class="modal">
      <div class="modal-card gal-card">
        <div id="collection-body"></div>
        <button id="collection-close" class="gal-close-btn">Close</button>
      </div>
    </div>
```

- [ ] **Step 2: Append gallery styles to `src/styles.css`**

Add at the end of the file:

```css
/* Collection gallery — dark battle theme (cyan), master-detail */
.collection-open-btn { display: block; margin: 0.6rem auto 0; }
.gal-card { background: #161b29; border: 1px solid var(--accent); max-width: 580px; width: 94%; text-align: left; }
.gal-head { display: flex; justify-content: space-between; align-items: baseline; }
.gal-title { font-size: 1.15rem; font-weight: 700; }
.gal-completion { font-size: 0.95rem; opacity: 0.85; }
.gal-bar { height: 6px; background: #ffffff14; border-radius: 3px; overflow: hidden; margin: 0.4rem 0 0.9rem; }
.gal-bar-fill { height: 100%; background: var(--accent); }
.gal-body { display: flex; gap: 1rem; flex-wrap: wrap; }
.gal-list { flex: 1 1 200px; min-width: 190px; display: flex; flex-direction: column; gap: 0.4rem; }
.gal-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.45rem; border-radius: 8px; background: #ffffff08; border: 1px solid #ffffff12; cursor: pointer; }
.gal-row-sel { background: #5ad7ff1f; border-color: var(--accent); }
.gal-face { font-size: 1.4rem; }
.gal-row-info { flex: 1; min-width: 0; }
.gal-name { display: block; font-weight: 600; font-size: 0.9rem; }
.gal-stars { color: #d9a441; font-size: 0.8rem; letter-spacing: 1px; }
.gal-count { font-size: 0.8rem; opacity: 0.7; }
.gal-detail { flex: 2 1 300px; min-width: 280px; }
.gal-detail-head { font-weight: 700; margin-bottom: 0.6rem; }
.gal-tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; }
.gal-tile { position: relative; background: #ffffff0a; border: 1px solid #ffffff14; border-radius: 8px; padding: 0.5rem 0.25rem; display: flex; flex-direction: column; align-items: center; gap: 0.2rem; color: #eee; }
.gal-tile-face { font-size: 1.5rem; }
.gal-tile-label { font-size: 0.7rem; opacity: 0.85; text-align: center; }
.gal-tile-locked { opacity: 0.32; }
.gal-tile-worn { outline: 2px solid var(--accent); border-color: var(--accent); }
.gal-lock { position: absolute; bottom: 2px; right: 4px; font-size: 0.7rem; }
.gal-spark { position: absolute; top: -7px; right: -5px; font-size: 0.85rem; }
.gal-caption { font-size: 0.8rem; opacity: 0.8; margin-top: 0.7rem; line-height: 1.4; }
.gal-close-btn { display: block; margin: 1rem auto 0; }
```

- [ ] **Step 3: Call `wireGallery` in `src/main.ts`**

Change the import line 10 from:

```ts
import { wireShop } from './ui/shop';
```

to:

```ts
import { wireShop } from './ui/shop';
import { wireGallery } from './ui/gallery';
```

Then add the call right after the `wireShop(...)` line (line 27):

```ts
  wireShop(getState, setState);
  wireGallery(getState, setState);
```

- [ ] **Step 4: Typecheck + build**

Run: `cd "C:/Agent Projects/PlotArmor" && npx tsc --noEmit && npm run build 2>&1 | tail -2`
Expected: tsc clean; `✓ built`.

- [ ] **Step 5: Commit**

```bash
git add index.html src/styles.css src/main.ts
git commit -m "feat: wire Collection modal into the app shell"
```

---

### Task 3: Remove the per-card 🎭 cycle button (the gallery replaces it)

**Files:**
- Modify: `src/ui/render.ts` (remove the `variantBtn` block + its usage + the `unlockedWorldsFor` import)
- Modify: `src/ui/input.ts` (remove the `data-action="variant"` branch + the `setVariant` import)
- Modify: `src/ui/render.test.ts` (remove the obsolete cycle-button test)

- [ ] **Step 1: Remove the cycle button from `render.ts`**

Delete this block (currently lines 76–83):

```ts
      const worlds = unlockedWorldsFor(state, c.classId);
      let variantBtn = '';
      if (worlds.length > 0) {
        const cycle: (number | null)[] = [null, ...worlds];
        const idx = cycle.findIndex((w) => w === c.variantWorld);
        const next = cycle[(idx + 1) % cycle.length];
        variantBtn = `<button data-action="variant" data-id="${c.id}" data-next="${next === null ? 'base' : next}">🎭 Skin</button>`;
      }
```

And remove the `${variantBtn}` line from the card markup (currently line 95):

```ts
        ${starBtn}
        ${variantBtn}
      </div>`;
```

becomes:

```ts
        ${starBtn}
      </div>`;
```

- [ ] **Step 2: Drop the now-unused `unlockedWorldsFor` import in `render.ts`**

Change the variants import (line 9) from:

```ts
import { unlockedWorldsFor, setBonusBreakdown, isInElement } from '../engine/variants';
```

to:

```ts
import { setBonusBreakdown, isInElement } from '../engine/variants';
```

- [ ] **Step 3: Remove the variant branch + import in `input.ts`**

Delete this branch (currently lines 22–26):

```ts
    } else if (action === 'variant') {
      const id = btn.getAttribute('data-id');
      const next = btn.getAttribute('data-next');
      if (id) setState(setVariant(getState(), id, next === 'base' || next === null ? null : Number(next)));
    }
```

so the chain ends at the `starup` branch:

```ts
    } else if (action === 'starup') {
      const classId = btn.getAttribute('data-class');
      if (classId) setState(starUp(getState(), classId as ClassId));
    }
```

And remove the now-unused import (line 4):

```ts
import { setVariant } from '../engine/variants';
```

(delete that line entirely).

- [ ] **Step 4: Remove the obsolete cycle-button test in `render.test.ts`**

Delete this test (currently lines 76–83) inside the `describe('variant UI (Slice 3a)', …)` block:

```ts
  it('offers a variant cycle button only when the class has an unlocked variant', () => {
    render(initialState(0)); // nothing unlocked
    expect(document.querySelector('#party [data-action="variant"]')).toBeNull();

    const withUnlock = { ...initialState(0), unlockedVariants: { ...makeUnlockedVariants(), antihero: [0] } };
    render(withUnlock);
    expect(document.querySelector('#party [data-action="variant"][data-id="c1"]')).not.toBeNull();
  });
```

Keep the sibling test "shows a skin tag and the world face when a character wears a variant" — the card still shows the worn skin. If removing the test leaves `makeUnlockedVariants` unused in `render.test.ts`, check the other tests first: it is still used by the `describe('variant UI …')` skin-tag test (`unlockedVariants: { ...makeUnlockedVariants(), antihero: [0] }`) and the set-bonus tests, so the import stays. If `tsc`/vitest reports it unused after your edit, remove it from the import; otherwise leave it.

- [ ] **Step 5: Typecheck + run the affected tests**

Run: `cd "C:/Agent Projects/PlotArmor" && npx tsc --noEmit && npx vitest run src/ui/render.test.ts`
Expected: tsc clean; render tests pass (cycle-button test gone, skin-tag + affinity + set-bonus tests still pass).

- [ ] **Step 6: Full suite**

Run: `cd "C:/Agent Projects/PlotArmor" && npm test 2>&1 | grep -E "Test Files|Tests "`
Expected: all pass — 163 prior − 1 removed cycle-button test + 7 new gallery tests = **169**.

- [ ] **Step 7: Commit**

```bash
git add src/ui/render.ts src/ui/input.ts src/ui/render.test.ts
git commit -m "refactor: remove per-card skin cycle button (gallery replaces it)"
```

---

### Task 4: Verify, docs, ship

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Confirm balance + build are unaffected**

Run: `cd "C:/Agent Projects/PlotArmor" && npx vitest run src/engine/balance.test.ts 2>&1 | grep -E "Tests " && npm run build 2>&1 | tail -2`
Expected: balance 3 tests pass (UI-only change cannot affect the engine harness); `✓ built`.

- [ ] **Step 2: Update the README Status section**

In `README.md`, after the Slice 4 (zone affinity) paragraph (the one ending "The affinity magnitude is a tunable placeholder."), add:

```markdown
The skins finally get a home: a **Collection screen (§8 of the party system)**. A `🎴 Collection`
button opens a master-detail modal — your five characters on the left (each with its worn skin, star
tier, and worlds-collected count and a `N / 40` completion bar), and the selected character's full set
of world skins on the right (unlocked ones in the world's accent, locked ones dimmed with 🔒, the worn
one ringed). Click any unlocked skin to equip it on that character — this replaces the old per-card
cycle button, which matters now that zone affinity makes skin choice strategic. It's a pure UI layer
over the existing data (no save change, no balance impact). All headless-tested (169 passing tests)
plus a live DOM smoke; `npm run build` is green.
```

Then add the plan link to the "Plans:" list — append after the Slice 4 link:

```markdown
[party Slice 4](docs/superpowers/plans/2026-06-19-plot-armor-party-slice4.md) ·
[collection gallery](docs/superpowers/plans/2026-06-20-plot-armor-collection-gallery.md).
```

(replace the period after the Slice 4 link with ` ·` and add the new link + final period).

- [ ] **Step 3: Commit and push**

```bash
git add README.md
git commit -m "docs: README status for the collection gallery"
git push origin main
```

Report the final `npm test` count, the `npm run build` size line, and the pushed commit range.

---

## Notes for the controller (post-implementation)

- After Task 4, dispatch a final whole-feature review over the gallery commit range, then update memory (`project_plotarmor.md` + the `MEMORY.md` index line), and report.
- Live DOM smoke (built `dist/`, served via the `plotarmor-dist` preview config): open the page, inject a save with some `unlockedVariants` for a fielded class, then drive the gallery via `preview_eval` synchronous DOM ops — click `#collection-open`, click a `[data-action="select"]` row, click an unlocked `[data-action="equip"]` tile, and confirm (a) the completion count, (b) the worn tile gets the ✨/ring, (c) the underlying battle card's skin updates, and (d) 0 console errors. Restore the test save afterward. Pixel screenshots remain uncapturable in the headless tab — verify via DOM reads, consistent with prior slices.
