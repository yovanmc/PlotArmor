// src/engine/progression.ts
import { ZERO, add } from './num';
import { GameState, makeStartingParty } from './state';
import { ZONE_COUNT, isBossIndex } from './content';
import { effectiveWords, effectiveTargetMaxHp, startingPartyLevel } from './modifiers';
import { royaltiesForBook } from './prestige';

// Called when the current target's HP reaches 0.
export function onClear(state: GameState): GameState {
  const { zoneIndex, encounterIndex } = state.zone;
  const words = add(state.words, effectiveWords(state, zoneIndex, encounterIndex));
  const clearedBoss = isBossIndex(encounterIndex);

  if (clearedBoss && zoneIndex >= ZONE_COUNT - 1) {
    return { ...state, words, bookComplete: true };
  }

  const nz = clearedBoss ? zoneIndex + 1 : zoneIndex;
  const ne = clearedBoss ? 0 : encounterIndex + 1;
  const advanced = { ...state, words, zone: { zoneIndex: nz, encounterIndex: ne } };
  return { ...advanced, currentHp: effectiveTargetMaxHp(advanced, nz, ne) };
}

// Player action: publish the finished book and start the next (harder) one.
export function publish(state: GameState): GameState {
  if (!state.bookComplete) return state;
  const royalties = add(state.royalties, royaltiesForBook(state.words));
  const zone = { zoneIndex: 0, encounterIndex: 0 };
  const base: GameState = {
    ...state, // upgrades persist via spread
    royalties,
    bookNumber: state.bookNumber + 1,
    inspiration: ZERO,
    words: ZERO,
    party: makeStartingParty(startingPartyLevel(state)),
    zone,
    currentHp: ZERO, // set below using the NEW (incremented) bookNumber
    bookComplete: false,
  };
  return { ...base, currentHp: effectiveTargetMaxHp(base, 0, 0) };
}
