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
