import { backprop, bce, cloneNetwork, zeroGrads, type Activation, type Network } from "./network";

export interface LayerWalk {
  act: Activation;
  /** Inputs this layer received. */
  input: number[];
  W: number[][];
  b: number[];
  z: number[];
  a: number[];
  /** ∂L/∂z per unit. */
  delta: number[];
  /** ∂L/∂W[j][i] = delta[j] · input[i]. */
  gW: number[][];
  gb: number[];
}

/** Every number behind one prediction and one SGD step on a single sample. */
export interface SampleWalkthrough {
  x: number[];
  y: number;
  p: number;
  loss: number;
  layers: LayerWalk[];
  /** The network after one plain SGD step on this sample alone (w ← w − η·g − η·λ·w). */
  next: Network;
  nextP: number;
  nextLoss: number;
}

export function walkthrough(net: Network, x: number[], y: number, learningRate: number, l2 = 0): SampleWalkthrough {
  const { gW, gb } = zeroGrads(net);
  const { trace, deltas } = backprop(net, { x, y }, gW, gb);
  const p = trace.a[trace.a.length - 1]![0]!;
  const layers = net.layers.map((l, k) => ({
    act: l.act,
    input: trace.a[k]!,
    W: l.W,
    b: l.b,
    z: trace.z[k]!,
    a: trace.a[k + 1]!,
    delta: deltas[k]!,
    gW: gW[k]!,
    gb: gb[k]!,
  }));
  const next = cloneNetwork(net);
  next.layers.forEach((l, k) => {
    l.W.forEach((row, j) => row.forEach((w, i) => (row[i] = w - learningRate * gW[k]![j]![i]! - learningRate * l2 * w)));
    l.b.forEach((b, j) => (l.b[j] = b - learningRate * gb[k]![j]!));
  });
  const { trace: t2 } = backprop(next, { x, y }, zeroGrads(next).gW, zeroGrads(next).gb);
  const nextP = t2.a[t2.a.length - 1]![0]!;
  return { x, y, p, loss: bce(p, y), layers, next, nextP, nextLoss: bce(nextP, y) };
}

/**
 * Central finite-difference estimate of ∂L/∂(parameter): the slow, obvious
 * way backprop must agree with (a "gradient check").
 */
export function numericGradient(net: Network, x: number[], y: number, layer: number, j: number, i: number | "b", h = 1e-5): number {
  const at = (delta: number) => {
    const n = cloneNetwork(net);
    const l = n.layers[layer]!;
    if (i === "b") l.b[j] = l.b[j]! + delta;
    else l.W[j]![i] = l.W[j]![i]! + delta;
    const { trace } = backprop(n, { x, y }, zeroGrads(n).gW, zeroGrads(n).gb);
    return bce(trace.a[trace.a.length - 1]![0]!, y);
  };
  return (at(h) - at(-h)) / (2 * h);
}
