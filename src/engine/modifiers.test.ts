// src/engine/modifiers.test.ts
import { describe, it, expect } from 'vitest';
import * as num from './num';
import { initialState, emptyUpgrades, makeCharacter, characterPower } from './state';
import {
  BOSS_INDEX, OFFLINE_CAP_SECONDS, RECRUIT_CAP, GHOSTWRITER_LEVEL, BOOK_SCALE,
  NIGHT_OWL_HOURS_PER_LEVEL, MUSE_FLOOR, FRUGAL_FLOOR,
  targetInspirationRate, targetMaxHp, targetRegen, targetWords, baseLevelCost, baseRecruitCost,
} from './content';
import * as M from './modifiers';

describe('modifiers: book-1, no-upgrades PARITY with raw v1 curves', () => {
  const s = initialState(0);

  it('bookDifficulty is 1 at book 1', () => {
    expect(num.toNum(M.bookDifficulty(s))).toBe(1);
  });
  it('HP / regen / words / inspiration-rate equal the raw curves', () => {
    expect(num.eq(M.effectiveTargetMaxHp(s, 0, 1), targetMaxHp(0, 1))).toBe(true);
    expect(num.eq(M.effectiveBossRegen(s, 0, BOSS_INDEX), targetRegen(0, BOSS_INDEX))).toBe(true);
    expect(num.eq(M.effectiveWords(s, 0, 0), targetWords(0, 0))).toBe(true);
    expect(num.eq(M.effectiveInspirationRate(s, 0, 0), targetInspirationRate(0, 0))).toBe(true);
  });
  it('party abilities raise DPS above the raw sum; costs equal base curves', () => {
    const rawSum = s.party.reduce((acc, c) => num.add(acc, characterPower(c)), num.ZERO);
    expect(num.gt(M.effectivePartyDps(s), rawSum)).toBe(true); // Plot Armor / Lone Wolf raise DPS above the raw sum
    expect(num.eq(M.effectiveLevelCost(s, 1), baseLevelCost(1))).toBe(true);
    expect(num.eq(M.effectiveRecruitCost(s, 2), baseRecruitCost(2))).toBe(true);
  });
  it('party cap / offline cap / starting level match v1 defaults', () => {
    expect(M.effectivePartyCap(s)).toBe(RECRUIT_CAP);
    expect(M.effectiveOfflineCap(s)).toBe(OFFLINE_CAP_SECONDS);
    expect(M.startingPartyLevel(s)).toBe(1);
  });
});

describe('modifiers: escalation and upgrade effects', () => {
  it('bookDifficulty scales by BOOK_SCALE and lifts enemy curves', () => {
    const b2 = { ...initialState(0), bookNumber: 2 };
    expect(num.toNum(M.bookDifficulty(b2))).toBe(BOOK_SCALE);
    expect(num.eq(M.effectiveTargetMaxHp(b2, 0, 1), num.mul(targetMaxHp(0, 1), num.n(BOOK_SCALE)))).toBe(true);
    expect(num.gt(M.effectiveWords(b2, 0, 0), targetWords(0, 0))).toBe(true);
  });
  it('sharpProse multiplies DPS; prolific multiplies inspiration rate', () => {
    const s = { ...initialState(0), upgrades: { ...emptyUpgrades(), sharpProse: 5, prolific: 10 } };
    const noSharp = { ...initialState(0), upgrades: { ...emptyUpgrades(), prolific: 10 } };
    expect(num.gt(M.effectivePartyDps(s), M.effectivePartyDps(noSharp))).toBe(true);
    expect(num.toNum(M.effectiveInspirationRate(s, 0, 0))).toBeCloseTo(num.toNum(targetInspirationRate(0, 0)) * 2, 6);
  });
  it('muse and frugalDrafts reductions are clamped to their floors', () => {
    const s = { ...initialState(0), upgrades: { ...emptyUpgrades(), muse: 100, frugalDrafts: 100 } };
    expect(num.toNum(M.effectiveBossRegen(s, 0, BOSS_INDEX)))
      .toBeCloseTo(num.toNum(targetRegen(0, BOSS_INDEX)) * MUSE_FLOOR, 6);
    expect(num.toNum(M.effectiveLevelCost(s, 1))).toBeCloseTo(num.toNum(baseLevelCost(1)) * FRUGAL_FLOOR, 6);
  });
  it('one-time unlocks raise cap / offline / starting level', () => {
    const s = { ...initialState(0), upgrades: { ...emptyUpgrades(), ensembleCast: true, ghostwriter: true, nightOwl: 3 } };
    expect(M.effectivePartyCap(s)).toBe(RECRUIT_CAP + 1);
    expect(M.effectiveOfflineCap(s)).toBe(OFFLINE_CAP_SECONDS + 3 * NIGHT_OWL_HOURS_PER_LEVEL * 3600);
    expect(M.startingPartyLevel(s)).toBe(GHOSTWRITER_LEVEL);
  });
});

describe('modifiers: party-class abilities', () => {
  it('a Support raises party DPS above the same party without it', () => {
    const base = initialState(0);
    const withSupport = { ...base, party: [...base.party, makeCharacter('s', 'support', 10)] };
    expect(num.gt(M.effectivePartyDps(withSupport), M.effectivePartyDps(base))).toBe(true);
  });
  it('a Debuffer reduces effective boss regen', () => {
    const base = { ...initialState(0) };
    const withDebuffer = { ...base, party: [...base.party, makeCharacter('d', 'debuffer', 10)] };
    expect(num.lt(
      M.effectiveBossRegen(withDebuffer, 1, BOSS_INDEX),
      M.effectiveBossRegen(base, 1, BOSS_INDEX),
    )).toBe(true);
  });
  it('a Sidekick raises the inspiration rate', () => {
    const base = initialState(0);
    const withSidekick = { ...base, party: [...base.party, makeCharacter('k', 'sidekick', 10)] };
    expect(num.gt(
      M.effectiveInspirationRate(withSidekick, 0, 0),
      M.effectiveInspirationRate(base, 0, 0),
    )).toBe(true);
  });
});
