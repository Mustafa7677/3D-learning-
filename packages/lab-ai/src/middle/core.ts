/**
 * AI Middle models: optimizers on a long narrow valley, classification
 * metrics on imbalanced data, and 2D convolution with 3×3 kernels.
 * Small and deterministic so every number in a lecture is pinned by a test.
 */

// ---------------- optimizers ----------------

export type Optimizer = "sgd" | "momentum" | "adam";
/** A ravine: gentle along x, steep along y (condition number 20). */
export const loss = (x: number, y: number) => 0.1 * x * x + 2 * y * y;
export const grad = (x: number, y: number): [number, number] => [0.2 * x, 4 * y];
export const OPT_START: [number, number] = [-9, 2];
export const OPT_STEPS = 150;
export const CONVERGED = 0.01;

export interface OptRun {
  path: [number, number][];
  /** First step at which the loss fell below CONVERGED, or null. */
  steps: number | null;
  diverged: boolean;
  final: number;
}

export function optimize(opt: Optimizer, lr: number): OptRun {
  let [x, y] = OPT_START;
  let vx = 0;
  let vy = 0;
  let mx = 0;
  let my = 0;
  let sx = 0;
  let sy = 0;
  const b1 = 0.9;
  const b2 = 0.999;
  const path: [number, number][] = [[x, y]];
  let steps: number | null = null;
  let diverged = false;
  for (let t = 1; t <= OPT_STEPS; t++) {
    const [gx, gy] = grad(x, y);
    if (opt === "sgd") {
      x -= lr * gx;
      y -= lr * gy;
    } else if (opt === "momentum") {
      vx = 0.9 * vx + gx;
      vy = 0.9 * vy + gy;
      x -= lr * vx;
      y -= lr * vy;
    } else {
      mx = b1 * mx + (1 - b1) * gx;
      my = b1 * my + (1 - b1) * gy;
      sx = b2 * sx + (1 - b2) * gx * gx;
      sy = b2 * sy + (1 - b2) * gy * gy;
      const mhx = mx / (1 - b1 ** t);
      const mhy = my / (1 - b1 ** t);
      const shx = sx / (1 - b2 ** t);
      const shy = sy / (1 - b2 ** t);
      x -= (lr * mhx) / (Math.sqrt(shx) + 1e-8);
      y -= (lr * mhy) / (Math.sqrt(shy) + 1e-8);
    }
    path.push([x, y]);
    const f = loss(x, y);
    if (!Number.isFinite(f) || f > 1e6) {
      diverged = true;
      break;
    }
    if (steps === null && f < CONVERGED) steps = t;
  }
  return { path, steps, diverged, final: loss(x, y) };
}

// ---------------- metrics on imbalanced data ----------------

export interface Patient {
  sick: boolean;
  /** The model's predicted probability of being sick. */
  score: number;
}

/** 200 people, 10 of them sick (5%). Scores overlap: no threshold is perfect. */
export function patients(): Patient[] {
  const sick = [0.42, 0.51, 0.58, 0.64, 0.7, 0.76, 0.82, 0.87, 0.92, 0.96].map((score) => ({ sick: true, score }));
  const healthy = Array.from({ length: 190 }, (_, i) => {
    const u = (i * 0.6180339887) % 1;
    return { sick: false, score: Math.round(0.75 * u ** 2 * 1000) / 1000 };
  });
  return [...healthy, ...sick];
}

export interface Confusion {
  tp: number;
  fp: number;
  fn: number;
  tn: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
}

export function confusion(data: Patient[], threshold: number, trivial = false): Confusion {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let tn = 0;
  for (const p of data) {
    const yes = !trivial && p.score >= threshold;
    if (yes && p.sick) tp++;
    else if (yes) fp++;
    else if (p.sick) fn++;
    else tn++;
  }
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { tp, fp, fn, tn, accuracy: (tp + tn) / data.length, precision, recall, f1 };
}

// ---------------- convolution ----------------

export const IMG_N = 8;

/** An 8×8 picture: a bright 4×4 square in the middle of a dark field. */
export function squareImage(): number[] {
  return Array.from({ length: IMG_N * IMG_N }, (_, i) => {
    const x = i % IMG_N;
    const y = Math.floor(i / IMG_N);
    return x >= 2 && x <= 5 && y >= 2 && y <= 5 ? 1 : 0;
  });
}

export type KernelPreset = "identity" | "blur" | "sobel-x" | "sobel-y" | "sharpen";
export const KERNELS: Record<KernelPreset, number[]> = {
  identity: [0, 0, 0, 0, 1, 0, 0, 0, 0],
  blur: [1, 1, 1, 1, 1, 1, 1, 1, 1].map((v) => v / 9),
  "sobel-x": [-1, 0, 1, -2, 0, 2, -1, 0, 1],
  "sobel-y": [-1, -2, -1, 0, 0, 0, 1, 2, 1],
  sharpen: [0, -1, 0, -1, 5, -1, 0, -1, 0],
};

/** "Valid" convolution (as in CNNs, no flip): an 8×8 image and a 3×3 kernel give 6×6. */
export function convolve(img: number[], k: number[], n = IMG_N): number[] {
  const m = n - 2;
  const out: number[] = [];
  for (let y = 0; y < m; y++)
    for (let x = 0; x < m; x++) {
      let s = 0;
      for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) s += img[(y + j) * n + (x + i)]! * k[j * 3 + i]!;
      out.push(Math.round(s * 1000) / 1000);
    }
  return out;
}

/** How strongly a kernel answers a pure vertical edge and a pure horizontal one (and a flat patch). */
export function edgeResponse(k: number[]): { vertical: number; horizontal: number; flat: number } {
  const v = [0, 0, 1, 0, 0, 1, 0, 0, 1];
  const h = [0, 0, 0, 0, 0, 0, 1, 1, 1];
  const dot = (p: number[]) => Math.abs(p.reduce((s, x, i) => s + x * k[i]!, 0));
  return { vertical: dot(v), horizontal: dot(h), flat: Math.abs(k.reduce((s, x) => s + x, 0)) };
}
