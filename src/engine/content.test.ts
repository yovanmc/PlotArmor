import { describe, it, expect } from 'vitest';
import * as num from './num';
import * as C from './content';

describe('content', () => {
  it('has 3 zones with full encounter/boss metadata', () => {
    expect(C.ZONE_COUNT).toBe(3);
    for (const z of C.ZONES) {
      expect(z.enemyEmojis.length).toBe(C.ENCOUNTERS_PER_ZONE);
      expect(z.enemyNames.length).toBe(C.ENCOUNTERS_PER_ZONE);
      expect(typeof z.bossName).toBe('string');
    }
  });

  it('encounter HP grows within a zone and across zones', () => {
    expect(num.gt(C.encounterHp(0, 1), C.encounterHp(0, 0))).toBe(true);
    expect(num.gt(C.encounterHp(1, 0), C.encounterHp(0, 0))).toBe(true);
  });

  it('boss index is the slot after the last regular encounter', () => {
    expect(C.BOSS_INDEX).toBe(C.ENCOUNTERS_PER_ZONE);
    expect(C.isBossIndex(C.BOSS_INDEX)).toBe(true);
    expect(C.isBossIndex(0)).toBe(false);
  });

  it('boss target has more HP than the last regular encounter and nonzero regen', () => {
    const lastReg = C.targetMaxHp(0, C.ENCOUNTERS_PER_ZONE - 1);
    const boss = C.targetMaxHp(0, C.BOSS_INDEX);
    expect(num.gt(boss, lastReg)).toBe(true);
    expect(num.gt(C.targetRegen(0, C.BOSS_INDEX), num.ZERO)).toBe(true);
    expect(num.eq(C.targetRegen(0, 0), num.ZERO)).toBe(true);
  });

  it('inspiration rate rises with tier; boss grants more words than a regular clear', () => {
    expect(num.gt(C.targetInspirationRate(0, 1), C.targetInspirationRate(0, 0))).toBe(true);
    expect(num.gt(C.targetWords(0, C.BOSS_INDEX), C.targetWords(0, 0))).toBe(true);
  });

  it('counts targets cleared within a book', () => {
    expect(C.TARGETS_PER_BOOK).toBe(C.ZONE_COUNT * (C.BOSS_INDEX + 1));
    expect(C.targetsClearedInBook(0, 0)).toBe(0);
    expect(C.targetsClearedInBook(1, 0)).toBe(C.BOSS_INDEX + 1);
  });
});
