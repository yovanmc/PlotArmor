import { describe, it, expect } from 'vitest';
import * as num from './num';
import { initialState } from './state';
import { targetInfo, advanceTarget } from './combat';
import { BOSS_INDEX, targetMaxHp } from './content';

describe('combat', () => {
  it('targetInfo reflects regular vs boss', () => {
    const s = initialState(0);
    const reg = targetInfo(s);
    expect(reg.isBoss).toBe(false);
    expect(num.eq(reg.regen, num.ZERO)).toBe(true);

    const atBoss = { ...s, zone: { zoneIndex: 0, encounterIndex: BOSS_INDEX } };
    const boss = targetInfo(atBoss);
    expect(boss.isBoss).toBe(true);
    expect(num.gt(boss.regen, num.ZERO)).toBe(true);
  });

  it('chips HP when dt is too small to clear', () => {
    const s = initialState(0); // dps 2, encounter(0,0) hp 10
    const info = targetInfo(s);
    const r = advanceTarget(num.n(10), info, 3); // 2 dps * 3s = 6 dmg
    expect(r.cleared).toBe(false);
    expect(num.toNum(r.hp)).toBeCloseTo(4, 6);
    expect(r.timeUsed).toBe(3);
  });

  it('clears exactly and reports the partial time used', () => {
    const s = initialState(0); // dps 2
    const info = targetInfo(s);
    const r = advanceTarget(num.n(10), info, 6); // would clear at t=5
    expect(r.cleared).toBe(true);
    expect(num.toNum(r.hp)).toBe(0);
    expect(r.timeUsed).toBeCloseTo(5, 6);
  });

  it('boss wall: when dps <= regen the boss never clears and regenerates toward max', () => {
    // default dps = 2; zone-0 boss regen = 3 -> net = -1
    const atBoss = { ...initialState(0), zone: { zoneIndex: 0, encounterIndex: BOSS_INDEX } };
    const info = targetInfo(atBoss);
    const max = targetMaxHp(0, BOSS_INDEX);
    const damaged = num.sub(max, num.n(5));
    const r = advanceTarget(damaged, info, 10);
    expect(r.cleared).toBe(false);
    expect(num.lte(r.hp, max)).toBe(true);
    expect(num.gt(r.hp, damaged)).toBe(true); // regenerated upward
  });
});
