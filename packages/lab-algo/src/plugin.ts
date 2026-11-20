import type { AssessmentResult, SimulationPlugin } from "@inside-tech/sim-core";
import { GRAPHS, pathCost, pathTo, traceGraph, type GraphAlg, type GraphPreset, type GraphTrace } from "./graph";
import { traceSearch, type Probe, type SearchKind } from "./search";
import { applyOp, countSort, makeArray, traceSort, type ArrayPreset, type Pivot, type SortAlg, type SortOp } from "./sort";

export type AlgoMode = "sort" | "search" | "graph";

export interface SortView {
  alg: SortAlg;
  pivot: Pivot;
  preset: ArrayPreset;
  n: number;
  seed: number;
  initial: number[];
  arr: number[];
  /** Operations applied so far. */
  cursor: number;
  total: number;
  playing: boolean;
  comparisons: number;
  swaps: number;
  writes: number;
  last: SortOp | null;
  done: number[];
  range: [number, number] | null;
  pivotAt: number | null;
  /** Operations of this run applied one at a time by the learner. */
  manual: number;
}

export interface SearchView {
  kind: SearchKind;
  n: number;
  sorted: boolean;
  arr: number[];
  target: number;
  cursor: number;
  total: number;
  probes: Probe[];
  found: number | null;
  playing: boolean;
}

export interface GraphView {
  preset: GraphPreset;
  alg: GraphAlg;
  start: string;
  goal: string;
  cursor: number;
  total: number;
  playing: boolean;
  visited: string[];
  /** Tentative distances of everything discovered so far. */
  dist: Record<string, number>;
  prev: Record<string, string | null>;
}

export interface SortRun {
  alg: SortAlg;
  pivot: Pivot;
  preset: ArrayPreset;
  n: number;
  comparisons: number;
  swaps: number;
  writes: number;
  /** Steps the learner took one by one (not played or skipped). */
  manualSteps: number;
}

export interface BenchPoint {
  alg: SortAlg;
  pivot: Pivot;
  preset: ArrayPreset;
  n: number;
  comparisons: number;
  swaps: number;
}

export interface AlgoStats {
  manualSortSteps: number;
  sortRuns: SortRun[];
  searches: { kind: SearchKind; n: number; sorted: boolean; target: number; probes: number; found: boolean; present: boolean }[];
  graphRuns: { preset: GraphPreset; alg: GraphAlg; start: string; goal: string; path: string[]; cost: number; visited: number }[];
  bench: BenchPoint[];
  modes: AlgoMode[];
}

export interface AlgoLabState {
  mode: AlgoMode;
  /** Operations (or probes, or graph events) per second while playing. */
  speed: number;
  acc: number;
  sort: SortView;
  search: SearchView;
  graph: GraphView;
  stats: AlgoStats;
}

export type AlgoLabAction =
  | { type: "mode/set"; mode: AlgoMode }
  | { type: "speed/set"; speed: number }
  | { type: "sort/config"; alg?: SortAlg; pivot?: Pivot; preset?: ArrayPreset; n?: number }
  | { type: "sort/shuffle" }
  | { type: "sort/step" }
  | { type: "sort/play" }
  | { type: "sort/pause" }
  | { type: "sort/reset" }
  | { type: "sort/finish" }
  | { type: "search/config"; kind?: SearchKind; n?: number; target?: number; sorted?: boolean }
  | { type: "search/step" }
  | { type: "search/play" }
  | { type: "search/pause" }
  | { type: "search/reset" }
  | { type: "search/finish" }
  | { type: "graph/config"; preset?: GraphPreset; alg?: GraphAlg; start?: string; goal?: string }
  | { type: "graph/step" }
  | { type: "graph/play" }
  | { type: "graph/pause" }
  | { type: "graph/reset" }
  | { type: "graph/finish" }
  | { type: "bench/run"; alg: SortAlg; n: number; preset?: ArrayPreset; pivot?: Pivot }
  | { type: "bench/clear" };

export const SORT_N = { min: 4, max: 48 };
export const SEARCH_N = { min: 8, max: 128 };
export const BENCH_N = { min: 4, max: 4096 };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const uniq = <T>(xs: T[], x: T) => (xs.includes(x) ? xs : [...xs, x]);

