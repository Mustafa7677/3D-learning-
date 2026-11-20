import { Rng, type AssessmentResult, type SimulationPlugin } from "@inside-tech/sim-core";
import { walkthrough, type SampleWalkthrough } from "./ml/explain";
import { generateDataset, type DatasetKind } from "./ml/datasets";
import {
  createNetwork,
  forward,
  isFiniteNetwork,
  measure,
  predict,
  trainEpoch,
  type Activation,
  type ForwardTrace,
  type Network,
  type Sample,
} from "./ml/network";

export type Split = "train" | "test";
export type ModelKind = "neuron" | "network";
export type NeuronActivation = "step" | "sigmoid";
export type HiddenActivation = "relu" | "tanh" | "sigmoid";

export interface DataPoint {
  id: number;
  x: number;
  y: number;
  label: 0 | 1;
  split: Split;
}

export interface NeuronParams {
  w1: number;
  w2: number;
  b: number;
  activation: NeuronActivation;
}

export interface Hyperparams {
  learningRate: number;
  batchSize: number;
  /** Training stops automatically at this epoch. */
  epochLimit: number;
  /** Epochs run per fixed simulation tick (training speed). */
  epochsPerTick: number;
  l2: number;
}

export interface EpochRecord {
  epoch: number;
  trainLoss: number;
  testLoss: number;
  trainAcc: number;
  testAcc: number;
}

/** Learner-behaviour counters that lessons grade against. */
export interface LearnerStats {
  userAdded: [number, number];
  userRemoved: number;
  relabels: number;
  reshuffles: number;
  datasetsGenerated: DatasetKind[];
  neuronEdits: number;
  /** Neuron edits since the current dataset was loaded. */
  neuronEditsOnDataset: number;
  inspectedPoints: number[];
  hiddenActivationsTried: HiddenActivation[];
  /** Epochs trained grouped by condition. */
  epochsHighLr: number;
  epochsLowLr: number;
  epochsBatch1: number;
  epochsLargeBatch: number;
  diverged: boolean;
  bestTestAcc: number;
  /** Largest train−test accuracy gap seen while training (overfitting). */
  maxGap: number;
  /** Epochs trained with L2 regularisation switched on. */
  epochsWithL2: number;
  /** Test loss rose ≥ 0.1 above its best while train loss kept falling. */
  sawTestLossRise: boolean;
  /** Largest test−train loss gap seen while training. */
  maxLossGap: number;
  exports: number;
}

export interface AiLabState {
  rngSeed: number;
  nextPointId: number;
  datasetKind: DatasetKind | "custom";
  /** Seed of the current generated dataset when it was fixed by a lesson; null otherwise. */
  dataSeed: number | null;
  noise: number;
  points: DataPoint[];
  trainRatio: number;
  model: ModelKind;
  neuron: NeuronParams;
  hidden: number[];
  hiddenActivation: HiddenActivation;
  network: Network;
  hyper: Hyperparams;
  training: {
    running: boolean;
    epoch: number;
    history: EpochRecord[];
  };
  selectedPointId: number | null;
  stats: LearnerStats;
}

export type AiLabAction =
  | { type: "dataset/generate"; kind: DatasetKind; count?: number; noise?: number; /** Fixed data seed: same points and split every time (lessons). */ seed?: number; /** Reuse the current dataset seed (count/noise sliders). */ keepSeed?: boolean }
  | { type: "dataset/clear" }
  | { type: "point/add"; x: number; y: number; label: 0 | 1 }
  | { type: "point/remove"; id: number }
  | { type: "point/relabel"; id: number }
  | { type: "point/select"; id: number | null }
  | { type: "split/setRatio"; ratio: number }
  | { type: "split/reshuffle" }
  | { type: "model/select"; model: ModelKind }
  | { type: "neuron/set"; params: Partial<NeuronParams> }
  | { type: "network/setHidden"; hidden: number[] }
  | { type: "network/setActivation"; activation: HiddenActivation }
  | { type: "network/reinit" }
  | { type: "hyper/set"; params: Partial<Hyperparams> }
  | { type: "train/start" }
  | { type: "train/pause" }
  | { type: "train/epoch"; count?: number }
  | { type: "train/reset" }
  /** Learner exported the trained model (UI copies/downloads `exportModel(state)`). */
  | { type: "model/export" };

