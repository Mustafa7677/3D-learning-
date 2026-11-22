import { describe, expect, it } from "vitest";
import { runAmort } from "./amort";

describe("algo: amortized dynamic array", () => {
  it("growing by one copies n²/2 elements; doubling copies fewer than n·2", () => {
    expect(runAmort("plus1")).toMatchObject({ copies: 2080, average: 33 });
    expect(runAmort("x2")).toMatchObject({ copies: 127, average: 2.95, maxCost: 65 });
  });
  it("doubling: cheap on average, one push in a while is expensive", () => {
    const r = runAmort("x2");
    expect(r.costs.filter((c) => c > 1).length).toBe(7);
    expect(r.costs.at(-1)).toBe(65);
  });
  it("x1.5 copies a little more and wastes less memory", () => {
    expect(runAmort("x1.5")).toMatchObject({ copies: 179, capacity: 93, unused: 28 });
    expect(runAmort("x2")).toMatchObject({ capacity: 128, unused: 63 });
  });
});
