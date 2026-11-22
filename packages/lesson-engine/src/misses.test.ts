import { describe, expect, it } from "vitest";
import { LessonEngine } from "./engine";
import type { LessonDefinition } from "./lesson";

const lesson: LessonDefinition<object> = {
  id: "m",
  labId: "x",
  order: 1,
  title: "M",
  summary: "",
  estimatedMinutes: 1,
  steps: [
    {
      id: "a",
      title: "A",
      body: "",
      objectives: [{ id: "x", text: "x", check: () => true }],
      quiz: [{ id: "q", question: "2 + 2?", options: ["3", "4", "5"], answer: 1, explain: "Екі мен екі: төрт." }],
    },
  ],
};

describe("mistakes notebook", () => {
  it("a wrong answer is remembered once, even after the right one", () => {
    const e = new LessonEngine(lesson);
    expect(e.answer("q", 0).correct).toBe(false);
    expect(e.answer("q", 2).correct).toBe(false);
    expect(e.answer("q", 1).correct).toBe(true);
    expect(e.getProgress().misses).toEqual({ a: ["q"] });
    expect(e.getProgress().answers).toEqual({ a: ["q"] });
  });
  it("a right first answer leaves no miss", () => {
    const e = new LessonEngine(lesson);
    e.answer("q", 1);
    expect(e.getProgress().misses).toBeUndefined();
  });
});
