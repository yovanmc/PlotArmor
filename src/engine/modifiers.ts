// src/engine/modifiers.ts
import { Num, n, add, mul, pow, ZERO } from './num';
import { GameState, Character, characterPower } from './state';
import {
  RECRUIT_CAP, OFFLINE_CAP_SECONDS,
  targetInspirationRate, targetMaxHp, targetRegen, targetWords,
  baseLevelCost, baseRecruitCost,
  BOOK_SCALE, PROLIFIC_MAG, SHARP_MAG, PAGETURNER_MAG, MUSE_MAG, MUSE_FLOOR,
  FRUGAL_MAG, FRUGAL_FLOOR, NIGHT_OWL_HOURS_PER_LEVEL, GHOSTWRITER_LEVEL,
  PARTY_ABILITY_FLOOR, findClass, AbilityKind, ClassId, starStatMult, starAbilityMult,
} from './content';
import { activeSetBonus } from './variants';

// Per-book difficulty/size factor D(b) = BOOK_SCALE^(b-1). D(1) = 1 (book 1 == v1).
export function bookDifficulty(state: GameState): Num {
  return pow(n(BOOK_SCALE), state.bookNumber - 1);
}

const prolificMult = (s: GameState): number => 1 + PROLIFIC_MAG * s.upgrades.prolific;
const sharpMult = (s: GameState): number => 1 + SHARP_MAG * s.upgrades.sharpProse;
const pageTurnerMult = (s: GameState): number => 1 + PAGETURNER_MAG * s.upgrades.pageTurner;
const museMult = (s: GameState): number => Math.max(MUSE_FLOOR, 1 - MUSE_MAG * s.upgrades.muse);
const frugalMult = (s: GameState): number => Math.max(FRUGAL_FLOOR, 1 - FRUGAL_MAG * s.upgrades.frugalDrafts);

function abilitySum(party: Character[], kind: AbilityKind, stars: Record<ClassId, number>): number {
  let total = 0;
  for (const c of party) {
    const ab = findClass(c.classId).ability;
    if (ab.kind === kind) total += ab.mag * c.level * starAbilityMult(stars[c.classId]);
  }
  return total;
}

function distinctClassCount(party: Character[]): number {
  return new Set(party.map((c) => c.classId)).size;
}

export function effectiveInspirationRate(s: GameState, zoneIndex: number, encounterIndex: number): Num {
  const sidekickMult = 1 + abilitySum(s.party, 'inspRate', s.stars);
  const setMult = activeSetBonus(s.party).inspMult;
  return mul(
    mul(mul(mul(targetInspirationRate(zoneIndex, encounterIndex), bookDifficulty(s)), n(prolificMult(s))), n(sidekickMult)),
    n(setMult),
  );
}

export function effectiveTargetMaxHp(s: GameState, zoneIndex: number, encounterIndex: number): Num {
  return mul(targetMaxHp(zoneIndex, encounterIndex), bookDifficulty(s));
}

export function effectiveBossRegen(s: GameState, zoneIndex: number, encounterIndex: number): Num {
  const shopReduction = 1 - museMult(s);                              // museMult already floored; this is the shop's cut
  const partyReduction = abilitySum(s.party, 'regenCut', s.stars);   // additional cut from Debuffers
  const setReduction = activeSetBonus(s.party).regenCutAdd;
  const combined = Math.max(PARTY_ABILITY_FLOOR, 1 - (shopReduction + partyReduction + setReduction));
  return mul(mul(targetRegen(zoneIndex, encounterIndex), bookDifficulty(s)), n(combined));
}

export function effectiveWords(s: GameState, zoneIndex: number, encounterIndex: number): Num {
  const setMult = activeSetBonus(s.party).wordsMult;
  return mul(mul(mul(targetWords(zoneIndex, encounterIndex), bookDifficulty(s)), n(pageTurnerMult(s))), n(setMult));
}

// A character's power including its CLASS star multiplier (stars live on state).
export function effectiveCharacterPower(state: GameState, c: Character): Num {
  return mul(characterPower(c), n(starStatMult(state.stars[c.classId])));
}

export function effectivePartyDps(s: GameState): Num {
  let sum = ZERO;
  for (const c of s.party) {
    const ab = findClass(c.classId).ability;
    const selfMult = ab.kind === 'loneWolf'
      ? 1 + ab.mag * c.level * starAbilityMult(s.stars[c.classId]) // Lone Wolf amps only itself
      : 1;
    sum = add(sum, mul(effectiveCharacterPower(s, c), n(selfMult)));
  }
  const supportMult = 1 + abilitySum(s.party, 'partyDps', s.stars);
  const hasProtagonist = s.party.some((c) => c.classId === 'protagonist');
  const plotArmorMult = hasProtagonist
    ? 1 + findClass('protagonist').ability.mag * distinctClassCount(s.party) * starAbilityMult(s.stars.protagonist)
    : 1;
  const setMult = activeSetBonus(s.party).dpsMult;
  return mul(mul(mul(mul(sum, n(sharpMult(s))), n(supportMult)), n(plotArmorMult)), n(setMult));
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
