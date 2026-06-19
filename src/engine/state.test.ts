import { describe, it, expect } from 'vitest';
import * as num from './num';
import { initialState, makeStartingParty } from './state';
import { STARTING_PARTY_SIZE, targetMaxHp } from './content';

describe('state', () => {
  it('starts a fresh game with the right defaults', () => {
    const s = initialState(1000);
    expect(s.party.length).toBe(STARTING_PARTY_SIZE);
    expect(s.bookNumber).toBe(1);
    expect(s.bookComplete).toBe(false);
    expect(s.zone).toEqual({ zoneIndex: 0, encounterIndex: 0 });
    expect(s.lastSaved).toBe(1000);
    expect(num.eq(s.inspiration, num.ZERO)).toBe(true);
    expect(num.eq(s.royalties, num.ZERO)).toBe(true);
    expect(num.eq(s.prestigeMultiplier, num.ONE)).toBe(true);
    expect(num.eq(s.currentHp, targetMaxHp(0, 0))).toBe(true);
  });

  it('starting party members are level 1 with base power 1', () => {
    const party = makeStartingParty();
    expect(party.every((c) => c.level === 1)).toBe(true);
    expect(party.every((c) => num.eq(c.basePower, num.ONE))).toBe(true);
    expect(new Set(party.map((c) => c.id)).size).toBe(party.length); // unique ids
  });
});
