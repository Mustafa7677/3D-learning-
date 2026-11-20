import { describe, expect, it } from "vitest";
import { LessonEngine, compileLesson, evaluateCondition, getPath, validateLessonSpec, type LessonSpec } from "./index";

const spec: LessonSpec = {
  format: "inside-tech/lesson@1",
  id: "my-gravity",
  labId: "game",
  kind: "game",
  title: "Ай гравитациясы",
  summary: "Доп Айда қалай секіреді?",
  estimatedMinutes: 5,
  steps: [
    {
      id: "drop",
      title: "Доп таста",
      body: "Үш доп таста.",
      onEnter: [{ type: "physics/clear" }],
      objectives: [
        { id: "three", text: "3 доп", when: { path: "stats.drops", op: ">=", value: 3 } },
        { id: "moon", text: "Ай", when: { any: [{ path: "stats.gravities", op: "includes", value: 1.6 }, { metric: "g", op: "<", value: 2 }] } },
      ],
    },
  ],
};

describe("lesson spec", () => {
  it("validates a good spec and reports problems in plain words", () => {
    expect(validateLessonSpec(spec, ["game"])).toEqual([]);
    const bad = { ...spec, id: "Bad Id", steps: [{ ...spec.steps[0]!, objectives: [{ id: "x", text: "", when: { path: "__proto__.x", op: "~", value: 1 } }] }] };
    const issues = validateLessonSpec(bad, ["game"]).map((i) => i.where);
    expect(issues).toEqual(expect.arrayContaining(["id", "steps[0].objectives[0].text", "steps[0].objectives[0].when"]));
    expect(validateLessonSpec({ ...spec, kind: "nope" }, ["game"]).map((i) => i.where)).toContain("kind");
    expect(validateLessonSpec(null)).toHaveLength(1);
  });

  it("paths never reach prototypes", () => {
    expect(getPath({ a: { b: [1, 2] } }, "a.b.1")).toBe(2);
    expect(getPath({}, "__proto__.polluted")).toBeUndefined();
    expect(getPath({}, "constructor")).toBeUndefined();
  });

  it("conditions combine with all/any over state and metrics", () => {
    const state = { stats: { drops: 3, gravities: [9.8, 1.6] } };
    expect(evaluateCondition({ all: [{ path: "stats.drops", op: ">=", value: 3 }, { path: "stats.gravities", op: "lengthAtLeast", value: 2 }] }, state, {})).toBe(true);
    expect(evaluateCondition({ metric: "testAcc", op: ">=", value: 0.9 }, state, { testAcc: 0.8 })).toBe(false);
    expect(evaluateCondition({ path: "stats.drops", op: ">", value: "2" }, state, {})).toBe(false);
  });

  it("compiles into a lesson the engine can run", () => {
    const lesson = compileLesson<{ stats: { drops: number; gravities: number[] } }, unknown>(spec);
    const e = new LessonEngine(lesson);
    const A = { score: 0, metrics: {}, notes: [] };
    e.update({ stats: { drops: 3, gravities: [] } }, A);
    expect(e.view().objectives.map((o) => o.done)).toEqual([true, false]);
    e.update({ stats: { drops: 3, gravities: [1.6] } }, A);
    expect(e.isLessonComplete()).toBe(true);
    expect(lesson.steps[0]!.onEnter).toEqual([{ type: "physics/clear" }]);
  });
});

describe("quiz and sharing", () => {
  const withQuiz = (quiz: unknown) => ({
    format: "inside-tech/lesson@1",
    id: "my-quiz",
    labId: "ai",
    kind: "classifier",
    title: "Сұрақтар",
    summary: "",
    estimatedMinutes: 5,
    steps: [{ id: "s1", title: "S", body: "Мәтін", objectives: [{ id: "o", text: "t", when: { path: "x", op: ">=", value: 1 } }], quiz }],
  });

  it("validates quiz questions", async () => {
    const { validateLessonSpec } = await import("./spec");
    const good = [{ id: "q1", question: "2+2?", options: ["3", "4"], answer: 1, explain: "Себебі 4." }];
    expect(validateLessonSpec(withQuiz(good))).toEqual([]);
    const issues = validateLessonSpec(withQuiz([{ id: "q1", question: "", options: ["бір"], answer: 3, explain: "" }]));
    expect(issues.map((i) => i.where)).toEqual(["steps[0].quiz[0].question", "steps[0].quiz[0].options", "steps[0].quiz[0].explain"]);
    expect(validateLessonSpec(withQuiz([{ ...good[0], answer: 2 }])).map((i) => i.where)).toEqual(["steps[0].quiz[0].answer"]);
  });

  it("compiled quizzes gate the step", async () => {
    const { compileLesson } = await import("./spec");
    const { LessonEngine } = await import("./engine");
    const spec = withQuiz([{ id: "q1", question: "2+2?", options: ["3", "4"], answer: 1, explain: "Себебі 4." }]) as never;
    const e = new LessonEngine(compileLesson<{ x: number }, never>(spec));
    e.update({ x: 2 }, { score: 0, metrics: {}, notes: [] });
    expect(e.isStepComplete()).toBe(false);
    expect(e.answer("q1", 1).correct).toBe(true);
    expect(e.isStepComplete()).toBe(true);
  });

  it("round-trips through a URL-safe string, including Kazakh text", async () => {
    const { encodeLessonSpec, decodeLessonSpec } = await import("./spec");
    const spec = withQuiz([{ id: "q1", question: "Әлем қандай? ңғүұқөһі", options: ["а", "ә"], answer: 1, explain: "Ә." }]) as never;
    const code = encodeLessonSpec(spec);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeLessonSpec(code)).toEqual(spec);
    expect(decodeLessonSpec("%%%")).toBeUndefined();
    expect(decodeLessonSpec(code.slice(0, 10))).toBeUndefined();
  });
});
