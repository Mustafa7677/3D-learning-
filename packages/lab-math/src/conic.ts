/**
 * Analytic geometry: the ellipse drawn with a string, and the conic sections cut from a
 * double cone. Pure functions, the scene and the lessons share them.
 */
import type { V3 } from "./linalg";

const RAD = Math.PI / 180;

// ---------------------------------------------------------------- the ellipse

export interface Ellipse {
  /** Semi-major axis. */
  a: number;
  /** Distance from the centre to a focus; 0 ≤ c < a. */
  c: number;
}

export const semiMinor = (e: Ellipse) => Math.sqrt(Math.max(0, e.a * e.a - e.c * e.c));
export const eccentricity = (e: Ellipse) => (e.a > 0 ? e.c / e.a : 0);

/** The point at parameter angle t (degrees): (a·cos t, b·sin t). */
export function ellipsePoint(e: Ellipse, tDeg: number): [number, number] {
  return [e.a * Math.cos(tDeg * RAD), semiMinor(e) * Math.sin(tDeg * RAD)];
}

/** Distances from a point of the ellipse to the two foci (−c, 0) and (c, 0). */
export function focalDistances(e: Ellipse, tDeg: number): [number, number] {
  const [x, y] = ellipsePoint(e, tDeg);
  return [Math.hypot(x + e.c, y), Math.hypot(x - e.c, y)];
}

// ---------------------------------------------------------------- the cone and the plane

/** Half-angle of the double cone, between its axis and a generator line. */
export const CONE_HALF = 30;
/** How far the cone reaches up and down from its vertex. */
export const CONE_H = 3;

export type ConicKind = "circle" | "ellipse" | "parabola" | "hyperbola" | "point" | "line" | "lines";

export const CONIC_NAME: Record<ConicKind, string> = {
  circle: "шеңбер",
  ellipse: "эллипс",
  parabola: "парабола",
  hyperbola: "гипербола",
  point: "нүкте",
  line: "бір түзу",
  lines: "қос түзу",
};

/**
 * The cutting plane: tilted by `tilt` degrees from the horizontal (a turn about the x axis),
 * at signed distance `d` from the cone's vertex. Its normal is (0, −sin β, cos β).
 */
export interface Cut {
  tilt: number;
  d: number;
}

/** Where the plane meets the cone. The plane is parallel to a generator at tilt = 90° − half-angle. */
export function conicKind(cut: Cut): ConicKind {
  const edge = 90 - CONE_HALF;
  const through = Math.abs(cut.d) < 1e-9;
  if (Math.abs(cut.tilt - edge) < 1e-9) return through ? "line" : "parabola";
  if (cut.tilt < edge) return through ? "point" : Math.abs(cut.tilt) < 1e-9 ? "circle" : "ellipse";
  return through ? "lines" : "hyperbola";
}

/** e = sin β / cos α: 0 for a circle, below 1 for an ellipse, 1 for a parabola, above 1 for a hyperbola. */
export const conicEccentricity = (cut: Cut) => Math.sin(cut.tilt * RAD) / Math.cos(CONE_HALF * RAD);

/**
 * The section curve as polylines in math coordinates (z up). For each angle φ round the axis
 * the cone's generator meets the plane at one height z; points beyond the cone's reach are
 * dropped, which splits a hyperbola into its two branches.
 */
export function sectionCurve(cut: Cut, samples = 360): V3[][] {
  const t = Math.tan(CONE_HALF * RAD);
  const sb = Math.sin(cut.tilt * RAD);
  const cb = Math.cos(cut.tilt * RAD);
  const out: V3[][] = [];
  let run: V3[] = [];
  for (let i = 0; i <= samples; i++) {
    const phi = (2 * Math.PI * i) / samples;
    const den = cb - sb * t * Math.sin(phi);
    const z = Math.abs(den) < 1e-9 ? Infinity : cut.d / den;
    if (!Number.isFinite(z) || Math.abs(z) > CONE_H) {
      if (run.length > 1) out.push(run);
      run = [];
      continue;
    }
    run.push([z * t * Math.cos(phi), z * t * Math.sin(phi), z]);
  }
  if (run.length > 1) out.push(run);
  // A closed curve (circle, ellipse) is one run that starts and ends at φ = 0: keep it whole.
  return out;
}

/** For a plane through the vertex: the generator lines it contains (none for a point). */
export function vertexLines(cut: Cut): V3[][] {
  const t = Math.tan(CONE_HALF * RAD);
  const sb = Math.sin(cut.tilt * RAD);
  const cb = Math.cos(cut.tilt * RAD);
  if (sb * t < cb - 1e-9) return [];
  const s = Math.min(1, cb / (sb * t));
  const phis = Math.abs(s - 1) < 1e-9 ? [Math.PI / 2] : [Math.asin(s), Math.PI - Math.asin(s)];
  return phis.map((phi) => {
    const dir: V3 = [t * Math.cos(phi), t * Math.sin(phi), 1];
    return [
      [-dir[0] * CONE_H, -dir[1] * CONE_H, -CONE_H],
      [dir[0] * CONE_H, dir[1] * CONE_H, CONE_H],
    ];
  });
}
