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
  {
    genre: 'High Fantasy', bg: '#1a1426', accent: '#c77dff',
    enemyEmojis: ['👺', '🐺', '💀', '🧝', '🗿', '🧌'],
    enemyNames: ['Goblin', 'Dire Wolf', 'Skeleton', 'Dark Elf', 'Stone Troll', 'Ogre'],
    bossEmoji: '🐲', bossName: 'The Elder Dragon',
  },
  {
    genre: 'Pirate Seas', bg: '#0e1f24', accent: '#3fae9f',
    enemyEmojis: ['🗡️', '🐀', '💣', '🦈', '🐍', '☠️'],
    enemyNames: ['Cutthroat', 'Cabin Rat', 'Cannoneer', 'Reef Shark', 'Sea Serpent', 'Cursed Sailor'],
    bossEmoji: '🏴‍☠️', bossName: 'The Dread Captain',
  },
  {
    genre: 'Noir City', bg: '#17171c', accent: '#b8bcc8',
    enemyEmojis: ['🧤', '🥊', '💋', '👮', '🔫', '🍾'],
    enemyNames: ['Pickpocket', 'Enforcer', 'Femme Fatale', 'Crooked Cop', 'Hitman', 'Bootlegger'],
    bossEmoji: '🎩', bossName: 'Mr. Big',
  },
  {
    genre: 'Eldritch Horror', bg: '#11160e', accent: '#9fe04a',
    enemyEmojis: ['🕯️', '🐟', '👤', '👻', '🦑', '🌀'],
    enemyNames: ['Cultist', 'Deep One', 'Crawling Shadow', 'Wraith', 'Spawn', 'Mind Fog'],
    bossEmoji: '👁️', bossName: 'The Sleeper',
  },
  {
    genre: 'Prehistoric', bg: '#241a10', accent: '#e07b39',
    enemyEmojis: ['🦎', '🦅', '🐯', '🦣', '🦕', '🌋'],
    enemyNames: ['Raptor', 'Pterodactyl', 'Sabertooth', 'Mammoth', 'Stegosaurus', 'Tar Pit'],
    bossEmoji: '🦖', bossName: 'The Tyrant King',
  },
];

export const ZONE_COUNT = ZONES.length;
export const TARGETS_PER_BOOK = ZONE_COUNT * (BOSS_INDEX + 1);

// --- tunable scaling curves ---
// Character power grows MULTIPLICATIVELY per level (power = basePower * POWER_GROWTH^(level-1)).
// This is what lets bought DPS keep pace with exponential enemy scaling; at level 1 power == basePower.
export const POWER_GROWTH = 1.45;
const BASE_ENCOUNTER_HP = n(10);
const HP_GROWTH_PER_ENCOUNTER = 1.6;
const HP_GROWTH_PER_ZONE = 6.5;
const BOSS_HP_MULT = n(4);
const BASE_BOSS_REGEN = n(3);
const REGEN_GROWTH_PER_ZONE = 5.5;
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

// ---------------------------------------------------------------------------
// Prestige depth (v2): escalation, royalty faucet, upgrade bounds — ALL tunable
// ---------------------------------------------------------------------------

export const BOOK_SCALE = 3.5;      // per-book difficulty/size growth; D(b) = BOOK_SCALE^(b-1)
export const ROYALTY_K = n(1);      // royalty payout coefficient
export const ROYALTY_W0 = n(10000); // royalty payout divisor (manuscript scale)

export const PROLIFIC_MAG = 0.10;   // +10% inspiration rate per level
export const SHARP_MAG = 0.10;      // +10% party DPS per level
export const PAGETURNER_MAG = 0.10; // +10% words per clear per level
export const MUSE_MAG = 0.05;       // -5% boss regen per level
export const MUSE_FLOOR = 0.10;     // regen multiplier floor (>=10% of base; max 90% reduction)
export const FRUGAL_MAG = 0.05;     // -5% spend costs per level
export const FRUGAL_FLOOR = 0.25;   // cost multiplier floor (>=25% of base; max 75% reduction)
export const NIGHT_OWL_HOURS_PER_LEVEL = 2; // +2h offline cap per level
export const GHOSTWRITER_LEVEL = 5; // pre-leveled new-book start when owned

