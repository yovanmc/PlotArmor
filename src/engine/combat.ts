// src/engine/combat.ts
import { Num, n, ZERO, sub, mul, div, gt, minN } from './num';
import { GameState } from './state';
import { isBossIndex } from './content';
import { effectivePartyDps, effectiveBossRegen, effectiveTargetMaxHp } from './modifiers';

export interface TargetInfo {
  maxHp: Num;
  regen: Num;
  isBoss: boolean;
  netDps: Num; // effectivePartyDps - regen
}

export function targetInfo(state: GameState): TargetInfo {
  const { zoneIndex, encounterIndex } = state.zone;
  const regen = effectiveBossRegen(state, zoneIndex, encounterIndex);
  return {
    maxHp: effectiveTargetMaxHp(state, zoneIndex, encounterIndex),
    regen,
    isBoss: isBossIndex(encounterIndex),
    netDps: sub(effectivePartyDps(state), regen),
  };
}

export interface AdvanceResult {
  hp: Num;
  cleared: boolean;
  timeUsed: number;
}

// Apply up to `dt` seconds of combat to the current target (unchanged logic).
export function advanceTarget(currentHp: Num, info: TargetInfo, dt: number): AdvanceResult {
  if (gt(info.netDps, ZERO)) {
    const ttc = div(currentHp, info.netDps).toNumber();
    if (ttc <= dt) {
      return { hp: ZERO, cleared: true, timeUsed: ttc };
    }
    return { hp: sub(currentHp, mul(info.netDps, n(dt))), cleared: false, timeUsed: dt };
  }
  const regened = sub(currentHp, mul(info.netDps, n(dt))); // subtracting non-positive => increase
  return { hp: minN(regened, info.maxHp), cleared: false, timeUsed: dt };
}
