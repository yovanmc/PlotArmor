// src/engine/save.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import * as num from './num';
import { initialState, emptyUpgrades, makeCharacter, makeUnlockedVariants } from './state';
import { serialize, deserialize, save, load, exportSave, importSave, SAVE_KEY } from './save';

describe('save', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a non-trivial state incl. upgrades', () => {
    const s = {
      ...initialState(1234),
      inspiration: num.n('1.5e40'),
      royalties: num.n(7),
      upgrades: { ...emptyUpgrades(), prolific: 3, ensembleCast: true },
    };
    const back = deserialize(serialize(s), 0);
    expect(num.eq(back.inspiration, s.inspiration)).toBe(true);
    expect(num.eq(back.royalties, s.royalties)).toBe(true);
    expect(back.upgrades.prolific).toBe(3);
    expect(back.upgrades.ensembleCast).toBe(true);
    expect(back.party.length).toBe(s.party.length);
    expect(back.lastSaved).toBe(1234);
    expect(back.schemaVersion).toBe(6);
  });

  it('migrates a v1 save: keeps royalties as wallet, ignores prestigeMultiplier, defaults upgrades, reseeds party', () => {
    const v1 = JSON.stringify({
      schemaVersion: 1, lastSaved: 5, inspiration: '100', words: '200', royalties: '4',
      prestigeMultiplier: '2.5', party: [{ id: 'c0', name: 'Quill', level: 3, basePower: '1' }],
      zone: { zoneIndex: 1, encounterIndex: 2 }, currentHp: '50', bookComplete: false, bookNumber: 2,
    });
    const s = deserialize(v1, 9);
    expect(num.eq(s.royalties, num.n(4))).toBe(true);
    expect(s.upgrades).toEqual(emptyUpgrades());
    expect(s.schemaVersion).toBe(6);
    expect((s as unknown as Record<string, unknown>).prestigeMultiplier).toBeUndefined();
    // classless party → reseeded; progress is intact
    expect(s.party[0].classId).toBe('protagonist');
    expect(s.party.length).toBe(2);
  });

  it('tolerates missing fields and ignores unknown fields', () => {
    const partial = deserialize('{"inspiration":"500","mysteryField":42}', 7);
    expect(num.eq(partial.inspiration, num.n(500))).toBe(true);
    expect(num.eq(partial.royalties, num.ZERO)).toBe(true);
    expect(partial.upgrades).toEqual(emptyUpgrades());
    expect(partial.party.length).toBe(initialState(0).party.length);
  });

  it('returns a fresh state on malformed JSON', () => {
    const fresh = deserialize('not json', 9);
    expect(num.eq(fresh.inspiration, num.ZERO)).toBe(true);
    expect(fresh.lastSaved).toBe(9);
  });

  it('save() then load() persists through localStorage', () => {
    save({ ...initialState(0), inspiration: num.n(777) });
    expect(localStorage.getItem(SAVE_KEY)).toBeTruthy();
    expect(num.eq(load(0)!.inspiration, num.n(777))).toBe(true);
  });

  it('load() returns null when nothing is saved', () => {
    expect(load(0)).toBeNull();
  });

  it('export/import round-trips via an opaque string', () => {
    const s = { ...initialState(0), words: num.n('1e12'), upgrades: { ...emptyUpgrades(), muse: 2 } };
    const back = importSave(exportSave(s), 0);
    expect(num.eq(back.words, num.n('1e12'))).toBe(true);
    expect(back.upgrades.muse).toBe(2);
  });

  it('round-trips classId for a v3 save', () => {
    const s = { ...initialState(0), party: [makeCharacter('c0', 'protagonist', 2), makeCharacter('c1', 'debuffer', 3)] };
    const back = deserialize(serialize(s), 0);
    expect(back.party.map((c) => c.classId)).toEqual(['protagonist', 'debuffer']);
    expect(back.party[1].level).toBe(3);
  });

  it('migrates a pre-v3 (classless) save by reseeding the party but keeping progress', () => {
    const legacy = JSON.stringify({
      schemaVersion: 2, lastSaved: 0, inspiration: '500', words: '1234', royalties: '7',
      party: [{ id: 'c0', name: 'Quill', level: 5, basePower: '1' }],
      zone: { zoneIndex: 1, encounterIndex: 2 }, currentHp: '10', bookComplete: false, bookNumber: 3,
      upgrades: { prolific: 2 },
    });
    const s = deserialize(legacy, 0);
    expect(num.toNum(s.royalties)).toBe(7);
    expect(s.bookNumber).toBe(3);
    expect(s.upgrades.prolific).toBe(2);
    expect(s.party[0].classId).toBe('protagonist'); // party reseeded into the class system
  });

  it('reseeds (does not crash) when a saved party has an unknown classId', () => {
    const corrupt = JSON.stringify({
      schemaVersion: 3, lastSaved: 0, inspiration: '0', words: '0', royalties: '4',
      party: [{ id: 'c0', name: 'Wizard', classId: 'wizard', level: 9, basePower: '5' }],
      zone: { zoneIndex: 0, encounterIndex: 0 }, currentHp: '10', bookComplete: false, bookNumber: 1,
      upgrades: {},
    });
    const s = deserialize(corrupt, 0);
    expect(num.toNum(s.royalties)).toBe(4);              // progress kept
    expect(s.party[0].classId).toBe('protagonist');      // unknown class -> whole party reseeded
  });
});

