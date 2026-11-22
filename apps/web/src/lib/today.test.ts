import { describe, expect, it } from "vitest";
import type { LessonProgress } from "@inside-tech/lesson-engine";
import { addActivity, sanitizeActivity, type ActivityLog } from "./activity";
import { lessonEntries } from "./lessons";
import { activeThisWeek, heatmap, mastery, nextLesson, todayPlan, weekStart } from "./today";

const P = (lessonId: string, updatedAt: number, done = false, extra: Partial<LessonProgress> = {}): LessonProgress => ({ lessonId, stepIndex: 0, completed: {}, startedAt: 0, updatedAt, completedAt: done ? updatedAt : undefined, ...extra });
const math = lessonEntries.filter((e) => e.labId === "math");

describe("the next lesson", () => {
  it("a newcomer starts at the first lesson", () => {
    expect(nextLesson(lessonEntries, [])?.entry.lesson.id).toBe(lessonEntries[0]!.lesson.id);
  });
  it("an unfinished lesson is resumed, the newest first", () => {
    const n = nextLesson(lessonEntries, [P(math[0]!.lesson.id, 5, true), P(math[2]!.lesson.id, 9), P(math[1]!.lesson.id, 7)]);
    expect(n).toMatchObject({ resume: true });
    expect(n!.entry.lesson.id).toBe(math[2]!.lesson.id);
  });
  it("after a finished lesson comes the next one in the same lab", () => {
    const n = nextLesson(lessonEntries, [P(math[0]!.lesson.id, 5, true), P(math[1]!.lesson.id, 8, true)]);
    expect(n).toMatchObject({ resume: false });
    expect(n!.entry.lesson.id).toBe(math[2]!.lesson.id);
  });
});

describe("the plan", () => {
  const now = new Date(2026, 10, 22, 10);
  const base = { entries: lessonEntries, progress: [], cardsDue: 4, mistakesDue: 0, daily: { id: "bdp", title: "Кең арна" }, now };
  it("three moves: retrieve, learn, stretch; ticked by today's activity", () => {
    let log: ActivityLog = { days: {} };
    expect(todayPlan({ ...base, activity: log }).map((x) => [x.id, x.done])).toEqual([["review", false], ["learn", false], ["stretch", false]]);
    log = addActivity(log, "review", now);
    log = addActivity(log, "problem", now);
    const plan = todayPlan({ ...base, activity: log });
    expect(plan.map((x) => x.done)).toEqual([true, false, true]);
    expect(plan[0]!.title).toBe("4 карточканы қайтала");
    expect(plan[2]!.href).toBe("/problems?p=bdp");
  });
  it("mistakes come before cards", () => {
    expect(todayPlan({ ...base, mistakesDue: 2, activity: { days: {} } })[0]).toMatchObject({ href: "/notebook", title: "2 қатені қайта шеш" });
  });
});

describe("the week, the heatmap, mastery", () => {
  it("weeks start on Monday; active days count up to today", () => {
    const sun = new Date(2026, 10, 22);
    expect(weekStart(sun).getDate()).toBe(16);
    let log: ActivityLog = { days: {} };
    for (const d of [15, 16, 18, 18, 22]) log = addActivity(log, "lesson", new Date(2026, 10, d));
    expect(activeThisWeek(log, sun)).toBe(3);
    const h = heatmap(log, sun, 4);
    expect(h).toHaveLength(4);
    expect(h.every((c) => c.length === 7)).toBe(true);
    const cells = h.flat();
    expect(cells.find((c) => c.key === "2026-11-18")).toMatchObject({ total: 2, level: 1 });
    expect(cells.at(-1)).toMatchObject({ key: "2026-11-22", future: false });
  });
  it("sanitises a stored log", () => {
    expect(sanitizeActivity({ days: { "2026-11-22": { lesson: 2, review: -1, x: 3 }, bad: { lesson: 1 } } })).toEqual({ days: { "2026-11-22": { lesson: 2 } } });
    expect(sanitizeActivity("junk")).toEqual({ days: {} });
  });
  it("mastery per lab, with first-time accuracy", () => {
    const m = mastery(lessonEntries, [P(math[0]!.lesson.id, 1, true, { answers: { a: ["q1", "q2", "q3"] }, misses: { a: ["q3"] } })]);
    const mm = m.find((x) => x.labId === "math")!;
    expect(mm).toMatchObject({ done: 1, total: math.length });
    expect(mm.accuracy).toBeCloseTo(2 / 3, 9);
    expect(m.length).toBe(11);
  });
});
