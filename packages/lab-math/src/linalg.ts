/**
 * The linear algebra behind the first subject: vectors in 3D, 3×3 matrices
 * (stored as rows), Gaussian elimination on a 3×4 augmented matrix, inverse,
 * determinant, coordinates in a basis and eigen-directions of 2×2 matrices.
 * Small and exact enough for teaching: comparisons use a tolerance.
 */

export type V3 = [number, number, number];
export type M3 = [V3, V3, V3];

export const EPS = 1e-9;
export const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;
export const nearV = (a: readonly number[], b: readonly number[], eps = 1e-6) => a.length === b.length && a.every((x, i) => near(x, b[i]!, eps));
const clean = (x: number) => (Math.abs(x) < EPS ? 0 : Math.round(x * 1e9) / 1e9);

export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (k: number, a: V3): V3 => [k * a[0], k * a[1], k * a[2]];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const len = (a: V3) => Math.sqrt(dot(a, a));
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const isZero = (a: V3) => len(a) < EPS;
export const parallel = (a: V3, b: V3) => len(cross(a, b)) < 1e-6;

/** Angle between two non-zero vectors, degrees. */
export function angleDeg(a: V3, b: V3): number {
  const c = dot(a, b) / (len(a) * len(b));
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
}

/** Signed length of the projection of b onto a. */
export const projLen = (a: V3, b: V3) => dot(a, b) / len(a);

export const I3: M3 = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

export const apply = (m: M3, v: V3): V3 => [dot(m[0], v), dot(m[1], v), dot(m[2], v)];
export const col = (m: M3, j: 0 | 1 | 2): V3 => [m[0][j], m[1][j], m[2][j]];

/** m · n: first n, then m. */
export function mul(m: M3, n: M3): M3 {
  const r = [0, 1, 2].map((i) => [0, 1, 2].map((j) => clean(m[i]![0] * n[0][j]! + m[i]![1] * n[1][j]! + m[i]![2] * n[2][j]!)));
  return r as unknown as M3;
}

export function det(m: M3): number {
  const [[a, b, c], [d, e, f], [g, h, i]] = m;
  return clean(a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g));
}

export function inverse(m: M3): M3 | null {
  const D = det(m);
  if (Math.abs(D) < EPS) return null;
  const [[a, b, c], [d, e, f], [g, h, i]] = m;
  const adj = [
    [e * i - f * h, c * h - b * i, b * f - c * e],
    [f * g - d * i, a * i - c * g, c * d - a * f],
    [d * h - e * g, b * g - a * h, a * e - b * d],
  ];
  return adj.map((r) => r.map((x) => clean(x / D))) as unknown as M3;
}

export const sameM = (a: M3, b: M3) => a.every((r, i) => nearV(r, b[i]!));

// ---------------- Gaussian elimination ----------------

/** A row of the augmented matrix [a b c | d]. */
export type Row4 = [number, number, number, number];
export type System = [Row4, Row4, Row4];

export type RowOp = { kind: "swap"; i: number; j: number } | { kind: "scale"; i: number; c: number } | { kind: "add"; i: number; j: number; c: number };

export function applyOp(s: System, op: RowOp): System {
  const r = s.map((x) => [...x]) as System;
  if (op.kind === "swap") [r[op.i], r[op.j]] = [r[op.j]!, r[op.i]!];
  else if (op.kind === "scale") r[op.i] = r[op.i]!.map((x) => clean(x * op.c)) as Row4;
  else r[op.i] = r[op.i]!.map((x, k) => clean(x + op.c * r[op.j]![k]!)) as Row4;
  return r;
}

/** Zeros below the diagonal: the staircase of the forward pass. */
export const isEchelon = (s: System) => near(s[1][0], 0) && near(s[2][0], 0) && near(s[2][1], 0) && !near(s[0][0], 0) && !near(s[1][1], 0) && !near(s[2][2], 0);

/** The left block is the identity: the right column is the solution. */
export const isReduced = (s: System) => s.every((r, i) => r.slice(0, 3).every((x, j) => near(x, i === j ? 1 : 0)));

export const solutionOf = (s: System): V3 | null => (isReduced(s) ? [s[0][3], s[1][3], s[2][3]] : null);

/** Parse "2", "-0.5" or "1/7" into a number. */
export function parseNumber(text: string): number | null {
  const t = text.trim().replace(",", ".");
  const m = /^(-?\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?))?$/.exec(t);
  if (!m) return null;
  const v = Number(m[1]) / (m[2] ? Number(m[2]) : 1);
  return Number.isFinite(v) && (m[2] === undefined || Number(m[2]) !== 0) ? v : null;
}

// ---------------- basis (in the xy-plane) ----------------

export type V2 = [number, number];
export const det2 = (a: V2, b: V2) => a[0] * b[1] - a[1] * b[0];
export const combo = (a: number, b1: V2, b: number, b2: V2): V2 => [clean(a * b1[0] + b * b2[0]), clean(a * b1[1] + b * b2[1])];

// ---------------- eigen-directions (2×2) ----------------

export type M2 = [V2, V2];
export const apply2 = (m: M2, v: V2): V2 => [m[0][0] * v[0] + m[0][1] * v[1], m[1][0] * v[0] + m[1][1] * v[1]];
export const dirOf = (deg: number): V2 => [clean(Math.cos((deg * Math.PI) / 180)), clean(Math.sin((deg * Math.PI) / 180))];

/** If A·v stays on v's line, the stretch factor λ; otherwise null. */
export function eigenFactor(m: M2, v: V2): number | null {
  const w = apply2(m, v);
  if (Math.abs(det2(v, w)) > 1e-6) return null;
  const n = v[0] * v[0] + v[1] * v[1];
  return clean((w[0] * v[0] + w[1] * v[1]) / n);
}
