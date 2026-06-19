// src/engine/modifiers.ts
import { Num, n, add, mul, pow, ZERO } from './num';
import { GameState, characterPower } from './state';
import {
  RECRUIT_CAP, OFFLINE_CAP_SECONDS,
  targetInspirationRate, targetMaxHp, targetRegen, targetWords,
  baseLevelCost, baseRecruitCost,
  BOOK_SCALE, PROLIFIC_MAG, SHARP_MAG, PAGETURNER_MAG, MUSE_MAG, MUSE_FLOOR,
  FRUGAL_MAG, FRUGAL_FLOOR, NIGHT_OWL_HOURS_PER_LEVEL, GHOSTWRITER_LEVEL,
} from './content';

// Per-book difficulty/size factor D(b) = BOOK_SCALE^(b-1). D(1) = 1 (book 1 == v1).
export function bookDifficulty(state: GameState): Num {
  return pow(n(BOOK_SCALE), state.bookNumber - 1);
}

const prolificMult = (s: GameState): number => 1 + PROLIFIC_MAG * s.upgrades.prolific;
const sharpMult = (s: GameState): number => 1 + SHARP_MAG * s.upgrades.sharpProse;
const pageTurnerMult = (s: GameState): number => 1 + PAGETURNER_MAG * s.upgrades.pageTurner;
const museMult = (s: GameState): number => Math.max(MUSE_FLOOR, 1 - MUSE_MAG * s.upgrades.muse);
const frugalMult = (s: GameState): number => Math.max(FRUGAL_FLOOR, 1 - FRUGAL_MAG * s.upgrades.frugalDrafts);

export function effectiveInspirationRate(s: GameState, zoneIndex: number, encounterIndex: number): Num {
  return mul(mul(targetInspirationRate(zoneIndex, encounterIndex), bookDifficulty(s)), n(prolificMult(s)));
}

export function effectiveTargetMaxHp(s: GameState, zoneIndex: number, encounterIndex: number): Num {
  return mul(targetMaxHp(zoneIndex, encounterIndex), bookDifficulty(s));
}

export function effectiveBossRegen(s: GameState, zoneIndex: number, encounterIndex: number): Num {
  return mul(mul(targetRegen(zoneIndex, encounterIndex), bookDifficulty(s)), n(museMult(s)));
}

export function effectiveWords(s: GameState, zoneIndex: number, encounterIndex: number): Num {
  return mul(mul(targetWords(zoneIndex, encounterIndex), bookDifficulty(s)), n(pageTurnerMult(s)));
}

export function effectivePartyDps(s: GameState): Num {
  let sum = ZERO;
  for (const c of s.party) sum = add(sum, characterPower(c));
  return mul(sum, n(sharpMult(s)));
}

export function effectiveLevelCost(s: GameState, level: number): Num {
  return mul(baseLevelCost(level), n(frugalMult(s)));
}

export function effectiveRecruitCost(s: GameState, partySize: number): Num {
  return mul(baseRecruitCost(partySize), n(frugalMult(s)));
}

export function effectivePartyCap(s: GameState): number {
  return RECRUIT_CAP + (s.upgrades.ensembleCast ? 1 : 0);
}

export function effectiveOfflineCap(s: GameState): number {
  return OFFLINE_CAP_SECONDS + s.upgrades.nightOwl * NIGHT_OWL_HOURS_PER_LEVEL * 3600;
}

export function startingPartyLevel(s: GameState): number {
  return s.upgrades.ghostwriter ? GHOSTWRITER_LEVEL : 1;
}
