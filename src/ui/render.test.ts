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
