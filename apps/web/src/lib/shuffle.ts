/**
 * Display order for answer options. Content is written with the correct option first, so the
 * screen must not show it that way: the order is a permutation seeded by the question text.
 * It is the same on every visit (no layout jump after a reload or a hydration) and different
 * between questions. A uniform shuffle puts the first (correct) option in each place equally often.
 */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number) {
  let s = seed || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** order[k] is the original index of the option shown in place k. */
export function optionOrder(key: string, n: number): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  const r = rng(hash(key));
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return order;
}
