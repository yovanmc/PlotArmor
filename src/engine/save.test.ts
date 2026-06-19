// src/engine/save.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import * as num from './num';
import { initialState, emptyUpgrades, makeCharacter } from './state';
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
    expect(back.schemaVersion).toBe(3);
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
    expect(s.schemaVersion).toBe(3);
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
