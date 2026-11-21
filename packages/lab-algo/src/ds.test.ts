import { describe, expect, it } from "vitest";
import {
  DP_ITEMS,
  HASH_WORDS,
  HEAP_CALLS,
  averageProbes,
  buckets,
  hashSum,
  heapPop,
  heapPush,
  insertKey,
  isHeap,
  knapsackBrute,
  knapsackChoice,
  knapsackGreedy,
  knapsackTable,
  loadFactor,
  longestChain,
  lookupProbes,
  type HashTable,
} from "./ds";

const table = (o: Partial<HashTable> = {}): HashTable => ({ capacity: 8, fn: "sum", resize: false, keys: [], resizes: 0, moved: 0, ...o });
const fill = (t: HashTable, words: string[]) => words.reduce(insertKey, t);

describe("hash table", () => {
  it("anagrams collide under the sum hash, and spread under the polynomial hash", () => {
    // 17 buckets (a prime), as in the lesson: these numbers are quoted in the lecture.
    const sum = fill(table({ fn: "sum", capacity: 17 }), HASH_WORDS.anagrams);
    const poly = fill(table({ fn: "poly", capacity: 17 }), HASH_WORDS.anagrams);
    expect(hashSum("мысық")).toBe(hashSum("сымық"));
    expect(longestChain(sum)).toBe(4);
    expect(averageProbes(sum).toFixed(2)).toBe("2.08");
    expect(longestChain(poly)).toBe(2);
    expect(averageProbes(poly).toFixed(2)).toBe("1.08");
  });

  it("every key is in exactly one bucket and can be found", () => {
    const t = fill(table({ fn: "poly" }), HASH_WORDS.cities);
    expect(buckets(t).flat().sort()).toEqual([...HASH_WORDS.cities].sort());
    for (const k of HASH_WORDS.cities) expect(lookupProbes(t, k).found).toBe(true);
    expect(lookupProbes(t, "Лондон").found).toBe(false);
  });

  it("without resizing the load factor grows past 1; with resizing it stays at or under 0.75", () => {
    const fixed = fill(table({ fn: "poly" }), HASH_WORDS.cities);
    expect(loadFactor(fixed)).toBe(3);
    const grow = fill(table({ fn: "poly", resize: true }), HASH_WORDS.cities);
    // 8 -> 16 at the 7th key, 16 -> 32 at the 13th; 24 / 32 is exactly 0.75, not past it.
    expect(loadFactor(grow)).toBe(0.75);
    expect(grow.capacity).toBe(32);
    expect(grow.resizes).toBe(2);
    expect(averageProbes(grow)).toBeLessThan(averageProbes(fixed));
  });

  it("duplicates are not inserted twice", () => {
    expect(fill(table(), ["а", "а"]).keys).toEqual(["а"]);
  });
});

describe("binary min-heap", () => {
  it("push keeps the heap property and pops come out in order", () => {
    let a: number[] = [];
    for (const v of HEAP_CALLS) {
      a = heapPush(a, v).arr;
      expect(isHeap(a)).toBe(true);
    }
    const out: number[] = [];
    while (a.length) {
      const r = heapPop(a);
      out.push(r.value!);
      a = r.arr;
      expect(isHeap(a)).toBe(true);
    }
    expect(out).toEqual([...HEAP_CALLS].sort((x, y) => x - y));
  });

  it("a push costs at most the height of the tree in swaps", () => {
    let a: number[] = [];
    for (let v = 100; v > 0; v--) {
      const r = heapPush(a, v);
      expect(r.swaps).toBeLessThanOrEqual(Math.floor(Math.log2(r.arr.length)));
      a = r.arr;
    }
  });

  it("pop on an empty heap does nothing", () => {
    expect(heapPop([])).toEqual({ arr: [], swaps: 0 });
  });
});

describe("knapsack", () => {
  for (const [name, p] of Object.entries(DP_ITEMS))
    it(`the table finds the true optimum (${name})`, () => {
      const t = knapsackTable(p.items, p.capacity);
      expect(t.at(-1)!.at(-1)).toBe(knapsackBrute(p.items, p.capacity));
      const chosen = knapsackChoice(p.items, t);
      const items = p.items.filter((it) => chosen.includes(it.name));
      expect(items.reduce((s, it) => s + it.w, 0)).toBeLessThanOrEqual(p.capacity);
      expect(items.reduce((s, it) => s + it.v, 0)).toBe(t.at(-1)!.at(-1));
    });

  it("the trip optimum quoted in the lecture: 21 with the sleeping bag, water and food", () => {
    const p = DP_ITEMS.trip;
    const t = knapsackTable(p.items, p.capacity);
    expect(t.at(-1)!.at(-1)).toBe(21);
    expect(knapsackChoice(p.items, t)).toEqual(["Ұйықтау қабы", "Су", "Тамақ"]);
  });

  it("the first pushes of the ambulance calls: the fourth call climbs two levels", () => {
    let a: number[] = [];
    const swaps = HEAP_CALLS.slice(0, 4).map((v) => {
      const r = heapPush(a, v);
      a = r.arr;
      return r.swaps;
    });
    expect(swaps).toEqual([0, 1, 0, 2]);
    expect(a).toEqual([1, 3, 8, 5]);
  });

  it("greedy by value per weight loses on the trap: 30 against 40", () => {
    const p = DP_ITEMS.trap;
    expect(knapsackGreedy(p.items, p.capacity)).toEqual({ value: 30, taken: ["Ноутбук"] });
    expect(knapsackTable(p.items, p.capacity).at(-1)!.at(-1)).toBe(40);
    expect(knapsackChoice(p.items, knapsackTable(p.items, p.capacity))).toEqual(["Камера", "Дрон"]);
  });
});
