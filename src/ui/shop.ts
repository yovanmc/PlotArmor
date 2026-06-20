// src/ui/shop.ts
import { GameState } from '../engine/state';
import { fmt } from '../engine/num';
import { REPEATABLE_UPGRADES, ONE_TIME_UPGRADES, UpgradeId, MAX_STAR, protagonistPromoteCost, legacyCost } from '../engine/content';
import { upgradeCost, canBuy, isOwned, buyUpgrade, canPromoteProtagonist, promoteProtagonist, canBuyLegacy, buyLegacy } from '../engine/prestige';

function el(id: string): HTMLElement {
  return document.getElementById(id)!;
}

function rowHtml(state: GameState, id: UpgradeId, name: string, desc: string, levelLabel: string): string {
  const control = isOwned(state, id)
    ? `<span class="shop-owned">✓ Owned</span>`
    : `<button class="shop-buy" data-action="buy" data-id="${id}" ${canBuy(state, id) ? '' : 'disabled'}>💰 ${fmt(upgradeCost(state, id))}</button>`;
  return `
    <div class="shop-row">
      <div class="shop-row-info">
        <div class="shop-row-name">${name}${levelLabel}</div>
        <div class="shop-row-desc">${desc}</div>
      </div>
      ${control}
    </div>`;
}

export function renderShop(state: GameState): void {
  const repeatable = REPEATABLE_UPGRADES
    .map((u) => rowHtml(state, u.id, u.name, u.desc, ` <span class="shop-lv">Lv ${state.upgrades[u.id]}</span>`))
    .join('');
  const oneTime = ONE_TIME_UPGRADES
    .map((u) => rowHtml(state, u.id, u.name, u.desc, ''))
    .join('');

  const protStars = state.stars.protagonist;
  const promoteControl = protStars >= MAX_STAR
    ? '<span class="shop-owned">★★★★★ Max</span>'
    : `<button class="shop-buy" data-action="promote" ${canPromoteProtagonist(state) ? '' : 'disabled'}>💰 ${fmt(protagonistPromoteCost(protStars))}</button>`;
  const protRow = `
    <div class="shop-row">
      <div class="shop-row-info">
        <div class="shop-row-name">The Protagonist <span class="shop-lv">${'★'.repeat(protStars)}${'☆'.repeat(MAX_STAR - protStars)}</span></div>
        <div class="shop-row-desc">Promote the lead: +stats and a stronger Plot Armor</div>
      </div>
      ${promoteControl}
    </div>`;

  const legacyRow = `
    <div class="shop-row">
      <div class="shop-row-info">
        <div class="shop-row-name">Legacy <span class="shop-lv">Lv ${state.legacy}</span></div>
        <div class="shop-row-desc">Spend surplus Edits: permanent +power & ability to the whole roster</div>
      </div>
      <button class="shop-buy" data-action="legacy" ${canBuyLegacy(state) ? '' : 'disabled'}>✏️ ${fmt(legacyCost(state.legacy))}</button>
    </div>`;

  el('shop-body').innerHTML = `
    <div class="shop-head">
      <span class="shop-title">Publishing House</span>
      <span class="shop-balance">💰 ${fmt(state.royalties)}</span>
    </div>
    <div class="shop-section-label">The Protagonist</div>
    ${protRow}
    <div class="shop-section-label">Legacy · ✏️ ${fmt(state.edits)}</div>
    ${legacyRow}
    <div class="shop-section-label">Upgrades</div>
    ${repeatable}
    <div class="shop-section-label">Unlocks</div>
    ${oneTime}`;
}

export function wireShop(getState: () => GameState, setState: (s: GameState) => void): void {
  const modal = el('shop-modal');

  el('shop-open').addEventListener('click', () => {
    renderShop(getState());
    modal.style.display = 'flex';
  });

  el('shop-close').addEventListener('click', () => {
    modal.style.display = 'none';
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
  });

  el('shop-body').addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('button[data-action="legacy"]')) {
      setState(buyLegacy(getState()));
      renderShop(getState());
      return;
    }
    if (target.closest('button[data-action="promote"]')) {
      setState(promoteProtagonist(getState()));
      renderShop(getState());
      return;
    }
    const btn = target.closest('button[data-action="buy"]');
    if (!btn) return;
    const id = btn.getAttribute('data-id') as UpgradeId | null;
    if (!id) return;
    setState(buyUpgrade(getState(), id));
    renderShop(getState());
  });
}
