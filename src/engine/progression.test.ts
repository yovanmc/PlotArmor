import { describe, it, expect } from 'vitest';
import * as num from './num';
import { initialState } from './state';
import { onClear, publish } from './progression';
import { BOSS_INDEX, ZONE_COUNT, targetMaxHp, targetWords, ROYALTY_BONUS } from './content';

describe('progression', () => {
  it('advances to the next encounter on a regular clear and grants words', () => {
    const s = initialState(0);
    const next = onClear(s);
    expect(next.zone).toEqual({ zoneIndex: 0, encounterIndex: 1 });
    expect(num.eq(next.words, targetWords(0, 0))).toBe(true);
    expect(num.eq(next.currentHp, targetMaxHp(0, 1))).toBe(true);
  });

  it('advances to the next zone when a non-final boss is cleared', () => {
    const s = { ...initialState(0), zone: { zoneIndex: 0, encounterIndex: BOSS_INDEX } };
    const next = onClear(s);
    expect(next.zone).toEqual({ zoneIndex: 1, encounterIndex: 0 });
    expect(next.bookComplete).toBe(false);
    expect(num.eq(next.currentHp, targetMaxHp(1, 0))).toBe(true);
  });

  it('flags bookComplete when the final zone boss is cleared', () => {
    const s = { ...initialState(0), zone: { zoneIndex: ZONE_COUNT - 1, encounterIndex: BOSS_INDEX } };
    const next = onClear(s);
    expect(next.bookComplete).toBe(true);
  });

  it('publish awards a royalty, bumps the multiplier, resets the book, keeps royalties', () => {
    const done = {
      ...initialState(0),
      bookComplete: true,
      inspiration: num.n(5000),
      words: num.n(99999),
      zone: { zoneIndex: ZONE_COUNT - 1, encounterIndex: BOSS_INDEX },
    };
    const next = publish(done);
    expect(num.eq(next.royalties, num.ONE)).toBe(true);
    expect(num.eq(next.prestigeMultiplier, num.n(1 + ROYALTY_BONUS))).toBe(true);
    expect(next.bookNumber).toBe(2);
    expect(next.bookComplete).toBe(false);
    expect(next.zone).toEqual({ zoneIndex: 0, encounterIndex: 0 });
    expect(num.eq(next.inspiration, num.ZERO)).toBe(true);
    expect(num.eq(next.words, num.ZERO)).toBe(true);
    expect(next.party.length).toBe(initialState(0).party.length);
  });

  it('publish is a no-op when the book is not complete', () => {
    const s = initialState(0);
    expect(publish(s)).toBe(s);
  });
});
