import { describe, expect, it } from "vitest";
import { runSharing } from "./sharing";

describe("arch: false sharing", () => {
  it("one thread, both counters: 2039 cycles", () => {
    expect(runSharing("single")).toMatchObject({ cycles: 2039, transfers: 1 });
  });
  it("two threads, one cache line: the line ping-pongs, 80 000 cycles, 39 times slower", () => {
    const r = runSharing("shared");
    expect(r).toMatchObject({ cycles: 80000, transfers: 2000, addresses: [0, 8] });
    expect(Math.round(r.cycles / runSharing("single").cycles)).toBe(39);
  });
  it("two threads, a line each: 1039 cycles, twice as fast as one thread", () => {
    const r = runSharing("padded");
    expect(r).toMatchObject({ cycles: 1039, transfers: 2, addresses: [0, 64] });
    expect(Math.round((runSharing("single").cycles / r.cycles) * 10) / 10).toBe(2);
  });
});
