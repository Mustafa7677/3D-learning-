import { describe, expect, it } from "vitest";
import type { LessonProgress } from "@inside-tech/lesson-engine";
import { BRIDGES, buildSky, checkBridges } from "./sky";
import { lessonEntries, lessonsForLab } from "./lessons";

const p = (lessonId: string, o: Partial<LessonProgress> = {}): LessonProgress => ({ lessonId, stepIndex: 0, completed: {}, startedAt: 1, updatedAt: 1, ...o });

describe("the sky of knowledge", () => {
  it("every lesson is one star, every lab one constellation", () => {
    const sky = buildSky([]);
    expect(sky.constellations).toHaveLength(11);
    expect(sky.constellations.reduce((n, c) => n + c.stars.length, 0)).toBe(lessonEntries.length);
  });

  it("is the same sky every time", () => {
    expect(buildSky([]).constellations[3]!.stars[2]!.pos).toEqual(buildSky([]).constellations[3]!.stars[2]!.pos);
  });

  it("stars do not sit on top of each other", () => {
    const stars = buildSky([]).constellations.flatMap((c) => c.stars);
    for (let i = 0; i < stars.length; i++)
      for (let j = i + 1; j < stars.length; j++) {
        const [a, b] = [stars[i]!.pos, stars[j]!.pos];
        expect(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]), `${stars[i]!.id} / ${stars[j]!.id}`).toBeGreaterThan(0.3);
      }
  });

  it("bridges join real lessons in different labs", () => {
    expect(checkBridges()).toEqual([]);
    expect(buildSky([]).bridges).toHaveLength(BRIDGES.length);
  });

  it("an empty sky points the North Star at the very first lesson", () => {
    expect(buildSky([]).north?.id).toBe(lessonEntries[0]!.lesson.id);
  });

  it("done stars shine, begun ones flicker, and the North Star is the lesson you left last", () => {
    const sec = lessonsForLab("sec");
    const sky = buildSky([p(sec[0]!.lesson.id, { completedAt: 5, updatedAt: 5 }), p(sec[1]!.lesson.id, { updatedAt: 9 }), p("ai-1-data", { updatedAt: 3 })]);
    const s = sky.constellations.find((c) => c.lab === "sec")!;
    expect(s.stars[0]!.state).toBe("done");
    expect(s.stars[1]!.state).toBe("started");
    expect(s.done).toBe(1);
    expect(sky.north?.id).toBe(sec[1]!.lesson.id);
  });

  it("with nothing open, the North Star is the next lesson of a lab you began", () => {
    const db = lessonsForLab("db");
    const sky = buildSky([p(db[0]!.lesson.id, { completedAt: 5, updatedAt: 5 })]);
    expect(sky.north?.id).toBe(db[1]!.lesson.id);
  });
});
