import { describe, expect, it } from "vitest";
import { runPool } from "./pool";

describe("object pooling", () => {
  it("40 bullets a frame without a pool: 12000 allocations, 3 GC pauses, worst frame 38.8 ms", () => {
    expect(runPool(40, false)).toMatchObject({ allocations: 12000, gcRuns: 3, janky: 3, worst: 38.8 });
  });
  it("with a pool: 1200 bullets (40 × 30 frames of life) are reused, no pauses", () => {
    expect(runPool(40, true)).toMatchObject({ allocations: 1200, poolSize: 1200, gcRuns: 0, janky: 0, worst: 8.8 });
  });
  it("fewer bullets just delay the pause: 20 a frame gives one", () => {
    expect(runPool(20, false).gcRuns).toBe(1);
    expect(runPool(10, false).gcRuns).toBe(0);
  });
});