describe('save v4: Edits + stars', () => {
  it('round-trips Edits and per-class stars', () => {
    const fresh = initialState(0);
    const s = { ...fresh, edits: num.n(42), stars: { ...fresh.stars, support: 4, debuffer: 2 } };
    const back = deserialize(serialize(s), 0);
    expect(num.eq(back.edits, num.n(42))).toBe(true);
    expect(back.stars.support).toBe(4);
    expect(back.stars.debuffer).toBe(2);
    expect(back.schemaVersion).toBe(6);
  });

  it('migrates a pre-v4 save: defaults Edits to 0 and all stars to 1, keeps progress', () => {
    const v3 = JSON.stringify({
      schemaVersion: 3, lastSaved: 0, inspiration: '500', words: '0', royalties: '9',
      party: [{ id: 'c0', name: 'The Protagonist', classId: 'protagonist', level: 2, basePower: '1' }],
      zone: { zoneIndex: 0, encounterIndex: 0 }, currentHp: '10', bookComplete: false, bookNumber: 1, upgrades: {},
    });
    const s = deserialize(v3, 0);
    expect(num.eq(s.edits, num.ZERO)).toBe(true);
    expect(s.stars.protagonist).toBe(1);
    expect(num.toNum(s.royalties)).toBe(9);
  });

  it('clamps and ignores corrupt star values', () => {
    const corrupt = JSON.stringify({
      schemaVersion: 4, lastSaved: 0, inspiration: '0', words: '0', royalties: '0',
      party: [{ id: 'c0', name: 'The Protagonist', classId: 'protagonist', level: 1, basePower: '1' }],
      zone: { zoneIndex: 0, encounterIndex: 0 }, currentHp: '10', bookComplete: false, bookNumber: 1, upgrades: {},
      edits: '5', stars: { support: 99, debuffer: -4, wizard: 3 },
    });
    const s = deserialize(corrupt, 0);
    expect(s.stars.support).toBe(5);   // clamped to MAX_STAR
    expect(s.stars.debuffer).toBe(1);  // negative -> floored up to 1
    expect((s.stars as Record<string, number>).wizard).toBeUndefined(); // unknown class ignored
    expect(num.toNum(s.edits)).toBe(5);
  });
});

