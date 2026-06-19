// src/engine/prestige.ts
import { Num, n, ONE, sub, mul, div, pow, gte, maxN, floorN } from './num';
import { GameState } from './state';
import { findUpgrade, UpgradeId, ROYALTY_K, ROYALTY_W0 } from './content';

export function upgradeCost(state: GameState, id: UpgradeId): Num {
  const def = findUpgrade(id);
  if (def.kind === 'oneTime') return def.cost;
  const level = state.upgrades[def.id]; // repeatable -> current level (number)
  return mul(def.baseCost, pow(n(def.costGrowth), level));
}

export function isOwned(state: GameState, id: UpgradeId): boolean {
  const def = findUpgrade(id);
  return def.kind === 'oneTime' ? state.upgrades[def.id] === true : false;
}

export function canBuy(state: GameState, id: UpgradeId): boolean {
  if (isOwned(state, id)) return false;
  return gte(state.royalties, upgradeCost(state, id));
}

export function buyUpgrade(state: GameState, id: UpgradeId): GameState {
  if (!canBuy(state, id)) return state;
  const def = findUpgrade(id);
  const royalties = sub(state.royalties, upgradeCost(state, id));
  if (def.kind === 'oneTime') {
    return { ...state, royalties, upgrades: { ...state.upgrades, [def.id]: true } };
  }
  return { ...state, royalties, upgrades: { ...state.upgrades, [def.id]: state.upgrades[def.id] + 1 } };
}

// Royalty payout for publishing a book: floor(K * sqrt(words / W0)), minimum 1.
export function royaltiesForBook(wordsThisBook: Num): Num {
  const root = pow(div(wordsThisBook, ROYALTY_W0), 0.5); // sqrt via fractional pow
  return maxN(floorN(mul(ROYALTY_K, root)), ONE);
}