// --- base spend-cost curves (the project's level/recruit cost curves) ---
const LEVEL_BASE_COST = n(10);
const LEVEL_COST_GROWTH = 1.5;
const RECRUIT_BASE_COST = n(100);
const RECRUIT_COST_GROWTH = 6;

export function baseLevelCost(level: number): Num {
  return mul(LEVEL_BASE_COST, pow(n(LEVEL_COST_GROWTH), level - 1));
}

export function baseRecruitCost(partySize: number): Num {
  return mul(RECRUIT_BASE_COST, pow(n(RECRUIT_COST_GROWTH), partySize - 2));
}

// --- upgrade catalog (static data) ---
export type RepeatableUpgradeId =
  | 'prolific' | 'sharpProse' | 'pageTurner' | 'muse' | 'nightOwl' | 'frugalDrafts';
export type OneTimeUpgradeId = 'ensembleCast' | 'ghostwriter';
export type UpgradeId = RepeatableUpgradeId | OneTimeUpgradeId;

export interface RepeatableUpgradeDef {
  id: RepeatableUpgradeId;
  kind: 'repeatable';
  name: string;
  desc: string;
  baseCost: Num;
  costGrowth: number;
}
export interface OneTimeUpgradeDef {
  id: OneTimeUpgradeId;
  kind: 'oneTime';
  name: string;
  desc: string;
  cost: Num;
}
export type UpgradeDef = RepeatableUpgradeDef | OneTimeUpgradeDef;

export const REPEATABLE_UPGRADES: RepeatableUpgradeDef[] = [
  { id: 'prolific', kind: 'repeatable', name: 'Prolific', desc: '+10% Inspiration rate per level', baseCost: n(3), costGrowth: 2 },
  { id: 'sharpProse', kind: 'repeatable', name: 'Sharp Prose', desc: '+10% party DPS per level', baseCost: n(3), costGrowth: 2 },
  { id: 'pageTurner', kind: 'repeatable', name: 'Page-Turner', desc: '+10% Words per clear per level', baseCost: n(5), costGrowth: 2 },
  { id: 'muse', kind: 'repeatable', name: 'Muse', desc: '-5% boss regen per level (max 90%)', baseCost: n(4), costGrowth: 2 },
  { id: 'nightOwl', kind: 'repeatable', name: 'Night Owl', desc: '+2h offline cap per level', baseCost: n(2), costGrowth: 2 },
  { id: 'frugalDrafts', kind: 'repeatable', name: 'Frugal Drafts', desc: '-5% level/recruit costs per level (max 75%)', baseCost: n(3), costGrowth: 2 },
];

export const ONE_TIME_UPGRADES: OneTimeUpgradeDef[] = [
  { id: 'ensembleCast', kind: 'oneTime', name: 'Ensemble Cast', desc: 'Party cap 5 -> 6', cost: n(25) },
  { id: 'ghostwriter', kind: 'oneTime', name: 'Ghostwriter', desc: 'Start each new book at level 5', cost: n(15) },
];

export function findUpgrade(id: UpgradeId): UpgradeDef {
  const all: UpgradeDef[] = [...REPEATABLE_UPGRADES, ...ONE_TIME_UPGRADES];
  const def = all.find((u) => u.id === id);
  if (!def) throw new Error(`Unknown upgrade: ${id}`);
  return def;
}

// --- party stars + the Edits economy (Slice 2) -------------------------------
// Stars are PER-CLASS (1..MAX_STAR). starStatMult scales class base power and
// starAbilityMult scales class ability magnitude; both are 1 at 1 star so the
// fresh game is identical to Slice 1. Edits are a global currency dropped by
// bosses, spent to raise a class's star. ALL magnitudes are harness-tuned.
export const MAX_STAR = 5;
export const STAR_GROWTH = 1.6;          // class base-power multiplier per star
export const STAR_ABILITY_GROWTH = 1.5;  // class ability-magnitude multiplier per star
export const EDITS_BASE = n(2);          // Edits cost of the 1*->2* step
export const STAR_COST_GROWTH = 2;       // star-up cost escalation per star
export const EDITS_PER_BOSS = n(1);      // base Edits per boss kill (book 1)
export const EDIT_BOOK_GROWTH = 1.25;    // gentle per-book growth of the boss drop

export function starStatMult(stars: number): number {
  return Math.pow(STAR_GROWTH, stars - 1);
}

