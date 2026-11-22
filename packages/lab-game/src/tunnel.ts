/**
 * Tunneling: a bullet flies towards a 15 cm wall at 60 frames a second. A
 * discrete collision check only looks at where the bullet is at each step,
 * so if one step is longer than the wall is thick, the bullet can be in
 * front of the wall on one frame and behind it on the next. Substeps shorten
 * the step (and cost more checks); continuous collision detection tests the
 * whole segment the bullet swept and cannot miss.
 */

export type CollideMethod = "discrete" | "substeps" | "ccd";
export const METHODS: CollideMethod[] = ["discrete", "substeps", "ccd"];
export const SPEEDS = [5, 20, 60];
export const WALL: [number, number] = [10, 10.15];
export const START = 0.2;
export const FPS = 60;
export const SUBSTEPS = 4;

export interface TunnelRun {
  method: CollideMethod;
  speed: number;
  hit: boolean;
  /** Distance moved between two checks. */
  step: number;
  /** Positions where a check happened, up to just past the wall. */
  checks: number[];
  /** Collision tests done until the bullet hit or passed the wall. */
  tests: number;
}

const inWall = (x: number) => x >= WALL[0] && x <= WALL[1];

export function runTunnel(method: CollideMethod, speed: number): TunnelRun {
  const steps = method === "substeps" ? SUBSTEPS : 1;
  const step = speed / FPS / steps;
  const checks: number[] = [];
  let hit = false;
  let tests = 0;
  for (let k = 0; ; k++) {
    const x = START + k * step;
    const prev = START + (k - 1) * step;
    if (k > 0) {
      tests++;
      checks.push(Math.round(x * 1000) / 1000);
      hit = method === "ccd" ? prev <= WALL[1] && x >= WALL[0] : inWall(x);
      if (hit || x > WALL[1]) break;
    }
  }
  return { method, speed, hit, step: Math.round(step * 1000) / 1000, checks: checks.filter((x) => x > WALL[0] - 2), tests };
}
