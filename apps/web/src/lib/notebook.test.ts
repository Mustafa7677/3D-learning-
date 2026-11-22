import type { LessonProgress } from "@inside-tech/lesson-engine";
import { describe, expect, it } from "vitest";
import { lessonEntries } from "./lessons";
import { collectMistakes, dueMistakes, gradeMistake, mastered, sanitizeReview, schedule } from "./notebook";

const web10 = lessonEntries.find((e) => e.lesson.id === "web-10-cache")!;
const step = web10.lesson.steps[0]!;
const base = (p: Partial<LessonProgress>): LessonProgress => ({ lessonId: "web-10-cache", stepIndex: 0, completed: {}, startedAt: 0, updatedAt: 0, ...p });

describe("mistakes notebook", () => {
  it("collects missed questions and disproved predictions, but not unrevealed ones", () => {
    const wrongPick = step.predict!.answer === 0 ? 1 : 0;
    const q = step.quiz![0]!;
    const unrevealed = collectMistakes(lessonEntries, [base({ predictions: { [step.id]: wrongPick }, misses: { [step.id]: [q.id] } })]);
    expect(unrevealed.map((m) => m.kind)).toEqual(["quiz"]);
    const done = step.objectives.map((o) => o.id);
    const revealed = collectMistakes(lessonEntries, [base({ completed: { [step.id]: done }, predictions: { [step.id]: wrongPick }, misses: { [step.id]: [q.id] } })]);
    expect(revealed.map((m) => m.kind)).toEqual(["predict", "quiz"]);
    expect(revealed[0]).toMatchObject({ labId: "web", chosen: wrongPick, answer: step.predict!.answer });
    // A right prediction is not a mistake.
    expect(collectMistakes(lessonEntries, [base({ completed: { [step.id]: done }, predictions: { [step.id]: step.predict!.answer } })])).toEqual([]);
  });

  it("Leitner: right moves up a box, wrong goes back; five boxes means mastered", () => {
    const ms = collectMistakes(lessonEntries, [base({ misses: { [step.id]: [step.quiz![0]!.id] } })]);
    const key = ms[0]!.key;
    let r = schedule({}, ms, 0);
    expect(dueMistakes(r, ms, 0)).toHaveLength(1);
    r = gradeMistake(r, key, true, 0);
    expect(r[key]).toEqual({ box: 2, due: 86_400_000 });
    expect(dueMistakes(r, ms, 0)).toHaveLength(0);
    expect(dueMistakes(r, ms, 86_400_000)).toHaveLength(1);
    r = gradeMistake(r, key, true, 0);
    expect(r[key]!.box).toBe(3);
    r = gradeMistake(r, key, false, 0);
    expect(r[key]).toEqual({ box: 1, due: 0 });
    for (let i = 0; i < 4; i++) r = gradeMistake(r, key, true, 1e15);
    expect(mastered(r, ms)).toBe(1);
    expect(dueMistakes(r, ms, 1e16)).toHaveLength(0);
  });

  it("rejects broken saved data", () => {
    expect(sanitizeReview({ a: { box: 9, due: 0 }, b: { box: 2, due: 5 }, c: null })).toEqual({ b: { box: 2, due: 5 } });
    expect(sanitizeReview("x")).toEqual({});
  });
});
