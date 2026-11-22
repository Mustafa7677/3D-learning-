import type { AssessmentResult, SimulationPlugin } from "@inside-tech/sim-core";
import { accuracy, driftScore, falseAlarms, train, weekData } from "./drift";
import { runFeature, runSplit, type FeatureRun, type DataSplit, type SplitRun } from "./leak";
import { KERNELS, confusion, convolve, edgeResponse, optimize, patients, squareImage, type Confusion, type KernelPreset, type OptRun, type Optimizer } from "./core";

export type OptimMode = "optim" | "metrics" | "conv" | "drift" | "leak";

export interface OptimStats {
  optimRuns: { opt: Optimizer; lr: number; steps: number | null; diverged: boolean }[];
  metricRuns: { trivial: boolean; threshold: number; accuracy: number; precision: number; recall: number }[];
  convRuns: { preset: KernelPreset | null; vertical: number; horizontal: number; flat: number }[];
  leakRuns?: ({ kind: "feature"; useLeak: boolean; test: number; production: number } | { kind: "split"; split: DataSplit; test: number; fresh: number })[];
  driftRuns?: { week: number; threshold: number; trainedWeek: number; accuracy: number; falseAlarms: number; drift: number }[];
}

export interface OptimLabState {
  mode: OptimMode;
  optim: { opt: Optimizer; lr: number; last: OptRun | null };
  metrics: { trivial: boolean; threshold: number; last: Confusion | null };
  conv: { kernel: number[]; preset: KernelPreset | null; output: number[] | null };
  drift?: { week: number; threshold: number; trainedWeek: number };
  leak?: { useLeak: boolean; split: DataSplit; feature: FeatureRun | null; splitRun: SplitRun | null };
  stats: OptimStats;
}

export type OptimLabAction =
  | { type: "mode/set"; mode: OptimMode }
  | { type: "optim/set"; opt?: Optimizer; lr?: number }
  | { type: "optim/run" }
  | { type: "metrics/set"; trivial?: boolean; threshold?: number }
  | { type: "metrics/evaluate" }
  | { type: "conv/preset"; preset: KernelPreset }
  | { type: "conv/cell"; index: number; value: number }
  | { type: "conv/apply" }
  | { type: "drift/week"; week: number }
  | { type: "drift/evaluate" }
  | { type: "drift/retrain" }
  | { type: "leak/set"; useLeak?: boolean; split?: DataSplit }
  | { type: "leak/train" }
  | { type: "leak/split" };

export const LRS = [0.05, 0.1, 0.3, 0.45, 0.55];
const cap = <T>(xs: T[], n = 40) => xs.slice(-n);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function initialOptimState(): OptimLabState {
  return {
    mode: "optim",
    optim: { opt: "sgd", lr: 0.1, last: null },
    metrics: { trivial: true, threshold: 0.5, last: null },
    conv: { kernel: [...KERNELS.identity], preset: "identity", output: null },
    drift: { week: 0, threshold: train(weekData(0)), trainedWeek: 0 },
    stats: { optimRuns: [], metricRuns: [], convRuns: [], driftRuns: [] },
  };
}

