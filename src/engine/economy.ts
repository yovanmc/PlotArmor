// src/engine/economy.ts
import { sub, gte } from './num';
import { GameState, makeCharacter } from './state';
import { ClassId, MAX_STAR, starUpCost } from './content';
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

export function recruit(state: GameState, classId: ClassId): GameState {
  if (!canRecruit(state)) return state;
  const cost = effectiveRecruitCost(state, state.party.length);
  const idx = state.party.length;
  const newChar = makeCharacter(`c${idx}`, classId);
  return { ...state, inspiration: sub(state.inspiration, cost), party: [...state.party, newChar] };
}

export function canStarUp(state: GameState, classId: ClassId): boolean {
  if (classId === 'protagonist') return false; // Protagonist grows via Royalties (Slice 3)
  const current = state.stars[classId];
  if (current >= MAX_STAR) return false;
  return gte(state.edits, starUpCost(current));
}

export function starUp(state: GameState, classId: ClassId): GameState {
  if (!canStarUp(state, classId)) return state;
  const current = state.stars[classId];
  const cost = starUpCost(current);
  return {
    ...state,
    edits: sub(state.edits, cost),
    stars: { ...state.stars, [classId]: current + 1 },
  };
}
