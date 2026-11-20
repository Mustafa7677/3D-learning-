import { describe, expect, it } from "vitest";
import { KeyValueProgressStore, LessonEngine, MemoryProgressStore, type LessonDefinition } from "./index";

type S = { n: number; seen: boolean };
const A = { score: 0, metrics: {}, notes: [] };

const lesson: LessonDefinition<S> = {
  id: "l1",
  labId: "test",
  order: 1,
  title: "T",
  summary: "",
  estimatedMinutes: 1,
  steps: [
    {
      id: "s1",
      title: "one",
      body: "",
      objectives: [
        { id: "see", text: "see it", check: (s) => s.seen },
        { id: "n3", text: "n >= 3 (held)", check: (s) => s.n >= 3, sticky: false },
      ],
    },
    { id: "s2", title: "two", body: "", objectives: [{ id: "n5", text: "n>=5", check: (s) => s.n >= 5 }] },
  ],
};

describe("LessonEngine", () => {
  it("tracks sticky and non-sticky objectives and gates advance", () => {
    const e = new LessonEngine(lesson, undefined, () => 1);
    e.update({ n: 0, seen: true }, A);
    expect(e.view().objectives.map((o) => o.done)).toEqual([true, false]);
    expect(e.advance()).toBeUndefined();
    e.update({ n: 3, seen: false }, A);
    expect(e.isStepComplete()).toBe(true);
    e.update({ n: 1, seen: false }, A);
    expect(e.isStepComplete()).toBe(false); // non-sticky dropped
    e.update({ n: 4, seen: false }, A);
    expect(e.advance()?.id).toBe("s2");
  });

  it("completes the lesson once and emits events", () => {
    const e = new LessonEngine(lesson, undefined, () => 5);
    const events: string[] = [];
    e.bus.on("lessonCompleted", () => events.push("done"));
    e.update({ n: 9, seen: true }, A);
    e.advance();
    e.update({ n: 9, seen: true }, A);
    e.update({ n: 10, seen: true }, A);
    expect(events).toEqual(["done"]);
    expect(e.isLessonComplete()).toBe(true);
    expect(e.completion()).toBe(1);
  });

  it("resumes from saved progress and locks unreached steps", () => {
    const e = new LessonEngine(lesson);
    expect(e.goTo(1)).toBeUndefined();
    e.update({ n: 9, seen: true }, A);
    e.advance();
    const resumed = new LessonEngine(lesson, e.getProgress());
    expect(resumed.view().index).toBe(1);
    expect(resumed.goTo(0)?.id).toBe("s1");
  });

  it("swallows throwing checks", () => {
    const bad: LessonDefinition<S> = {
      ...lesson,
      steps: [{ id: "x", title: "", body: "", objectives: [{ id: "o", text: "", check: () => { throw new Error("x"); } }] }],
    };
    const e = new LessonEngine(bad);
    expect(() => e.update({ n: 0, seen: false }, A)).not.toThrow();
  });
});

describe("progress stores", () => {
  it("memory store round-trips", async () => {
    const s = new MemoryProgressStore();
    const p = new LessonEngine(lesson).getProgress();
    await s.save(p);
    expect(await s.load("l1")).toEqual(p);
  });
  it("key-value store round-trips and lists", async () => {
    const m = new Map<string, string>();
    const s = new KeyValueProgressStore({ getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) });
    const p = new LessonEngine(lesson).getProgress();
    await s.save(p);
    expect(await s.load("l1")).toEqual(p);
    expect(await s.list()).toHaveLength(1);
  });
});
