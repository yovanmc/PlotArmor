import { Num, ZERO, sub } from './num';
import { GameState } from './state';
import { step } from './loop';
import { OFFLINE_CAP_SECONDS } from './content';

export function offlineSeconds(nowMs: number, lastSavedMs: number): number {
  const raw = (nowMs - lastSavedMs) / 1000;
  if (!Number.isFinite(raw) || raw <= 0) return 0; // rewound/zero/invalid
  return Math.min(raw, OFFLINE_CAP_SECONDS);
}

export interface OfflineSummary {
  seconds: number;
  inspirationGained: Num;
  wordsGained: Num;
  clears: number;
  cappedOut: boolean;
}

export function applyOffline(
  state: GameState,
  nowMs: number,
): { state: GameState; summary: OfflineSummary } {
  const seconds = offlineSeconds(nowMs, state.lastSaved);
  if (seconds === 0) {
    return {
      state: { ...state, lastSaved: nowMs },
      summary: { seconds: 0, inspirationGained: ZERO, wordsGained: ZERO, clears: 0, cappedOut: false },
    };
  }
  const before = state;
  const res = step(state, seconds);
  return {
    state: { ...res.state, lastSaved: nowMs },
    summary: {
      seconds,
      inspirationGained: sub(res.state.inspiration, before.inspiration),
      wordsGained: sub(res.state.words, before.words),
      clears: res.clears,
      cappedOut: res.cappedOut,
    },
  };
}
