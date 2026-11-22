import type { LessonProgress } from "@inside-tech/lesson-engine";
import { describe, expect, it } from "vitest";
import { lessonEntries } from "./lessons";
import { calibration, calibrationVerdict, drawTicket, questionPool } from "./ticket";

const opened = (id: string): LessonProgress => ({ lessonId: id, stepIndex: 0, completed: {}, startedAt: 0, updatedAt: 0 });

describe("exam ticket", () => {
  it("a new learner gets questions from the first lessons of every lab", () => {
    const pool = questionPool(lessonEntries, []);
    expect(new Set(pool.map((q) => q.labId)).size).toBe(10);
    expect(pool.every((q) => lessonEntries.find((e) => e.lesson.id === q.lessonId)!.lesson.order <= 2)).toBe(true);
  });
  it("otherwise only from opened lessons", () => {
    const pool = questionPool(lessonEntries, [opened("web-10-cache"), opened("sec-12-dh")]);
    expect(new Set(pool.map((q) => q.lessonId))).toEqual(new Set(["web-10-cache", "sec-12-dh"]));
  });
  it("interleaves: no two questions from the same lab in a row while others remain", () => {
    const t = drawTicket(questionPool(lessonEntries, []), 7, 8);
    expect(t).toHaveLength(8);
    for (let i = 1; i < t.length; i++) expect(t[i]!.labId).not.toBe(t[i - 1]!.labId);
    expect(drawTicket(questionPool(lessonEntries, []), 7, 8)).toEqual(t);
  });
  it("calibration: sure but wrong is overconfidence", () => {
    const a = [
      { confidence: 2 as const, correct: true },
      { confidence: 2 as const, correct: false },
      { confidence: 0 as const, correct: true },
    ];
    expect(calibration(a)[2]).toEqual({ total: 2, right: 1 });
    expect(calibrationVerdict(a)).toBe("over");
    expect(calibrationVerdict([{ confidence: 2, correct: true }, { confidence: 0, correct: false }])).toBe("good");
    expect(calibrationVerdict([{ confidence: 0, correct: true }, { confidence: 0, correct: true }])).toBe("under");
  });
});
