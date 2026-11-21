import { describe, expect, it } from "vitest";
import { LessonEngine } from "./engine";
import type { LessonDefinition } from "./lesson";

interface S {
  lit: boolean;
}
const lesson: LessonDefinition<S> = {
  id: "t",
  labId: "x",
  order: 1,
  title: "T",
  summary: "",
  estimatedMinutes: 1,
  steps: [
    {
      id: "a",
      title: "A",
      body: "",
      predict: { question: "Не болады?", options: ["Жанады", "Сөнеді"], answer: 0, explain: "Себебі ток бар." },
      objectives: [{ id: "on", text: "Жақ", check: (s) => s.lit }],
    },
    { id: "b", title: "B", body: "", objectives: [{ id: "x", text: "x", check: () => true }] },
  ],
};
const eval0 = { score: 0, metrics: {}, notes: [] };

describe("predict, observe, explain", () => {
  it("the answer stays hidden until the learner has predicted and seen it happen", () => {
    const e = new LessonEngine(lesson);
    expect(e.view().predict).toEqual({ question: "Не болады?", options: ["Жанады", "Сөнеді"], chosen: undefined, answer: undefined, explain: undefined });
    e.update({ lit: true }, eval0);
    // Observed but never predicted: still hidden, there is nothing to compare.
    expect(e.view().predict?.answer).toBeUndefined();
  });

  it("a committed guess is revealed after the experiment, right or wrong", () => {
    const e = new LessonEngine(lesson);
    expect(e.predict(1)).toBe(true);
    expect(e.view().predict).toMatchObject({ chosen: 1, answer: undefined });
    e.update({ lit: true }, eval0);
    expect(e.view().predict).toMatchObject({ chosen: 1, answer: 0, explain: "Себебі ток бар." });
  });

  it("the first choice stands, and bad options are refused", () => {
    const e = new LessonEngine(lesson);
    expect(e.predict(5)).toBe(false);
    expect(e.predict(0)).toBe(true);
    expect(e.predict(1)).toBe(false);
    expect(e.view().predict?.chosen).toBe(0);
  });

  it("predicting is never graded: completion and step completion ignore it", () => {
    const a = new LessonEngine(lesson);
    const b = new LessonEngine(lesson);
    b.predict(1);
    a.update({ lit: true }, eval0);
    b.update({ lit: true }, eval0);
    expect(a.completion()).toBe(b.completion());
    expect(a.isStepComplete()).toBe(true);
  });

  it("steps without a prediction have none, and the choice is saved in progress", () => {
    const e = new LessonEngine(lesson);
    e.predict(0);
    expect(e.getProgress().predictions).toEqual({ a: 0 });
    e.update({ lit: true }, eval0);
    e.advance();
    expect(e.view().predict).toBeUndefined();
  });
});