export const MAX_POINTS = 600;
export const MAX_HIDDEN_LAYERS = 4;
export const MAX_UNITS = 16;
const HISTORY_LIMIT = 1000;
const HIGH_LR = 1;
const LOW_LR = 0.1;

const emptyStats = (): LearnerStats => ({
  userAdded: [0, 0],
  userRemoved: 0,
  relabels: 0,
  reshuffles: 0,
  datasetsGenerated: [],
  neuronEdits: 0,
  neuronEditsOnDataset: 0,
  inspectedPoints: [],
  hiddenActivationsTried: [],
  epochsHighLr: 0,
  epochsLowLr: 0,
  epochsBatch1: 0,
  epochsLargeBatch: 0,
  diverged: false,
  bestTestAcc: 0,
  maxGap: 0,
  epochsWithL2: 0,
  sawTestLossRise: false,
  maxLossGap: 0,
  exports: 0,
});

/** Deterministically assign splits: a seeded shuffle, first `ratio` fraction is train. */
function assignSplits(points: DataPoint[], ratio: number, rng: Rng): DataPoint[] {
  const order = rng.shuffle(points.map((_, i) => i));
  const nTrain = Math.round(points.length * ratio);
  const split: Split[] = new Array(points.length);
  order.forEach((idx, rank) => (split[idx] = rank < nTrain ? "train" : "test"));
  return points.map((p, i) => ({ ...p, split: split[i]! }));
}

function freshNetwork(s: Pick<AiLabState, "hidden" | "hiddenActivation">, rng: Rng): Network {
  return createNetwork(2, s.hidden, s.hiddenActivation, rng);
}

function resetTraining(_s: AiLabState): AiLabState["training"] {
  return { running: false, epoch: 0, history: [] };
}

export function neuronAsNetwork(n: NeuronParams): Network {
  return { layers: [{ W: [[n.w1, n.w2]], b: [n.b], act: n.activation }] };
}

/** The model currently being evaluated/visualised. */
export function activeNetwork(s: AiLabState): Network {
  return s.model === "neuron" ? neuronAsNetwork(s.neuron) : s.network;
}

export function samples(s: AiLabState, split?: Split): Sample[] {
  return s.points.filter((p) => !split || p.split === split).map((p) => ({ x: [p.x, p.y], y: p.label }));
}

function recordEpoch(s: AiLabState, net: Network, epoch: number): EpochRecord {
  const tr = measure(net, samples(s, "train"));
  const te = measure(net, samples(s, "test"));
  return { epoch, trainLoss: tr.loss, testLoss: te.loss, trainAcc: tr.accuracy, testAcc: te.accuracy };
}

/** Test loss climbed ≥ 0.1 above its minimum while train loss is at or below its value then. */
function detectTestLossRise(history: EpochRecord[]): boolean {
  let best = 0;
  for (let i = 1; i < history.length; i++) if (history[i]!.testLoss < history[best]!.testLoss) best = i;
  const last = history[history.length - 1]!;
  const min = history[best]!;
  return best < history.length - 5 && last.testLoss - min.testLoss >= 0.1 && last.trainLoss <= min.trainLoss;
}

/** Chance-level BCE is ln 2 ≈ 0.69; five epochs in a row at 2× that means training blew up. */
function isStuckAboveChance(history: EpochRecord[]): boolean {
  if (history.length < 5) return false;
  return history.slice(-5).every((h) => h.trainLoss > 2 * Math.LN2);
}

