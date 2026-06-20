import { describe, it, expect } from 'vitest';
import { compareLoadouts } from './analysis';

describe('analysis: loadout comparison', () => {
  it('returns positive mono/rainbow book outputs and a finite ratio', () => {
    const r = compareLoadouts();
    expect(r.mono).toBeGreaterThan(0);
    expect(r.rainbow).toBeGreaterThan(0);
    expect(Number.isFinite(r.ratio)).toBe(true);
    expect(r.ratio).toBeGreaterThan(0);
  });
});
