import { describe, expect, it } from "vitest";
import type { LessonProgress } from "@inside-tech/lesson-engine";
import { buildPassport, stampDate } from "./passport";
import { lessonsForLab } from "./lessons";

const p = (lessonId: string, o: Partial<LessonProgress> = {}): LessonProgress => ({ lessonId, stepIndex: 0, completed: {}, startedAt: 1, updatedAt: 1, ...o });
const id = (lab: string, i: number) => lessonsForLab(lab)[i]!.lesson.id;

describe("learning passport", () => {
  it("an empty passport shows nothing earned and points at the first lesson", () => {
    const pp = buildPassport([]);
    expect(pp.empty).toBe(true);
    expect(pp.resume).toBeUndefined();
    expect(pp.stamps).toBe(0);
    expect(pp.lessonsDone).toBe(0);
    expect(pp.labs).toHaveLength(10);
    expect(pp.first.href).toBe(`/labs/ai/${id("ai", 0)}`);
    expect(pp.lessonsTotal).toBe(pp.labs.reduce((n, l) => n + l.total, 0));
  });

  it("a lab gets its stamp from the first lesson finished there", () => {
    const pp = buildPassport([p(id("cloud", 7), { completedAt: 500, updatedAt: 500 }), p(id("cloud", 0), { completedAt: 200, updatedAt: 200 })]);
    const cloud = pp.labs.find((l) => l.id === "cloud")!;
    expect(cloud.done).toBe(2);
    expect(cloud.stamp?.lesson.id).toBe(id("cloud", 0));
    expect(cloud.stamp?.at).toBe(200);
    expect(cloud.next?.id).toBe(id("cloud", 1));
    expect(pp.stamps).toBe(1);
    expect(pp.labs.filter((l) => l.id !== "cloud").every((l) => !l.stamp && l.done === 0)).toBe(true);
    expect(pp.finished.map((f) => f.at)).toEqual([500, 200]);
  });

  it("resume is the most recent unfinished lesson, with its real step", () => {
    const pp = buildPassport([
      p(id("ai", 0), { stepIndex: 1, updatedAt: 100 }),
      p(id("sec", 1), { stepIndex: lessonsForLab("sec")[1]!.lesson.steps.length - 1, updatedAt: 300 }),
      p(id("net", 0), { completedAt: 400, updatedAt: 400 }),
    ]);
    expect(pp.resume?.lesson.id).toBe(id("sec", 1));
    expect(pp.resume?.step).toBe(lessonsForLab("sec")[1]!.lesson.steps.length);
    expect(pp.resume?.steps).toBe(lessonsForLab("sec")[1]!.lesson.steps.length);
    expect(pp.labs.find((l) => l.id === "ai")!.next).toMatchObject({ id: id("ai", 0), started: true });
  });

  it("finished lessons do not count as a place to resume", () => {
    expect(buildPassport([p(id("db", 0), { completedAt: 9, updatedAt: 9 })]).resume).toBeUndefined();
  });

  it("progress on unknown lessons is ignored, not invented", () => {
    const pp = buildPassport([p("custom-1234", { completedAt: 5, updatedAt: 5 })]);
    expect(pp.empty).toBe(true);
    expect(pp.lessonsDone).toBe(0);
    expect(pp.stamps).toBe(0);
  });

  it("formats stamp dates without locale data", () => {
    expect(stampDate(new Date(2026, 10, 21).getTime())).toBe("21.11.2026");
  });
});