function runEpochs(s: AiLabState, n: number): AiLabState {
  if (s.model !== "network") return s;
  const train = samples(s, "train");
  if (train.length === 0) return { ...s, training: { ...s.training, running: false } };
  const rng = new Rng(s.rngSeed);
  let net = s.network;
  let epoch = s.training.epoch;
  const history = s.training.history.slice();
  const stats = { ...s.stats };
  let running = s.training.running;
  for (let i = 0; i < n; i++) {
    net = trainEpoch(net, train, { learningRate: s.hyper.learningRate, batchSize: s.hyper.batchSize, l2: s.hyper.l2 }, rng);
    epoch++;
    const rec = recordEpoch(s, net, epoch);
    history.push(rec);
    if (s.hyper.learningRate >= HIGH_LR) stats.epochsHighLr++;
    if (s.hyper.learningRate <= LOW_LR) stats.epochsLowLr++;
    if (s.hyper.batchSize === 1) stats.epochsBatch1++;
    if (s.hyper.batchSize >= 32) stats.epochsLargeBatch++;
    stats.bestTestAcc = Math.max(stats.bestTestAcc, rec.testAcc);
    if (rec.trainAcc >= 0.9) stats.maxGap = Math.max(stats.maxGap, rec.trainAcc - rec.testAcc);
    if (s.hyper.l2 > 0) stats.epochsWithL2++;
    if (Number.isFinite(rec.testLoss - rec.trainLoss)) stats.maxLossGap = Math.max(stats.maxLossGap, rec.testLoss - rec.trainLoss);
    if (!stats.sawTestLossRise && history.length >= 20) stats.sawTestLossRise = detectTestLossRise(history);
    if (!isFiniteNetwork(net) || !Number.isFinite(rec.trainLoss) || rec.trainLoss > 5 || isStuckAboveChance(history)) {
      stats.diverged = true;
      running = false;
      break;
    }
    if (epoch >= s.hyper.epochLimit) {
      running = false;
      break;
    }
  }
  if (history.length > HISTORY_LIMIT) history.splice(0, history.length - HISTORY_LIMIT);
  return { ...s, rngSeed: rng.seed, network: net, training: { running, epoch, history }, stats };
}

const clampNum = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo));

function loadDataset(s: AiLabState, kind: DatasetKind, count: number, noise: number, dataSeed?: number): AiLabState {
  const rng = new Rng(s.rngSeed);
  const dataRng = dataSeed === undefined ? rng : new Rng(dataSeed);
  const raw = generateDataset(kind, clampNum(count, 2, MAX_POINTS), clampNum(noise, 0, 1), dataRng);
  let id = s.nextPointId;
  const pts: DataPoint[] = raw.map((p) => ({ ...p, id: id++, split: "train" }));
  const points = assignSplits(pts, s.trainRatio, dataRng);
  const network = freshNetwork(s, rng);
  return {
    ...s,
    rngSeed: rng.seed,
    nextPointId: id,
    datasetKind: kind,
    dataSeed: dataSeed ?? null,
    noise: clampNum(noise, 0, 1),
    points,
    network,
    training: resetTraining(s),
    selectedPointId: null,
    stats: {
      ...s.stats,
      datasetsGenerated: [...s.stats.datasetsGenerated, kind],
      neuronEditsOnDataset: 0,
      inspectedPoints: [],
    },
  };
}

export function initialState(seed: number): AiLabState {
  const base: AiLabState = {
    rngSeed: seed >>> 0,
    nextPointId: 1,
    datasetKind: "custom",
    dataSeed: null,
    noise: 0.2,
    points: [],
    trainRatio: 0.8,
    model: "network",
    neuron: { w1: 0.5, w2: -0.5, b: 0, activation: "step" },
    hidden: [6, 6],
    hiddenActivation: "tanh",
    network: { layers: [] },
    hyper: { learningRate: 0.3, batchSize: 16, epochLimit: 300, epochsPerTick: 1, l2: 0 },
    training: { running: false, epoch: 0, history: [] },
    selectedPointId: null,
    stats: emptyStats(),
  };
  const s = loadDataset(base, "blobs", 160, 0.2);
  return { ...s, stats: emptyStats() };
}

