import { describe, expect, it } from "vitest";
import { MISSION_SCHOOL as M, SCENARIOS, formatMs, pageKB, runMission, sharedFinishMs, slowestSegment } from "./mission";

describe("mission model v0: the school site", () => {
  it("is deterministic", () => {
    expect(runMission(SCENARIOS.class, "cache")).toEqual(runMission(SCENARIOS.class, "cache"));
  });

  it("one phone in the morning is fast", () => {
    const r = runMission(SCENARIOS.single, "none");
    expect(r.totalMs).toBeLessThan(1000);
    expect(r.queueAhead).toBe(0);
  });

  it("the whole class at once is many times slower, and the download is where the time goes", () => {
    const one = runMission(SCENARIOS.single, "none");
    const cls = runMission(SCENARIOS.class, "none");
    expect(cls.totalMs).toBeGreaterThan(one.totalMs * 10);
    expect(slowestSegment(cls)).toBe("download");
    // 30 phones x 2440 KB over 6250 KB/s.
    expect(cls.segments.find((s) => s.id === "download")!.ms).toBe(Math.round(((30 * 2440) / 6250) * 1000));
  });

  it("caching rescues a class that has visited before", () => {
    expect(runMission(SCENARIOS.repeatClass, "cache").totalMs).toBeLessThan(1000);
  });

  it("the counterexample: caching does nothing for a class that comes for the first time", () => {
    const before = runMission(SCENARIOS.newClass, "none");
    const cache = runMission(SCENARIOS.newClass, "cache");
    const resize = runMission(SCENARIOS.newClass, "resize");
    expect(cache.segments.find((s) => s.id === "download")!.ms).toBe(before.segments.find((s) => s.id === "download")!.ms);
    expect(resize.totalMs).toBeLessThan(before.totalMs / 4);
  });

  it("resizing helps every scenario, caching only repeat visits", () => {
    for (const s of Object.values(SCENARIOS)) {
      expect(runMission(s, "resize").totalMs).toBeLessThanOrEqual(runMission(s, "none").totalMs);
      expect(runMission(s, "cache").totalMs).toBeLessThanOrEqual(runMission(s, "none").totalMs);
    }
  });

  it("a first visit pays for DNS; segments add up to the total", () => {
    const r = runMission(SCENARIOS.newClass, "none");
    expect(r.segments[0]).toEqual({ id: "dns", ms: M.dnsMs });
    expect(r.segments.reduce((s, x) => s + x.ms, 0)).toBe(r.totalMs);
  });

  it("fair sharing: a small download is not held back by big ones", () => {
    expect(sharedFinishMs(100, [1000, 1000], 1000)).toBe(300);
    expect(sharedFinishMs(1000, [100, 100], 1000)).toBe(1200);
    expect(pageKB(true, "cache")).toBe(M.htmlKB);
    expect(pageKB(false, "cache")).toBe(M.htmlKB + M.photosKB);
  });

  it("formats times the Kazakh way", () => {
    expect(formatMs(345)).toBe("345 мс");
    expect(formatMs(11926)).toBe("11,9 с");
  });
});
