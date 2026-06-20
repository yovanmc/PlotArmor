// src/engine/save.ts
import { Num, ZERO, numToStr, strToNum } from './num';
import { GameState, Character, Upgrades, initialState, emptyUpgrades, makeStartingParty, makeStars, makeUnlockedVariants } from './state';
import { ClassId, findClass, CLASSES, MAX_STAR, ZONE_COUNT } from './content';

export const SAVE_KEY = 'plotarmor.save.v1';
// Migration is structural (the isV3Party guard inspects field shape), not version-gated.
// SCHEMA_VERSION is stamped into the output so saves are self-describing.
export const SCHEMA_VERSION = 6;

// Derived from the authoritative class catalog so it can never drift out of sync.
const KNOWN_CLASS_IDS = new Set<string>(CLASSES.map((c) => c.id));

interface CharDTO { id: string; name: string; classId: string; level: number; basePower: string; variantWorld: number | null; }
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
  edits: string;
  stars: Record<string, number>;
  unlockedVariants: Record<string, number[]>;
  legacy: number;
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

// Read per-class stars defensively: every class defaults to 1, values are
// clamped to [1, MAX_STAR], and unknown keys are dropped. Derived from CLASSES.
function sanitizeStars(raw: unknown): Record<ClassId, number> {
  const out = makeStars();
  if (raw && typeof raw === 'object') {
    for (const c of CLASSES) {
      const v = (raw as Record<string, unknown>)[c.id];
      if (typeof v === 'number' && Number.isFinite(v)) {
        out[c.id] = Math.max(1, Math.min(MAX_STAR, Math.floor(v)));
      }
    }
  }
  return out;
}

// A valid world index is an integer in [0, ZONE_COUNT); anything else -> null.
function validWorld(v: unknown): number | null {
  if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < ZONE_COUNT) return v;
  return null;
}

// A valid legacy level is a non-negative integer; anything else -> 0.
function sanitizeLegacy(raw: unknown): number {
  return typeof raw === 'number' && Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
}

// Read per-class unlocked worlds defensively: drop unknown class keys, drop
// out-of-range worlds, dedup, default each class to []. Derived from CLASSES.
function sanitizeUnlocked(raw: unknown): Record<ClassId, number[]> {
  const out = makeUnlockedVariants();
  if (raw && typeof raw === 'object') {
    for (const c of CLASSES) {
      const list = (raw as Record<string, unknown>)[c.id];
      if (Array.isArray(list)) {
        const seen = new Set<number>();
        for (const v of list) {
          const w = validWorld(v);
          if (w !== null && !seen.has(w)) { seen.add(w); out[c.id].push(w); }
        }
      }
    }
  }
  return out;
}

export function serialize(state: GameState): string {
  const dto: SaveDTO = {
    schemaVersion: SCHEMA_VERSION,
    lastSaved: state.lastSaved,
    inspiration: numToStr(state.inspiration),
    words: numToStr(state.words),
    royalties: numToStr(state.royalties),
    party: state.party.map((c) => ({ id: c.id, name: c.name, classId: c.classId, level: c.level, basePower: numToStr(c.basePower), variantWorld: c.variantWorld })),
    zone: { zoneIndex: state.zone.zoneIndex, encounterIndex: state.zone.encounterIndex },
    currentHp: numToStr(state.currentHp),
    bookComplete: state.bookComplete,
    bookNumber: state.bookNumber,
    upgrades: state.upgrades,
    edits: numToStr(state.edits),
    stars: state.stars,
    unlockedVariants: state.unlockedVariants,
    legacy: state.legacy,
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
        variantWorld: validWorld((c as { variantWorld?: unknown }).variantWorld),
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
    edits: numOr(dto.edits, ZERO),
    stars: sanitizeStars(dto.stars),
    unlockedVariants: sanitizeUnlocked(dto.unlockedVariants),
    legacy: sanitizeLegacy(dto.legacy),
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