function reduce(s: AiLabState, a: AiLabAction): AiLabState {
  switch (a.type) {
    case "dataset/generate":
      return loadDataset(s, a.kind, a.count ?? Math.max(s.points.length, 160), a.noise ?? s.noise, a.seed ?? (a.keepSeed ? (s.dataSeed ?? undefined) : undefined));

    case "dataset/clear":
      return { ...s, points: [], datasetKind: "custom", selectedPointId: null, training: resetTraining(s) };

    case "point/add": {
      if (s.points.length >= MAX_POINTS) return s;
      const rng = new Rng(s.rngSeed);
      // New points go to train with probability trainRatio, keeping the split honest.
      const split: Split = rng.next() < s.trainRatio ? "train" : "test";
      const p: DataPoint = { id: s.nextPointId, x: clampNum(a.x, -1, 1), y: clampNum(a.y, -1, 1), label: a.label, split };
      const userAdded: [number, number] = [...s.stats.userAdded];
      userAdded[a.label]++;
      return {
        ...s,
        rngSeed: rng.seed,
        nextPointId: s.nextPointId + 1,
        points: [...s.points, p],
        datasetKind: "custom",
        stats: { ...s.stats, userAdded },
      };
    }

    case "point/remove": {
      if (!s.points.some((p) => p.id === a.id)) return s;
      return {
        ...s,
        points: s.points.filter((p) => p.id !== a.id),
        selectedPointId: s.selectedPointId === a.id ? null : s.selectedPointId,
        stats: { ...s.stats, userRemoved: s.stats.userRemoved + 1 },
      };
    }

    case "point/relabel":
      return {
        ...s,
        points: s.points.map((p) => (p.id === a.id ? { ...p, label: (1 - p.label) as 0 | 1 } : p)),
        stats: { ...s.stats, relabels: s.stats.relabels + 1 },
      };

    case "point/select": {
      if (a.id !== null && !s.points.some((p) => p.id === a.id)) return s;
      const inspected =
        a.id !== null && !s.stats.inspectedPoints.includes(a.id)
          ? [...s.stats.inspectedPoints, a.id].slice(-50)
          : s.stats.inspectedPoints;
      return { ...s, selectedPointId: a.id, stats: { ...s.stats, inspectedPoints: inspected } };
    }

    case "split/setRatio": {
      const ratio = clampNum(a.ratio, 0.1, 0.95);
      const rng = new Rng(s.rngSeed);
      return { ...s, trainRatio: ratio, points: assignSplits(s.points, ratio, rng), rngSeed: rng.seed, training: resetTraining(s) };
    }

    case "split/reshuffle": {
      const rng = new Rng(s.rngSeed);
      return {
        ...s,
        points: assignSplits(s.points, s.trainRatio, rng),
        rngSeed: rng.seed,
        training: resetTraining(s),
        stats: { ...s.stats, reshuffles: s.stats.reshuffles + 1 },
      };
    }

    case "model/select":
      return { ...s, model: a.model, training: { ...s.training, running: false } };

    case "neuron/set": {
      const n = { ...s.neuron };
      if (a.params.w1 !== undefined) n.w1 = clampNum(a.params.w1, -10, 10);
      if (a.params.w2 !== undefined) n.w2 = clampNum(a.params.w2, -10, 10);
      if (a.params.b !== undefined) n.b = clampNum(a.params.b, -10, 10);
      if (a.params.activation) n.activation = a.params.activation;
      return {
        ...s,
        neuron: n,
        stats: { ...s.stats, neuronEdits: s.stats.neuronEdits + 1, neuronEditsOnDataset: s.stats.neuronEditsOnDataset + 1 },
      };
    }

    case "network/setHidden": {
      const hidden = a.hidden
        .slice(0, MAX_HIDDEN_LAYERS)
        .map((u) => Math.round(clampNum(u, 1, MAX_UNITS)));
      const rng = new Rng(s.rngSeed);
      const next = { ...s, hidden };
      return { ...next, network: freshNetwork(next, rng), rngSeed: rng.seed, training: resetTraining(s) };
    }

    case "network/setActivation": {
      const rng = new Rng(s.rngSeed);
      const next = { ...s, hiddenActivation: a.activation };
      const tried = s.stats.hiddenActivationsTried.includes(a.activation)
        ? s.stats.hiddenActivationsTried
        : [...s.stats.hiddenActivationsTried, a.activation];
      return {
        ...next,
        network: freshNetwork(next, rng),
        rngSeed: rng.seed,
        training: resetTraining(s),
        stats: { ...s.stats, hiddenActivationsTried: tried },
      };
    }

    case "network/reinit": {
      const rng = new Rng(s.rngSeed);
      return { ...s, network: freshNetwork(s, rng), rngSeed: rng.seed, training: resetTraining(s) };
    }

    case "hyper/set": {
      const h = { ...s.hyper };
      const p = a.params;
      if (p.learningRate !== undefined) h.learningRate = clampNum(p.learningRate, 0.0001, 10);
      if (p.batchSize !== undefined) h.batchSize = Math.round(clampNum(p.batchSize, 1, 512));
      if (p.epochLimit !== undefined) h.epochLimit = Math.round(clampNum(p.epochLimit, 1, 5000));
      if (p.epochsPerTick !== undefined) h.epochsPerTick = Math.round(clampNum(p.epochsPerTick, 1, 20));
      if (p.l2 !== undefined) h.l2 = clampNum(p.l2, 0, 0.1);
      return { ...s, hyper: h };
    }

    case "train/start": {
      if (s.model !== "network") return s;
      const limit = s.training.epoch >= s.hyper.epochLimit ? s.training.epoch + s.hyper.epochLimit : s.hyper.epochLimit;
      return { ...s, hyper: { ...s.hyper, epochLimit: limit }, training: { ...s.training, running: true }, stats: { ...s.stats, diverged: false } };
    }

    case "train/pause":
      return { ...s, training: { ...s.training, running: false } };

    case "train/epoch": {
      const unlimited = { ...s, hyper: { ...s.hyper, epochLimit: Number.MAX_SAFE_INTEGER } };
      const after = runEpochs(unlimited, Math.max(1, Math.min(500, a.count ?? 1)));
      return { ...after, hyper: s.hyper, training: { ...after.training, running: s.training.running } };
    }

    case "model/export":
      return { ...s, stats: { ...s.stats, exports: s.stats.exports + 1 } };

    case "train/reset": {
      const rng = new Rng(s.rngSeed);
      return { ...s, network: freshNetwork(s, rng), rngSeed: rng.seed, training: resetTraining(s) };
    }
  }
}

