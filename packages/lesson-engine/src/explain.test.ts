import { describe, expect, it } from "vitest";
import { LessonEngine } from "./engine";
import { coverage, type SelfExplain } from "./explain";
import type { LessonDefinition } from "./lesson";

const se: SelfExplain = {
  prompt: "Неге OFFSET баяу?",
  concepts: [
    { label: "өткізілген жолдар да оқылады", words: ["оқиды", "оқылады", "санап"] },
    { label: "индекс мәнге секіреді", words: ["секір", "индекс"] },
  ],
  model: "OFFSET орынмен санайды...",
};

describe("self-explanation", () => {
  it("finds ideas by stem, whatever the ending or the case", () => {
    expect(coverage(se, "Дерекқор 4980 жолды САНАП өтеді")).toEqual({ found: ["өткізілген жолдар да оқылады"], missing: ["индекс мәнге секіреді"], share: 0.5 });
    expect(coverage(se, "индекстен мәнге секіреді, ал offset бәрін оқиды").share).toBe(1);
  });

  it("opens after the experiment, keeps the learner's text, then shows the model", () => {
    type S = { done: boolean };
    const lesson: LessonDefinition<S> = { id: "x", labId: "db", order: 1, title: "X", summary: "", estimatedMinutes: 1, steps: [{ id: "a", title: "A", body: "", objectives: [{ id: "o", text: "o", check: (s) => s.done }], selfExplain: se }] };
    const e = new LessonEngine(lesson);
    expect(e.view().selfExplain).toEqual({ prompt: se.prompt, open: false });
    expect(e.explainSelf("дерекқор бәрін санап өтеді, сондықтан баяу")).toBe(false);
    e.update({ done: true }, { score: 0, metrics: {}, notes: [] });
    expect(e.explainSelf("қысқа")).toBe(false);
    expect(e.explainSelf("дерекқор бәрін санап өтеді, сондықтан баяу")).toBe(true);
    const v = e.view().selfExplain!;
    expect(v).toMatchObject({ open: true, written: "дерекқор бәрін санап өтеді, сондықтан баяу", model: se.model });
    expect(v.coverage!.missing).toEqual(["индекс мәнге секіреді"]);
    expect(e.getProgress().explanations).toEqual({ a: "дерекқор бәрін санап өтеді, сондықтан баяу" });
  });
});
