/** Linear and binary search, recorded probe by probe. */
export type SearchKind = "linear" | "binary";

export interface Probe {
  /** Index looked at. */
  i: number;
  /** Range still possible before this probe (binary search). */
  lo: number;
  hi: number;
}

export interface SearchTrace {
  probes: Probe[];
  /** Index of the target, or -1. */
  found: number;
}

export function traceSearch(kind: SearchKind, a: number[], target: number): SearchTrace {
  const probes: Probe[] = [];
  if (kind === "linear") {
    for (let i = 0; i < a.length; i++) {
      probes.push({ i, lo: i, hi: a.length - 1 });
      if (a[i] === target) return { probes, found: i };
    }
    return { probes, found: -1 };
  }
  let lo = 0;
  let hi = a.length - 1;
  while (lo <= hi) {
    // lo + (hi - lo) / 2 never overflows, unlike (lo + hi) / 2 with fixed-width integers.
    const mid = lo + ((hi - lo) >> 1);
    probes.push({ i: mid, lo, hi });
    if (a[mid] === target) return { probes, found: mid };
    if (a[mid]! < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return { probes, found: -1 };
}

/** Worst-case probes for binary search on n items: ⌊log₂ n⌋ + 1. */
export const binaryWorst = (n: number) => (n <= 0 ? 0 : Math.floor(Math.log2(n)) + 1);
