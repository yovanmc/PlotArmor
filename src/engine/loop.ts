// src/engine/loop.ts
import { n, add, mul } from './num';
import { GameState } from './state';
import { OFFLINE_MAX_ITERS } from './content';
import { effectiveInspirationRate } from './modifiers';
import { targetInfo, advanceTarget } from './combat';
import { onClear } from './progression';

export interface StepResult {
  state: GameState;
  clears: number;
  cappedOut: boolean;
}

export function step(state: GameState, dt: number): StepResult {
  let s = state;
  let remaining = dt;
  let clears = 0;
  let iters = 0;
  let cappedOut = false;

  while (remaining > 1e-9 && !s.bookComplete) {
    if (iters++ >= OFFLINE_MAX_ITERS) {
      cappedOut = true;
      break;
    }
    const info = targetInfo(s);
    const rate = effectiveInspirationRate(s, s.zone.zoneIndex, s.zone.encounterIndex);
    const res = advanceTarget(s.currentHp, info, remaining);

    s = {
      ...s,
      inspiration: add(s.inspiration, mul(rate, n(res.timeUsed))),
      currentHp: res.hp,
    };
    remaining -= res.timeUsed;

    if (res.cleared) {
      s = onClear(s);
      clears++;
    } else {
      break;
    }
  }

  return { state: s, clears, cappedOut };
}
