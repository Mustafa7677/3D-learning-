/**
 * A field sensor sends one reading a second. Twice in two minutes its I2C
 * bus locks up and the main loop hangs waiting for it. A watchdog timer
 * resets the chip unless it is "fed" at least every 2 s. Fed from the main
 * loop, it notices the hang and reboots (1 s). Fed from a timer interrupt,
 * it keeps being fed while the main loop is stuck, and notices nothing.
 */

export type WatchdogMode = "none" | "isr" | "loop";
export const WATCHDOG_MODES: WatchdogMode[] = ["none", "isr", "loop"];
export const WD_SECONDS = 120;
export const HANGS = [40, 90];
export const WD_TIMEOUT = 2;
export const BOOT = 1;

export type DeviceState = "ok" | "hung" | "boot";

export interface WatchdogRun {
  mode: WatchdogMode;
  timeline: DeviceState[];
  readings: number;
  downtime: number;
  resets: number;
}

export function runWatchdog(mode: WatchdogMode): WatchdogRun {
  const timeline: DeviceState[] = [];
  let state: DeviceState = "ok";
  let since = 0; // seconds in the current hang or boot
  let resets = 0;
  for (let t = 0; t < WD_SECONDS; t++) {
    if (state === "ok" && HANGS.includes(t)) {
      state = "hung";
      since = 0;
    }
    if (state === "hung") {
      // Only a watchdog fed from the main loop starves when the loop hangs.
      if (mode === "loop" && since >= WD_TIMEOUT) {
        state = "boot";
        since = 0;
        resets++;
      }
    } else if (state === "boot" && since >= BOOT) {
      state = "ok";
    }
    timeline.push(state);
    since++;
  }
  const readings = timeline.filter((s) => s === "ok").length;
  return { mode, timeline, readings, downtime: WD_SECONDS - readings, resets };
}
