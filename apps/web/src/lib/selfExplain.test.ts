import { MIN_EXPLANATION, coverage } from "@inside-tech/lesson-engine";
import { describe, expect, it } from "vitest";
import { lessonEntries } from "./lessons";

const all = lessonEntries.flatMap((e) => e.lesson.steps.filter((s) => s.selfExplain).map((s) => ({ id: `${e.lesson.id}/${s.id}`, se: s.selfExplain! })));

describe("self-explanation content", () => {
  it("every Middle 14 lesson asks for one", () => {
    const lessons = new Set(all.map((x) => x.id.split("/")[0]));
    expect(lessons.size).toBeGreaterThanOrEqual(10);
  });
  for (const { id, se } of all)
    it(`${id}: the expert's text covers every idea; a vague answer does not`, () => {
      expect(coverage(se, se.model).missing, id).toEqual([]);
      expect(se.concepts.length).toBeGreaterThanOrEqual(2);
      expect(coverage(se, "Білмеймін, бірдеңе болды да, нәтиже өзгерді.").share, id).toBeLessThan(0.5);
      expect(se.model.length).toBeGreaterThan(MIN_EXPLANATION);
      expect(/[–—]/.test(se.prompt + se.model + se.concepts.map((c) => c.label).join(""))).toBe(false);
    });
});
