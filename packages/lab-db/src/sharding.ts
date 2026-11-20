/**
 * Spreading 1000 user ids over N database servers ("shards"), and what
 * happens when a shard is added: modulo hashing moves most keys, consistent
 * hashing moves only about 1/(N+1) of them.
 */
export type ShardMethod = "mod" | "consistent";
export const KEYS = 1000;
export const VNODES = 64;

/** FNV-1a: a small, well-spread string hash. */
export function fnv(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  // Final avalanche so nearby inputs spread over the whole ring.
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  return h >>> 0;
}

export function ring(n: number): { pos: number; shard: number }[] {
  const points: { pos: number; shard: number }[] = [];
  for (let s = 0; s < n; s++) for (let v = 0; v < VNODES; v++) points.push({ pos: fnv(`shard-${s}#${v}`), shard: s });
  return points.sort((a, b) => a.pos - b.pos);
}

export function assign(method: ShardMethod, n: number): number[] {
  if (method === "mod") return Array.from({ length: KEYS }, (_, k) => fnv(`user-${k + 1}`) % n);
  const r = ring(n);
  return Array.from({ length: KEYS }, (_, k) => {
    const h = fnv(`user-${k + 1}`);
    // First virtual node clockwise from the key (wrapping around).
    let lo = 0;
    let hi = r.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (r[mid]!.pos < h) lo = mid + 1;
      else hi = mid;
    }
    return r[lo % r.length]!.shard;
  });
}

export const loads = (a: number[], n: number) => Array.from({ length: n }, (_, s) => a.filter((x) => x === s).length);
export const movedFraction = (a: number[], b: number[]) => a.filter((x, i) => x !== b[i]).length / a.length;