// ---------------- traces (memoised: recomputed from small inputs, never stored in state) ----------------

const memo = new Map<string, unknown>();
function cached<T>(key: string, make: () => T): T {
  if (!memo.has(key)) {
    if (memo.size > 64) memo.clear();
    memo.set(key, make());
  }
  return memo.get(key) as T;
}

export const sortOps = (v: Pick<SortView, "alg" | "pivot" | "initial">): SortOp[] =>
  cached(`s|${v.alg}|${v.pivot}|${v.initial.join(",")}`, () => traceSort(v.alg, v.initial, v.pivot));
export const graphTrace = (v: Pick<GraphView, "preset" | "alg" | "start">): GraphTrace =>
  cached(`g|${v.preset}|${v.alg}|${v.start}`, () => traceGraph(GRAPHS[v.preset], v.alg, v.start));

// ---------------- sort ----------------

function freshSort(base: Pick<SortView, "alg" | "pivot" | "preset" | "n" | "seed">): SortView {
  const initial = makeArray(base.preset, base.n, base.seed);
  const v: SortView = {
    ...base,
    initial,
    arr: initial.slice(),
    cursor: 0,
    total: 0,
    playing: false,
    comparisons: 0,
    swaps: 0,
    writes: 0,
    last: null,
    done: [],
    range: null,
    pivotAt: null,
    manual: 0,
  };
  return { ...v, total: sortOps(v).length };
}

function advanceSort(s: AlgoLabState, count: number, manual: boolean): AlgoLabState {
  const v = s.sort;
  if (v.cursor >= v.total) return s;
  const ops = sortOps(v);
  const arr = v.arr.slice();
  let { comparisons, swaps, writes, last, range, pivotAt } = v;
  const done = v.done.slice();
  const end = Math.min(v.total, v.cursor + count);
  for (let c = v.cursor; c < end; c++) {
    const op = ops[c]!;
    applyOp(arr, op);
    last = op;
    if (op.k === "cmp") comparisons++;
    else if (op.k === "swap") swaps++;
    else if (op.k === "set") writes++;
    else if (op.k === "done") {
      done.push(op.i);
      if (pivotAt === op.i) pivotAt = null;
    } else if (op.k === "range") range = [op.lo, op.hi];
    else if (op.k === "pivot") pivotAt = op.i;
  }
  const finished = end >= v.total;
  let stats = s.stats;
  const manualSteps = v.manual + (manual ? end - v.cursor : 0);
  if (manual) stats = { ...stats, manualSortSteps: stats.manualSortSteps + (end - v.cursor) };
  if (finished) {
    const run: SortRun = { alg: v.alg, pivot: v.pivot, preset: v.preset, n: v.n, comparisons, swaps, writes, manualSteps };
    stats = { ...stats, sortRuns: [...stats.sortRuns, run].slice(-40) };
  }
  return {
    ...s,
    sort: { ...v, arr, cursor: end, manual: manualSteps, comparisons, swaps, writes, last: finished ? null : last, done, range: finished ? null : range, pivotAt: finished ? null : pivotAt, playing: finished ? false : v.playing },
    stats,
  };
}

// ---------------- search ----------------

function searchArray(n: number, sorted: boolean): number[] {
  // Distinct odd values so targets are easy to read; shuffled copies keep the same values.
  const a = Array.from({ length: n }, (_, i) => 2 * i + 3);
  if (sorted) return a;
  return makeArray("random", n, 5).map((k) => a[k - 1]!);
}

function freshSearch(base: Pick<SearchView, "kind" | "n" | "sorted" | "target">): SearchView {
  const arr = searchArray(base.n, base.sorted);
  const t = traceSearch(base.kind, arr, base.target);
  return { ...base, arr, cursor: 0, total: t.probes.length, probes: [], found: null, playing: false };
}

