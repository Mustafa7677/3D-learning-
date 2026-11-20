/**
 * A direct-mapped cache in front of an 8×8 matrix of 4-byte integers.
 * Summing the matrix row by row or column by column touches the same data in
 * a different order — and the hit rate shows why order matters.
 */
export const ROWS = 8;
export const COLS = 8;
export const WORD = 4;

export type Pattern = "row" | "column";

export interface CacheConfig {
  /** Number of cache lines. */
  lines: number;
  /** Bytes per line. */
  lineSize: number;
}

export interface Access {
  r: number;
  c: number;
  addr: number;
  line: number;
  tag: number;
  hit: boolean;
}

/** Addresses in visiting order. Row-major layout: element (r, c) lives at (r·COLS + c)·WORD. */
export function accesses(pattern: Pattern): { r: number; c: number; addr: number }[] {
  const out: { r: number; c: number; addr: number }[] = [];
  for (let i = 0; i < ROWS; i++)
    for (let j = 0; j < COLS; j++) {
      const [r, c] = pattern === "row" ? [i, j] : [j, i];
      out.push({ r, c, addr: (r * COLS + c) * WORD });
    }
  return out;
}

/** Simulate the whole traversal: each block maps to exactly one line (block mod lines). */
export function simulateCache(pattern: Pattern, cfg: CacheConfig): Access[] {
  const tags: (number | null)[] = Array(cfg.lines).fill(null);
  return accesses(pattern).map(({ r, c, addr }) => {
    const block = Math.floor(addr / cfg.lineSize);
    const line = block % cfg.lines;
    const tag = Math.floor(block / cfg.lines);
    const hit = tags[line] === tag;
    tags[line] = tag;
    return { r, c, addr, line, tag, hit };
  });
}

/** Latency model: a hit costs 1 cycle, a miss goes to main memory. */
export const HIT_CYCLES = 1;
export const MISS_CYCLES = 100;
export const cost = (trace: Access[]) => trace.reduce((s, a) => s + (a.hit ? HIT_CYCLES : MISS_CYCLES), 0);
