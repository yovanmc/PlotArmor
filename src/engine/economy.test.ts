// src/engine/economy.test.ts
import { describe, it, expect } from 'vitest';
import * as num from './num';
import { initialState, emptyUpgrades } from './state';
import * as eco from './economy';
import { baseLevelCost, RECRUIT_CAP } from './content';
import { starUp, canStarUp } from './economy';

describe('economy actions', () => {
  it('levelUp spends the (effective) cost and raises level when affordable', () => {
    const s = { ...initialState(0), inspiration: num.n(1000) };
    const id = s.party[0].id;
    const cost = baseLevelCost(s.party[0].level); // book1 / no upgrades => effective == base
    const next = eco.levelUp(s, id);
    expect(next.party[0].level).toBe(2);
    expect(num.eq(next.inspiration, num.sub(num.n(1000), cost))).toBe(true);
  });

  it('levelUp is a no-op when unaffordable', () => {
    const s = { ...initialState(0), inspiration: num.ZERO };
    expect(eco.levelUp(s, s.party[0].id)).toBe(s);
  });

  it('recruit adds a character and respects the base cap', () => {
    let s = { ...initialState(0), inspiration: num.n('1e9') };
    while (s.party.length < RECRUIT_CAP) {
      const before = s.party.length;
      s = eco.recruit(s, 'antihero');
      expect(s.party.length).toBe(before + 1);
    }
    expect(eco.canRecruit(s)).toBe(false);
    expect(eco.recruit(s, 'antihero')).toBe(s);
  });

  it('frugalDrafts reduces the effective recruit cost actually charged', () => {
    const base = { ...initialState(0), inspiration: num.n('1e9') };
    const thrifty = { ...base, upgrades: { ...emptyUpgrades(), frugalDrafts: 4 } }; // -20%
    const afterBase = eco.recruit(base, 'antihero');
    const afterThrifty = eco.recruit(thrifty, 'antihero');
    expect(num.gt(afterThrifty.inspiration, afterBase.inspiration)).toBe(true);
  });

  it('ensembleCast raises the cap so a 6th member can be recruited', () => {
    let s = { ...initialState(0), inspiration: num.n('1e12'), upgrades: { ...emptyUpgrades(), ensembleCast: true } };
    while (eco.canRecruit(s)) s = eco.recruit(s, 'antihero');
    expect(s.party.length).toBe(RECRUIT_CAP + 1);
  });

  it('recruit(classId) adds a level-1 character of that class and charges inspiration', () => {
    const s = { ...initialState(0), inspiration: num.n('1e9') };
    const before = s.party.length;
    const after = eco.recruit(s, 'debuffer');
    expect(after.party.length).toBe(before + 1);
    expect(after.party[after.party.length - 1].classId).toBe('debuffer');
    expect(num.lt(after.inspiration, s.inspiration)).toBe(true);
  });
});

describe('star-up (Slice 2)', () => {
  it('star up spends Edits and raises the class star', () => {
    const s = { ...initialState(0), edits: num.n('1e6') };
    const after = starUp(s, 'support');
    expect(after.stars.support).toBe(2);
    expect(num.lt(after.edits, s.edits)).toBe(true);
  });

  it('refuses the Protagonist (it grows via Royalties, not stars)', () => {
    const s = { ...initialState(0), edits: num.n('1e6') };
    expect(canStarUp(s, 'protagonist')).toBe(false);
    expect(starUp(s, 'protagonist')).toBe(s); // no-op, same reference
  });

  it('refuses past MAX_STAR and when Edits are insufficient', () => {
    const fresh = initialState(0);
    const maxed = { ...fresh, edits: num.n('1e9'), stars: { ...fresh.stars, support: 5 } };
    expect(canStarUp(maxed, 'support')).toBe(false);
    const broke = { ...fresh, edits: num.ZERO };
    expect(canStarUp(broke, 'support')).toBe(false);
  });
});
