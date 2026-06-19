import { Num, n, ZERO, ONE, numToStr, strToNum } from './num';
import { GameState, Character, initialState } from './state';

export const SAVE_KEY = 'plotarmor.save.v1';
export const SCHEMA_VERSION = 1;

interface CharDTO { id: string; name: string; level: number; basePower: string; }
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
  prestigeMultiplier: string;
}

export function serialize(state: GameState): string {
  const dto: SaveDTO = {
    schemaVersion: SCHEMA_VERSION,
    lastSaved: state.lastSaved,
    inspiration: numToStr(state.inspiration),
    words: numToStr(state.words),
    royalties: numToStr(state.royalties),
    party: state.party.map((c) => ({
      id: c.id, name: c.name, level: c.level, basePower: numToStr(c.basePower),
    })),
    zone: { zoneIndex: state.zone.zoneIndex, encounterIndex: state.zone.encounterIndex },
    currentHp: numToStr(state.currentHp),
    bookComplete: state.bookComplete,
    bookNumber: state.bookNumber,
    prestigeMultiplier: numToStr(state.prestigeMultiplier),
  };
  return JSON.stringify(dto);
}

// Tolerant: missing fields fall back to a fresh state; unknown fields are ignored.
export function deserialize(raw: string, nowMs: number): GameState {
  const fresh = initialState(nowMs);
  let dto: Partial<SaveDTO>;
  try {
    dto = JSON.parse(raw) as Partial<SaveDTO>;
  } catch {
    return fresh;
  }
  const numOr = (s: string | undefined, fallback: Num): Num =>
    typeof s === 'string' ? strToNum(s) : fallback;

  const party: Character[] =
    Array.isArray(dto.party) && dto.party.length > 0
      ? dto.party.map((c, i) => ({
          id: c?.id ?? `c${i}`,
          name: c?.name ?? `Character ${i + 1}`,
          level: typeof c?.level === 'number' ? c.level : 1,
          basePower: numOr(c?.basePower, n(1)),
        }))
      : fresh.party;

  return {
    schemaVersion: SCHEMA_VERSION,
    lastSaved: typeof dto.lastSaved === 'number' ? dto.lastSaved : nowMs,
    inspiration: numOr(dto.inspiration, ZERO),
    words: numOr(dto.words, ZERO),
    royalties: numOr(dto.royalties, ZERO),
    party,
    zone: {
      zoneIndex: dto.zone?.zoneIndex ?? 0,
      encounterIndex: dto.zone?.encounterIndex ?? 0,
    },
    currentHp: numOr(dto.currentHp, fresh.currentHp),
    bookComplete: typeof dto.bookComplete === 'boolean' ? dto.bookComplete : false,
    bookNumber: typeof dto.bookNumber === 'number' ? dto.bookNumber : 1,
    prestigeMultiplier: numOr(dto.prestigeMultiplier, ONE),
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
  const json = decodeURIComponent(escape(atob(encoded)));
  return deserialize(json, nowMs);
}
