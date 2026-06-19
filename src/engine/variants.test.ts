import { describe, it, expect } from 'vitest';
import { initialState, makeCharacter } from './state';
import { unlockNextVariant, setVariant, unlockedWorldsFor } from './variants';
import { makeUnlockedVariants } from './state';

describe('variant acquisition', () => {
  it('unlocks the next class (fixed order) for the cleared world', () => {
    let u = makeUnlockedVariants();
    u = unlockNextVariant(u, 2);          // world 2 (Space)
    expect(u.protagonist).toEqual([2]);   // protagonist is first in VARIANT_UNLOCK_ORDER
    u = unlockNextVariant(u, 2);
    expect(u.antihero).toEqual([2]);      // then antihero
  });

  it('is a no-op once every class owns that world', () => {
    let u = makeUnlockedVariants();
    for (let i = 0; i < 5; i++) u = unlockNextVariant(u, 0);
    const before = JSON.stringify(u);
    u = unlockNextVariant(u, 0);          // 6th clear: nothing left to unlock
    expect(JSON.stringify(u)).toBe(before);
  });

  it('does not mutate the input map', () => {
    const u = makeUnlockedVariants();
    unlockNextVariant(u, 3);
    expect(u.protagonist).toEqual([]);    // original untouched
  });
});

describe('equip / query', () => {
  it('equips an unlocked variant on a fielded character', () => {
    const base = { ...initialState(0), unlockedVariants: { ...makeUnlockedVariants(), antihero: [2] } };
    const after = setVariant(base, 'c1', 2); // c1 is the starting Anti-hero
    expect(after.party.find((c) => c.id === 'c1')!.variantWorld).toBe(2);
  });

  it('refuses to equip a variant the class has not unlocked', () => {
    const base = initialState(0);
    expect(setVariant(base, 'c1', 4)).toBe(base); // no-op, same reference
  });

  it('allows equipping the base look (null) regardless of unlocks', () => {
    const start = { ...initialState(0), party: [makeCharacter('c0', 'protagonist'), { ...makeCharacter('c1', 'antihero'), variantWorld: 2 }] };
    const after = setVariant(start, 'c1', null);
    expect(after.party.find((c) => c.id === 'c1')!.variantWorld).toBeNull();
  });

  it('unlockedWorldsFor returns the class list', () => {
    const s = { ...initialState(0), unlockedVariants: { ...makeUnlockedVariants(), support: [1, 5] } };
    expect(unlockedWorldsFor(s, 'support')).toEqual([1, 5]);
  });
});
