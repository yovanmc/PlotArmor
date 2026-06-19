import Decimal from 'break_eternity.js';

export type Num = Decimal;

export const ZERO: Num = new Decimal(0);
export const ONE: Num = new Decimal(1);

export function n(v: number | string | Num): Num {
  return new Decimal(v as number);
}

export const add = (a: Num, b: Num): Num => a.add(b);
export const sub = (a: Num, b: Num): Num => a.sub(b);
export const mul = (a: Num, b: Num): Num => a.mul(b);
export const div = (a: Num, b: Num): Num => a.div(b);
export function pow(base: Num, exp: number): Num {
  // break_eternity's .pow() uses logarithms and can drift for small integer
  // exponents (e.g. 2^10 → 1024.0000000000002).  For small non-negative
  // integer exponents use repeated multiplication to keep the result exact.
  if (Number.isInteger(exp) && exp >= 0 && exp <= 50) {
    let result: Num = ONE;
    for (let i = 0; i < exp; i++) result = result.mul(base);
    return result;
  }
  return base.pow(exp);
}

export const gte = (a: Num, b: Num): boolean => a.gte(b);
export const gt = (a: Num, b: Num): boolean => a.gt(b);
export const lte = (a: Num, b: Num): boolean => a.lte(b);
export const lt = (a: Num, b: Num): boolean => a.lt(b);
export const eq = (a: Num, b: Num): boolean => a.eq(b);

export const maxN = (a: Num, b: Num): Num => a.max(b);
export const minN = (a: Num, b: Num): Num => a.min(b);

export const toNum = (v: Num): number => v.toNumber();
export const numToStr = (v: Num): string => v.toString();
export const strToNum = (s: string): Num => new Decimal(s);
export const floorN = (v: Num): Num => v.floor();

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

export function fmt(v: Num): string {
  if (v.lt(1000)) {
    const x = v.toNumber();
    return Number.isInteger(x) ? String(x) : x.toFixed(1);
  }
  const exp = Math.floor(v.log10().toNumber());
  const tier = Math.floor(exp / 3);
  if (tier > 0 && tier < SUFFIXES.length) {
    const scaled = v.div(new Decimal(10).pow(tier * 3)).toNumber();
    return scaled.toFixed(2) + SUFFIXES[tier];
  }
  return v.toExponential(2);
}
