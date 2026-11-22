import type { AssessmentResult, SimulationPlugin } from "@inside-tech/sim-core";
import { I3, applyOp, det, inverse, isEchelon, isReduced, mul, type M2, type M3, type RowOp, type System, type V2, type V3 } from "./linalg";

export type MathMode = "vectors" | "dot" | "gauss" | "matrix" | "inverse" | "det" | "basis" | "eigen";

/** The system of the elimination lesson: x + y + z = 6, 2x + y − z = 1, x − y + 2z = 5 (solution 1, 2, 3). */
export const GAUSS_START: System = [
  [1, 1, 1, 6],
  [2, 1, -1, 1],
  [1, -1, 2, 5],
];

export const PRESETS: Record<string, M3> = {
  identity: I3,
  rot90: [
    [0, -1, 0],
    [1, 0, 0],
    [0, 0, 1],
  ],
  shear: [
    [1, 1, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
  stretch: [
    [2, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
  flatten: [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 0],
  ],
  mirror: [
    [-1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
};
export type Preset = keyof typeof PRESETS;

export const EIGEN_PRESETS: Record<"symmetric" | "shear2" | "rotation2", M2> = {
  symmetric: [
    [2, 1],
    [1, 2],
  ],
  shear2: [
    [1, 1],
    [0, 1],
  ],
  rotation2: [
    [0, -1],
    [1, 0],
  ],
};
export type EigenPreset = keyof typeof EIGEN_PRESETS;

export interface MathStats {
  /** Every u, v, k the learner tried (vectors and dot lessons). */
  vectorSnaps: { u: V3; v: V3; k: number }[];
  /** States of the augmented matrix after each row operation. */
  gaussOps: number;
  gaussEchelon: boolean;
  gaussReduced: boolean;
  /** Matrices the learner built or composed. */
  matrices: { m: M3; via: "edit" | "preset" | "compose" }[];
  inverseTries: { m: M3; ok: boolean }[];
  basisSnaps: { b1: V2; b2: V2; a: number; b: number }[];
  eigenProbes: { preset: EigenPreset; deg: number }[];
}

export interface MathLabState {
  mode: MathMode;
  u: V3;
  v: V3;
  k: number;
  sys: System;
  sysHistory: string[];
  A: M3;
  showInverse: boolean;
  b1: V2;
  b2: V2;
  a: number;
  b: number;
  eigen: EigenPreset;
  probe: number;
  stats: MathStats;
}

export type MathLabAction =
  | { type: "mode/set"; mode: MathMode }
  | { type: "vec/set"; which: "u" | "v"; value: V3 }
  | { type: "vec/k"; k: number }
  | { type: "gauss/op"; op: RowOp }
  | { type: "gauss/reset" }
  | { type: "matrix/set"; m: M3 }
  | { type: "matrix/cell"; r: number; c: number; value: number }
  | { type: "matrix/preset"; name: Preset }
  | { type: "matrix/compose"; name: Preset }
  | { type: "inverse/toggle"; on: boolean }
  | { type: "basis/set"; b1?: V2; b2?: V2; a?: number; b?: number }
  | { type: "eigen/preset"; name: EigenPreset }
  | { type: "eigen/probe"; deg: number };

const fin = (x: unknown, lo = -10, hi = 10) => (typeof x === "number" && Number.isFinite(x) ? Math.min(hi, Math.max(lo, Math.round(x * 1000) / 1000)) : 0);
const v3 = (v: readonly unknown[]): V3 => [fin(v[0]), fin(v[1]), fin(v[2])];
const v2 = (v: readonly unknown[]): V2 => [fin(v[0]), fin(v[1])];
const m3 = (m: readonly (readonly unknown[])[]): M3 => [v3(m[0] ?? []), v3(m[1] ?? []), v3(m[2] ?? [])];
const cap = <T>(xs: T[], n = 60) => xs.slice(-n);
const opName = (op: RowOp) => (op.kind === "swap" ? `R${op.i + 1} ↔ R${op.j + 1}` : op.kind === "scale" ? `R${op.i + 1} ← ${op.c}·R${op.i + 1}` : `R${op.i + 1} ← R${op.i + 1} ${op.c >= 0 ? "+" : "−"} ${Math.abs(op.c)}·R${op.j + 1}`);

export function initialMathState(): MathLabState {
  return {
    mode: "vectors",
    u: [3, 1, 0],
    v: [1, 2, 0],
    k: 1,
    sys: GAUSS_START.map((r) => [...r]) as System,
    sysHistory: [],
    A: I3,
    showInverse: false,
    b1: [1, 1],
    b2: [1, -1],
    a: 0,
    b: 0,
    eigen: "symmetric",
    probe: 0,
    stats: { vectorSnaps: [], gaussOps: 0, gaussEchelon: false, gaussReduced: false, matrices: [], inverseTries: [], basisSnaps: [], eigenProbes: [] },
  };
}

function snapVec(s: MathLabState): MathLabState {
  return { ...s, stats: { ...s.stats, vectorSnaps: cap([...s.stats.vectorSnaps, { u: s.u, v: s.v, k: s.k }]) } };
}
function snapBasis(s: MathLabState): MathLabState {
  return { ...s, stats: { ...s.stats, basisSnaps: cap([...s.stats.basisSnaps, { b1: s.b1, b2: s.b2, a: s.a, b: s.b }]) } };
}
function setMatrix(s: MathLabState, m: M3, via: "edit" | "preset" | "compose"): MathLabState {
  return { ...s, A: m, showInverse: false, stats: { ...s.stats, matrices: cap([...s.stats.matrices, { m, via }]) } };
}

function reduce(s: MathLabState, a: MathLabAction): MathLabState {
  switch (a.type) {
    case "mode/set":
      return { ...s, mode: a.mode };
    case "vec/set":
      return snapVec(a.which === "u" ? { ...s, u: v3(a.value) } : { ...s, v: v3(a.value) });
    case "vec/k":
      return snapVec({ ...s, k: fin(a.k, -5, 5) });
    case "gauss/op": {
      const op = a.op;
      const okRow = (i: unknown) => i === 0 || i === 1 || i === 2;
      if (!okRow(op.i) || (op.kind !== "scale" && (!okRow(op.j) || op.i === op.j))) return s;
      if (op.kind !== "swap" && (!Number.isFinite(op.c) || op.c === 0 || Math.abs(op.c) > 100)) return s;
      const sys = applyOp(s.sys, op);
      return {
        ...s,
        sys,
        sysHistory: [...s.sysHistory, opName(op)].slice(-30),
        stats: { ...s.stats, gaussOps: s.stats.gaussOps + 1, gaussEchelon: s.stats.gaussEchelon || isEchelon(sys), gaussReduced: s.stats.gaussReduced || isReduced(sys) },
      };
    }
    case "gauss/reset":
      return { ...s, sys: GAUSS_START.map((r) => [...r]) as System, sysHistory: [] };
    case "matrix/set":
      return setMatrix(s, m3(a.m), "edit");
    case "matrix/cell": {
      if (![0, 1, 2].includes(a.r) || ![0, 1, 2].includes(a.c)) return s;
      const m = s.A.map((row) => [...row]) as M3;
      m[a.r]![a.c] = fin(a.value);
      return setMatrix(s, m, "edit");
    }
    case "matrix/preset":
      return PRESETS[a.name] ? setMatrix(s, PRESETS[a.name]!, "preset") : s;
    case "matrix/compose":
      return PRESETS[a.name] ? setMatrix(s, mul(PRESETS[a.name]!, s.A), "compose") : s;
    case "inverse/toggle": {
      const ok = !!inverse(s.A);
      return { ...s, showInverse: a.on && ok, stats: a.on ? { ...s.stats, inverseTries: cap([...s.stats.inverseTries, { m: s.A, ok }]) } : s.stats };
    }
    case "basis/set":
      return snapBasis({ ...s, b1: a.b1 ? v2(a.b1) : s.b1, b2: a.b2 ? v2(a.b2) : s.b2, a: a.a !== undefined ? fin(a.a, -6, 6) : s.a, b: a.b !== undefined ? fin(a.b, -6, 6) : s.b });
    case "eigen/preset":
      return EIGEN_PRESETS[a.name] ? { ...s, eigen: a.name, probe: 0 } : s;
    case "eigen/probe": {
      const deg = ((Math.round(fin(a.deg, -360, 360)) % 180) + 180) % 180;
      return { ...s, probe: deg, stats: { ...s.stats, eigenProbes: cap([...s.stats.eigenProbes, { preset: s.eigen, deg }]) } };
    }
  }
}

function evaluate(s: MathLabState): AssessmentResult {
  return { score: 0, metrics: { det: det(s.A), ops: s.stats.gaussOps }, notes: [] };
}

export const mathLabPlugin: SimulationPlugin<MathLabState, MathLabAction> = {
  id: "math-lab",
  version: "1.0.0",
  initialize: () => initialMathState(),
  dispatch: reduce,
  step: (s) => s,
  snapshot: (s) => structuredClone(s),
  restore: (snap) => structuredClone(snap as MathLabState),
  evaluate,
};
