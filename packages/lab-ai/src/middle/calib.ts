/**
 * Calibration: when a model says "95% sure", is it right 95% of the time?
 * A classifier trained too long gives logits three times too large: its
 * yes/no answers are as good as before, its confidence is not. Dividing the
 * logits by a temperature T (fitted on held-out data) fixes the confidence
 * without changing a single answer.
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
const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

export const TEMPERATURES = [1, 2, 3, 4];
/** How much too large the model's logits are. */
export const OVERCONFIDENCE = 3;
export const CALIB_N = 2000;

/** Each example: the model's raw logit and the true label. */
export function calibData(): { logit: number; label: boolean }[] {
  const r = rng(0xca11b);
  return Array.from({ length: CALIB_N }, () => {
    const z = (r() * 2 - 1) * 3; // the true log-odds
    return { logit: z * OVERCONFIDENCE, label: r() < sigmoid(z) };
  });
}

export interface CalibBin {
  /** Mean confidence in the predicted class. */
  confidence: number;
  accuracy: number;
  count: number;
}

export interface CalibRun {
  temperature: number;
  accuracy: number;
  /** Expected calibration error: weighted gap between confidence and accuracy. */
  ece: number;
  bins: CalibBin[];
}

const r2 = (x: number) => Math.round(x * 100) / 100;

export function runCalib(temperature: number): CalibRun {
  const data = calibData();
  const edges = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0001];
  const acc = edges.slice(0, -1).map(() => ({ conf: 0, right: 0, n: 0 }));
  let right = 0;
  for (const d of data) {
    const p = sigmoid(d.logit / temperature);
    const yes = p >= 0.5;
    const conf = yes ? p : 1 - p;
    const ok = yes === d.label;
    if (ok) right++;
    const b = edges.findIndex((e, i) => conf >= e && conf < edges[i + 1]!);
    acc[b]!.conf += conf;
    acc[b]!.right += ok ? 1 : 0;
    acc[b]!.n++;
  }
  const bins = acc.map((b) => ({ confidence: b.n ? r2(b.conf / b.n) : 0, accuracy: b.n ? r2(b.right / b.n) : 0, count: b.n }));
  const ece = acc.reduce((s, b) => s + (b.n ? Math.abs(b.conf / b.n - b.right / b.n) * b.n : 0), 0) / data.length;
  return { temperature, accuracy: r2(right / data.length), ece: Math.round(ece * 1000) / 1000, bins };
}
