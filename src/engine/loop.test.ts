import { describe, it, expect } from 'vitest';
import * as num from './num';
import { initialState } from './state';
import { step } from './loop';
import { BOSS_INDEX, ZONE_COUNT, targetMaxHp, targetInspirationRate } from './content';

describe('loop.step', () => {
  it('accrues inspiration continuously and clears the first encounter', () => {
    const s = initialState(0); // dps ≈2.37 (Protagonist+Anti-hero w/ Lone Wolf + Plot Armor), encounter(0,0) hp 10 -> clears at t≈4.2s
    const r = step(s, 6);
    expect(r.clears).toBeGreaterThanOrEqual(1);
    expect(num.gt(r.state.inspiration, num.ZERO)).toBe(true);
    expect(r.state.zone.encounterIndex).toBeGreaterThan(0); // advanced
  });

  it('halts at bookComplete and does not auto-publish', () => {
    const atFinalBoss = {
      ...initialState(0),
      zone: { zoneIndex: ZONE_COUNT - 1, encounterIndex: BOSS_INDEX },
      // give enough dps to beat the final boss quickly
      party: [{ id: 'x', name: 'Hero', classId: 'protagonist' as const, level: 1, basePower: num.n('1e30'), variantWorld: null }],
      currentHp: num.n(1),
    };
    const r = step(atFinalBoss, 10);
    expect(r.state.bookComplete).toBe(true);
    expect(r.state.bookNumber).toBe(1); // NOT auto-published
  });

  it('boss wall still earns inspiration (rate-based) without clearing', () => {
    const atBoss = {
      ...initialState(0), // dps 3 == zone-0 boss regen 3 -> wall (net=0)
      zone: { zoneIndex: 0, encounterIndex: BOSS_INDEX },
      currentHp: targetMaxHp(0, BOSS_INDEX),
    };
    const r = step(atBoss, 10);
    expect(r.clears).toBe(0);
    const rate = targetInspirationRate(0, BOSS_INDEX);
    expect(num.toNum(r.state.inspiration)).toBeCloseTo(num.toNum(num.mul(rate, num.n(10))), 4);
  });

  it('is deterministic across timestep granularity at a boss wall (constant rate)', () => {
    const base = {
      ...initialState(0),
      zone: { zoneIndex: 0, encounterIndex: BOSS_INDEX },
      currentHp: targetMaxHp(0, BOSS_INDEX),
    };
    const oneShot = step(base, 100).state.inspiration;
    let acc = base;
    for (let i = 0; i < 1000; i++) acc = step(acc, 0.1).state;
    expect(num.toNum(acc.inspiration)).toBeCloseTo(num.toNum(oneShot), 4);
  });
});