function reduce(s: OptimLabState, a: OptimLabAction): OptimLabState {
  const st = s.stats;
  switch (a.type) {
    case "mode/set":
      return { ...s, mode: a.mode };
    case "optim/set":
      return { ...s, mode: "optim", optim: { opt: a.opt ?? s.optim.opt, lr: a.lr !== undefined && LRS.includes(a.lr) ? a.lr : s.optim.lr, last: null } };
    case "optim/run": {
      const r = optimize(s.optim.opt, s.optim.lr);
      return { ...s, mode: "optim", optim: { ...s.optim, last: r }, stats: { ...st, optimRuns: cap([...st.optimRuns, { opt: s.optim.opt, lr: s.optim.lr, steps: r.steps, diverged: r.diverged }]) } };
    }
    case "metrics/set":
      return { ...s, mode: "metrics", metrics: { trivial: a.trivial ?? s.metrics.trivial, threshold: a.threshold !== undefined ? Math.round(clamp(a.threshold, 0, 1) * 100) / 100 : s.metrics.threshold, last: null } };
    case "metrics/evaluate": {
      const c = confusion(patients(), s.metrics.threshold, s.metrics.trivial);
      const run = { trivial: s.metrics.trivial, threshold: s.metrics.threshold, accuracy: c.accuracy, precision: c.precision, recall: c.recall };
      return { ...s, mode: "metrics", metrics: { ...s.metrics, last: c }, stats: { ...st, metricRuns: cap([...st.metricRuns, run]) } };
    }
    case "conv/preset":
      return { ...s, mode: "conv", conv: { kernel: [...KERNELS[a.preset]], preset: a.preset, output: null } };
    case "conv/cell": {
      const i = Math.round(a.index);
      if (i < 0 || i > 8) return s;
      const kernel = [...s.conv.kernel];
      kernel[i] = Math.round(clamp(a.value, -4, 4));
      return { ...s, mode: "conv", conv: { kernel, preset: null, output: null } };
    }
    case "drift/week": {
      const d = s.drift ?? { week: 0, threshold: train(weekData(0)), trainedWeek: 0 };
      return [0, 4, 8, 12].includes(a.week) ? { ...s, mode: "drift", drift: { ...d, week: a.week } } : s;
    }
    case "drift/retrain": {
      const d = s.drift ?? { week: 0, threshold: train(weekData(0)), trainedWeek: 0 };
      return { ...s, mode: "drift", drift: { ...d, threshold: train(weekData(d.week)), trainedWeek: d.week } };
    }
    case "drift/evaluate": {
      const d = s.drift ?? { week: 0, threshold: train(weekData(0)), trainedWeek: 0 };
      const data = weekData(d.week);
      const run = { week: d.week, threshold: d.threshold, trainedWeek: d.trainedWeek, accuracy: accuracy(data, d.threshold), falseAlarms: falseAlarms(data, d.threshold), drift: Math.round(driftScore(weekData(d.trainedWeek), data) * 100) / 100 };
      return { ...s, mode: "drift", stats: { ...st, driftRuns: cap([...(st.driftRuns ?? []), run]) } };
    }
    case "leak/set": {
      const l = s.leak ?? { useLeak: true, split: "rows" as DataSplit, feature: null, splitRun: null };
      const split = a.split === "rows" || a.split === "patients" ? a.split : l.split;
      return { ...s, mode: "leak", leak: { ...l, useLeak: a.useLeak ?? l.useLeak, split } };
    }
    case "leak/train": {
      const l = s.leak ?? { useLeak: true, split: "rows" as DataSplit, feature: null, splitRun: null };
      const r = runFeature(l.useLeak);
      return { ...s, mode: "leak", leak: { ...l, feature: r }, stats: { ...st, leakRuns: cap([...(st.leakRuns ?? []), { kind: "feature" as const, useLeak: r.useLeak, test: r.test, production: r.production }]) } };
    }
    case "leak/split": {
      const l = s.leak ?? { useLeak: true, split: "rows" as DataSplit, feature: null, splitRun: null };
      const r = runSplit(l.split);
      return { ...s, mode: "leak", leak: { ...l, splitRun: r }, stats: { ...st, leakRuns: cap([...(st.leakRuns ?? []), { kind: "split" as const, split: r.split, test: r.test, fresh: r.fresh }]) } };
    }
    case "conv/apply": {
      const out = convolve(squareImage(), s.conv.kernel);
      const r = edgeResponse(s.conv.kernel);
      return { ...s, mode: "conv", conv: { ...s.conv, output: out }, stats: { ...st, convRuns: cap([...st.convRuns, { preset: s.conv.preset, ...r }]) } };
    }
  }
}

export const optimLabPlugin: SimulationPlugin<OptimLabState, OptimLabAction> = {
  id: "ai-optim-lab",
  version: "1.0.0",
  initialize: () => initialOptimState(),
  dispatch: reduce,
  step: (s) => s,
  snapshot: (s) => structuredClone(s),
  restore: (snap) => structuredClone(snap as OptimLabState),
  evaluate: (s): AssessmentResult => ({ score: 0, metrics: { runs: s.stats.optimRuns.length + s.stats.metricRuns.length + s.stats.convRuns.length }, notes: [] }),
};
