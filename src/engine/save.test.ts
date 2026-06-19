import { describe, it, expect, beforeEach } from 'vitest';
import * as num from './num';
import { initialState } from './state';
import { serialize, deserialize, save, load, exportSave, importSave, SAVE_KEY } from './save';

describe('save', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a non-trivial state', () => {
    const s = { ...initialState(1234), inspiration: num.n('1.5e40'), royalties: num.n(3), prestigeMultiplier: num.n(2.5) };
    const back = deserialize(serialize(s), 0);
    expect(num.eq(back.inspiration, s.inspiration)).toBe(true);
    expect(num.eq(back.royalties, s.royalties)).toBe(true);
    expect(num.eq(back.prestigeMultiplier, s.prestigeMultiplier)).toBe(true);
    expect(back.zone).toEqual(s.zone);
    expect(back.party.length).toBe(s.party.length);
    expect(back.lastSaved).toBe(1234);
  });

  it('tolerates missing fields (defaults) and ignores unknown fields', () => {
    const partial = deserialize('{"inspiration":"500","mysteryField":42}', 7);
    expect(num.eq(partial.inspiration, num.n(500))).toBe(true);
    expect(num.eq(partial.royalties, num.ZERO)).toBe(true); // defaulted
    expect(partial.party.length).toBe(initialState(0).party.length); // defaulted
  });

  it('returns a fresh state on malformed JSON', () => {
    const fresh = deserialize('not json', 9);
    expect(num.eq(fresh.inspiration, num.ZERO)).toBe(true);
    expect(fresh.lastSaved).toBe(9);
  });

  it('save() then load() persists through localStorage', () => {
    const s = { ...initialState(0), inspiration: num.n(777) };
    save(s);
    expect(localStorage.getItem(SAVE_KEY)).toBeTruthy();
    const loaded = load(0)!;
    expect(num.eq(loaded.inspiration, num.n(777))).toBe(true);
  });

  it('load() returns null when nothing is saved', () => {
    expect(load(0)).toBeNull();
  });

  it('export/import round-trips via an opaque string', () => {
    const s = { ...initialState(0), words: num.n('1e12') };
    const code = exportSave(s);
    const back = importSave(code, 0);
    expect(num.eq(back.words, num.n('1e12'))).toBe(true);
  });
});
