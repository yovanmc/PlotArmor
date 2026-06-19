import { describe, it, expect } from 'vitest';
import * as num from './num';
import { initialState } from './state';
import * as eco from './economy';
import { RECRUIT_CAP } from './content';

describe('economy', () => {
  it('party DPS = sum of (basePower*level) * prestigeMultiplier', () => {
    const s = initialState(0); // 2 chars, level 1, basePower 1, prestige 1
    expect(num.toNum(eco.partyDps(s))).toBe(2);
    const boosted = { ...s, prestigeMultiplier: num.n(1.5) };
    expect(num.toNum(eco.partyDps(boosted))).toBe(3);
  });

  it('level cost grows with level', () => {
    expect(num.gt(eco.levelCost(2), eco.levelCost(1))).toBe(true);
  });

  it('levelUp spends inspiration and raises the level when affordable', () => {
    const s = { ...initialState(0), inspiration: num.n(1000) };
    const id = s.party[0].id;
    const cost = eco.levelCost(s.party[0].level);
    const next = eco.levelUp(s, id);
    expect(next.party[0].level).toBe(2);
    expect(num.eq(next.inspiration, num.sub(num.n(1000), cost))).toBe(true);
  });

  it('levelUp is a no-op when unaffordable', () => {
    const s = { ...initialState(0), inspiration: num.ZERO };
    const next = eco.levelUp(s, s.party[0].id);
    expect(next).toBe(s); // same reference -> nothing changed
  });

  it('recruit adds a character and respects the cap', () => {
    let s = { ...initialState(0), inspiration: num.n('1e9') };
    while (s.party.length < RECRUIT_CAP) {
      const before = s.party.length;
      s = eco.recruit(s);
      expect(s.party.length).toBe(before + 1);
    }
    expect(eco.canRecruit(s)).toBe(false); // at cap
    const afterCap = eco.recruit(s);
    expect(afterCap.party.length).toBe(RECRUIT_CAP);
  });
});
