import { Rng } from "@inside-tech/sim-core";

export type Activation = "linear" | "relu" | "tanh" | "sigmoid" | "step";

/** Fully connected layer. W is [out][in]. Plain arrays so state is JSON/structured-clone friendly. */
export interface Layer {
  W: number[][];
  b: number[];
  act: Activation;
}

export interface Network {
  layers: Layer[];
}

export interface Sample {
  x: number[];
  y: number; // 0 | 1
}

export function activate(act: Activation, z: number): number {
  switch (act) {
    case "linear":
      return z;
    case "relu":
      return z > 0 ? z : 0;
    case "tanh":
      return Math.tanh(z);
    case "sigmoid":
      return 1 / (1 + Math.exp(-z));
    case "step":
      return z >= 0 ? 1 : 0;
  }
}

/** Derivative expressed in terms of z and a = act(z). Step uses a sigmoid surrogate gradient. */
export function activateDeriv(act: Activation, z: number, a: number): number {
  switch (act) {
    case "linear":
      return 1;
    case "relu":
      return z > 0 ? 1 : 0;
    case "tanh":
      return 1 - a * a;
    case "sigmoid":
      return a * (1 - a);
    case "step": {
      const s = 1 / (1 + Math.exp(-z));
      return s * (1 - s);
    }
  }
}

/**
 * Build a binary classifier: inputs → hidden layers (shared activation) → 1 sigmoid output.
 * Weights use He init for ReLU and Xavier otherwise, drawn from the deterministic Rng.
 */
export function createNetwork(
  inputs: number,
  hidden: number[],
  hiddenAct: Activation,
  rng: Rng,
  outputAct: Activation = "sigmoid",
): Network {
  const sizes = [inputs, ...hidden, 1];
  const layers: Layer[] = [];
  for (let l = 1; l < sizes.length; l++) {
    const fanIn = sizes[l - 1]!;
    const fanOut = sizes[l]!;
    const isOut = l === sizes.length - 1;
    const act = isOut ? outputAct : hiddenAct;
    const scale = act === "relu" ? Math.sqrt(2 / fanIn) : Math.sqrt(2 / (fanIn + fanOut));
    const W = Array.from({ length: fanOut }, () => Array.from({ length: fanIn }, () => rng.normal() * scale));
    const b = Array.from({ length: fanOut }, () => 0);
    layers.push({ W, b, act });
  }
  return { layers };
}

export interface ForwardTrace {
  /** a[0] is the input; a[l] the output of layer l-1. */
  a: number[][];
  /** z[l] is the pre-activation of layer l. */
  z: number[][];
}

export function forward(net: Network, x: number[]): ForwardTrace {
  const a: number[][] = [x];
  const z: number[][] = [];
  let input = x;
  for (const layer of net.layers) {
    const zl = new Array<number>(layer.b.length);
    const al = new Array<number>(layer.b.length);
    for (let j = 0; j < layer.b.length; j++) {
      const row = layer.W[j]!;
      let s = layer.b[j]!;
      for (let i = 0; i < input.length; i++) s += row[i]! * input[i]!;
      zl[j] = s;
      al[j] = activate(layer.act, s);
    }
    z.push(zl);
    a.push(al);
    input = al;
  }
  return { a, z };
}

export function predict(net: Network, x: number[]): number {
  const t = forward(net, x);
  return t.a[t.a.length - 1]![0]!;
}

const EPS = 1e-7;

export function bce(p: number, y: number): number {
  const q = Math.min(1 - EPS, Math.max(EPS, p));
  return -(y * Math.log(q) + (1 - y) * Math.log(1 - q));
}

export interface Metrics {
  loss: number;
  accuracy: number;
  count: number;
}

export function measure(net: Network, data: Sample[]): Metrics {
  if (data.length === 0) return { loss: 0, accuracy: 0, count: 0 };
  let loss = 0;
  let correct = 0;
  for (const s of data) {
    const p = predict(net, s.x);
    loss += bce(p, s.y);
    if ((p >= 0.5 ? 1 : 0) === s.y) correct++;
  }
  return { loss: loss / data.length, accuracy: correct / data.length, count: data.length };
}

