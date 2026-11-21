/**
 * Game Development, Middle level models: grid pathfinding (BFS, Dijkstra,
 * A*), an enemy state machine with hysteresis, and a uniform grid for
 * broad-phase collision. Deterministic: every lecture number is pinned.
 */

// ---------------- pathfinding ----------------

/** "#" wall, "~" mud (cost 5), "." floor (cost 1), "S" start, "G" goal. */
export const PATH_MAP = [
  "................",
  "..S.......#.....",
  "..........#.....",
  "...######.#.....",
  "..........#.....",
  "....~~~~~~#.....",
  "....~~~~~~#.....",
  "....~~~~~~......",
  "..........#..G..",
  "..........#.....",
];
export const PATH_W = PATH_MAP[0]!.length;
export const PATH_H = PATH_MAP.length;
export const MUD_COST = 5;

export type PathAlgo = "bfs" | "dijkstra" | "astar" | "greedy";

export interface PathResult {
  path: number[];
  cost: number;
  /** Cells taken off the frontier, in order. */
  expanded: number[];
}

const at = (i: number) => PATH_MAP[Math.floor(i / PATH_W)]![i % PATH_W]!;
const find = (ch: string) => {
  for (let i = 0; i < PATH_W * PATH_H; i++) if (at(i) === ch) return i;
  return -1;
};
export const PATH_START = find("S");
export const PATH_GOAL = find("G");
const stepCost = (i: number) => (at(i) === "~" ? MUD_COST : 1);
const manhattan = (a: number, b: number) => Math.abs((a % PATH_W) - (b % PATH_W)) + Math.abs(Math.floor(a / PATH_W) - Math.floor(b / PATH_W));

function neighbours(i: number): number[] {
  const x = i % PATH_W;
  const y = Math.floor(i / PATH_W);
  const out: number[] = [];
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= PATH_W || ny >= PATH_H) continue;
    const j = ny * PATH_W + nx;
    if (at(j) !== "#") out.push(j);
  }
  return out;
}

/**
 * One best-first search, four priorities: BFS ignores costs (steps only),
 * Dijkstra uses g, A* uses g + h, greedy uses h alone. Ties go to the cell
 * that entered the frontier first, so runs are reproducible.
 */
export function findPath(algo: PathAlgo, weight = 1): PathResult {
  const g = new Map<number, number>([[PATH_START, 0]]);
  const prev = new Map<number, number>();
  const done = new Set<number>();
  const expanded: number[] = [];
  let open: { i: number; f: number; n: number }[] = [{ i: PATH_START, f: 0, n: 0 }];
  let counter = 1;
  const h = (i: number) => weight * manhattan(i, PATH_GOAL);
  while (open.length) {
    open.sort((a, b) => a.f - b.f || a.n - b.n);
    const { i } = open.shift()!;
    if (done.has(i)) continue;
    done.add(i);
    expanded.push(i);
    if (i === PATH_GOAL) break;
    for (const j of neighbours(i)) {
      if (done.has(j)) continue;
      const cost = g.get(i)! + (algo === "bfs" ? 1 : stepCost(j));
      if (g.has(j) && g.get(j)! <= cost) continue;
      g.set(j, cost);
      prev.set(j, i);
      const f = algo === "astar" ? cost + h(j) : algo === "greedy" ? h(j) : cost;
      open.push({ i: j, f, n: counter++ });
    }
    open = open.filter((o) => !done.has(o.i));
  }
  const path: number[] = [];
  if (done.has(PATH_GOAL)) for (let c: number | undefined = PATH_GOAL; c !== undefined; c = prev.get(c)) path.unshift(c);
  const real = path.slice(1).reduce((s, i) => s + stepCost(i), 0);
  return { path, cost: real, expanded };
}

// ---------------- enemy state machine ----------------

export type GuardState = "patrol" | "chase" | "attack";

/** Distance from guard to player, second by second: the player hovers near the edge of sight. */
export const PLAYER_DISTANCE = [12, 11, 10, 9, 8, 7, 6, 5, 6, 5, 6, 7, 6, 5, 6, 7, 6, 5, 4, 3, 2, 1, 1, 2, 3, 5, 7, 8, 9, 10, 11, 12];

export interface FsmRun {
  states: GuardState[];
  /** How many times the state changed. */
  switches: number;
}

/** Patrol → chase when the player is within `see`; chase → patrol beyond `lose`; attack at distance ≤ 1. */
export function runGuard(see: number, lose: number): FsmRun {
  let s: GuardState = "patrol";
  let switches = 0;
  const states = PLAYER_DISTANCE.map((d) => {
    let next: GuardState = s;
    if (d <= 1) next = "attack";
    else if (s === "attack") next = "chase";
    else if (s === "patrol" && d <= see) next = "chase";
    else if (s === "chase" && d > lose) next = "patrol";
    if (next !== s) switches++;
    s = next;
    return s;
  });
  return { states, switches };
}

// ---------------- broad phase: uniform grid ----------------

export const WORLD = 100;

/** N small bodies scattered over a 100×100 world, reproducibly. */
export function bodies(n: number): [number, number][] {
  let seed = 0x9e3779b1;
  const rnd = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 2 ** 32;
  };
  return Array.from({ length: n }, () => [rnd() * WORLD, rnd() * WORLD]);
}

export const RADIUS = 1;

export interface BroadPhase {
  /** Pair tests the narrow phase had to run. */
  checks: number;
  /** Pairs that really touch. */
  hits: number;
}

/** Brute force: every pair. */
export function bruteForce(pts: [number, number][]): BroadPhase {
  let checks = 0;
  let hits = 0;
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++) {
      checks++;
      if (Math.hypot(pts[i]![0] - pts[j]![0], pts[i]![1] - pts[j]![1]) < 2 * RADIUS) hits++;
    }
  return { checks, hits };
}

/** Uniform grid: bucket by cell, test a body only against bodies in its own and neighbouring cells. */
export function gridPhase(pts: [number, number][], cell: number): BroadPhase {
  const key = (cx: number, cy: number) => `${cx},${cy}`;
  const grid = new Map<string, number[]>();
  pts.forEach(([x, y], i) => {
    const k = key(Math.floor(x / cell), Math.floor(y / cell));
    grid.set(k, [...(grid.get(k) ?? []), i]);
  });
  let checks = 0;
  let hits = 0;
  pts.forEach(([x, y], i) => {
    const cx = Math.floor(x / cell);
    const cy = Math.floor(y / cell);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (const j of grid.get(key(cx + dx, cy + dy)) ?? []) {
          if (j <= i) continue;
          checks++;
          if (Math.hypot(x - pts[j]![0], y - pts[j]![1]) < 2 * RADIUS) hits++;
        }
  });
  return { checks, hits };
}
