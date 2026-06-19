import { Num, n, ZERO, sub, mul, div, gt, minN } from './num';
import { GameState } from './state';
import { targetMaxHp, targetRegen, isBossIndex } from './content';
import { partyDps } from './economy';

export interface TargetInfo {
  maxHp: Num;
  regen: Num;
  isBoss: boolean;
  netDps: Num; // partyDps - regen (regen is 0 for regular encounters)
}

export function targetInfo(state: GameState): TargetInfo {
  const { zoneIndex, encounterIndex } = state.zone;
  const regen = targetRegen(zoneIndex, encounterIndex);
  return {
    maxHp: targetMaxHp(zoneIndex, encounterIndex),
    regen,
    isBoss: isBossIndex(encounterIndex),
    netDps: sub(partyDps(state), regen),
  };
}

export interface AdvanceResult {
  hp: Num;
  cleared: boolean;
  timeUsed: number; // seconds of `dt` consumed (== ttc on clear, else == dt)
}

// Apply up to `dt` seconds of combat to the current target.
export function advanceTarget(currentHp: Num, info: TargetInfo, dt: number): AdvanceResult {
  if (gt(info.netDps, ZERO)) {
    const ttc = div(currentHp, info.netDps).toNumber();
    if (ttc <= dt) {
      return { hp: ZERO, cleared: true, timeUsed: ttc };
    }
    return { hp: sub(currentHp, mul(info.netDps, n(dt))), cleared: false, timeUsed: dt };
  }
  // netDps <= 0 (boss wall): regenerate toward maxHp, never clears
  const regened = sub(currentHp, mul(info.netDps, n(dt))); // subtracting a non-positive => increase
  return { hp: minN(regened, info.maxHp), cleared: false, timeUsed: dt };
}
