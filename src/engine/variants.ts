// src/engine/variants.ts
// Variant ownership (per-class unlocked world skins) + equip. Cosmetic in
// Slice 3a; the 2/3/5 set bonus is Slice 3b. Pure functions over GameState.
import { ClassId, VARIANT_UNLOCK_ORDER } from './content';
import { GameState } from './state';

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