export function evaluateAiLab(s: AiLabState): AssessmentResult {
  const net = activeNetwork(s);
  const tr = measure(net, samples(s, "train"));
  const te = measure(net, samples(s, "test"));
  const all = measure(net, samples(s));
  const counts = [0, 0];
  for (const p of s.points) counts[p.label]!++;
  const notes: string[] = [];
  if (s.points.length < 10) notes.push("few-points");
  const minority = Math.min(counts[0]!, counts[1]!) / Math.max(1, s.points.length);
  if (s.points.length >= 10 && minority < 0.25) notes.push("class-imbalance");
  if (te.count > 0 && tr.accuracy - te.accuracy > 0.12) notes.push("overfitting");
  if (s.stats.diverged) notes.push("diverged");
  if (s.model === "network" && s.training.epoch > 30 && tr.accuracy < 0.7) notes.push("underfitting");
  return {
    score: te.count > 0 ? te.accuracy : tr.accuracy,
    metrics: {
      trainAcc: tr.accuracy,
      testAcc: te.accuracy,
      trainLoss: tr.loss,
      testLoss: te.loss,
      accuracy: all.accuracy,
      points: s.points.length,
      trainCount: tr.count,
      testCount: te.count,
      class0: counts[0]!,
      class1: counts[1]!,
      epoch: s.training.epoch,
    },
    notes,
  };
}

