import { describe, it, expect } from 'vitest';
import * as num from './num';
import * as C from './content';
import {
  starStatMult, starAbilityMult, starUpCost, bossEditDrop, MAX_STAR,
} from './content';

describe('content', () => {
  it('has 8 zones with full encounter/boss metadata', () => {
    expect(C.ZONE_COUNT).toBe(8);
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

describe('content: prestige catalog & costs', () => {
  it('exposes 6 repeatable upgrades and 2 one-time unlocks', () => {
    expect(C.REPEATABLE_UPGRADES.length).toBe(6);
    expect(C.ONE_TIME_UPGRADES.length).toBe(2);
  });

  it('findUpgrade returns a def by id and throws on unknown', () => {
    expect(C.findUpgrade('prolific').kind).toBe('repeatable');
    expect(C.findUpgrade('ensembleCast').kind).toBe('oneTime');
    expect(() => C.findUpgrade('nope' as C.UpgradeId)).toThrow();
  });

  it('base spend costs grow with level / party size', () => {
    expect(num.gt(C.baseLevelCost(2), C.baseLevelCost(1))).toBe(true);
    expect(num.gt(C.baseRecruitCost(3), C.baseRecruitCost(2))).toBe(true);
  });

  it('book escalation constant is > 1', () => {
    expect(C.BOOK_SCALE).toBeGreaterThan(1);
  });
});

describe('content: classes', () => {
  it('defines the four classes plus the protagonist with abilities', () => {
    expect(C.CLASSES.map((c) => c.id).sort()).toEqual(
      ['antihero', 'debuffer', 'protagonist', 'sidekick', 'support'],
    );
    for (const def of C.CLASSES) {
      expect(typeof def.name).toBe('string');
      expect(num.gt(def.classBasePower, num.ZERO)).toBe(true);
      expect(typeof def.ability.kind).toBe('string');
    }
    expect(C.findClass('protagonist').ability.kind).toBe('plotArmor');
    expect(C.findClass('debuffer').ability.kind).toBe('regenCut');
    expect(() => C.findClass('nope' as C.ClassId)).toThrow();
  });
});

describe('stars + Edits (Slice 2)', () => {
  it('MAX_STAR is 5', () => {
    expect(MAX_STAR).toBe(5);
  });

  it('star multipliers are exactly 1 at 1 star and grow with stars', () => {
    expect(starStatMult(1)).toBe(1);
    expect(starAbilityMult(1)).toBe(1);
    expect(starStatMult(5)).toBeGreaterThan(starStatMult(1));
    expect(starAbilityMult(5)).toBeGreaterThan(starAbilityMult(1));
  });

  it('star-up cost rises with the current star', () => {
    expect(num.gt(starUpCost(2), starUpCost(1))).toBe(true);
    expect(num.gt(starUpCost(1), num.ZERO)).toBe(true);
  });

  it('boss Edit drop is positive and grows with the book number', () => {
    expect(num.gt(bossEditDrop(1), num.ZERO)).toBe(true);
    expect(num.gt(bossEditDrop(3), bossEditDrop(1))).toBe(true);
  });
});

import { VARIANT_UNLOCK_ORDER, WORLD_FACE, worldGenre, ZONE_COUNT } from './content';

describe('world variants (Slice 3a)', () => {
  it('the variant unlock order lists every class exactly once', () => {
    expect(VARIANT_UNLOCK_ORDER).toHaveLength(5);
    expect(new Set(VARIANT_UNLOCK_ORDER).size).toBe(5);
    expect(VARIANT_UNLOCK_ORDER).toContain('protagonist');
  });

  it('there is one face emoji per world', () => {
    expect(WORLD_FACE).toHaveLength(ZONE_COUNT);
    expect(WORLD_FACE.every((e) => typeof e === 'string' && e.length > 0)).toBe(true);
  });

  it('worldGenre returns the zone genre', () => {
    expect(worldGenre(0)).toBe('Wild West');
  });
});

import { WORLD_SET_BONUS, SET_THRESHOLDS, setTier } from './content';

describe('set-bonus content (Slice 3b)', () => {
  it('has one set-bonus def per world with 3 ascending tiers', () => {
    expect(WORLD_SET_BONUS).toHaveLength(ZONE_COUNT);
    for (const def of WORLD_SET_BONUS) {
      expect(def.tiers).toHaveLength(3);
      expect(def.tiers[0]).toBeLessThan(def.tiers[1]);
      expect(def.tiers[1]).toBeLessThan(def.tiers[2]);
    }
  });

  it('thresholds are 2/3/5 and setTier maps counts to tiers', () => {
    expect(SET_THRESHOLDS).toEqual([2, 3, 5]);
    expect(setTier(1)).toBe(0);
    expect(setTier(2)).toBe(1);
    expect(setTier(3)).toBe(2);
    expect(setTier(4)).toBe(2);
    expect(setTier(5)).toBe(3);
  });
});

import { protagonistPromoteCost } from './content';

describe('Protagonist promotion cost (Protagonist track)', () => {
  it('is positive and rises with the current star', () => {
    expect(num.gt(protagonistPromoteCost(1), num.ZERO)).toBe(true);
    expect(num.gt(protagonistPromoteCost(2), protagonistPromoteCost(1))).toBe(true);
    expect(num.gt(protagonistPromoteCost(4), protagonistPromoteCost(3))).toBe(true);
  });

  it('charges base × growth^(currentStar-1) — first promotion costs base, not base×growth', () => {
    // base=3, growth=2 → promoting FROM 1★ costs 3, from 2★ costs 6, from 4★ costs 24.
    // Pins the off-by-one: exponent is currentStar-1, so 1★ pays the base cost.
    expect(num.toNum(protagonistPromoteCost(1))).toBe(3);
    expect(num.toNum(protagonistPromoteCost(2))).toBe(6);
    expect(num.toNum(protagonistPromoteCost(4))).toBe(24);
  });
});
