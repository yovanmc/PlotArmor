import { describe, it, expect, beforeEach } from 'vitest';
import { initialState, makeUnlockedVariants } from '../engine/state';
import { render } from './render';
import * as num from '../engine/num';

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

  it('keeps the #shop-open button balance in sync when the button is present', () => {
    document.body.innerHTML = HTML + '<button id="shop-open"></button>';
    render({ ...initialState(0), royalties: num.n(7) });
    expect(document.getElementById('shop-open')!.textContent).toContain('💰 7');
  });

  it('does not throw when #shop-open is absent (the default fixture)', () => {
    expect(() => render(initialState(0))).not.toThrow();
  });

  it('party cards show the class name and the recruit area offers a per-class button', () => {
    render(initialState(0));
    expect(document.getElementById('party')!.textContent).toContain('The Protagonist');
    expect(document.querySelector('#party [data-action="recruit"][data-class]')).not.toBeNull();
  });
});

describe('stars + Edits UI (Slice 2)', () => {
  beforeEach(() => { document.body.innerHTML = HTML; });

  it('shows the Edits balance in the HUD', () => {
    render({ ...initialState(0), edits: num.n(12) });
    expect(document.getElementById('hud')!.textContent).toContain('Edits');
    expect(document.getElementById('hud')!.textContent).toContain('12');
  });

  it('shows star pips and a star-up button for a non-Protagonist class, but not for the Protagonist', () => {
    render({ ...initialState(0), edits: num.n('1e6') });
    const party = document.getElementById('party')!;
    expect(party.querySelector('[data-action="starup"][data-class="antihero"]')).not.toBeNull();
    expect(party.querySelector('[data-action="starup"][data-class="protagonist"]')).toBeNull();
    expect(party.textContent).toContain('★');
  });
});

describe('variant UI (Slice 3a)', () => {
  beforeEach(() => { document.body.innerHTML = HTML; });

  it('shows a skin tag and the world face when a character wears a variant', () => {
    const base = { ...initialState(0), unlockedVariants: { ...makeUnlockedVariants(), antihero: [0] } };
    base.party = base.party.map((c) => (c.classId === 'antihero' ? { ...c, variantWorld: 0 } : c));
    render(base);
    const party = document.getElementById('party')!;
    expect(party.textContent).toContain('Wild West'); // skin tag
  });

  it('offers a variant cycle button only when the class has an unlocked variant', () => {
    render(initialState(0)); // nothing unlocked
    expect(document.querySelector('#party [data-action="variant"]')).toBeNull();

    const withUnlock = { ...initialState(0), unlockedVariants: { ...makeUnlockedVariants(), antihero: [0] } };
    render(withUnlock);
    expect(document.querySelector('#party [data-action="variant"][data-id="c1"]')).not.toBeNull();
  });
});

describe('set-bonus HUD (Slice 3b)', () => {
  beforeEach(() => { document.body.innerHTML = HTML; });

  it('shows an active world set in the HUD when 2+ share a world', () => {
    const s = initialState(0);
    s.party = s.party.map((c) => ({ ...c, variantWorld: 2 })); // both starters on Space
    render(s);
    const hud = document.getElementById('hud')!.textContent!;
    expect(hud).toContain('Space');
    expect(hud).toMatch(/set/i);
  });

  it('shows no set line when nobody is in a set', () => {
    render(initialState(0)); // all base looks
    expect(document.getElementById('hud')!.textContent).not.toMatch(/set bonus/i);
  });
});

describe('Protagonist card pips (Protagonist track)', () => {
  beforeEach(() => { document.body.innerHTML = HTML; });

  it('shows star pips for the Protagonist instead of a dash', () => {
    render(initialState(0));
    const party = document.getElementById('party')!;
    expect(party.textContent).toContain('★');
    // the Protagonist card has no card-level star-up button (promotion is shop-only)
    expect(document.querySelector('#party [data-action="starup"][data-class="protagonist"]')).toBeNull();
  });
});
