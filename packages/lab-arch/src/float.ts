/**
 * Floating point: why 0.1 + 0.2 is not 0.3, how rounding errors pile up when
 * a float32 adds 0.1 a hundred thousand times, and how Kahan summation
 * carries the lost bits along. Math.fround gives exact IEEE 754 float32.
 */

export type Precision = 32 | 64;
const round = (x: number, p: Precision) => (p === 32 ? Math.fround(x) : x);

/** 0.1 + 0.2 in the chosen precision, and whether it equals 0.3 there. */
export function pointThree(p: Precision): { sum: number; equals: boolean; text: string } {
  const sum = round(round(0.1, p) + round(0.2, p), p);
  return { sum, equals: sum === round(0.3, p), text: p === 32 ? sum.toPrecision(9) : String(sum) };
}

export const SUM_N = 100_000;

/** Add `value` n times; Kahan keeps a running correction for the bits each addition loses. */
export function repeatedSum(p: Precision, kahan: boolean, n = SUM_N, value = 0.1): { sum: number; exact: number; error: number } {
  const v = round(value, p);
  let sum = 0;
  let c = 0;
  for (let i = 0; i < n; i++) {
    if (!kahan) sum = round(sum + v, p);
    else {
      const y = round(v - c, p);
      const t = round(sum + y, p);
      c = round(round(t - sum, p) - y, p);
      sum = t;
    }
  }
  const exact = n * value;
  return { sum, exact, error: Math.abs(sum - exact) };
}

/** float32 has 24 bits of precision: above 2^24 = 16 777 216, adding 1 does nothing. */
export const bigPlusOne = (p: Precision, big = 16_777_216) => round(round(big, p) + 1, p) - round(big, p);
