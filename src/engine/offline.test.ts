import { describe, it, expect } from 'vitest';
import * as num from './num';
import { initialState } from './state';
import { offlineSeconds, applyOffline } from './offline';
import { OFFLINE_CAP_SECONDS } from './content';

describe('offline', () => {
  it('computes elapsed seconds', () => {
    expect(offlineSeconds(60_000, 0)).toBe(60);
  });

  it('clamps to the offline cap', () => {
    const huge = OFFLINE_CAP_SECONDS * 1000 * 5;
    expect(offlineSeconds(huge, 0)).toBe(OFFLINE_CAP_SECONDS);
  });

  it('guards against a rewound clock (lastSaved in the future)', () => {
    expect(offlineSeconds(0, 10_000)).toBe(0);
  });

  it('applyOffline accrues resources and updates lastSaved', () => {
    const s = { ...initialState(0), lastSaved: 0 };
    const { state, summary } = applyOffline(s, 3_600_000); // 1 hour
    expect(summary.seconds).toBe(3600);
    expect(num.gt(state.inspiration, num.ZERO)).toBe(true);
    expect(state.lastSaved).toBe(3_600_000);
    expect(num.eq(summary.inspirationGained, state.inspiration)).toBe(true);
  });

  it('applyOffline with no elapsed time only bumps lastSaved', () => {
    const s = { ...initialState(0), lastSaved: 5000 };
    const { state, summary } = applyOffline(s, 4000); // clock went backwards
    expect(summary.seconds).toBe(0);
    expect(num.eq(state.inspiration, num.ZERO)).toBe(true);
    expect(state.lastSaved).toBe(4000);
  });
});
