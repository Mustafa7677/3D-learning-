import { describe, expect, it } from "vitest";
import { accuracy, driftScore, falseAlarms, train, weekData } from "./drift";

describe("data drift", () => {
  const w0 = weekData(0);
  const t0 = train(w0);
  it("week 0: the learned threshold is 93, accuracy 99.5%", () => {
    expect(t0).toBe(93);
    expect(accuracy(w0, t0)).toBe(0.995);
  });
  it("the same model in week 8: 81%, 37 false alarms; week 12: 45%, 110", () => {
    expect(accuracy(weekData(8), t0)).toBe(0.81);
    expect(falseAlarms(weekData(8), t0)).toBe(37);
    expect(accuracy(weekData(12), t0)).toBe(0.45);
    expect(falseAlarms(weekData(12), t0)).toBe(110);
  });
  it("the monitor sees it: the median moved 1.14 training SDs by week 8", () => {
    expect(Math.round(driftScore(w0, weekData(8)) * 100) / 100).toBe(1.14);
    expect(driftScore(w0, w0)).toBe(0);
  });
  it("retraining on week 8 moves the threshold to 120 and restores 98.5%", () => {
    expect(train(weekData(8))).toBe(120);
    expect(accuracy(weekData(8), train(weekData(8)))).toBe(0.985);
  });
});