export interface TrainConfig {
  learningRate: number;
  batchSize: number;
  /** L2 weight decay coefficient. */
  l2: number;
}

export function cloneNetwork(net: Network): Network {
  return { layers: net.layers.map((l) => ({ W: l.W.map((r) => r.slice()), b: l.b.slice(), act: l.act })) };
}

/**
 * Backpropagation for one sample: adds ∂L/∂W and ∂L/∂b (binary cross-entropy)
 * into the accumulators and returns the forward trace and per-layer deltas
 * (deltas[l][j] = ∂L/∂z of unit j in layer l).
 */
export function backprop(net: Network, s: Sample, gW: number[][][], gb: number[][]): { trace: ForwardTrace; deltas: number[][] } {
  const L = net.layers.length;
  const trace = forward(net, s.x);
  const { a, z } = trace;
  const deltas: number[][] = new Array(L);
  // Output delta: for sigmoid+BCE dL/dz = p - y. Other output activations use chain rule.
  const outLayer = net.layers[L - 1]!;
  const p = a[L]![0]!;
  let delta: number[] =
    outLayer.act === "sigmoid" ? [p - s.y] : [((p - s.y) / Math.max(EPS, p * (1 - p))) * activateDeriv(outLayer.act, z[L - 1]![0]!, p)];

  for (let l = L - 1; l >= 0; l--) {
    deltas[l] = delta;
    const layer = net.layers[l]!;
    const input = a[l]!;
    for (let j = 0; j < layer.b.length; j++) {
      const d = delta[j]!;
      gb[l]![j]! += d;
      const gRow = gW[l]![j]!;
      for (let i = 0; i < input.length; i++) gRow[i]! += d * input[i]!;
    }
    if (l > 0) {
      const prev = net.layers[l - 1]!;
      const next: number[] = new Array(input.length).fill(0);
      for (let i = 0; i < input.length; i++) {
        let s2 = 0;
        for (let j = 0; j < layer.b.length; j++) s2 += layer.W[j]![i]! * delta[j]!;
        next[i] = s2 * activateDeriv(prev.act, z[l - 1]![i]!, a[l]![i]!);
      }
      delta = next;
    }
  }
  return { trace, deltas };
}

/** Zeroed gradient accumulators shaped like `net`. */
export function zeroGrads(net: Network): { gW: number[][][]; gb: number[][] } {
  return { gW: net.layers.map((l) => l.W.map((r) => r.map(() => 0))), gb: net.layers.map((l) => l.b.map(() => 0)) };
}

/**
 * One epoch of mini-batch SGD with binary cross-entropy (sigmoid output).
 * Returns a new network; the input is not mutated. Shuffle order comes from `rng`.
 */
export function trainEpoch(net: Network, data: Sample[], cfg: TrainConfig, rng: Rng): Network {
  const out = cloneNetwork(net);
  if (data.length === 0) return out;
  const order = rng.shuffle(data.map((_, i) => i));
  const bs = Math.max(1, Math.min(cfg.batchSize, data.length));
  const L = out.layers.length;

  for (let start = 0; start < order.length; start += bs) {
    const batch = order.slice(start, start + bs);
    const { gW, gb } = zeroGrads(out);

    for (const idx of batch) backprop(out, data[idx]!, gW, gb);

    const scale = cfg.learningRate / batch.length;
    for (let l = 0; l < L; l++) {
      const layer = out.layers[l]!;
      for (let j = 0; j < layer.b.length; j++) {
        const row = layer.W[j]!;
        const gRow = gW[l]![j]!;
        for (let i = 0; i < row.length; i++) {
          row[i] = row[i]! - scale * gRow[i]! - cfg.learningRate * cfg.l2 * row[i]!;
        }
        layer.b[j] = layer.b[j]! - scale * gb[l]![j]!;
      }
    }
  }
  return out;
}

export function parameterCount(net: Network): number {
  return net.layers.reduce((n, l) => n + l.b.length * (l.W[0]?.length ?? 0) + l.b.length, 0);
}

export function isFiniteNetwork(net: Network): boolean {
  return net.layers.every((l) => l.b.every(Number.isFinite) && l.W.every((r) => r.every(Number.isFinite)));
}
