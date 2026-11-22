import { describe, expect, it } from "vitest";
import { runBloat } from "./bufferbloat";

describe("net: bufferbloat", () => {
  it("a huge buffer: no loss, full speed, and the delay climbs past 700 ms", () => {
    expect(runBloat("huge")).toMatchObject({ drops: 0, utilization: 0.99, avgRtt: 402, maxRtt: 731.2 });
  });
  it("a tiny buffer: low delay, but the link idles after each halving", () => {
    expect(runBloat("tiny")).toMatchObject({ avgRtt: 43, maxRtt: 53.2, utilization: 0.9 });
  });
  it("a buffer of one bandwidth-delay product: full speed and under 100 ms", () => {
    expect(runBloat("bdp")).toMatchObject({ avgRtt: 60, maxRtt: 80.8, utilization: 0.99 });
  });
});
