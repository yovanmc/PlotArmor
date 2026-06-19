import { ZERO, ONE, n, add, mul } from './num';
import { GameState, makeStartingParty } from './state';
import { ZONE_COUNT, ROYALTY_BONUS, isBossIndex, targetMaxHp, targetWords } from './content';

// Called when the current target's HP reaches 0.
export function onClear(state: GameState): GameState {
  const { zoneIndex, encounterIndex } = state.zone;
  const words = add(state.words, targetWords(zoneIndex, encounterIndex));
  const clearedBoss = isBossIndex(encounterIndex);

  if (clearedBoss && zoneIndex >= ZONE_COUNT - 1) {
    // final boss of the final zone -> book complete, await player's Publish
    return { ...state, words, bookComplete: true };
  }

  const nz = clearedBoss ? zoneIndex + 1 : zoneIndex;
  const ne = clearedBoss ? 0 : encounterIndex + 1;
  return {
    ...state,
    words,
    zone: { zoneIndex: nz, encounterIndex: ne },
    currentHp: targetMaxHp(nz, ne),
  };
}

// Player action: publish the finished book and start the next one.
export function publish(state: GameState): GameState {
  if (!state.bookComplete) return state;
  const royalties = add(state.royalties, ONE);
  const prestigeMultiplier = add(ONE, mul(royalties, n(ROYALTY_BONUS)));
  const zone = { zoneIndex: 0, encounterIndex: 0 };
  return {
    ...state,
    royalties,
    prestigeMultiplier,
    bookNumber: state.bookNumber + 1,
    inspiration: ZERO,
    words: ZERO,
    party: makeStartingParty(),
    zone,
    currentHp: targetMaxHp(zone.zoneIndex, zone.encounterIndex),
    bookComplete: false,
  };
}
