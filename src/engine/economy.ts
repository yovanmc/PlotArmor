import { Num, n, ZERO, add, sub, mul, pow, gte } from './num';
import { GameState, Character, CHARACTER_NAMES } from './state';
import { RECRUIT_CAP } from './content';

const LEVEL_BASE_COST = n(10);
const LEVEL_COST_GROWTH = 1.5;
const RECRUIT_BASE_COST = n(100);
const RECRUIT_COST_GROWTH = 6;

export function characterPower(c: Character): Num {
  return mul(c.basePower, n(c.level));
}

export function partyDps(state: GameState): Num {
  let sum = ZERO;
  for (const c of state.party) sum = add(sum, characterPower(c));
  return mul(sum, state.prestigeMultiplier);
}

export function levelCost(level: number): Num {
  return mul(LEVEL_BASE_COST, pow(n(LEVEL_COST_GROWTH), level - 1));
}

// cost to add the (partySize+1)-th member; partySize starts at STARTING_PARTY_SIZE (2)
export function recruitCost(partySize: number): Num {
  return mul(RECRUIT_BASE_COST, pow(n(RECRUIT_COST_GROWTH), partySize - 2));
}

export function canLevel(state: GameState, id: string): boolean {
  const c = state.party.find((p) => p.id === id);
  if (!c) return false;
  return gte(state.inspiration, levelCost(c.level));
}

export function levelUp(state: GameState, id: string): GameState {
  if (!canLevel(state, id)) return state;
  const c = state.party.find((p) => p.id === id)!;
  const cost = levelCost(c.level);
  return {
    ...state,
    inspiration: sub(state.inspiration, cost),
    party: state.party.map((p) => (p.id === id ? { ...p, level: p.level + 1 } : p)),
  };
}

export function canRecruit(state: GameState): boolean {
  return (
    state.party.length < RECRUIT_CAP &&
    gte(state.inspiration, recruitCost(state.party.length))
  );
}

export function recruit(state: GameState): GameState {
  if (!canRecruit(state)) return state;
  const cost = recruitCost(state.party.length);
  const idx = state.party.length;
  const newChar: Character = {
    id: `c${idx}`,
    name: CHARACTER_NAMES[idx] ?? `Character ${idx + 1}`,
    level: 1,
    basePower: n(1),
  };
  return {
    ...state,
    inspiration: sub(state.inspiration, cost),
    party: [...state.party, newChar],
  };
}
