/**
 * Union-Find (disjoint sets): which computers are connected? Sixteen nodes,
 * fifteen unions that chain them together, then every node asks for its
 * root twice. Naive linking grows a tall chain; path compression flattens it
 * on the first walk; union by rank never lets it grow.
 */

export const UF_N = 16;
export type UfVariant = "naive" | "compress" | "rank";

export interface UfRun {
  parent: number[];
  /** Height of the tallest tree after the unions. */
  height: number;
  /** Pointer hops for the first and the second pass of finds over all nodes. */
  firstPass: number;
  secondPass: number;
  /** Depth of each node after the unions (before any finds). */
  depth: number[];
}

/** The unions: (0,1), (1,2), ... (14,15): the worst case for naive linking. */
export const UF_UNIONS: [number, number][] = Array.from({ length: UF_N - 1 }, (_, i) => [i, i + 1]);

export function runUnionFind(variant: UfVariant): UfRun {
  const parent = Array.from({ length: UF_N }, (_, i) => i);
  const rank = Array.from({ length: UF_N }, () => 0);
  const compress = variant === "compress";
  let hops = 0;
  const find = (x: number): number => {
    let r = x;
    while (parent[r] !== r) {
      r = parent[r]!;
      hops++;
    }
    if (compress) {
      let c = x;
      while (parent[c] !== r) {
        const next = parent[c]!;
        parent[c] = r;
        c = next;
      }
    }
    return r;
  };
  for (const [a, b] of UF_UNIONS) {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) continue;
    if (variant !== "rank") parent[ra] = rb;
    else if (rank[ra]! < rank[rb]!) parent[ra] = rb;
    else if (rank[ra]! > rank[rb]!) parent[rb] = ra;
    else {
      parent[rb] = ra;
      rank[ra]!++;
    }
  }
  const depthOf = (x: number) => {
    let d = 0;
    while (parent[x] !== x) {
      x = parent[x]!;
      d++;
    }
    return d;
  };
  const depth = parent.map((_, i) => depthOf(i));
  const after = [...parent];
  hops = 0;
  for (let i = 0; i < UF_N; i++) find(i);
  const firstPass = hops;
  hops = 0;
  for (let i = 0; i < UF_N; i++) find(i);
  return { parent: after, height: Math.max(...depth), firstPass, secondPass: hops, depth };
}
