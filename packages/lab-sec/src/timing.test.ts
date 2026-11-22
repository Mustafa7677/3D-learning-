import { describe, expect, it } from "vitest";
import { SECRET, runTiming, serverTime } from "./timing";

describe("sec: timing attack", () => {
  it("an early-exit comparison is slower by 1 µs per correct leading character", () => {
    expect(serverTime("00000000", "early")).toBe(50);
    expect(serverTime("a7000000", "early")).toBe(52);
    expect(serverTime(SECRET, "early")).toBe(58);
    expect(serverTime("00000000", "constant")).toBe(serverTime(SECRET, "constant"));
  });
  it("one or ten measurements per guess drown in 2 µs of noise; a hundred recover the whole secret", () => {
    expect(runTiming("early", 1).correct).toBeLessThan(8);
    expect(runTiming("early", 10).correct).toBeLessThan(8);
    expect(runTiming("early", 100)).toMatchObject({ guess: SECRET, correct: 8, requests: 12800 });
  });
  it("a constant-time comparison leaves nothing to measure", () => {
    expect(runTiming("constant", 100).correct).toBeLessThan(3);
  });
});
