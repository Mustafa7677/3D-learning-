import { describe, expect, it } from "vitest";
import { clock, elapsedMs, finish, focusWeek, isDone, minutesByDay, newSession, pause, remainingMs, resume } from "./focus";

const M = 60000;
const t0 = new Date(2026, 10, 22, 10).getTime();

describe("a focus session", () => {
  it("counts down, pauses do not count, and it ends on time", () => {
    let s = newSession("  Гаусс әдісі  ", 25, t0);
    expect(s.intention).toBe("Гаусс әдісі");
    expect(clock(remainingMs(s, t0))).toBe("25:00");
    s = pause(s, t0 + 10 * M);
    expect(remainingMs(s, t0 + 20 * M)).toBe(15 * M);
    s = pause(s, t0 + 21 * M);
    expect(s.pauses).toBe(1);
    s = resume(s, t0 + 20 * M);
    expect(elapsedMs(s, t0 + 30 * M)).toBe(20 * M);
    expect(isDone(s, t0 + 34 * M)).toBe(false);
    expect(isDone(s, t0 + 35 * M)).toBe(true);
    expect(remainingMs(s, t0 + 99 * M)).toBe(0);
  });

  it("finishing early keeps the minutes spent; finishing late never counts more than planned", () => {
    const s = newSession("x", 25, t0);
    expect(finish(s, t0 + 12.7 * M).focusedMin).toBe(12);
    expect(finish(s, t0 + 60 * M).focusedMin).toBe(25);
    const paused = pause(s, t0 + 5 * M);
    expect(finish(paused, t0 + 30 * M).focusedMin).toBe(5);
  });

  it("formats the clock", () => {
    expect([clock(0), clock(59_001), clock(25 * M), clock(9 * M + 5000)]).toEqual(["00:00", "01:00", "25:00", "09:05"]);
  });

  it("adds focused minutes by day and shows the last week", () => {
    const a = finish(newSession("a", 25, t0), t0 + 25 * M);
    const b = finish(newSession("b", 15, t0 + 60 * M), t0 + 75 * M);
    const c = finish(newSession("c", 45, t0 - 24 * 60 * M), t0 - 24 * 60 * M + 45 * M);
    const open = newSession("d", 25, t0);
    expect(minutesByDay([a, b, c, open])).toEqual({ "2026-11-22": 40, "2026-11-21": 45 });
    const w = focusWeek([a, b, c], new Date(t0));
    expect(w.map((d) => d.min)).toEqual([0, 0, 0, 0, 0, 45, 40]);
    expect(w.at(-1)!.today).toBe(true);
  });
});
