/**
 * Data structures for the Middle level: a hash table with chaining, a binary
 * min-heap and the 0/1 knapsack table. Pure functions; the plugin stores only
 * small inputs and derives the rest.
 */

// ---------------- hash table ----------------

export type HashFn = "sum" | "poly";

/** Sum of character codes: every anagram lands in the same bucket. */
export function hashSum(key: string): number {
  let h = 0;
  for (const ch of key) h += ch.codePointAt(0)!;
  return h;
}

/** Polynomial rolling hash (base 31): the order of letters matters. */
export function hashPoly(key: string): number {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.codePointAt(0)!) % 1_000_000_007;
  return h;
}

export const hashOf = (fn: HashFn, key: string) => (fn === "sum" ? hashSum(key) : hashPoly(key));

export interface HashTable {
  capacity: number;
  fn: HashFn;
  /** Grow ×2 when the load factor would pass 0.75. */
  resize: boolean;
  /** Keys in insertion order (duplicates are ignored). */
  keys: string[];
  /** How many times the table grew, and how many keys were moved when it did. */
  resizes: number;
  moved: number;
}

export const LOAD_LIMIT = 0.75;

export function buckets(t: Pick<HashTable, "capacity" | "fn" | "keys">): string[][] {
  const b: string[][] = Array.from({ length: t.capacity }, () => []);
  for (const k of t.keys) b[hashOf(t.fn, k) % t.capacity]!.push(k);
  return b;
}

export function insertKey(t: HashTable, key: string): HashTable {
  if (!key || t.keys.includes(key)) return t;
  let next: HashTable = { ...t, keys: [...t.keys, key] };
  while (next.resize && next.keys.length / next.capacity > LOAD_LIMIT) {
    next = { ...next, capacity: next.capacity * 2, resizes: next.resizes + 1, moved: next.moved + next.keys.length };
  }
  return next;
}

/** Keys compared while looking `key` up: its bucket's chain up to the match (or all of it). */
export function lookupProbes(t: HashTable, key: string): { probes: number; found: boolean } {
  const chain = buckets(t)[hashOf(t.fn, key) % t.capacity]!;
  const i = chain.indexOf(key);
  return i >= 0 ? { probes: i + 1, found: true } : { probes: chain.length, found: false };
}

export const loadFactor = (t: HashTable) => t.keys.length / t.capacity;
export const longestChain = (t: HashTable) => Math.max(0, ...buckets(t).map((c) => c.length));
/** Average comparisons to find a key that is present. */
export function averageProbes(t: HashTable): number {
  if (!t.keys.length) return 0;
  return t.keys.reduce((s, k) => s + lookupProbes(t, k).probes, 0) / t.keys.length;
}

/** Word sets for the lesson: anagrams (same letters, different order) and plain words. */
export const HASH_WORDS: Record<"anagrams" | "cities", string[]> = {
  anagrams: ["мысық", "сымық", "қысым", "қымыс", "кітап", "тапкі", "пікат", "ақпан", "пақан", "нақпа", "сарқа", "арқас"],
  cities: [
    "Алматы", "Астана", "Шымкент", "Қарағанды", "Ақтөбе", "Тараз", "Павлодар", "Өскемен", "Семей", "Атырау", "Қостанай", "Қызылорда",
    "Орал", "Петропавл", "Ақтау", "Түркістан", "Көкшетау", "Талдықорған", "Екібастұз", "Жезқазған", "Балқаш", "Рудный", "Жаңаөзен", "Қаскелең",
  ],
};

// ---------------- binary min-heap ----------------

export interface HeapOp {
  kind: "push" | "pop";
  value: number;
  swaps: number;
}

/** Push: append and sift up. Returns the new array and how many swaps it took. */
export function heapPush(arr: number[], value: number): { arr: number[]; swaps: number } {
  const a = [...arr, value];
  let i = a.length - 1;
  let swaps = 0;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (a[p]! <= a[i]!) break;
    [a[p], a[i]] = [a[i]!, a[p]!];
    i = p;
    swaps++;
  }
  return { arr: a, swaps };
}

