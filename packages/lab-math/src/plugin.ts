import type { AssessmentResult, SimulationPlugin } from "@inside-tech/sim-core";
import { conicKind, type ConicKind, type Cut, type Ellipse } from "./conic";
import { I3, applyOp, det, inverse, isEchelon, isReduced, mul, type M2, type M3, type RowOp, type System, type V2, type V3 } from "./linalg";

export type MathMode = "vectors" | "dot" | "gauss" | "matrix" | "inverse" | "det" | "basis" | "eigen" | "ellipse" | "conic";

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
  /** Every ellipse and point the learner set (a, c, parameter angle t). */
  ellipseSnaps: { a: number; c: number; t: number }[];
  /** Every cut of the cone, with what it gave. */
  conicSnaps: { tilt: number; d: number; kind: ConicKind }[];
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
  ell: Ellipse & { t: number };
  cut: Cut;
  /** What a solution film is showing right now; drawn over the learner's state, never graded. */
  film?: FilmScene | null;
  stats: MathStats;
}

export type FilmScene = Partial<Pick<MathLabState, "u" | "v" | "k" | "sys" | "A" | "showInverse" | "b1" | "b2" | "a" | "b" | "eigen" | "probe" | "ell" | "cut">>;

/** The state the 3D scene draws: the learner's, with the film's patch on top. */
export const shown = (s: MathLabState): MathLabState => (s.film ? { ...s, ...s.film } : s);

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
  | { type: "eigen/probe"; deg: number }
  | { type: "ellipse/set"; a?: number; c?: number; t?: number }
  | { type: "conic/set"; tilt?: number; d?: number }
  | { type: "film/scene"; patch: Record<string, unknown> | null };

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
    ell: { a: 5, c: 3, t: 0 },
    cut: { tilt: 0, d: 1 },
    stats: { vectorSnaps: [], gaussOps: 0, gaussEchelon: false, gaussReduced: false, matrices: [], inverseTries: [], basisSnaps: [], eigenProbes: [], ellipseSnaps: [], conicSnaps: [] },
  };
}

function snapVec(s: MathLabState): MathLabState {
  return { ...s, stats: { ...s.stats, vectorSnaps: cap([...s.stats.vectorSnaps, { u: s.u, v: s.v, k: s.k }]) } };
}
function snapBasis(s: MathLabState): MathLabState {
  return { ...s, stats: { ...s.stats, basisSnaps: cap([...s.stats.basisSnaps, { b1: s.b1, b2: s.b2, a: s.a, b: s.b }]) } };
}
/** a in [1, 7]; the foci stay strictly inside: c in [0, a − 0.5]; t in [0, 360). */
function cleanEllipse(a: unknown, c: unknown, t: unknown): Ellipse & { t: number } {
  const A = fin(a, 1, 7);
  return { a: A, c: fin(c, 0, Math.max(0, A - 0.5)), t: ((Math.round(fin(t, -720, 720)) % 360) + 360) % 360 };
}
function cleanCut(tilt: unknown, d: unknown): Cut {
  return { tilt: Math.round(fin(tilt, 0, 90)), d: Math.round(fin(d, -2, 2) * 10) / 10 };
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
    case "ellipse/set": {
      const ell = cleanEllipse(a.a ?? s.ell.a, a.c ?? s.ell.c, a.t ?? s.ell.t);
      return { ...s, ell, stats: { ...s.stats, ellipseSnaps: cap([...s.stats.ellipseSnaps, ell]) } };
    }
    case "conic/set": {
      const cut = cleanCut(a.tilt ?? s.cut.tilt, a.d ?? s.cut.d);
      return { ...s, cut, stats: { ...s.stats, conicSnaps: cap([...s.stats.conicSnaps, { ...cut, kind: conicKind(cut) }]) } };
    }
    case "film/scene": {
      if (!a.patch) return { ...s, film: null };
      const q = a.patch;
      const f: FilmScene = { ...(s.film ?? {}) };
      if (Array.isArray(q.u)) f.u = v3(q.u);
      if (Array.isArray(q.v)) f.v = v3(q.v);
      if (typeof q.k === "number") f.k = fin(q.k, -5, 5);
      if (Array.isArray(q.sys) && q.sys.length === 3) f.sys = (q.sys as unknown[][]).map((r) => [0, 1, 2, 3].map((i) => fin(r[i], -100, 100))) as System;
      if (Array.isArray(q.A)) f.A = m3(q.A as unknown[][]);
      if (typeof q.showInverse === "boolean") f.showInverse = q.showInverse && !!inverse(f.A ?? s.A);
      if (Array.isArray(q.b1)) f.b1 = v2(q.b1);
      if (Array.isArray(q.b2)) f.b2 = v2(q.b2);
      if (typeof q.a === "number") f.a = fin(q.a, -6, 6);
      if (typeof q.b === "number") f.b = fin(q.b, -6, 6);
      if (typeof q.eigen === "string" && q.eigen in EIGEN_PRESETS) f.eigen = q.eigen as EigenPreset;
      if (q.ell && typeof q.ell === "object") {
        const e = q.ell as Record<string, unknown>;
        const base = f.ell ?? s.ell;
        f.ell = cleanEllipse(e.a ?? base.a, e.c ?? base.c, e.t ?? base.t);
      }
      if (q.cut && typeof q.cut === "object") {
        const c = q.cut as Record<string, unknown>;
        const base = f.cut ?? s.cut;
        f.cut = cleanCut(c.tilt ?? base.tilt, c.d ?? base.d);
      }
      if (typeof q.probe === "number") f.probe = ((Math.round(fin(q.probe, -360, 360)) % 180) + 180) % 180;
      return { ...s, film: f };
    }
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
