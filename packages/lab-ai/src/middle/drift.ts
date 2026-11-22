/**
 * Data drift: a fraud model learns one threshold on transaction amounts in
 * week 0. Inflation moves ordinary purchases up week by week; the model does
 * not notice, its accuracy quietly falls, until someone watches the inputs.
 */

const rng = (seed: number) => {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return (s + 0.5) / 2 ** 32;
  };
};

/** 200 normal draws, fixed: the same "random" sample every run. */
const NORMALS = (() => {
  const r = rng(0x51ed27);
  return Array.from({ length: 200 }, () => Math.sqrt(-2 * Math.log(r())) * Math.cos(2 * Math.PI * r()));
})();

export const LEGIT_MEAN = 50;
export const LEGIT_SD = 15;
export const FRAUD_MEAN = 130;
export const FRAUD_SD = 20;
/** Ordinary purchases grow by this much (in tenge thousands) every week. */
export const DRIFT_PER_WEEK = 4;

export interface Tx {
  amount: number;
  fraud: boolean;
}

/** One week of traffic: 180 ordinary purchases and 20 frauds. */
export function weekData(week: number): Tx[] {
  const shift = week * DRIFT_PER_WEEK;
  const legit = NORMALS.slice(0, 180).map((z) => ({ amount: LEGIT_MEAN + shift + z * LEGIT_SD, fraud: false }));
  const fraud = NORMALS.slice(180).map((z) => ({ amount: FRAUD_MEAN + shift * 0.5 + z * FRAUD_SD, fraud: true }));
  return [...legit, ...fraud];
}

/** "Training": the threshold that misclassifies the fewest transactions of that week. */
export function train(data: Tx[]): number {
  const cands = [...new Set(data.map((t) => Math.round(t.amount)))].sort((a, b) => a - b);
  let best = cands[0]!;
  let bestErr = Infinity;
  for (const c of cands) {
    const err = data.filter((t) => (t.amount >= c) !== t.fraud).length;
    if (err < bestErr) {
      bestErr = err;
      best = c;
    }
  }
  return best;
}

export const accuracy = (data: Tx[], threshold: number) => data.filter((t) => (t.amount >= threshold) === t.fraud).length / data.length;
export const falseAlarms = (data: Tx[], threshold: number) => data.filter((t) => !t.fraud && t.amount >= threshold).length;

/** A drift monitor: how far this week's median input moved from the training week's, in training standard deviations. */
export function driftScore(train0: Tx[], now: Tx[]): number {
  const med = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)]!;
  };
  const a = train0.map((t) => t.amount);
  const mean = a.reduce((x, y) => x + y, 0) / a.length;
  const sd = Math.sqrt(a.reduce((x, y) => x + (y - mean) ** 2, 0) / a.length);
  return Math.abs(med(now.map((t) => t.amount)) - med(a)) / sd;
}