function advanceSearch(s: AlgoLabState, count: number): AlgoLabState {
  const v = s.search;
  if (v.cursor >= v.total) return s;
  const t = traceSearch(v.kind, v.arr, v.target);
  const end = Math.min(v.total, v.cursor + count);
  const finished = end >= v.total;
  let stats = s.stats;
  if (finished) {
    const present = v.arr.includes(v.target);
    stats = { ...stats, searches: [...stats.searches, { kind: v.kind, n: v.n, sorted: v.sorted, target: v.target, probes: t.probes.length, found: t.found >= 0, present }].slice(-40) };
  }
  return { ...s, search: { ...v, cursor: end, probes: t.probes.slice(0, end), found: finished ? t.found : null, playing: finished ? false : v.playing }, stats };
}

// ---------------- graph ----------------

function freshGraph(base: Pick<GraphView, "preset" | "alg" | "start" | "goal">): GraphView {
  return { ...base, cursor: 0, total: graphTrace(base).events.length, playing: false, visited: [], dist: {}, prev: {} };
}

function advanceGraph(s: AlgoLabState, count: number): AlgoLabState {
  const v = s.graph;
  if (v.cursor >= v.total) return s;
  const t = graphTrace(v);
  const end = Math.min(v.total, v.cursor + count);
  const visited = v.visited.slice();
  const dist = { ...v.dist };
  const prev = { ...v.prev };
  for (let c = v.cursor; c < end; c++) {
    const e = t.events[c]!;
    if (e.k === "push") {
      dist[e.n] = e.d;
      prev[e.n] = e.from;
    } else visited.push(e.n);
  }
  const finished = end >= v.total;
  let stats = s.stats;
  if (finished) {
    const path = pathTo(t.prev, v.goal);
    const run = { preset: v.preset, alg: v.alg, start: v.start, goal: v.goal, path, cost: pathCost(GRAPHS[v.preset], path), visited: visited.length };
    stats = { ...stats, graphRuns: [...stats.graphRuns, run].slice(-40) };
  }
  return { ...s, graph: { ...v, cursor: end, visited, dist, prev, playing: finished ? false : v.playing }, stats };
}

// ---------------- plugin ----------------

export function initialAlgoState(seed: number): AlgoLabState {
  return {
    mode: "sort",
    speed: 6,
    acc: 0,
    sort: freshSort({ alg: "bubble", pivot: "last", preset: "random", n: 12, seed: (seed % 997) + 1 }),
    search: freshSearch({ kind: "linear", n: 32, sorted: true, target: 47 }),
    graph: freshGraph({ preset: "roads", alg: "bfs", start: "A", goal: "H" }),
    stats: { manualSortSteps: 0, sortRuns: [], searches: [], graphRuns: [], bench: [], modes: ["sort"] },
  };
}

