// src/engine/save.ts
import { Num, ZERO, numToStr, strToNum } from './num';
import { GameState, Character, Upgrades, initialState, emptyUpgrades, makeStartingParty, makeStars } from './state';
import { ClassId, findClass, CLASSES } from './content';

export const SAVE_KEY = 'plotarmor.save.v1';
// Migration is structural (the isV3Party guard inspects field shape), not version-gated.
// SCHEMA_VERSION is stamped into the output so saves are self-describing.
export const SCHEMA_VERSION = 3;

// Derived from the authoritative class catalog so it can never drift out of sync.
const KNOWN_CLASS_IDS = new Set<string>(CLASSES.map((c) => c.id));

interface CharDTO { id: string; name: string; classId: string; level: number; basePower: string; }
interface SaveDTO {
  schemaVersion: number;
  lastSaved: number;
  inspiration: string;
  words: string;
  royalties: string;
  party: CharDTO[];
  zone: { zoneIndex: number; encounterIndex: number };
  currentHp: string;
  bookComplete: boolean;
  bookNumber: number;
  upgrades: Upgrades;
}

function mergeUpgrades(u: Partial<Upgrades> | undefined): Upgrades {
  const e = emptyUpgrades();
  if (!u || typeof u !== 'object') return e;
  const numOrDefault = (v: unknown, d: number): number => (typeof v === 'number' ? v : d);
  const boolOrDefault = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d);
  return {
    prolific: numOrDefault(u.prolific, e.prolific),
    sharpProse: numOrDefault(u.sharpProse, e.sharpProse),
    pageTurner: numOrDefault(u.pageTurner, e.pageTurner),
    muse: numOrDefault(u.muse, e.muse),
    nightOwl: numOrDefault(u.nightOwl, e.nightOwl),
    frugalDrafts: numOrDefault(u.frugalDrafts, e.frugalDrafts),
    ensembleCast: boolOrDefault(u.ensembleCast, e.ensembleCast),
    ghostwriter: boolOrDefault(u.ghostwriter, e.ghostwriter),
  };
}

export function serialize(state: GameState): string {
  const dto: SaveDTO = {
    schemaVersion: SCHEMA_VERSION,
    lastSaved: state.lastSaved,
    inspiration: numToStr(state.inspiration),
    words: numToStr(state.words),
    royalties: numToStr(state.royalties),
    party: state.party.map((c) => ({ id: c.id, name: c.name, classId: c.classId, level: c.level, basePower: numToStr(c.basePower) })),
    zone: { zoneIndex: state.zone.zoneIndex, encounterIndex: state.zone.encounterIndex },
    currentHp: numToStr(state.currentHp),
    bookComplete: state.bookComplete,
    bookNumber: state.bookNumber,
    upgrades: state.upgrades,
  };
  return JSON.stringify(dto);
}

// Tolerant: missing fields fall back to fresh defaults; unknown fields (incl. the v1
// `prestigeMultiplier`) are ignored. A v1 save's `royalties` is preserved as the wallet.
export function deserialize(raw: string, nowMs: number): GameState {
  const fresh = initialState(nowMs);
  let dto: Partial<SaveDTO>;
  try {
    dto = JSON.parse(raw) as Partial<SaveDTO>;
  } catch {
    return fresh;
  }
  const numOr = (s: string | undefined, fallback: Num): Num => (typeof s === 'string' ? strToNum(s) : fallback);

  const isV3Party =
    Array.isArray(dto.party) && dto.party.length > 0 &&
    dto.party.every((c) => typeof (c as { classId?: unknown }).classId === 'string' &&
      KNOWN_CLASS_IDS.has((c as { classId: string }).classId));

  const party: Character[] = isV3Party
    ? (dto.party as CharDTO[]).map((c, i) => ({
        id: c.id ?? `c${i}`,
        name: c.name ?? `Character ${i + 1}`,
        classId: c.classId as ClassId,
        level: typeof c.level === 'number' ? c.level : 1,
        basePower: numOr(c.basePower, findClass(c.classId as ClassId).classBasePower),
      }))
    : makeStartingParty(); // pre-v3 / classless: reseed the ephemeral party

  return {
    schemaVersion: SCHEMA_VERSION,
    lastSaved: typeof dto.lastSaved === 'number' ? dto.lastSaved : nowMs,
    inspiration: numOr(dto.inspiration, ZERO),
    words: numOr(dto.words, ZERO),
    royalties: numOr(dto.royalties, ZERO),
    party,
    zone: { zoneIndex: dto.zone?.zoneIndex ?? 0, encounterIndex: dto.zone?.encounterIndex ?? 0 },
    currentHp: numOr(dto.currentHp, fresh.currentHp),
    bookComplete: typeof dto.bookComplete === 'boolean' ? dto.bookComplete : false,
    bookNumber: typeof dto.bookNumber === 'number' ? dto.bookNumber : 1,
    upgrades: mergeUpgrades(dto.upgrades),
    edits: ZERO,              // STOPGAP — Task 6 reads dto.edits
    stars: makeStars(),       // STOPGAP — Task 6 reads dto.stars
  };
}

export function save(state: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, serialize(state));
  } catch {
    /* storage unavailable/full — ignore for a single-user local game */
  }
}

export function load(nowMs: number): GameState | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(SAVE_KEY);
  } catch {
    raw = null;
  }
  if (!raw) return null;
  return deserialize(raw, nowMs);
}

export function exportSave(state: GameState): string {
  return btoa(unescape(encodeURIComponent(serialize(state))));
}

export function importSave(encoded: string, nowMs: number): GameState {
  return deserialize(decodeURIComponent(escape(atob(encoded))), nowMs);
}
