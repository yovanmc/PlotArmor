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
    const s = initialState(0);
    const info = targetInfo(s);
    // Pick a dt where dps*dt < hp so the target is not cleared; hp is 10 in encounter(0,0)
    const hp = num.n(10);
    const dps = num.toNum(info.netDps);
    const dt = 1; // at any plausible DPS << 10, 1s of combat should not clear 10 hp
    expect(dps * dt).toBeLessThan(num.toNum(hp)); // sanity: confirm the scenario is valid
    const r = advanceTarget(hp, info, dt);
    expect(r.cleared).toBe(false);
    expect(num.toNum(r.hp)).toBeCloseTo(num.toNum(hp) - dps * dt, 6);
    expect(r.timeUsed).toBe(dt);
  });

  it('clears exactly and reports the partial time used', () => {
    const s = initialState(0);
    const info = targetInfo(s);
    const hp = num.n(10);
    const dps = num.toNum(info.netDps);
    const expectedTtc = 10 / dps; // time to clear = hp / netDps
    const dt = expectedTtc * 2; // give it twice the time it needs
    const r = advanceTarget(hp, info, dt);
    expect(r.cleared).toBe(true);
    expect(num.toNum(r.hp)).toBe(0);
    expect(r.timeUsed).toBeCloseTo(expectedTtc, 6);
  });

  it('boss wall: when dps <= regen the boss never clears and hp does not drop below start', () => {
    // Use zone 1 boss: regen = BASE_BOSS_REGEN * REGEN_GROWTH_PER_ZONE^1 = 3 * 5.5 = 16.5,
    // which exceeds the starting party DPS (~3.67 after abilities), creating a real wall.
    const atBoss = { ...initialState(0), zone: { zoneIndex: 1, encounterIndex: BOSS_INDEX } };
    const info = targetInfo(atBoss);
    expect(num.lte(info.netDps, num.ZERO)).toBe(true); // confirm wall scenario
    const max = targetMaxHp(1, BOSS_INDEX);
    const damaged = num.sub(max, num.n(5));
    const r = advanceTarget(damaged, info, 10);
    expect(r.cleared).toBe(false);
    expect(num.lte(r.hp, max)).toBe(true);
    expect(num.gte(r.hp, damaged)).toBe(true); // hp not reduced (net dps <= 0)
  });
});
