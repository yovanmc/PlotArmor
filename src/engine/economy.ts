// src/engine/economy.ts
import { sub, gte } from './num';
import { GameState, Character, makeCharacter } from './state';
import { effectiveLevelCost, effectiveRecruitCost, effectivePartyCap } from './modifiers';

export function canLevel(state: GameState, id: string): boolean {
  const c = state.party.find((p) => p.id === id);
  if (!c) return false;
  return gte(state.inspiration, effectiveLevelCost(state, c.level));
}

export function levelUp(state: GameState, id: string): GameState {
  if (!canLevel(state, id)) return state;
  const c = state.party.find((p) => p.id === id)!;
  const cost = effectiveLevelCost(state, c.level);
  return {
    ...state,
    inspiration: sub(state.inspiration, cost),
    party: state.party.map((p) => (p.id === id ? { ...p, level: p.level + 1 } : p)),
  };
}

export function canRecruit(state: GameState): boolean {
  return (
    state.party.length < effectivePartyCap(state) &&
    gte(state.inspiration, effectiveRecruitCost(state, state.party.length))
  );
}

export function recruit(state: GameState): GameState {
  if (!canRecruit(state)) return state;
  const cost = effectiveRecruitCost(state, state.party.length);
  const idx = state.party.length;
  // stopgap (Slice 1 Task 4 finalizes recruit-by-class)
  const newChar: Character = makeCharacter(`c${idx}`, 'antihero');
  return { ...state, inspiration: sub(state.inspiration, cost), party: [...state.party, newChar] };
}
