import { describe, expect, it } from "vitest";
import { GRAPHS, pathCost, pathTo, traceGraph } from "./graph";
import { binaryWorst, traceSearch } from "./search";
import { applyOp, countSort, makeArray, traceSort, type SortAlg } from "./sort";

const ALGS: SortAlg[] = ["bubble", "selection", "insertion", "merge", "quick"];

describe("sorting", () => {
  it("every algorithm sorts every kind of input, and replaying its trace gives the same result", () => {
    for (const alg of ALGS)
      for (const preset of ["random", "sorted", "reversed", "nearly", "few"] as const)
        for (const n of [0, 1, 2, 7, 32]) {
          const input = makeArray(preset, n, 11);
          const expected = input.slice().sort((a, b) => a - b);
          for (const pivot of ["last", "middle"] as const) {
            expect(countSort(alg, input, pivot).sorted, `${alg}/${preset}/${n}`).toEqual(expected);
            const a = input.slice();
            const ops = traceSort(alg, input, pivot);
            for (const op of ops) applyOp(a, op);
            expect(a).toEqual(expected);
            // Every position is eventually marked final.
            expect(new Set(ops.filter((o) => o.k === "done").map((o) => (o as { i: number }).i)).size).toBe(n);
          }
        }
  });

  it("matches the textbook comparison counts", () => {
    const n = 32;
    const random = makeArray("random", n, 3);
    expect(countSort("selection", random).comparisons).toBe((n * (n - 1)) / 2);
    expect(countSort("bubble", makeArray("reversed", n, 1)).comparisons).toBe((n * (n - 1)) / 2);
    // Already sorted: one pass, no swaps.
    expect(countSort("bubble", makeArray("sorted", n, 1)).comparisons).toBe(n - 1);
    expect(countSort("insertion", makeArray("sorted", n, 1)).comparisons).toBe(n - 1);
    // Quicksort with the last element as pivot degrades on sorted input; the middle pivot does not.
    expect(countSort("quick", makeArray("sorted", n, 1), "last").comparisons).toBe((n * (n - 1)) / 2);
    expect(countSort("quick", makeArray("sorted", n, 1), "middle").comparisons).toBeLessThan(n * Math.log2(n));
    // Merge sort: at most n·log₂n comparisons over log₂n levels of merging.
    const m = countSort("merge", random);
    expect(m.comparisons).toBeLessThanOrEqual(n * Math.log2(n));
    expect(m.depth).toBe(Math.log2(n)); // merge levels: 32 → 16 → 8 → 4 → 2
  });

  it("quadratic sorts quadruple when n doubles; merge sort only a little more than doubles", () => {
    const at = (alg: SortAlg, n: number) => countSort(alg, makeArray("random", n, 9)).comparisons;
    expect(at("selection", 512) / at("selection", 256)).toBeCloseTo(4, 1);
    const r = at("merge", 512) / at("merge", 256);
    expect(r).toBeGreaterThan(2);
    expect(r).toBeLessThan(2.4);
  });
});

describe("searching", () => {
  const a = Array.from({ length: 64 }, (_, i) => (i + 1) * 3);
  it("binary search never needs more than ⌊log₂ n⌋ + 1 probes", () => {
    for (const t of [...a, 1, 500]) {
      const b = traceSearch("binary", a, t);
      expect(b.probes.length).toBeLessThanOrEqual(binaryWorst(64));
      expect(b.found).toBe(a.indexOf(t));
    }
    expect(binaryWorst(64)).toBe(7);
  });
  it("linear search looks at every element before giving up", () => {
    expect(traceSearch("linear", a, 1).probes).toHaveLength(64);
    expect(traceSearch("linear", a, 30).probes).toHaveLength(10);
  });
});

describe("graphs", () => {
  const g = GRAPHS.roads;
  it("BFS finds the path with fewest edges, Dijkstra the cheapest", () => {
    const bfs = traceGraph(g, "bfs", "A");
    const dij = traceGraph(g, "dijkstra", "A");
    expect(pathTo(bfs.prev, "H")).toEqual(["A", "C", "G", "H"]);
    expect(pathCost(g, pathTo(bfs.prev, "H"))).toBe(15);
    expect(pathTo(dij.prev, "H")).toEqual(["A", "B", "D", "F", "H"]);
    expect(dij.dist.H).toBe(8);
  });
  it("BFS visits by distance; DFS goes deep first", () => {
    const grid = GRAPHS.grid;
    const bfs = traceGraph(grid, "bfs", "A1");
    const dists = bfs.order.map((n) => bfs.dist[n]!);
    expect(dists).toEqual([...dists].sort((x, y) => x - y));
    const dfs = traceGraph(grid, "dfs", "A1");
    expect(dfs.order).toHaveLength(16);
    expect(dfs.order.slice(0, 4)).toEqual(["A1", "A2", "A3", "A4"]);
    expect(bfs.order.slice(0, 3)).toEqual(["A1", "A2", "B1"]);
  });
  it("Dijkstra finalises nodes in order of distance", () => {
    const d = traceGraph(g, "dijkstra", "A");
    const ds = d.order.map((n) => d.dist[n]!);
    expect(ds).toEqual([...ds].sort((x, y) => x - y));
  });
});