export function starAbilityMult(stars: number): number {
  return Math.pow(STAR_ABILITY_GROWTH, stars - 1);
}

// Edits to go from `currentStar` to `currentStar + 1`.
export function starUpCost(currentStar: number): Num {
  return mul(EDITS_BASE, pow(n(STAR_COST_GROWTH), currentStar - 1));
}

// Edits dropped by a boss kill in the given book. Grows gently with the book
// number (stars are a bounded permanent boost, not a scaling mechanism).
export function bossEditDrop(bookNumber: number): Num {
  return mul(EDITS_PER_BOSS, pow(n(EDIT_BOOK_GROWTH), bookNumber - 1));
}

// --- star-prestige: the Legacy track (Edits sink past 5★) --------------------
// Once classes are maxed at 5★, surplus Edits buy global "Legacy" levels. Each
// level multiplies EVERY character's power AND ability magnitude by LEGACY_GROWTH
// (legacyMult(0) === 1, so it is neutral by default). LEGACY_BASE is high enough
// that raising stars stays the better early buy. ALL three are tunable placeholders.
export const LEGACY_GROWTH = 1.5;        // global power+ability multiplier per Legacy level
export const LEGACY_BASE = n(128);       // Edits cost of the first Legacy level
export const LEGACY_COST_GROWTH = 2;     // cost escalation per level

export function legacyMult(level: number): number {
  return Math.pow(LEGACY_GROWTH, level);
}

export function legacyCost(level: number): Num {
  return mul(LEGACY_BASE, pow(n(LEGACY_COST_GROWTH), level));
}

// --- world variants (Slice 3a) ----------------------------------------------
// A character can wear a cosmetic skin from any world its class has unlocked.
// Variants are (classId x worldIndex); display-only in Slice 3a (the 2/3/5 set
// bonus is Slice 3b). Clearing a world's boss unlocks the next class's variant
// for that world in this FIXED order (deterministic, no RNG):
export const VARIANT_UNLOCK_ORDER: ClassId[] = [
  'protagonist', 'antihero', 'support', 'debuffer', 'sidekick', 'scribe',
];

// One "writer face" emoji per world (index-aligned with ZONES). Cosmetic only.
export const WORLD_FACE: string[] = ['🤠', '🧟', '🚀', '🧙', '🏴‍☠️', '🕵️', '🐙', '🦴'];

export function worldGenre(worldIndex: number): string {
  return ZONES[worldIndex].genre;
}

// --- world set bonus (Slice 3b) ---------------------------------------------
// Fielding 2 / 3 / 5 characters wearing the SAME world's variant grants a tier
// 1 / 2 / 3 bonus. Thresholds are uniform across worlds; the bonus AXIS differs
// per world so each collection has its own identity. ALL magnitudes + the axis
// mapping are harness-/owner-tuned placeholders.
export type SetAxis = 'dps' | 'insp' | 'words' | 'editDrop' | 'regenCut';

export interface SetBonusDef {
  axis: SetAxis;
  tiers: [number, number, number]; // magnitude at tier 1 / 2 / 3
}

export const SET_THRESHOLDS: [number, number, number] = [2, 3, 5];

// How many same-world variants are fielded -> tier (0 = none).
export function setTier(count: number): number {
  if (count >= SET_THRESHOLDS[2]) return 3;
  if (count >= SET_THRESHOLDS[1]) return 2;
  if (count >= SET_THRESHOLDS[0]) return 1;
  return 0;
}

// Index-aligned with ZONES. `dps`/`insp`/`words`/`editDrop` are +fraction
// multipliers; `regenCut` is an additive reduction to boss regen (shares the
// PARTY_ABILITY_FLOOR with the shop `muse` upgrade + Debuffers).
export const WORLD_SET_BONUS: SetBonusDef[] = [
  { axis: 'insp',     tiers: [0.15, 0.35, 0.75] }, // 0 Wild West — frontier hustle
  { axis: 'regenCut', tiers: [0.05, 0.12, 0.25] }, // 1 Zombie Apocalypse — break the horde
  { axis: 'dps',      tiers: [0.10, 0.20, 0.35] }, // 2 Space — "speed"
  { axis: 'words',    tiers: [0.20, 0.50, 1.00] }, // 3 High Fantasy — epic tomes
  { axis: 'editDrop', tiers: [0.25, 0.60, 1.20] }, // 4 Pirate Seas — plunder
  { axis: 'dps',      tiers: [0.10, 0.20, 0.35] }, // 5 Noir City — sharp investigation
  { axis: 'regenCut', tiers: [0.05, 0.12, 0.25] }, // 6 Eldritch Horror — dread weakens foes
  { axis: 'insp',     tiers: [0.15, 0.35, 0.75] }, // 7 Prehistoric — primal abundance
];

