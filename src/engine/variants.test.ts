import { describe, it, expect } from 'vitest';
import { initialState, makeCharacter } from './state';
import { unlockNextVariant, setVariant, unlockedWorldsFor, activeSetBonus, setBonusBreakdown, affinityMult, distinctWorldsFielded, ensembleAffinityAmp } from './variants';
import { AFFINITY_MAG } from './content';
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
    for (let i = 0; i < 6; i++) u = unlockNextVariant(u, 0);
    const before = JSON.stringify(u);
    u = unlockNextVariant(u, 0);          // 7th clear: nothing left to unlock
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

function partyOnWorlds(worlds: (number | null)[]) {
  return worlds.map((w, i) => ({ ...makeCharacter(`c${i}`, 'antihero'), variantWorld: w }));
}

describe('set bonus', () => {
  it('is neutral when fewer than 2 share a world', () => {
    const b = activeSetBonus(partyOnWorlds([2, null, 0, null]));
    expect(b.dpsMult).toBe(1);
    expect(b.inspMult).toBe(1);
    expect(b.wordsMult).toBe(1);
    expect(b.editDropMult).toBe(1);
    expect(b.regenCutAdd).toBe(0);
  });

  it('applies the world axis at the right tier (Space = DPS)', () => {
    // 5 on Space (world 2, dps tier 3 = +0.35) — rebalanced DOWN so rainbow can compete (tuning pass)
    expect(activeSetBonus(partyOnWorlds([2, 2, 2, 2, 2])).dpsMult).toBeCloseTo(1.35, 5);
    // 3 on Space (tier 2 = +0.20)
    expect(activeSetBonus(partyOnWorlds([2, 2, 2, null, null])).dpsMult).toBeCloseTo(1.20, 5);
    // 2 on Space (tier 1 = +0.10)
    expect(activeSetBonus(partyOnWorlds([2, 2, null, null, null])).dpsMult).toBeCloseTo(1.10, 5);
  });

  it('regenCut worlds add to regenCutAdd', () => {
    // 2 on Zombie (world 1, regenCut tier 1 = 0.05)
    expect(activeSetBonus(partyOnWorlds([1, 1])).regenCutAdd).toBeCloseTo(0.05, 5);
  });

  it('stacks two different world sets at once', () => {
    // 2 Space (dps tier1 = +0.10) + 2 Pirate (world 4, editDrop tier1 = +0.25)
    const b = activeSetBonus(partyOnWorlds([2, 2, 4, 4]));
    expect(b.dpsMult).toBeCloseTo(1.10, 5);
    expect(b.editDropMult).toBeCloseTo(1.25, 5);
  });

  it('breakdown lists qualifying worlds with their count + tier', () => {
    const bd = setBonusBreakdown(partyOnWorlds([2, 2, 2, 4, 4]));
    expect(bd).toContainEqual({ world: 2, count: 3, tier: 2 });
    expect(bd).toContainEqual({ world: 4, count: 2, tier: 1 });
  });
});

describe('zone affinity helper (Slice 4)', () => {
  it('boosts a character whose skin matches the current zone', () => {
    const c = { ...makeCharacter('c', 'antihero'), variantWorld: 2 };
    expect(affinityMult(c, 2)).toBeCloseTo(1 + AFFINITY_MAG, 6);
  });

  it('is neutral (1) when the skin does not match the current zone', () => {
    const c = { ...makeCharacter('c', 'antihero'), variantWorld: 2 };
    expect(affinityMult(c, 5)).toBe(1);
  });

  it('is neutral (1) for a base-skin character (variantWorld null) in any zone', () => {
    const c = makeCharacter('c', 'antihero'); // variantWorld null
    expect(affinityMult(c, 0)).toBe(1);
  });
});

describe('Ensemble (diversity) set', () => {
  const mk = (id: string, world: number | null) => ({ ...makeCharacter(id, 'support', 1), variantWorld: world });
  it('counts distinct fielded worlds (base look ignored)', () => {
    expect(distinctWorldsFielded([mk('a', 2), mk('b', 2), mk('c', null)])).toBe(1);
    expect(distinctWorldsFielded([mk('a', 0), mk('b', 1), mk('c', 2)])).toBe(3);
  });
  it('amplifies affinity for an in-element character when 3+ distinct worlds are fielded', () => {
    const rainbow = [mk('a', 0), mk('b', 1), mk('c', 2)];
    const amp = ensembleAffinityAmp(rainbow);
    expect(amp).toBeGreaterThan(0);
    const inEl = rainbow[0]; // wears world 0, fighting zone 0
    expect(affinityMult(inEl, 0, amp)).toBeGreaterThan(affinityMult(inEl, 0, 0));
  });
  it('is neutral below the threshold (mono / <3 distinct) and off-element', () => {
    const mono = [mk('a', 2), mk('b', 2)];
    expect(ensembleAffinityAmp(mono)).toBe(0);
    expect(affinityMult(mono[0], 5, 1.0)).toBe(1); // off-element: amp irrelevant
  });
});