export const aiLabPlugin: SimulationPlugin<AiLabState, AiLabAction> = {
  id: "ai-lab",
  version: "1.0.0",
  initialize: initialState,
  dispatch: reduce,
  step(s) {
    if (!s.training.running) return s;
    return runEpochs(s, s.hyper.epochsPerTick);
  },
  snapshot: (s) => structuredClone(s),
  restore: (snap) => structuredClone(snap as AiLabState),
  evaluate: evaluateAiLab,
};

// ---- Selectors used by the renderer ----

/** Probability grid over [-1,1]² (row-major, y rows top→bottom from -1 to 1). */
export function predictionGrid(s: AiLabState, res: number): Float32Array {
  const net = activeNetwork(s);
  const out = new Float32Array(res * res);
  for (let j = 0; j < res; j++) {
    const y = -1 + (2 * j) / (res - 1);
    for (let i = 0; i < res; i++) {
      const x = -1 + (2 * i) / (res - 1);
      out[j * res + i] = net.layers.length ? predict(net, [x, y]) : 0.5;
    }
  }
  return out;
}

export function selectedTrace(s: AiLabState): ForwardTrace | undefined {
  const p = s.points.find((q) => q.id === s.selectedPointId);
  if (!p) return undefined;
  return forward(activeNetwork(s), [p.x, p.y]);
}

export type { Activation };

export interface ExportedModel {
  format: "inside-tech/mlp@1";
  inputs: ["x1", "x2"];
  output: "P(class = 1)";
  hidden: number[];
  hiddenActivation: HiddenActivation;
  layers: { W: number[][]; b: number[]; activation: Activation }[];
  metrics: { trainAcc: number; testAcc: number; epochs: number; dataset: string };
}

/** Portable JSON of the active network, runnable with the snippet in `exportedModelRunner`. */
export function exportModel(s: AiLabState): ExportedModel {
  const m = evaluateAiLab(s).metrics;
  const round = (v: number) => Math.round(v * 1e6) / 1e6;
  return {
    format: "inside-tech/mlp@1",
    inputs: ["x1", "x2"],
    output: "P(class = 1)",
    hidden: s.hidden,
    hiddenActivation: s.hiddenActivation,
    layers: s.network.layers.map((l) => ({ W: l.W.map((r) => r.map(round)), b: l.b.map(round), activation: l.act })),
    metrics: { trainAcc: m.trainAcc ?? 0, testAcc: m.testAcc ?? 0, epochs: s.training.epoch, dataset: s.datasetKind },
  };
}

/** Plain-JS predictor for an exported model, shown to the learner next to the JSON. */
export const exportedModelRunner = `function predict(model, x1, x2) {
  const f = { relu: (z) => Math.max(0, z), tanh: Math.tanh, sigmoid: (z) => 1 / (1 + Math.exp(-z)), linear: (z) => z, step: (z) => (z >= 0 ? 1 : 0) };
  let a = [x1, x2];
  for (const layer of model.layers) {
    a = layer.W.map((row, j) => f[layer.activation](row.reduce((s, w, i) => s + w * a[i], layer.b[j])));
  }
  return a[0]; // P(class = 1)
}`;

/** Full numeric walkthrough (forward, loss, backprop, next step) for the selected point. */
export function selectedWalkthrough(s: AiLabState): SampleWalkthrough | undefined {
  const p = s.points.find((q) => q.id === s.selectedPointId);
  if (!p) return undefined;
  return walkthrough(activeNetwork(s), [p.x, p.y], p.label, s.hyper.learningRate, s.hyper.l2);
}
