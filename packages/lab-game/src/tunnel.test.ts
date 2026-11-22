import { describe, expect, it } from "vitest";
import { runTunnel } from "./tunnel";

describe("game: tunneling", () => {
  it("discrete checks catch a slow bullet and miss a fast one", () => {
    expect(runTunnel("discrete", 5)).toMatchObject({ hit: true, step: 0.083 });
    expect(runTunnel("discrete", 20)).toMatchObject({ hit: false, step: 0.333, tests: 30 });
    expect(runTunnel("discrete", 60).hit).toBe(false);
  });
  it("four substeps catch 20 m/s but not 60 m/s, at four times the tests", () => {
    expect(runTunnel("substeps", 20)).toMatchObject({ hit: true, step: 0.083, tests: 118 });
    expect(runTunnel("substeps", 60)).toMatchObject({ hit: false, step: 0.25, tests: 40 });
  });
  it("continuous detection never misses, with one test per frame", () => {
    for (const v of [5, 20, 60]) expect(runTunnel("ccd", v).hit).toBe(true);
    expect(runTunnel("ccd", 60).tests).toBe(10);
  });
});
