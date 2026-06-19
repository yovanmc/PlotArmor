// src/engine/state.ts
import { Num, n, mul, ZERO, ONE } from './num';
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

export interface Upgrades {
  // repeatable -> level counts
  prolific: number;
  sharpProse: number;
  pageTurner: number;
  muse: number;
  nightOwl: number;
  frugalDrafts: number;
  // one-time -> owned flags
  ensembleCast: boolean;
  ghostwriter: boolean;
}

export interface GameState {
  schemaVersion: number;
  lastSaved: number; // epoch ms
  inspiration: Num;
  words: Num;
  royalties: Num; // prestige wallet (spent on upgrades)
  party: Character[];
  zone: ZoneState;
  currentHp: Num;
  bookComplete: boolean;
  bookNumber: number;
  prestigeMultiplier: Num; // DEPRECATED: removed in M6 once nothing reads it
  upgrades: Upgrades;
}

export const CHARACTER_NAMES = [
  'Quill', 'Inkheart', 'Margin', 'Verse', 'Footnote', 'Epilogue', 'Prologue',
];

export function emptyUpgrades(): Upgrades {
  return {
    prolific: 0, sharpProse: 0, pageTurner: 0, muse: 0, nightOwl: 0, frugalDrafts: 0,
    ensembleCast: false, ghostwriter: false,
  };
}

export function characterPower(c: Character): Num {
  return mul(c.basePower, n(c.level));
}

export function makeStartingParty(level = 1): Character[] {
  const party: Character[] = [];
  for (let i = 0; i < STARTING_PARTY_SIZE; i++) {
    party.push({ id: `c${i}`, name: CHARACTER_NAMES[i], level, basePower: ONE });
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
    upgrades: emptyUpgrades(),
  };
}
