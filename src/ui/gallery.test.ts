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
