import { describe, expect, it } from "vitest";
import { runCalib } from "./calib";

describe("ai: calibration and temperature scaling", () => {
  it("the raw model says 99% where it is right 86% of the time", () => {
    const r = runCalib(1);
    expect(r).toMatchObject({ accuracy: 0.79, ece: 0.128 });
    expect(r.bins.at(-1)).toMatchObject({ confidence: 0.99, accuracy: 0.86 });
  });
  it("dividing by T = 3 fixes the confidence and keeps every answer", () => {
    expect(runCalib(3)).toMatchObject({ accuracy: 0.79, ece: 0.011 });
    expect(runCalib(2).ece).toBe(0.055);
  });
  it("too much temperature: underconfident again", () => {
    expect(runCalib(4)).toMatchObject({ accuracy: 0.79, ece: 0.056 });
  });
});