function reduce(s: AlgoLabState, a: AlgoLabAction): AlgoLabState {
  switch (a.type) {
    case "mode/set":
      return { ...s, mode: a.mode, acc: 0, stats: { ...s.stats, modes: uniq(s.stats.modes, a.mode) } };
    case "speed/set":
      return { ...s, speed: clamp(a.speed, 0.5, 400) };

    case "sort/config": {
      const v = s.sort;
      const next = {
        alg: a.alg ?? v.alg,
        pivot: a.pivot ?? v.pivot,
        preset: a.preset ?? v.preset,
        n: Math.round(clamp(a.n ?? v.n, SORT_N.min, SORT_N.max)),
        seed: v.seed,
      };
      return { ...s, mode: "sort", sort: freshSort(next) };
    }
    case "sort/shuffle":
      return { ...s, sort: freshSort({ ...s.sort, seed: (s.sort.seed * 48271) % 2147483647 || 1 }) };
    case "sort/reset":
      return { ...s, sort: freshSort(s.sort) };
    case "sort/step":
      return advanceSort({ ...s, sort: { ...s.sort, playing: false } }, 1, true);
    case "sort/play":
      return s.sort.cursor >= s.sort.total ? s : { ...s, mode: "sort", acc: 0, sort: { ...s.sort, playing: true } };
    case "sort/pause":
      return { ...s, sort: { ...s.sort, playing: false } };
    case "sort/finish":
      return advanceSort(s, Number.MAX_SAFE_INTEGER, false);

    case "search/config": {
      const v = s.search;
      const n = Math.round(clamp(a.n ?? v.n, SEARCH_N.min, SEARCH_N.max));
      const target = Math.round(clamp(a.target ?? v.target, 0, 1000));
      return { ...s, mode: "search", search: freshSearch({ kind: a.kind ?? v.kind, n, sorted: a.sorted ?? v.sorted, target }) };
    }
    case "search/reset":
      return { ...s, search: freshSearch(s.search) };
    case "search/step":
      return advanceSearch({ ...s, search: { ...s.search, playing: false } }, 1);
    case "search/play":
      return s.search.cursor >= s.search.total ? s : { ...s, mode: "search", acc: 0, search: { ...s.search, playing: true } };
    case "search/pause":
      return { ...s, search: { ...s.search, playing: false } };
    case "search/finish":
      return advanceSearch(s, Number.MAX_SAFE_INTEGER);

    case "graph/config": {
      const v = s.graph;
      const preset = a.preset ?? v.preset;
      const ids = GRAPHS[preset].nodes.map((n) => n.id);
      const start = a.start && ids.includes(a.start) ? a.start : ids.includes(v.start) && !a.preset ? v.start : ids[0]!;
      const goal = a.goal && ids.includes(a.goal) ? a.goal : ids.includes(v.goal) && !a.preset ? v.goal : ids[ids.length - 1]!;
      return { ...s, mode: "graph", graph: freshGraph({ preset, alg: a.alg ?? v.alg, start, goal }) };
    }
    case "graph/reset":
      return { ...s, graph: freshGraph(s.graph) };
    case "graph/step":
      return advanceGraph({ ...s, graph: { ...s.graph, playing: false } }, 1);
    case "graph/play":
      return s.graph.cursor >= s.graph.total ? s : { ...s, mode: "graph", acc: 0, graph: { ...s.graph, playing: true } };
    case "graph/pause":
      return { ...s, graph: { ...s.graph, playing: false } };
    case "graph/finish":
      return advanceGraph(s, Number.MAX_SAFE_INTEGER);

    case "bench/run": {
      const n = Math.round(clamp(a.n, BENCH_N.min, BENCH_N.max));
      const preset = a.preset ?? "random";
      const pivot = a.pivot ?? "last";
      const c = countSort(a.alg, makeArray(preset, n, 2026), pivot);
      const point: BenchPoint = { alg: a.alg, pivot, preset, n, comparisons: c.comparisons, swaps: c.swaps };
      const bench = [...s.stats.bench.filter((p) => !(p.alg === a.alg && p.n === n && p.preset === preset && p.pivot === pivot)), point].slice(-60);
      return { ...s, stats: { ...s.stats, bench } };
    }
    case "bench/clear":
      return { ...s, stats: { ...s.stats, bench: [] } };
  }
}

export function evaluateAlgo(s: AlgoLabState): AssessmentResult {
  return {
    score: 0,
    metrics: {
      comparisons: s.sort.comparisons,
      swaps: s.sort.swaps,
      sortProgress: s.sort.total ? s.sort.cursor / s.sort.total : 1,
      probes: s.search.probes.length,
      visited: s.graph.visited.length,
      benchPoints: s.stats.bench.length,
    },
    notes: [],
  };
}

export const algoLabPlugin: SimulationPlugin<AlgoLabState, AlgoLabAction> = {
  id: "algo-lab",
  version: "1.0.0",
  initialize: initialAlgoState,
  dispatch: reduce,
  step(s, dt) {
    const playing = s.mode === "sort" ? s.sort.playing : s.mode === "search" ? s.search.playing : s.graph.playing;
    if (!playing) return s;
    const acc = s.acc + dt * s.speed;
    const whole = Math.floor(acc);
    if (whole < 1) return { ...s, acc };
    const rest = { ...s, acc: acc - whole };
    if (s.mode === "sort") return advanceSort(rest, whole, false);
    if (s.mode === "search") return advanceSearch(rest, whole);
    return advanceGraph(rest, whole);
  },
  snapshot: (s) => structuredClone(s),
  restore: (snap) => structuredClone(snap as AlgoLabState),
  evaluate: evaluateAlgo,
};
