/**
 * Data leakage, two ways. (1) A feature that is only known after the answer:
 * "antibiotic prescribed" is written down once the doctor has diagnosed the
 * flu, so it predicts the diagnosis perfectly in the archive and is always
 * empty when the model is used for real. (2) The same patient's visits on both
 * sides of a random split: a model that memorises patients looks brilliant on
 * the test set and guesses on new people.
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
const normal = (r: () => number) => Math.sqrt(-2 * Math.log(r())) * Math.cos(2 * Math.PI * r());
const round = (x: number) => Math.round(x * 100) / 100;

// ---------------- 1. a feature from the future ----------------

export interface Visit {
  temp: number;
  /** Written into the record after the diagnosis: 1 if an antibiotic was prescribed. */
  antibiotic: number;
  sick: boolean;
}

/** The archive (with the antibiotic column filled in) and production (the column is still empty). */
export function archive(): { train: Visit[]; test: Visit[]; production: Visit[] } {
  const r = rng(0x1ea6);
  const make = (n: number, live: boolean): Visit[] =>
    Array.from({ length: n }, () => {
      const sick = r() < 0.4;
      const temp = round((sick ? 38.0 : 37.0) + normal(r) * 0.6);
      const prescribed = sick ? r() < 0.97 : r() < 0.02;
      return { temp, antibiotic: live ? 0 : prescribed ? 1 : 0, sick };
    });
  return { train: make(200, false), test: make(400, false), production: make(400, true) };
}

export type LeakFeature = "temp" | "antibiotic";

export interface Stump {
  feature: LeakFeature;
  threshold: number;
}

/** The best single rule "feature > threshold means sick" on the training rows. */
export function trainStump(rows: Visit[], features: LeakFeature[]): Stump {
  let best: Stump = { feature: features[0]!, threshold: 0 };
  let bestRight = -1;
  for (const f of features) {
    const cands = [...new Set(rows.map((v) => v[f]))].sort((a, b) => a - b);
    for (const c of cands) {
      const right = rows.filter((v) => v[f] > c === v.sick).length;
      if (right > bestRight) {
        bestRight = right;
        best = { feature: f, threshold: c };
      }
    }
  }
  return best;
}

export const stumpAccuracy = (s: Stump, rows: Visit[]) => round(rows.filter((v) => v[s.feature] > s.threshold === v.sick).length / rows.length);

export interface FeatureRun {
  useLeak: boolean;
  stump: Stump;
  test: number;
  production: number;
}

export function runFeature(useLeak: boolean): FeatureRun {
  const d = archive();
  const stump = trainStump(d.train, useLeak ? ["temp", "antibiotic"] : ["temp"]);
  return { useLeak, stump, test: stumpAccuracy(stump, d.test), production: stumpAccuracy(stump, d.production) };
}

// ---------------- 2. the same patient on both sides ----------------

export interface Row {
  patient: number;
  age: number;
  temp: number;
  sick: boolean;
}

export const PATIENTS = 150;
export const VISITS = 3;

/** 150 patients, three visits each; and 100 new patients the model has never seen. */
export function clinic(): { rows: Row[]; fresh: Row[] } {
  const r = rng(0x9a7e);
  const make = (from: number, n: number): Row[] =>
    Array.from({ length: n }, (_, k) => {
      const patient = from + k;
      const age = Math.round(20 + r() * 60);
      // Whether a patient is ill depends mostly on things the model does not see.
      const sick = r() < 0.45;
      return Array.from({ length: VISITS }, () => ({ patient, age, temp: round((sick ? 37.6 : 37.2) + normal(r) * 0.45), sick }));
    }).flat();
  return { rows: make(0, PATIENTS), fresh: make(1000, 100) };
}

export type DataSplit = "rows" | "patients";

/** A 1-nearest-neighbour model: it remembers every training row. */
function predict(train: Row[], x: Row): boolean {
  let best = train[0]!;
  let bestD = Infinity;
  for (const t of train) {
    const d = (t.age - x.age) ** 2 + (t.temp - x.temp) ** 2;
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return best.sick;
}

const knnAccuracy = (train: Row[], rows: Row[]) => round(rows.filter((x) => predict(train, x) === x.sick).length / rows.length);

export interface SplitRun {
  split: DataSplit;
  test: number;
  fresh: number;
  /** Test rows whose patient also appears in training. */
  shared: number;
}

/** Hold out 20% of the data, either by row or by whole patient, then compare with new patients. */
export function runSplit(split: DataSplit): SplitRun {
  const { rows, fresh } = clinic();
  const r = rng(0x5711);
  const testPatients = new Set<number>();
  const isTest =
    split === "rows"
      ? rows.map(() => r() < 0.2)
      : (() => {
          for (let p = 0; p < PATIENTS; p++) if (r() < 0.2) testPatients.add(p);
          return rows.map((x) => testPatients.has(x.patient));
        })();
  const train = rows.filter((_, i) => !isTest[i]);
  const test = rows.filter((_, i) => isTest[i]);
  const seen = new Set(train.map((x) => x.patient));
  return { split, test: knnAccuracy(train, test), fresh: knnAccuracy(train, fresh), shared: test.filter((x) => seen.has(x.patient)).length };
}
