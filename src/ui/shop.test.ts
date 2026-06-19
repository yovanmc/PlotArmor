// src/ui/shop.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as num from '../engine/num';
import { initialState, emptyUpgrades, GameState } from '../engine/state';
import { REPEATABLE_UPGRADES, ONE_TIME_UPGRADES } from '../engine/content';
import { renderShop, wireShop } from './shop';

const FIXTURE = `
  <button id="shop-open"></button>
  <div id="shop-modal" class="modal">
    <div class="modal-card shop-card">
      <div id="shop-body"></div>
      <button id="shop-close"></button>
    </div>
  </div>`;

beforeEach(() => { document.body.innerHTML = FIXTURE; });

describe('renderShop', () => {
  it('renders a row for every upgrade (6 repeatable + 2 one-time) with the balance', () => {
    renderShop({ ...initialState(0), royalties: num.n(12) });
    const body = document.getElementById('shop-body')!;
    expect(body.textContent).toContain('Publishing House');
    expect(body.textContent).toContain('💰 12');
    expect(body.querySelectorAll('.shop-row').length).toBe(REPEATABLE_UPGRADES.length + ONE_TIME_UPGRADES.length);
    expect(body.textContent).toContain('Prolific');
    expect(body.textContent).toContain('Ensemble Cast');
  });

  it('disables buy buttons the player cannot afford', () => {
    renderShop({ ...initialState(0), royalties: num.ZERO });
    const buyButtons = document.querySelectorAll<HTMLButtonElement>('.shop-buy');
    expect(buyButtons.length).toBeGreaterThan(0);
    expect([...buyButtons].every((b) => b.disabled)).toBe(true);
  });

  it('enables affordable buy buttons', () => {
    renderShop({ ...initialState(0), royalties: num.n('1e9') });
    const buyButtons = document.querySelectorAll<HTMLButtonElement>('.shop-buy');
    expect([...buyButtons].some((b) => !b.disabled)).toBe(true);
  });

  it('shows owned (no buy button) for an owned one-time unlock', () => {
    renderShop({ ...initialState(0), royalties: num.n('1e9'), upgrades: { ...emptyUpgrades(), ensembleCast: true } });
    const body = document.getElementById('shop-body')!;
    expect(body.textContent).toContain('Owned');
    expect(document.querySelector('button[data-id="ensembleCast"]')).toBeNull();
  });
});

describe('wireShop', () => {
  it('opens and closes the modal', () => {
    let state: GameState = { ...initialState(0), royalties: num.n('1e9') };
    wireShop(() => state, (s) => { state = s; });
    const modal = document.getElementById('shop-modal')!;
    document.getElementById('shop-open')!.click();
    expect(modal.style.display).toBe('flex');
    document.getElementById('shop-close')!.click();
    expect(modal.style.display).toBe('none');
  });

  it('buying an upgrade calls setState with the purchase applied', () => {
    let state: GameState = { ...initialState(0), royalties: num.n('1e9') };
    const setState = vi.fn((s: GameState) => { state = s; });
    wireShop(() => state, setState);
    document.getElementById('shop-open')!.click(); // renders the rows
    const prolificBtn = document.querySelector<HTMLButtonElement>('button[data-id="prolific"]')!;
    prolificBtn.click();
    expect(setState).toHaveBeenCalled();
    expect(state.upgrades.prolific).toBe(1);
    expect(num.lt(state.royalties, num.n('1e9'))).toBe(true);
  });
});
