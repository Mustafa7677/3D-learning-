/**
 * Topological sort (Kahn's algorithm) on course prerequisites: which order
 * can a student take them in, how many semesters does it take at least, and
 * what happens when the prerequisites form a cycle.
 */

export const TOPO_NODES = ["Бағдарламалау", "Құрылымдар", "Алгоритмдер", "Дерекқор", "Желілер", "Веб", "Бұлт"];
/** [before, after]: the first course is a prerequisite of the second. */
export const TOPO_EDGES: [number, number][] = [
  [0, 1],
  [1, 2],
  [0, 3],
  [0, 4],
  [3, 5],
  [4, 5],
  [5, 6],
  [2, 6],
];
/** A careless new rule: "Құрылымдар" now requires "Бұлт". It closes a cycle. */
export const CYCLE_EDGE: [number, number] = [6, 1];

export interface TopoRun {
  order: number[];
  /** Semester of each course in the order (longest chain of prerequisites before it), -1 if stuck. */
  semester: number[];
  semesters: number;
  /** Courses that never became ready: they sit on or behind a cycle. */
  stuck: number[];
}

export function topoSort(edges: [number, number][], n = TOPO_NODES.length): TopoRun {
  const indeg = Array.from({ length: n }, () => 0);
  const out: number[][] = Array.from({ length: n }, () => []);
  for (const [a, b] of edges) {
    out[a]!.push(b);
    indeg[b]!++;
  }
  const semester = Array.from({ length: n }, () => -1);
  const ready = indeg.map((d, i) => (d === 0 ? i : -1)).filter((i) => i >= 0);
  for (const i of ready) semester[i] = 1;
  const order: number[] = [];
  while (ready.length) {
    ready.sort((a, b) => a - b);
    const u = ready.shift()!;
    order.push(u);
    for (const v of out[u]!) {
      semester[v] = Math.max(semester[v]!, semester[u]! + 1);
      if (--indeg[v]! === 0) ready.push(v);
    }
  }
  const stuck = Array.from({ length: n }, (_, i) => i).filter((i) => !order.includes(i));
  for (const i of stuck) semester[i] = -1;
  return { order, semester, semesters: Math.max(0, ...semester), stuck };
}
