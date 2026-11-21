import { describe, expect, it } from "vitest";
import { PIPE_PROGRAM, assocAddresses, branchOutcomes, canSwap, predictBranches, runAssoc, runPipeline } from "./middle-core";

const order = (ids: string[]) => ids.map((id) => PIPE_PROGRAM.find((p) => p.id === id)!);

describe("pipeline", () => {
  it("no pipeline: 25 cycles; stalls without forwarding: 15; forwarding: 10", () => {
    expect(runPipeline(PIPE_PROGRAM, "off").cycles).toBe(25);
    const st = runPipeline(PIPE_PROGRAM, "stall");
    expect([st.cycles, st.stalls]).toEqual([15, 6]);
    const fw = runPipeline(PIPE_PROGRAM, "forward");
    expect([fw.cycles, fw.stalls]).toEqual([10, 1]);
    // The only stall left is the load-use one.
    expect(Object.values(fw.rows[1]!.cells).filter((c) => c === "ID·")).toHaveLength(1);
  });
  it("moving the independent ADD behind the load hides the load-use stall: 9 cycles", () => {
    const re = order(["i1", "i5", "i2", "i3", "i4"]);
    expect(runPipeline(re, "forward")).toMatchObject({ cycles: 9, stalls: 0 });
  });
  it("only independent neighbours may swap", () => {
    const [i1, i2, i3, i4, i5] = PIPE_PROGRAM;
    expect(canSwap(i1!, i2!)).toBe(false);
    expect(canSwap(i2!, i3!)).toBe(false);
    expect(canSwap(i4!, i5!)).toBe(true);
    expect(canSwap(i3!, i5!)).toBe(true);
    expect(canSwap(i1!, i5!)).toBe(true);
  });
});

describe("branch prediction", () => {
  const loop = branchOutcomes("loop");
  it("an inner loop of 4, ten times: always-taken 10 misses, 1-bit 19, 2-bit 10", () => {
    expect(loop).toHaveLength(40);
    expect(predictBranches("taken", loop).misses).toBe(10);
    expect(predictBranches("1bit", loop).misses).toBe(19);
    expect(predictBranches("2bit", loop).misses).toBe(10);
  });
  it("sorted data: 3 misses (start, then two while the counter climbs); the same data unsorted: about half", () => {
    expect(predictBranches("2bit", branchOutcomes("sorted")).misses).toBe(3);
    const r = predictBranches("2bit", branchOutcomes("random")).misses;
    expect(r).toBe(RANDOM_MISSES);
  });
});

const RANDOM_MISSES = 31;

describe("set-associative cache", () => {
  it("two arrays a cache apart: direct-mapped misses all 64, 2-way hits 48", () => {
    const a = assocAddresses("two");
    expect(runAssoc(a, 1)).toMatchObject({ hits: 0, misses: 64 });
    expect(runAssoc(a, 2)).toMatchObject({ hits: 48, misses: 16 });
  });
  it("three arrays: 2-way with LRU misses all 96, 4-way hits 72", () => {
    const a = assocAddresses("three");
    expect(runAssoc(a, 2)).toMatchObject({ hits: 0, misses: 96 });
    expect(runAssoc(a, 4)).toMatchObject({ hits: 72, misses: 24 });
  });
  it("sequential access hits 3 of 4 whatever the associativity", () => {
    for (const w of [1, 2, 4]) expect(runAssoc(assocAddresses("sequential"), w).hits).toBe(48);
  });
});
