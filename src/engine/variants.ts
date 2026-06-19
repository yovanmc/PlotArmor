// src/engine/variants.ts
// Variant ownership (per-class unlocked world skins) + equip. Cosmetic in
// Slice 3a; the 2/3/5 set bonus is Slice 3b. Pure functions over GameState.
import { ClassId, VARIANT_UNLOCK_ORDER, WORLD_SET_BONUS, setTier } from './content';
import { GameState, Character } from './state';

// On clearing world `worldIndex`'s boss, unlock the next class's variant for that
// world in VARIANT_UNLOCK_ORDER. Returns a NEW map (or the same one if the
// world's set is already complete for every class). Never mutates the input.
export function unlockNextVariant(
  unlocked: Record<ClassId, number[]>,
  worldIndex: number,
): Record<ClassId, number[]> {
  for (const classId of VARIANT_UNLOCK_ORDER) {
    if (!unlocked[classId].includes(worldIndex)) {
      return { ...unlocked, [classId]: [...unlocked[classId], worldIndex] };
    }
  }
  return unlocked;
}

export function isVariantUnlocked(state: GameState, classId: ClassId, worldIndex: number): boolean {
  return state.unlockedVariants[classId].includes(worldIndex);
}

export function unlockedWorldsFor(state: GameState, classId: ClassId): number[] {
  return state.unlockedVariants[classId];
}

// Equip a world skin on a fielded character (null = base look). Equips a
// non-null world only if that character's class has unlocked it; otherwise the
// state is returned unchanged (same reference).
export function setVariant(state: GameState, characterId: string, worldIndex: number | null): GameState {
  const c = state.party.find((p) => p.id === characterId);
  if (!c) return state;
  if (worldIndex !== null && !isVariantUnlocked(state, c.classId, worldIndex)) return state;
  return {
    ...state,
    party: state.party.map((p) => (p.id === characterId ? { ...p, variantWorld: worldIndex } : p)),
  };
}

export interface SetBonus {
  dpsMult: number;
  inspMult: number;
  wordsMult: number;
  editDropMult: number;
  regenCutAdd: number; // additive reduction to boss regen (shares the floor)
}

// How many fielded characters wear each world's variant (base look ignored).
function worldCounts(party: Character[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const c of party) {
    if (c.variantWorld !== null) counts.set(c.variantWorld, (counts.get(c.variantWorld) ?? 0) + 1);
  }
  return counts;
}

// Aggregate the active set bonuses across all fielded same-world groups.
export function activeSetBonus(party: Character[]): SetBonus {
  const b: SetBonus = { dpsMult: 1, inspMult: 1, wordsMult: 1, editDropMult: 1, regenCutAdd: 0 };
  for (const [world, count] of worldCounts(party)) {
    const tier = setTier(count);
    if (tier === 0) continue;
    const def = WORLD_SET_BONUS[world];
    const mag = def.tiers[tier - 1];
    switch (def.axis) {
      case 'dps': b.dpsMult *= 1 + mag; break;
      case 'insp': b.inspMult *= 1 + mag; break;
      case 'words': b.wordsMult *= 1 + mag; break;
      case 'editDrop': b.editDropMult *= 1 + mag; break;
      case 'regenCut': b.regenCutAdd += mag; break;
    }
  }
  return b;
}

// UI helper: the worlds currently granting a bonus, with count + tier.
export function setBonusBreakdown(party: Character[]): { world: number; count: number; tier: number }[] {
  const out: { world: number; count: number; tier: number }[] = [];
  for (const [world, count] of worldCounts(party)) {
    const tier = setTier(count);
    if (tier > 0) out.push({ world, count, tier });
  }
  return out;
}
