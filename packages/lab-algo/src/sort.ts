/**
 * Sorting algorithms written once, as emitters of primitive operations.
 * Recording the operations gives a step-by-step trace for the 3D view;
 * counting them gives the numbers for Big-O experiments on large inputs.
 */
export type SortAlg = "bubble" | "selection" | "insertion" | "merge" | "quick";
export type Pivot = "last" | "middle";

export type SortOp =
  /** Compare a[i] with a[j]. */
  | { k: "cmp"; i: number; j: number }
  /** Exchange a[i] and a[j]. */
  | { k: "swap"; i: number; j: number }
  /** Write a value into a[i] (merge sort copies from an auxiliary array). */
  | { k: "set"; i: number; v: number }
  /** a[i] is in its final place. */
  | { k: "done"; i: number }
  /** The algorithm now works on a[lo..hi] (recursion). */
  | { k: "range"; lo: number; hi: number }
  /** a[i] is the quicksort pivot. */
  | { k: "pivot"; i: number };

export interface SortCounts {
  comparisons: number;
  swaps: number;
  writes: number;
  /** Deepest recursion level reached (merge and quick). */
  depth: number;
}

interface Emitter {
  cmp(i: number, j: number): void;
  swap(i: number, j: number): void;
  set(i: number, v: number): void;
  done(i: number): void;
  range(lo: number, hi: number, depth: number): void;
  pivot(i: number): void;
}

function run(alg: SortAlg, a: number[], e: Emitter, pivot: Pivot): void {
  const n = a.length;
  const swap = (i: number, j: number) => {
    const t = a[i]!;
    a[i] = a[j]!;
    a[j] = t;
    e.swap(i, j);
  };
  /** Compare and return a[i] > a[j]. */
  const gt = (i: number, j: number) => {
    e.cmp(i, j);
    return a[i]! > a[j]!;
  };

  switch (alg) {
    case "bubble": {
      for (let end = n - 1; end > 0; end--) {
        let swapped = false;
        for (let i = 0; i < end; i++) {
          if (gt(i, i + 1)) {
            swap(i, i + 1);
            swapped = true;
          }
        }
        e.done(end);
        // No swap in a whole pass: everything left is already in order.
        if (!swapped) {
          for (let i = end - 1; i >= 0; i--) e.done(i);
          return;
        }
      }
      if (n > 0) e.done(0);
      return;
    }
    case "selection": {
      for (let i = 0; i < n - 1; i++) {
        let min = i;
        for (let j = i + 1; j < n; j++) if (gt(min, j)) min = j;
        if (min !== i) swap(i, min);
        e.done(i);
      }
      if (n > 0) e.done(n - 1);
      return;
    }
    case "insertion": {
      for (let i = 1; i < n; i++) {
        for (let j = i; j > 0 && gt(j - 1, j); j--) swap(j - 1, j);
      }
      for (let i = 0; i < n; i++) e.done(i);
      return;
    }
    case "merge": {
      const aux = a.slice();
      const sort = (lo: number, hi: number, depth: number) => {
        if (hi - lo < 1) return;
        e.range(lo, hi, depth);
        const mid = (lo + hi) >> 1;
        sort(lo, mid, depth + 1);
        sort(mid + 1, hi, depth + 1);
        e.range(lo, hi, depth);
        for (let k = lo; k <= hi; k++) aux[k] = a[k]!;
        let i = lo;
        let j = mid + 1;
        for (let k = lo; k <= hi; k++) {
          let v: number;
          if (i > mid) v = aux[j++]!;
          else if (j > hi) v = aux[i++]!;
          else {
            e.cmp(i, j);
            v = aux[j]! < aux[i]! ? aux[j++]! : aux[i++]!;
          }
          a[k] = v;
          e.set(k, v);
        }
      };
      sort(0, n - 1, 1);
      for (let i = 0; i < n; i++) e.done(i);
      return;
    }
    case "quick": {
      const sort = (lo: number, hi: number, depth: number) => {
        if (lo > hi) return;
        if (lo === hi) return e.done(lo);
        e.range(lo, hi, depth);
        if (pivot === "middle") swap((lo + hi) >> 1, hi);
        e.pivot(hi);
        // Lomuto partition: everything ≤ pivot moves left of i.
        let i = lo;
        for (let j = lo; j < hi; j++) {
          if (!gt(j, hi)) {
            if (i !== j) swap(i, j);
            i++;
          }
        }
        if (i !== hi) swap(i, hi);
        e.done(i);
        sort(lo, i - 1, depth + 1);
        sort(i + 1, hi, depth + 1);
      };
      sort(0, n - 1, 1);
      return;
    }
  }
}

/** Every operation the algorithm performs on a copy of `input`. */
export function traceSort(alg: SortAlg, input: number[], pivot: Pivot = "last"): SortOp[] {
  const ops: SortOp[] = [];
  run(alg, input.slice(), {
    cmp: (i, j) => ops.push({ k: "cmp", i, j }),
    swap: (i, j) => ops.push({ k: "swap", i, j }),
    set: (i, v) => ops.push({ k: "set", i, v }),
    done: (i) => ops.push({ k: "done", i }),
    range: (lo, hi) => ops.push({ k: "range", lo, hi }),
    pivot: (i) => ops.push({ k: "pivot", i }),
  }, pivot);
  return ops;
}

/** Operation counts without recording a trace (fast enough for n in the thousands). */
export function countSort(alg: SortAlg, input: number[], pivot: Pivot = "last"): SortCounts & { sorted: number[] } {
  const c: SortCounts = { comparisons: 0, swaps: 0, writes: 0, depth: 0 };
  const a = input.slice();
  run(alg, a, {
    cmp: () => c.comparisons++,
    swap: () => c.swaps++,
    set: () => c.writes++,
    done: () => {},
    range: (_lo, _hi, d) => (c.depth = Math.max(c.depth, d)),
    pivot: () => {},
  }, pivot);
  return { ...c, sorted: a };
}

/** Apply one operation to an array in place. */
export function applyOp(a: number[], op: SortOp): void {
  if (op.k === "swap") {
    const t = a[op.i]!;
    a[op.i] = a[op.j]!;
    a[op.j] = t;
  } else if (op.k === "set") a[op.i] = op.v;
}

export type ArrayPreset = "random" | "sorted" | "reversed" | "nearly" | "few";

/** Deterministic test inputs: values 1..n arranged by preset. */
export function makeArray(preset: ArrayPreset, n: number, seed: number): number[] {
  let s = seed >>> 0 || 1;
  const rnd = (m: number) => {
    // xorshift32: cheap, deterministic, good enough for shuffles.
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s % m;
  };
  const a = Array.from({ length: n }, (_, i) => i + 1);
  const shuffle = () => {
    for (let i = n - 1; i > 0; i--) {
      const j = rnd(i + 1);
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
  };
  switch (preset) {
    case "sorted":
      return a;
    case "reversed":
      return a.reverse();
    case "nearly": {
      // Sorted, with a few neighbouring pairs swapped.
      for (let k = 0; n > 1 && k < Math.max(1, Math.floor(n / 10)); k++) {
        const i = rnd(n - 1);
        [a[i], a[i + 1]] = [a[i + 1]!, a[i]!];
      }
      return a;
    }
    case "few": {
      shuffle();
      return a.map((v) => 1 + (v % 4) * Math.max(1, Math.floor(n / 4)));
    }
    default:
      shuffle();
      return a;
  }
}
