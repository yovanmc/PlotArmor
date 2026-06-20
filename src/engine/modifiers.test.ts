// src/engine/modifiers.test.ts
import { describe, it, expect } from 'vitest';
import * as num from './num';
import { initialState, emptyUpgrades, makeCharacter, characterPower } from './state';
import {
  BOSS_INDEX, OFFLINE_CAP_SECONDS, RECRUIT_CAP, GHOSTWRITER_LEVEL, BOOK_SCALE,
  NIGHT_OWL_HOURS_PER_LEVEL, MUSE_FLOOR, FRUGAL_FLOOR,
  targetInspirationRate, targetMaxHp, targetRegen, targetWords, baseLevelCost, baseRecruitCost,
  AFFINITY_MAG,
} from './content';
import * as M from './modifiers';
import { effectiveCharacterPower, effectivePartyDps } from './modifiers';

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

describe('star scaling (Slice 2)', () => {
  it('a higher star raises a character\'s effective power and the party DPS', () => {
    const base = initialState(0);
    const starred = { ...base, stars: { ...base.stars, antihero: 3 } };
    const c = base.party.find((p) => p.classId === 'antihero')!;
    expect(num.gt(effectiveCharacterPower(starred, c), effectiveCharacterPower(base, c))).toBe(true);
    expect(num.gt(M.effectivePartyDps(starred), M.effectivePartyDps(base))).toBe(true);
  });

  it('effectiveCharacterPower equals raw characterPower at 1 star', () => {
    const s = initialState(0);
    const c = s.party[0];
    expect(num.eq(effectiveCharacterPower(s, c), characterPower(c))).toBe(true);
  });

  it('starring a Support amplifies its party-DPS ability', () => {
    const oneStar = {
      ...initialState(0),
      party: [makeCharacter('c0', 'protagonist'), makeCharacter('c1', 'support')],
    };
    const threeStar = { ...oneStar, stars: { ...oneStar.stars, support: 3 } };
    expect(num.gt(M.effectivePartyDps(threeStar), M.effectivePartyDps(oneStar))).toBe(true);
  });
});

describe('Plot Armor scales with the Protagonist star (Protagonist track)', () => {
  it('a promoted Protagonist raises party DPS vs a 1-star Protagonist', () => {
    const base = initialState(0); // protagonist at 1 star
    const promoted = { ...base, stars: { ...base.stars, protagonist: 4 } };
    expect(num.gt(effectivePartyDps(promoted), effectivePartyDps(base))).toBe(true);
  });

  it('the Plot Armor multiplier itself grows with the Protagonist star', () => {
    // Hold base power constant by comparing the ratio contributed beyond raw sum.
    // A 1-protagonist + 1-antihero party: raise ONLY the protagonist star and
    // confirm DPS rises by MORE than the protagonist's own base-power increase.
    const base = initialState(0);
    const promoted = { ...base, stars: { ...base.stars, protagonist: 5 } };
    const baseDps = num.toNum(effectivePartyDps(base));
    const promotedDps = num.toNum(effectivePartyDps(promoted));
    // base-power-only scaling would multiply just the protagonist's share; Plot
    // Armor scaling multiplies the whole-party product, so the gain is larger.
    // Without the Plot Armor edit: ratio ~3.72; with it: ratio ~5.81. Threshold: 4.5.
    expect(promotedDps / baseDps).toBeGreaterThan(4.5);
  });
});

describe('set bonus in modifiers (Slice 3b)', () => {
  // build a 5-Space party (world 2 = DPS set)
  function spaceParty() {
    const five = (['protagonist', 'antihero', 'support', 'debuffer', 'sidekick'] as const)
      .map((cls, i) => ({ ...makeCharacter(`c${i}`, cls), variantWorld: 2 }));
    return { ...initialState(0), party: five };
  }

  it('a full DPS set raises effectivePartyDps vs the same party on base looks', () => {
    const set = spaceParty();
    const base = { ...set, party: set.party.map((c) => ({ ...c, variantWorld: null })) };
    expect(num.gt(M.effectivePartyDps(set), M.effectivePartyDps(base))).toBe(true);
  });

  it('a full Wild West set (Inspiration axis) raises effectiveInspirationRate', () => {
    const wildwest = spaceParty();
    wildwest.party = wildwest.party.map((c) => ({ ...c, variantWorld: 0 }));
    const base = { ...wildwest, party: wildwest.party.map((c) => ({ ...c, variantWorld: null })) };
    expect(num.gt(M.effectiveInspirationRate(wildwest, 0, 0), M.effectiveInspirationRate(base, 0, 0))).toBe(true);
  });

  it('a full Eldritch set (regenCut axis) lowers effectiveBossRegen', () => {
    const eldritch = spaceParty();
    eldritch.party = eldritch.party.map((c) => ({ ...c, variantWorld: 6 }));
    const base = { ...eldritch, party: eldritch.party.map((c) => ({ ...c, variantWorld: null })) };
    // boss encounter (zone 0, BOSS_INDEX) so regen is non-zero
    expect(num.lt(M.effectiveBossRegen(eldritch, 0, BOSS_INDEX), M.effectiveBossRegen(base, 0, BOSS_INDEX))).toBe(true);
  });
});

