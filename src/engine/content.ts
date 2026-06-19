import { Num, n, mul, pow, ZERO } from './num';

export const ENCOUNTERS_PER_ZONE = 6;
export const BOSS_INDEX = ENCOUNTERS_PER_ZONE; // 6 (slot after the 6 regulars)
export const RECRUIT_CAP = 5;
export const STARTING_PARTY_SIZE = 2;
export const TICK_SECONDS = 0.1;
export const OFFLINE_CAP_SECONDS = 12 * 3600;
export const AUTOSAVE_INTERVAL_MS = 15_000;
export const OFFLINE_MAX_ITERS = 200_000;
export const ROYALTY_BONUS = 0.5; // permanent +50% production per royalty

export interface ZoneDef {
  genre: string;
  bg: string;
  accent: string;
  enemyEmojis: string[];
  enemyNames: string[];
  bossEmoji: string;
  bossName: string;
}

export const ZONES: ZoneDef[] = [
  {
    genre: 'Wild West', bg: '#3a2a1a', accent: '#d9a441',
    enemyEmojis: ['🤠', '🐍', '🌵', '🐎', '🦅', '💰'],
    enemyNames: ['Bandit', 'Rattlesnake', 'Cactus Golem', 'Wild Stallion', 'Vulture', 'Claim Jumper'],
    bossEmoji: '🤵', bossName: 'The Black Hat Kingpin',
  },
  {
    genre: 'Zombie Apocalypse', bg: '#1c2a1c', accent: '#6abf69',
    enemyEmojis: ['🧟', '🏃', '🦴', '🩸', '📢', '☣️'],
    enemyNames: ['Shambler', 'Runner', 'Crawler', 'Bloater', 'Screamer', 'Infected Horde'],
    bossEmoji: '🧠', bossName: 'Patient Zero',
  },
  {
    genre: 'Space', bg: '#0b1020', accent: '#5ad7ff',
    enemyEmojis: ['👽', '🛸', '🤖', '☄️', '🪐', '⭐'],
    enemyNames: ['Xeno Scout', 'Drone Swarm', 'War Mech', 'Asteroid', 'Void Spawn', 'Star Reaver'],
    bossEmoji: '👾', bossName: 'The Hollow Star',
  },
];

export const ZONE_COUNT = ZONES.length;
export const TARGETS_PER_BOOK = ZONE_COUNT * (BOSS_INDEX + 1);

// --- tunable scaling curves ---
const BASE_ENCOUNTER_HP = n(10);
const HP_GROWTH_PER_ENCOUNTER = 1.6;
const HP_GROWTH_PER_ZONE = 12;
const BOSS_HP_MULT = n(4);
const BASE_BOSS_REGEN = n(3);
const REGEN_GROWTH_PER_ZONE = 12;
const BASE_INSP_RATE = n(1);
const INSP_GROWTH = 1.35; // per tier index
const BASE_WORDS = n(50);
const BOSS_WORDS_MULT = n(20);

export function tierIndex(zoneIndex: number, encounterIndex: number): number {
  return zoneIndex * (BOSS_INDEX + 1) + encounterIndex;
}

export function isBossIndex(encounterIndex: number): boolean {
  return encounterIndex >= BOSS_INDEX;
}

export function encounterHp(zoneIndex: number, encounterIndex: number): Num {
  return mul(
    mul(BASE_ENCOUNTER_HP, pow(n(HP_GROWTH_PER_ZONE), zoneIndex)),
    pow(n(HP_GROWTH_PER_ENCOUNTER), encounterIndex),
  );
}

export function targetMaxHp(zoneIndex: number, encounterIndex: number): Num {
  if (isBossIndex(encounterIndex)) {
    return mul(encounterHp(zoneIndex, ENCOUNTERS_PER_ZONE - 1), BOSS_HP_MULT);
  }
  return encounterHp(zoneIndex, encounterIndex);
}

export function targetRegen(zoneIndex: number, encounterIndex: number): Num {
  if (!isBossIndex(encounterIndex)) return ZERO;
  return mul(BASE_BOSS_REGEN, pow(n(REGEN_GROWTH_PER_ZONE), zoneIndex));
}

export function targetInspirationRate(zoneIndex: number, encounterIndex: number): Num {
  return mul(BASE_INSP_RATE, pow(n(INSP_GROWTH), tierIndex(zoneIndex, encounterIndex)));
}

export function targetWords(zoneIndex: number, encounterIndex: number): Num {
  const base = mul(BASE_WORDS, pow(n(HP_GROWTH_PER_ZONE), zoneIndex));
  return isBossIndex(encounterIndex) ? mul(base, BOSS_WORDS_MULT) : base;
}

export function targetName(zoneIndex: number, encounterIndex: number): string {
  const z = ZONES[zoneIndex];
  return isBossIndex(encounterIndex) ? z.bossName : z.enemyNames[encounterIndex];
}

export function targetEmoji(zoneIndex: number, encounterIndex: number): string {
  const z = ZONES[zoneIndex];
  return isBossIndex(encounterIndex) ? z.bossEmoji : z.enemyEmojis[encounterIndex];
}

export function targetsClearedInBook(zoneIndex: number, encounterIndex: number): number {
  return zoneIndex * (BOSS_INDEX + 1) + encounterIndex;
}
