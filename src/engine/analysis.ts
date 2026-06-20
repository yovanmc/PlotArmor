// src/engine/analysis.ts
// Pure tuning instruments: compare loadout archetypes by total book DPS output.
// Used by the balance report to tune the Ensemble/affinity/set magnitudes to parity.
import { GameState, initialState, makeCharacter, Character } from './state';
import { ZONE_COUNT } from './content';
import { effectivePartyDps } from './modifiers';
import { Num, add, toNum, ZERO } from './num';

// A representative fielded combat party at a fixed level, wearing a given set of worlds.
function partyWearing(worlds: (number | null)[]): Character[] {
  const classes = ['protagonist', 'antihero', 'support', 'debuffer', 'sidekick'] as const;
  return worlds.map((w, i) => ({ ...makeCharacter(`c${i}`, classes[i], 12), variantWorld: w }));
}

// Sum effectivePartyDps across all zones of a book (affinity fires per matching zone).
function bookOutput(party: Character[]): number {
  const base = initialState(0);
  let total: Num = ZERO;
  for (let z = 0; z < ZONE_COUNT; z++) {
    const s: GameState = { ...base, party, zone: { zoneIndex: z, encounterIndex: 0 } };
    total = add(total, effectivePartyDps(s));
  }
  return toNum(total);
}

// Mono = all 5 wear world 2 (Space, a dps-axis set). Rainbow = 5 distinct worlds incl. Space.
export function compareLoadouts(): { mono: number; rainbow: number; ratio: number } {
  const mono = bookOutput(partyWearing([2, 2, 2, 2, 2]));
  const rainbow = bookOutput(partyWearing([2, 5, 0, 3, 4]));
  return { mono, rainbow, ratio: rainbow / mono };
}
