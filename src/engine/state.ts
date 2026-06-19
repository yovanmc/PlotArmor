// src/engine/state.ts
import { Num, n, mul, pow, ZERO } from './num';
import { targetMaxHp, POWER_GROWTH, ClassId, findClass } from './content';

export interface Character {
  id: string;
  name: string;
  classId: ClassId;
  level: number;
  basePower: Num;
}

export interface ZoneState {
  zoneIndex: number;
  encounterIndex: number;
}

export interface Upgrades {
  prolific: number;
  sharpProse: number;
  pageTurner: number;
  muse: number;
  nightOwl: number;
  frugalDrafts: number;
  ensembleCast: boolean;
  ghostwriter: boolean;
}

export interface GameState {
  schemaVersion: number;
  lastSaved: number;
  inspiration: Num;
  words: Num;
  royalties: Num;
  party: Character[];
  zone: ZoneState;
  currentHp: Num;
  bookComplete: boolean;
  bookNumber: number;
  upgrades: Upgrades;
}

export function emptyUpgrades(): Upgrades {
  return {
    prolific: 0, sharpProse: 0, pageTurner: 0, muse: 0, nightOwl: 0, frugalDrafts: 0,
    ensembleCast: false, ghostwriter: false,
  };
}

export function characterPower(c: Character): Num {
  return mul(c.basePower, pow(n(POWER_GROWTH), c.level - 1));
}

export function makeCharacter(id: string, classId: ClassId, level = 1): Character {
  const def = findClass(classId);
  return { id, name: def.name, classId, level, basePower: def.classBasePower };
}

export function makeStartingParty(level = 1): Character[] {
  return [
    makeCharacter('c0', 'protagonist', level),
    makeCharacter('c1', 'antihero', level),
  ];
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
    upgrades: emptyUpgrades(),
  };
}