describe('save v5: variants', () => {
  it('round-trips variantWorld and unlockedVariants', () => {
    const fresh = initialState(0);
    const s = {
      ...fresh,
      party: [{ ...fresh.party[0] }, { ...fresh.party[1], variantWorld: 2 }],
      unlockedVariants: { ...makeUnlockedVariants(), antihero: [2], support: [1, 5] },
    };
    const back = deserialize(serialize(s), 0);
    expect(back.party[1].variantWorld).toBe(2);
    expect(back.unlockedVariants.antihero).toEqual([2]);
    expect(back.unlockedVariants.support).toEqual([1, 5]);
    expect(back.schemaVersion).toBe(6);
  });

  it('migrates a pre-v5 save: base look + empty unlocks, keeps progress', () => {
    const v4 = JSON.stringify({
      schemaVersion: 4, lastSaved: 0, inspiration: '500', words: '0', royalties: '9',
      party: [{ id: 'c0', name: 'The Protagonist', classId: 'protagonist', level: 2, basePower: '1' }],
      zone: { zoneIndex: 0, encounterIndex: 0 }, currentHp: '10', bookComplete: false, bookNumber: 1,
      upgrades: {}, edits: '3', stars: { protagonist: 1, antihero: 1, support: 1, debuffer: 1, sidekick: 1 },
    });
    const s = deserialize(v4, 0);
    expect(s.party[0].variantWorld).toBeNull();
    expect(s.unlockedVariants.protagonist).toEqual([]);
    expect(num.toNum(s.royalties)).toBe(9);
    expect(num.toNum(s.edits)).toBe(3);
  });

  it('sanitizes corrupt variant data (drops unknown classes + out-of-range worlds, dedups)', () => {
    const corrupt = JSON.stringify({
      schemaVersion: 5, lastSaved: 0, inspiration: '0', words: '0', royalties: '0',
      party: [{ id: 'c0', name: 'The Protagonist', classId: 'protagonist', level: 1, basePower: '1', variantWorld: 999 }],
      zone: { zoneIndex: 0, encounterIndex: 0 }, currentHp: '10', bookComplete: false, bookNumber: 1,
      upgrades: {}, edits: '0', stars: {},
      unlockedVariants: { support: [1, 1, 99, -3, 2], wizard: [0] },
    });
    const s = deserialize(corrupt, 0);
    expect(s.unlockedVariants.support).toEqual([1, 2]);     // dedup + drop out-of-range
    expect((s.unlockedVariants as Record<string, number[]>).wizard).toBeUndefined(); // unknown class dropped
    expect(s.party[0].variantWorld).toBeNull();             // out-of-range world -> base
  });
});

describe('save v6: legacy', () => {
  it('round-trips the legacy level', () => {
    const fresh = { ...initialState(0), legacy: 3 };
    const back = deserialize(serialize(fresh), 0);
    expect(back.legacy).toBe(3);
    expect(back.schemaVersion).toBe(6);
  });

  it('migrates a pre-v6 save (no legacy field) to legacy 0, keeping progress', () => {
    const v5 = JSON.stringify({
      schemaVersion: 5, lastSaved: 0, inspiration: '500', words: '0', royalties: '9',
      party: [{ id: 'c0', name: 'The Protagonist', classId: 'protagonist', level: 1, basePower: '1', variantWorld: null }],
      zone: { zoneIndex: 0, encounterIndex: 0 }, currentHp: '1', bookComplete: false, bookNumber: 1,
      edits: '12', stars: {}, unlockedVariants: {},
    });
    const s = deserialize(v5, 0);
    expect(s.legacy).toBe(0);
    expect(num.toNum(s.edits)).toBe(12); // other progress preserved
  });

  it('sanitizes a corrupt legacy value to a non-negative integer', () => {
    const bad = JSON.stringify({ schemaVersion: 6, lastSaved: 0, inspiration: '0', words: '0', royalties: '0',
      party: [], zone: { zoneIndex: 0, encounterIndex: 0 }, currentHp: '1', bookComplete: false, bookNumber: 1,
      edits: '0', stars: {}, unlockedVariants: {}, legacy: -4.7 });
    expect(deserialize(bad, 0).legacy).toBe(0);
  });
});
