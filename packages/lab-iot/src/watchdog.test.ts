import { describe, expect, it } from "vitest";
import { runWatchdog } from "./watchdog";

describe("iot: watchdog timer", () => {
  it("without a watchdog the first hang is forever: 80 s silent", () => {
    expect(runWatchdog("none")).toMatchObject({ readings: 40, downtime: 80, resets: 0 });
  });
  it("fed from a timer interrupt, the watchdog never notices the stuck loop", () => {
    expect(runWatchdog("isr")).toMatchObject({ downtime: 80, resets: 0 });
  });
  it("fed from the main loop: two resets, 3 s each, 114 readings", () => {
    const r = runWatchdog("loop");
    expect(r).toMatchObject({ readings: 114, downtime: 6, resets: 2 });
    expect(r.timeline.slice(40, 44)).toEqual(["hung", "hung", "boot", "ok"]);
  });
});
