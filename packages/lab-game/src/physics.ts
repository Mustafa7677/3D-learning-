import type { V3 } from "./scene";

/**
 * A small deterministic rigid-body solver: spheres, a ground plane and static
 * axis-aligned boxes. Semi-implicit Euler integration with `substeps` per
 * fixed step — few substeps let fast objects tunnel through thin walls, which
 * is exactly what the lesson shows.
 */
export interface Ball {
  id: number;
  pos: V3;
  vel: V3;
  r: number;
  mass: number;
  color: string;
}

export interface Wall {
  id: number;
  min: V3;
  max: V3;
}

export interface PhysicsParams {
  gravity: number;
  restitution: number;
  friction: number;
  substeps: number;
}

export interface PhysicsWorld {
  balls: Ball[];
  walls: Wall[];
  params: PhysicsParams;
  time: number;
  running: boolean;
  nextId: number;
}

export interface StepEvents {
  bounces: { id: number; speed: number }[];
  collisions: number;
  wallHits: number;
  /** Balls that crossed a wall between two substeps without touching it. */
  tunneled: number[];
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);

export const ARENA = 6;

export function stepPhysics(w: PhysicsWorld, dt: number): { world: PhysicsWorld; events: StepEvents } {
  const events: StepEvents = { bounces: [], collisions: 0, wallHits: 0, tunneled: [] };
  const n = Math.max(1, Math.min(32, Math.round(w.params.substeps)));
  const h = dt / n;
  const e = w.params.restitution;
  let balls = w.balls.map((b) => ({ ...b, pos: [...b.pos] as V3, vel: [...b.vel] as V3 }));

  for (let s = 0; s < n; s++) {
    for (const b of balls) {
      const before: V3 = [...b.pos] as V3;
      b.vel[1] -= w.params.gravity * h;
      b.pos[0] += b.vel[0] * h;
      b.pos[1] += b.vel[1] * h;
      b.pos[2] += b.vel[2] * h;

      // Ground
      if (b.pos[1] - b.r < 0) {
        b.pos[1] = b.r;
        if (b.vel[1] < 0) {
          const speed = -b.vel[1];
          b.vel[1] = speed * e < 0.05 ? 0 : speed * e;
          if (speed > 0.5) events.bounces.push({ id: b.id, speed });
        }
        const f = Math.max(0, 1 - w.params.friction * h * 10);
        b.vel[0] *= f;
        b.vel[2] *= f;
      }
      // Arena bounds
      for (const axis of [0, 2] as const) {
        if (Math.abs(b.pos[axis]) + b.r > ARENA) {
          b.pos[axis] = Math.sign(b.pos[axis]) * (ARENA - b.r);
          b.vel[axis] = -b.vel[axis] * e;
        }
      }
      // Static boxes
      for (const wall of w.walls) {
        const c: V3 = [
          Math.max(wall.min[0], Math.min(b.pos[0], wall.max[0])),
          Math.max(wall.min[1], Math.min(b.pos[1], wall.max[1])),
          Math.max(wall.min[2], Math.min(b.pos[2], wall.max[2])),
        ];
        const d = sub(b.pos, c);
        const dist = len(d);
        if (dist < b.r) {
          let nrm: V3;
          if (dist > 1e-9) {
            nrm = [d[0] / dist, d[1] / dist, d[2] / dist];
            b.pos = [c[0] + nrm[0] * b.r, c[1] + nrm[1] * b.r, c[2] + nrm[2] * b.r];
          } else {
            // Centre inside the box: push out along the axis of least penetration, against the motion.
            const pen = [0, 1, 2].map((k) => Math.min(b.pos[k]! - wall.min[k]!, wall.max[k]! - b.pos[k]!));
            const k = pen.indexOf(Math.min(...pen));
            const side = b.vel[k]! > 0 ? -1 : 1;
            nrm = [0, 0, 0];
            nrm[k] = side;
            b.pos[k] = side < 0 ? wall.min[k]! - b.r : wall.max[k]! + b.r;
          }
          const vn = dot(b.vel, nrm);
          if (vn < 0) {
            b.vel = [b.vel[0] - (1 + e) * vn * nrm[0], b.vel[1] - (1 + e) * vn * nrm[1], b.vel[2] - (1 + e) * vn * nrm[2]];
            events.wallHits++;
          }
        } else {
          // Tunnelling check along x: started on one side of a thin wall, ended on the other.
          const inYZ = b.pos[1] >= wall.min[1] && b.pos[1] <= wall.max[1] + b.r && b.pos[2] >= wall.min[2] - b.r && b.pos[2] <= wall.max[2] + b.r;
          const crossed = (before[0] + b.r <= wall.min[0] && b.pos[0] - b.r >= wall.max[0]) || (before[0] - b.r >= wall.max[0] && b.pos[0] + b.r <= wall.min[0]);
          if (inYZ && crossed && !events.tunneled.includes(b.id)) events.tunneled.push(b.id);
        }
      }
    }
    // Ball–ball impulses
    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        const a = balls[i]!;
        const b = balls[j]!;
        const d = sub(b.pos, a.pos);
        const dist = len(d);
        const minD = a.r + b.r;
        if (dist >= minD || dist < 1e-9) continue;
        const nrm: V3 = [d[0] / dist, d[1] / dist, d[2] / dist];
        const overlap = minD - dist;
        const ia = 1 / a.mass;
        const ib = 1 / b.mass;
        for (let k = 0; k < 3; k++) {
          a.pos[k]! -= (nrm[k]! * overlap * ia) / (ia + ib);
          b.pos[k]! += (nrm[k]! * overlap * ib) / (ia + ib);
        }
        const rel = dot(sub(b.vel, a.vel), nrm);
        if (rel < 0) {
          const j_ = (-(1 + e) * rel) / (ia + ib);
          for (let k = 0; k < 3; k++) {
            a.vel[k]! -= j_ * ia * nrm[k]!;
            b.vel[k]! += j_ * ib * nrm[k]!;
          }
          events.collisions++;
        }
      }
    }
  }
  balls = balls.map((b) => ({ ...b, pos: b.pos.map((v) => Math.round(v * 1e6) / 1e6) as V3, vel: b.vel.map((v) => Math.round(v * 1e6) / 1e6) as V3 }));
  return { world: { ...w, balls, time: w.time + dt }, events };
}

export function kineticEnergy(w: PhysicsWorld): number {
  return w.balls.reduce((s, b) => s + 0.5 * b.mass * dot(b.vel, b.vel) + b.mass * w.params.gravity * (b.pos[1] - b.r), 0);
}

export const THIN_WALL: Wall = { id: 1, min: [1.9, 0, -3], max: [2.1, 2.5, 3] };
