import { describe, it, expect, beforeEach } from 'vitest';
import { initialState } from '../engine/state';
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
});