// --- zone affinity (Slice 4) ------------------------------------------------
// A fielded character is "in its element" when its equipped skin's world matches
// the CURRENT zone. While in its element, its WHOLE contribution (power + class
// ability) is scaled by 1 + AFFINITY_MAG. Distinct from the makeup-based set
// bonus (§6b): affinity is dynamic per-zone. Harness-/owner-tuned placeholder.
export const AFFINITY_MAG = 0.7;

// --- Ensemble (diversity) set — Slice-4 sibling -----------------------------
// Fielding N DISTINCT worlds grants an always-on Ensemble bonus that AMPLIFIES
// zone affinity (go broad -> your in-element characters hit harder). Mirrors the
// same-world set (SET_THRESHOLDS). Harness-/owner-tuned placeholders.
export const ENSEMBLE_THRESHOLDS: [number, number, number] = [3, 4, 5];
export const ENSEMBLE_AFFINITY_AMP: [number, number, number] = [0.8, 1.6, 3.0];

export function ensembleTier(distinctCount: number): number {
  if (distinctCount >= ENSEMBLE_THRESHOLDS[2]) return 3;
  if (distinctCount >= ENSEMBLE_THRESHOLDS[1]) return 2;
  if (distinctCount >= ENSEMBLE_THRESHOLDS[0]) return 1;
  return 0;
}

// --- Protagonist track (Royalty-funded promotion) ---------------------------
// The Protagonist has no Edits stars; it is PROMOTED 1*->MAX_STAR with Royalties
// in the Publishing House. Cost rises per star. Tunable placeholders (Royalties
// are scarce, so this is a long-term prestige sink).
export const PROTAGONIST_PROMOTE_BASE = n(3);  // Royalties for 1*->2*
export const PROTAGONIST_PROMOTE_GROWTH = 2;   // cost escalation per star

export function protagonistPromoteCost(currentStar: number): Num {
  return mul(PROTAGONIST_PROMOTE_BASE, pow(n(PROTAGONIST_PROMOTE_GROWTH), currentStar - 1));
}

// --- party classes (Slice 1) -------------------------------------------------
export type ClassId = 'protagonist' | 'antihero' | 'support' | 'debuffer' | 'sidekick' | 'scribe';
export type AbilityKind = 'plotArmor' | 'loneWolf' | 'partyDps' | 'regenCut' | 'inspRate' | 'dot';

export interface ClassDef {
  id: ClassId;
  name: string;
  classBasePower: Num;
  ability: { kind: AbilityKind; mag: number }; // mag is per-level (× star later); placeholder values
}

// ALL magnitudes + base powers are placeholders, tuned later against the balance harness.
export const CLASSES: ClassDef[] = [
  { id: 'protagonist', name: 'The Protagonist', classBasePower: n(1.0), ability: { kind: 'plotArmor', mag: 0.08 } },
  { id: 'antihero',    name: 'Anti-hero',       classBasePower: n(1.0), ability: { kind: 'loneWolf', mag: 0.04 } },
  { id: 'support',     name: 'Support',         classBasePower: n(0.6), ability: { kind: 'partyDps', mag: 0.025 } },
  { id: 'debuffer',    name: 'Debuffer',        classBasePower: n(0.5), ability: { kind: 'regenCut', mag: 0.025 } },
  { id: 'sidekick',    name: 'Sidekick',        classBasePower: n(0.5), ability: { kind: 'inspRate', mag: 0.025 } },
  { id: 'scribe',      name: 'The Critic',      classBasePower: n(0.5), ability: { kind: 'dot', mag: 0.003 } },
];

export const PARTY_ABILITY_FLOOR = 0.10; // regen-cut floor shared with the shop `muse` upgrade

export function findClass(id: ClassId): ClassDef {
  const def = CLASSES.find((c) => c.id === id);
  if (!def) throw new Error(`Unknown class: ${id}`);
  return def;
}
