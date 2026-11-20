/** Graph search: BFS (queue), DFS (stack) and Dijkstra (priority queue), recorded event by event. */
export interface GraphNode {
  id: string;
  x: number;
  z: number;
}

export interface GraphEdge {
  a: string;
  b: string;
  w: number;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  weighted: boolean;
}

export type GraphAlg = "bfs" | "dfs" | "dijkstra";
export type GraphPreset = "roads" | "grid";

export type GraphEvent =
  /** n joins the frontier (or gets a better distance) with tentative distance d via `from`. */
  | { k: "push"; n: string; d: number; from: string | null }
  /** n is taken from the frontier and finalised. */
  | { k: "visit"; n: string; d: number };

export interface GraphTrace {
  events: GraphEvent[];
  order: string[];
  dist: Record<string, number>;
  prev: Record<string, string | null>;
}

export const GRAPHS: Record<GraphPreset, Graph> = {
  // Fewest roads A→H is A-C-G-H (cost 15); the cheapest is A-B-D-F-H (cost 8).
  roads: {
    weighted: true,
    nodes: [
      { id: "A", x: -4, z: 0 },
      { id: "B", x: -2, z: -2 },
      { id: "C", x: -2, z: 2 },
      { id: "D", x: 0, z: -2.6 },
      { id: "E", x: 0, z: 0.6 },
      { id: "F", x: 2, z: -1.2 },
      { id: "G", x: 2, z: 2.4 },
      { id: "H", x: 4, z: 0 },
    ],
    edges: [
      { a: "A", b: "B", w: 2 },
      { a: "A", b: "C", w: 5 },
      { a: "B", b: "D", w: 2 },
      { a: "B", b: "E", w: 6 },
      { a: "C", b: "E", w: 1 },
      { a: "C", b: "G", w: 9 },
      { a: "D", b: "F", w: 2 },
      { a: "E", b: "F", w: 3 },
      { a: "E", b: "G", w: 4 },
      { a: "F", b: "H", w: 2 },
      { a: "G", b: "H", w: 1 },
    ],
  },
  grid: (() => {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const id = (r: number, c: number) => `${String.fromCharCode(65 + r)}${c + 1}`;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) nodes.push({ id: id(r, c), x: -3 + c * 2, z: -3 + r * 2 });
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++) {
        if (c < 3) edges.push({ a: id(r, c), b: id(r, c + 1), w: 1 });
        if (r < 3) edges.push({ a: id(r, c), b: id(r + 1, c), w: 1 });
      }
    return { weighted: false, nodes, edges };
  })(),
};

/** Neighbours in a fixed (alphabetical) order so every run is reproducible. */
export function neighbours(g: Graph, n: string): { n: string; w: number }[] {
  const out: { n: string; w: number }[] = [];
  for (const e of g.edges) {
    if (e.a === n) out.push({ n: e.b, w: e.w });
    else if (e.b === n) out.push({ n: e.a, w: e.w });
  }
  return out.sort((x, y) => (x.n < y.n ? -1 : x.n > y.n ? 1 : 0));
}

export function traceGraph(g: Graph, alg: GraphAlg, start: string): GraphTrace {
  const events: GraphEvent[] = [];
  const order: string[] = [];
  const dist: Record<string, number> = {};
  const prev: Record<string, string | null> = {};
  const visited = new Set<string>();
  const push = (n: string, d: number, from: string | null) => {
    dist[n] = d;
    prev[n] = from;
    events.push({ k: "push", n, d, from });
  };
  const visit = (n: string) => {
    visited.add(n);
    order.push(n);
    events.push({ k: "visit", n, d: dist[n]! });
  };

  if (alg === "bfs") {
    const queue = [start];
    push(start, 0, null);
    for (let head = 0; head < queue.length; head++) {
      const v = queue[head]!;
      visit(v);
      for (const { n } of neighbours(g, v)) {
        if (n in dist) continue;
        push(n, dist[v]! + 1, v);
        queue.push(n);
      }
    }
  } else if (alg === "dfs") {
    const stack: { n: string; from: string | null; d: number }[] = [{ n: start, from: null, d: 0 }];
    while (stack.length) {
      const { n: v, from, d } = stack.pop()!;
      if (visited.has(v)) continue;
      if (!(v in dist) || prev[v] !== from) push(v, d, from);
      visit(v);
      // Push in reverse so the alphabetically first neighbour is explored first.
      for (const { n } of neighbours(g, v).reverse()) if (!visited.has(n)) stack.push({ n, from: v, d: d + 1 });
    }
  } else {
    // Dijkstra with a simple array as the priority queue: O(V²), fine for small graphs.
    push(start, 0, null);
    for (;;) {
      let best: string | undefined;
      for (const n of Object.keys(dist)) if (!visited.has(n) && (best === undefined || dist[n]! < dist[best]! || (dist[n] === dist[best] && n < best))) best = n;
      if (best === undefined) break;
      visit(best);
      for (const { n, w } of neighbours(g, best)) {
        if (visited.has(n)) continue;
        const d = dist[best]! + (g.weighted ? w : 1);
        if (!(n in dist) || d < dist[n]!) push(n, d, best);
      }
    }
  }
  return { events, order, dist, prev };
}

/** Follow `prev` links back from the goal. Empty when the goal was not reached. */
export function pathTo(prev: Record<string, string | null>, goal: string): string[] {
  if (!(goal in prev)) return [];
  const path: string[] = [];
  for (let n: string | null = goal; n !== null; n = prev[n] ?? null) {
    path.unshift(n);
    if (path.length > 1000) return [];
  }
  return path;
}

export function pathCost(g: Graph, path: string[]): number {
  let cost = 0;
  for (let i = 1; i < path.length; i++) {
    const e = g.edges.find((x) => (x.a === path[i - 1] && x.b === path[i]) || (x.b === path[i - 1] && x.a === path[i]));
    if (!e) return Number.POSITIVE_INFINITY;
    cost += g.weighted ? e.w : 1;
  }
  return cost;
}
