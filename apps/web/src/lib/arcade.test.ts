import { describe, expect, it } from "vitest";
import { GAMES, LETTERS, bitLevel, bitsValue, cacheSequence, gate, gateRound, medalOf, rng, simulate } from "./arcade";
import { lessonsForLab } from "./lessons";

describe("arcade", () => {
  it("every game names a real lab and climbing medals, with no dashes", () => {
    for (const g of GAMES) {
      expect(lessonsForLab(g.lab).length, g.id).toBeGreaterThan(0);
      expect(g.medals[0] < g.medals[1] && g.medals[1] < g.medals[2], g.id).toBe(true);
      expect(medalOf(g, g.medals[2])).toBe(3);
      expect(medalOf(g, g.medals[0] - 1)).toBe(0);
    }
    expect(/[–—]/.test(JSON.stringify([GAMES, LETTERS]))).toBe(false);
  });

  it("bits: the switches read as a binary number, the register widens with the level", () => {
    expect(bitsValue([true, false, true, true])).toBe(11);
    expect(bitsValue([false, false, false])).toBe(0);
    expect(bitLevel(0).width).toBe(4);
    expect(bitLevel(100).width).toBe(8);
    expect(bitLevel(100).fall).toBeGreaterThanOrEqual(7);
  });

  it("gates: truth tables, and every round's answer is the gate's output", () => {
    expect([gate("AND", true, true), gate("AND", true, false)]).toEqual([true, false]);
    expect([gate("XOR", true, false), gate("XOR", true, true)]).toEqual([true, false]);
    expect([gate("NAND", true, true), gate("NOR", false, false), gate("NOT", false)]).toEqual([false, true, true]);
    const r = rng(7);
    for (const score of [0, 100, 300]) {
      for (let k = 0; k < 50; k++) {
        const g = gateRound(score, r);
        const first = gate(g.first, g.inputs[0]!, g.inputs[1]);
        expect(g.answer).toBe(g.second ? gate(g.second, first, g.inputs[2]) : first);
        if (score < 60) expect(["AND", "OR", "NOT"]).toContain(g.first);
        if (score >= 180) expect(g.second).toBeDefined();
      }
    }
  });

  it("phishing: a balanced deck, each letter explained", () => {
    const phish = LETTERS.filter((l) => l.phish).length;
    expect(phish).toBeGreaterThanOrEqual(8);
    expect(LETTERS.length - phish).toBeGreaterThanOrEqual(8);
    for (const l of LETTERS) expect(l.why.length, l.subject).toBeGreaterThan(30);
  });

  it("cache: the optimal policy is never beaten, and LRU is a real opponent", () => {
    for (let seed = 1; seed < 40; seed++) {
      const seq = cacheSequence(seed);
      const opt = simulate(seq, 3, "opt");
      expect(simulate(seq, 3, "lru")).toBeLessThanOrEqual(opt);
      expect(simulate(seq, 3, "fifo")).toBeLessThanOrEqual(opt);
    }
    // A textbook case: A B C A D A B with 3 slots.
    const seq = ["A", "B", "C", "A", "D", "A", "B"];
    expect(simulate(seq, 3, "opt")).toBe(3);
    expect(simulate(seq, 3, "lru")).toBe(2);
  });
});