/** Pop the minimum: move the last leaf to the root and sift down. */
export function heapPop(arr: number[]): { arr: number[]; value?: number; swaps: number } {
  if (!arr.length) return { arr, swaps: 0 };
  const a = [...arr];
  const top = a[0]!;
  const last = a.pop()!;
  let swaps = 0;
  if (a.length) {
    a[0] = last;
    let i = 0;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let m = i;
      if (l < a.length && a[l]! < a[m]!) m = l;
      if (r < a.length && a[r]! < a[m]!) m = r;
      if (m === i) break;
      [a[m], a[i]] = [a[i]!, a[m]!];
      i = m;
      swaps++;
    }
  }
  return { arr: a, value: top, swaps };
}

/** Every parent is no larger than its children. */
export const isHeap = (a: number[]) => a.every((v, i) => i === 0 || a[(i - 1) >> 1]! <= v);

/** Ambulance calls: urgency 1 is the most urgent. */
export const HEAP_CALLS = [5, 3, 8, 1, 9, 2, 7, 4, 6];

// ---------------- 0/1 knapsack ----------------

export interface Item {
  name: string;
  w: number;
  v: number;
}

export type DpPreset = "trip" | "trap";

/** «trap» is where taking the best value-per-weight first loses: 30 against 40. */
export const DP_ITEMS: Record<DpPreset, { capacity: number; items: Item[] }> = {
  trip: {
    capacity: 8,
    items: [
      { name: "Шатыр", w: 4, v: 9 },
      { name: "Ұйықтау қабы", w: 3, v: 7 },
      { name: "Су", w: 2, v: 6 },
      { name: "Шам", w: 1, v: 3 },
      { name: "Тамақ", w: 3, v: 8 },
    ],
  },
  trap: {
    capacity: 10,
    items: [
      { name: "Ноутбук", w: 6, v: 30 },
      { name: "Камера", w: 5, v: 20 },
      { name: "Дрон", w: 5, v: 20 },
    ],
  },
};

/** The full table: best[i][c] = best value using the first i items within capacity c. */
export function knapsackTable(items: Item[], capacity: number): number[][] {
  const t = Array.from({ length: items.length + 1 }, () => Array<number>(capacity + 1).fill(0));
  for (let i = 1; i <= items.length; i++) {
    const it = items[i - 1]!;
    for (let c = 0; c <= capacity; c++) {
      const skip = t[i - 1]![c]!;
      const take = it.w <= c ? t[i - 1]![c - it.w]! + it.v : -1;
      t[i]![c] = Math.max(skip, take);
    }
  }
  return t;
}

/** Which items the optimum takes, read back from the table. */
export function knapsackChoice(items: Item[], table: number[][]): string[] {
  const out: string[] = [];
  let c = table[0]!.length - 1;
  for (let i = items.length; i > 0; i--) {
    if (table[i]![c] !== table[i - 1]![c]) {
      out.unshift(items[i - 1]!.name);
      c -= items[i - 1]!.w;
    }
  }
  return out;
}

/** Greedy by value per weight: fast, and sometimes wrong. */
export function knapsackGreedy(items: Item[], capacity: number): { value: number; taken: string[] } {
  let left = capacity;
  let value = 0;
  const taken: string[] = [];
  for (const it of [...items].sort((a, b) => b.v / b.w - a.v / a.w)) {
    if (it.w <= left) {
      left -= it.w;
      value += it.v;
      taken.push(it.name);
    }
  }
  return { value, taken };
}

/** Exhaustive check used by the tests: the true optimum by trying every subset. */
export function knapsackBrute(items: Item[], capacity: number): number {
  let best = 0;
  for (let m = 0; m < 1 << items.length; m++) {
    let w = 0;
    let v = 0;
    items.forEach((it, i) => {
      if (m & (1 << i)) {
        w += it.w;
        v += it.v;
      }
    });
    if (w <= capacity) best = Math.max(best, v);
  }
  return best;
}
