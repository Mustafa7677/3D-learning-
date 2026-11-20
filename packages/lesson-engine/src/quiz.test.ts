import { describe, expect, it } from "vitest";
import { LessonEngine, withContent, type LessonDefinition } from "./index";

type S = { n: number };
const A = { score: 0, metrics: {}, notes: [] };

const base: LessonDefinition<S> = {
  id: "q",
  labId: "t",
  order: 1,
  title: "Q",
  summary: "",
  estimatedMinutes: 1,
  steps: [
    { id: "a", title: "A", body: "old", objectives: [{ id: "n1", text: "n ≥ 1", check: (s) => s.n >= 1 }] },
    { id: "b", title: "B", body: "", objectives: [{ id: "n2", text: "n ≥ 2", check: (s) => s.n >= 2 }] },
  ],
};

const lesson = withContent(base, {
  a: {
    body: "## Идея\nЖаңа мәтін",
    quiz: [{ id: "q1", question: "2 + 2?", options: ["3", "4"], answer: 1, explain: "Себебі 2 + 2 = 4.", wrongHint: "Қайта санап көр." }],
  },
});

describe("concept checks", () => {
  it("a step needs both its objectives and correct answers", () => {
    const e = new LessonEngine(lesson);
    e.update({ n: 1 }, A);
    expect(e.isStepComplete()).toBe(false);
    expect(e.answer("q1", 0)).toEqual({ correct: false, feedback: "Қайта санап көр." });
    expect(e.view().quiz[0]).toMatchObject({ answered: false, explain: undefined });
    expect(e.answer("q1", 1)).toEqual({ correct: true, feedback: "Себебі 2 + 2 = 4." });
    expect(e.isStepComplete()).toBe(true);
    expect(e.view().quiz[0]).toMatchObject({ answered: true, explain: "Себебі 2 + 2 = 4." });
    expect(e.completion()).toBeCloseTo(2 / 3);
  });

  it("answers persist with progress and lock later steps until done", () => {
    const e = new LessonEngine(lesson);
    e.update({ n: 1 }, A);
    expect(e.goTo(1)).toBeUndefined();
    e.answer("q1", 1);
    const resumed = new LessonEngine(lesson, e.getProgress());
    expect(resumed.isStepComplete(0)).toBe(true);
    expect(resumed.advance()?.id).toBe("b");
  });

  it("the last answer can complete the lesson", () => {
    const one = withContent({ ...base, steps: [base.steps[0]!] }, { a: lesson.steps[0]! });
    const e = new LessonEngine(one);
    let done = 0;
    e.bus.on("lessonCompleted", () => done++);
    e.update({ n: 5 }, A);
    expect(done).toBe(0);
    e.answer("q1", 1);
    expect(done).toBe(1);
  });

  it("content for an unknown step is an error", () => {
    expect(() => withContent(base, { nope: { body: "x" } })).toThrow(/unknown step/);
  });
});
