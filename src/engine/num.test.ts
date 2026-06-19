import { describe, it, expect } from 'vitest';
import * as num from './num';

describe('num', () => {
  it('constructs and compares', () => {
    expect(num.eq(num.n(5), num.n(5))).toBe(true);
    expect(num.gt(num.n(10), num.n(5))).toBe(true);
    expect(num.lt(num.n(2), num.n(3))).toBe(true);
    expect(num.gte(num.n(5), num.n(5))).toBe(true);
  });

  it('does arithmetic', () => {
    expect(num.toNum(num.add(num.n(2), num.n(3)))).toBe(5);
    expect(num.toNum(num.sub(num.n(10), num.n(3)))).toBe(7);
    expect(num.toNum(num.mul(num.n(4), num.n(5)))).toBe(20);
    expect(num.toNum(num.div(num.n(20), num.n(4)))).toBe(5);
    expect(num.toNum(num.pow(num.n(2), 10))).toBe(1024);
  });

  it('min/max', () => {
    expect(num.toNum(num.maxN(num.n(3), num.n(7)))).toBe(7);
    expect(num.toNum(num.minN(num.n(3), num.n(7)))).toBe(3);
  });

  it('serializes round-trip including very large values', () => {
    const v = num.n('1.2345e120');
    expect(num.eq(num.strToNum(num.numToStr(v)), v)).toBe(true);
  });

  it('formats small and large magnitudes', () => {
    expect(num.fmt(num.n(0))).toBe('0');
    expect(num.fmt(num.n(42))).toBe('42');
    expect(num.fmt(num.n(1500))).toBe('1.50K');
    expect(num.fmt(num.n(2_500_000))).toBe('2.50M');
    expect(num.fmt(num.n(1_000_000_000))).toBe('1.00B');
  });
});
