// src/engine/prestige.test.ts
import { describe, it, expect } from 'vitest';
import * as num from './num';
import { initialState, emptyUpgrades } from './state';
import * as P from './prestige';

const rich = () => ({ ...initialState(0), royalties: num.n(1000) });

describe('prestige: costs', () => {
  it('repeatable cost grows geometrically with current level', () => {
    const s0 = rich();
    const s1 = { ...s0, upgrades: { ...emptyUpgrades(), prolific: 1 } };
    expect(num.gt(P.upgradeCost(s1, 'prolific'), P.upgradeCost(s0, 'prolific'))).toBe(true);
  });
  it('one-time cost is the fixed catalog cost', () => {
    expect(num.eq(P.upgradeCost(rich(), 'ghostwriter'), num.n(15))).toBe(true);
  });
});

describe('prestige: canBuy / buyUpgrade', () => {
  it('buys a repeatable upgrade: spends royalties, increments level', () => {
    const s = rich();
    const cost = P.upgradeCost(s, 'prolific');
    const next = P.buyUpgrade(s, 'prolific');
    expect(next.upgrades.prolific).toBe(1);
    expect(num.eq(next.royalties, num.sub(num.n(1000), cost))).toBe(true);
  });
  it('buys a one-time unlock: sets the flag, cannot be bought twice', () => {
    const s = P.buyUpgrade(rich(), 'ensembleCast');
    expect(s.upgrades.ensembleCast).toBe(true);
    expect(P.canBuy(s, 'ensembleCast')).toBe(false);
    expect(P.buyUpgrade(s, 'ensembleCast')).toBe(s); // no-op, same ref
  });
  it('is a no-op (same ref) when unaffordable', () => {
    const broke = { ...initialState(0), royalties: num.ZERO };
    expect(P.canBuy(broke, 'prolific')).toBe(false);
    expect(P.buyUpgrade(broke, 'prolific')).toBe(broke);
  });
});

describe('prestige: royaltiesForBook faucet', () => {
  it('is monotonic in manuscript size with a floor of 1', () => {
    expect(num.eq(P.royaltiesForBook(num.ZERO), num.ONE)).toBe(true);
    expect(num.gte(P.royaltiesForBook(num.n('1e6')), P.royaltiesForBook(num.n('1e4')))).toBe(true);
    expect(num.gt(P.royaltiesForBook(num.n('1e8')), num.ONE)).toBe(true);
  });
});
