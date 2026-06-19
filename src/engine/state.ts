import { Num, ZERO, ONE } from './num';
import { STARTING_PARTY_SIZE, targetMaxHp } from './content';

export interface Character {
  id: string;
  name: string;
  level: number;
  basePower: Num;
}

export interface ZoneState {
  zoneIndex: number;
  encounterIndex: number;
}

export interface GameState {
  schemaVersion: number;
  lastSaved: number; // epoch ms
  inspiration: Num;
  words: Num;
  royalties: Num;
  party: Character[];
  zone: ZoneState;
  currentHp: Num; // remaining HP of the current target
  bookComplete: boolean;
  bookNumber: number;
  prestigeMultiplier: Num;
}

export const CHARACTER_NAMES = [
  'Quill', 'Inkheart', 'Margin', 'Verse', 'Footnote', 'Epilogue', 'Prologue',
];

export function makeStartingParty(): Character[] {
  const party: Character[] = [];
  for (let i = 0; i < STARTING_PARTY_SIZE; i++) {
    party.push({ id: `c${i}`, name: CHARACTER_NAMES[i], level: 1, basePower: ONE });
  }
  return party;
}

export function initialState(nowMs: number): GameState {
  const zone: ZoneState = { zoneIndex: 0, encounterIndex: 0 };
  return {
    schemaVersion: 1,
    lastSaved: nowMs,
    inspiration: ZERO,
    words: ZERO,
    royalties: ZERO,
    party: makeStartingParty(),
    zone,
    currentHp: targetMaxHp(zone.zoneIndex, zone.encounterIndex),
    bookComplete: false,
    bookNumber: 1,
    prestigeMultiplier: ONE,
  };
}