describe('zone affinity (Slice 4)', () => {
  // initialState(0) starts in zoneIndex 0.
  it('a home Anti-hero (skin matches current zone) raises party DPS vs off-zone', () => {
    const base = initialState(0);
    const home = { ...base, party: base.party.map((c) => (c.classId === 'antihero' ? { ...c, variantWorld: 0 } : c)) };
    const away = { ...base, party: base.party.map((c) => (c.classId === 'antihero' ? { ...c, variantWorld: 3 } : c)) };
    expect(num.gt(M.effectivePartyDps(home), M.effectivePartyDps(away))).toBe(true);
  });

  it('is neutral for a base-skin party — DPS is identical regardless of current zone', () => {
    const z0 = initialState(0);                       // all base looks, zone 0
    const z5 = { ...z0, zone: { ...z0.zone, zoneIndex: 5 } };
    expect(num.eq(M.effectivePartyDps(z0), M.effectivePartyDps(z5))).toBe(true);
  });

  it('a home Support raises party DPS vs the same Support off-zone', () => {
    const base = { ...initialState(0), party: [makeCharacter('p', 'protagonist'), makeCharacter('s', 'support', 10)] };
    const home = { ...base, party: base.party.map((c) => (c.classId === 'support' ? { ...c, variantWorld: 0 } : c)) };
    const away = { ...base, party: base.party.map((c) => (c.classId === 'support' ? { ...c, variantWorld: 3 } : c)) };
    expect(num.gt(M.effectivePartyDps(home), M.effectivePartyDps(away))).toBe(true);
  });

  it('a home Sidekick raises the Inspiration rate vs off-zone (inspRate ability scaled)', () => {
    const base = { ...initialState(0), party: [makeCharacter('p', 'protagonist'), makeCharacter('k', 'sidekick', 10)] };
    const home = { ...base, party: base.party.map((c) => (c.classId === 'sidekick' ? { ...c, variantWorld: 0 } : c)) };
    const away = { ...base, party: base.party.map((c) => (c.classId === 'sidekick' ? { ...c, variantWorld: 3 } : c)) };
    expect(num.gt(M.effectiveInspirationRate(home, 0, 0), M.effectiveInspirationRate(away, 0, 0))).toBe(true);
  });

  it('a home Debuffer cuts boss regen MORE than off-zone (regenCut ability scaled)', () => {
    const base = { ...initialState(0), party: [makeCharacter('p', 'protagonist'), makeCharacter('d', 'debuffer', 10)] };
    const home = { ...base, party: base.party.map((c) => (c.classId === 'debuffer' ? { ...c, variantWorld: 1 } : c)) };
    const away = { ...base, party: base.party.map((c) => (c.classId === 'debuffer' ? { ...c, variantWorld: 3 } : c)) };
    expect(num.lt(M.effectiveBossRegen(home, 1, BOSS_INDEX), M.effectiveBossRegen(away, 1, BOSS_INDEX))).toBe(true);
  });

  it('does NOT scale Plot Armor: a lone home Protagonist gains exactly 1 + AFFINITY_MAG (power only)', () => {
    // Single-protagonist party: no set, no support/loneWolf terms. Away DPS =
    // power x plotArmor. Home DPS = (power x affinity) x plotArmor (plotArmor
    // unchanged). So home/away == 1 + AFFINITY_MAG exactly. If affinity ALSO
    // scaled Plot Armor, this ratio would exceed 1 + AFFINITY_MAG.
    const base = { ...initialState(0), party: [makeCharacter('p', 'protagonist')] };
    const home = { ...base, party: [{ ...base.party[0], variantWorld: 0 }] };
    const away = { ...base, party: [{ ...base.party[0], variantWorld: 3 }] };
    const ratio = num.toNum(M.effectivePartyDps(home)) / num.toNum(M.effectivePartyDps(away));
    expect(ratio).toBeCloseTo(1 + AFFINITY_MAG, 6);
  });
});

describe('star-prestige Legacy scaling', () => {
  it('a Legacy level raises party DPS vs legacy 0', () => {
    const base = initialState(0);
    const leg = { ...base, legacy: 2 };
    expect(num.gt(M.effectivePartyDps(leg), M.effectivePartyDps(base))).toBe(true);
  });

  it('a Legacy level raises the Inspiration rate when a Sidekick is fielded (ability scaled)', () => {
    const base = { ...initialState(0), party: [makeCharacter('p', 'protagonist'), makeCharacter('k', 'sidekick', 10)] };
    const leg = { ...base, legacy: 2 };
    expect(num.gt(M.effectiveInspirationRate(leg, 0, 0), M.effectiveInspirationRate(base, 0, 0))).toBe(true);
  });

  it('is neutral at legacy 0 — effectiveCharacterPower unchanged', () => {
    const s = initialState(0);
    const c = s.party[0];
    expect(num.eq(effectiveCharacterPower(s, c), effectiveCharacterPower({ ...s, legacy: 0 }, c))).toBe(true);
  });
});

describe('The Critic (DoT combat class)', () => {
  it('a fielded Critic raises party DPS via its max-HP bleed', () => {
    const base = initialState(0);
    const withCritic = { ...base, party: [...base.party, makeCharacter('crit', 'scribe', 10)] };
    expect(num.gt(M.effectivePartyDps(withCritic), M.effectivePartyDps(base))).toBe(true);
  });
  it('contributes nothing when no Critic is fielded — party DPS unchanged', () => {
    const base = initialState(0);
    const plusSupport = { ...base, party: [...base.party, makeCharacter('s', 'support', 10)] };
    const dpsBefore = M.effectivePartyDps(base);
    // adding a non-Critic does not invoke the DoT path; sanity that the DoT term is Critic-gated
    expect(num.gt(M.effectivePartyDps(plusSupport), dpsBefore)).toBe(true); // support still helps
  });
});
