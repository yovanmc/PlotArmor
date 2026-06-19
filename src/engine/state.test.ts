// src/engine/state.test.ts
import { describe, it, expect } from 'vitest';
import * as num from './num';
import { initialState, makeStartingParty, emptyUpgrades, characterPower } from './state';
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
    expect(num.eq(s.currentHp, targetMaxHp(0, 0))).toBe(true);
    expect(s.upgrades).toEqual(emptyUpgrades());
  });

  it('starting party members are level 1 with base power 1', () => {
    const party = makeStartingParty();
    expect(party.every((c) => c.level === 1)).toBe(true);
    expect(party.every((c) => num.eq(c.basePower, num.ONE))).toBe(true);
    expect(new Set(party.map((c) => c.id)).size).toBe(party.length);
  });

  it('makeStartingParty can start the party at a higher level', () => {
    const party = makeStartingParty(5);
    expect(party.every((c) => c.level === 5)).toBe(true);
    expect(party.length).toBe(STARTING_PARTY_SIZE);
  });

  it('characterPower = basePower * level', () => {
    expect(num.toNum(characterPower({ id: 'x', name: 'X', level: 4, basePower: num.n(2) }))).toBe(8);
  });

  it('emptyUpgrades has zeroed levels and false flags', () => {
    const u = emptyUpgrades();
    expect(u.prolific).toBe(0);
    expect(u.sharpProse).toBe(0);
    expect(u.ensembleCast).toBe(false);
    expect(u.ghostwriter).toBe(false);
  });
});
