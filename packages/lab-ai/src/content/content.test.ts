import { describe, expect, it } from "vitest";
import { aiLessons, languageLessons } from "../index";

/** Every step teaches (enough text) and checks understanding (valid questions). */
describe("AI lab lesson content", () => {
  for (const lesson of [...aiLessons, ...languageLessons]) {
    for (const step of lesson.steps) {
      it(`${lesson.id}/${step.id}`, () => {
        expect(step.body.length, "lecture text").toBeGreaterThan(600);
        expect(step.body).toMatch(/## /);
        expect(step.quiz?.length ?? 0, "concept checks").toBeGreaterThanOrEqual(2);
        const ids = new Set<string>();
        for (const q of step.quiz ?? []) {
          expect(ids.has(q.id), `duplicate question id ${q.id}`).toBe(false);
          ids.add(q.id);
          expect(q.options.length).toBeGreaterThanOrEqual(3);
          expect(new Set(q.options).size, "options are distinct").toBe(q.options.length);
          expect(q.answer).toBeGreaterThanOrEqual(0);
          expect(q.answer).toBeLessThan(q.options.length);
          expect(q.explain.length).toBeGreaterThan(20);
        }
      });
    }
  }
});

import { aiDeepDives } from "./deep";

describe("deep dives", () => {
  it("are well-formed collapsible sections", () => {
    let n = 0;
    for (const [lessonId, dives] of Object.entries(aiDeepDives)) {
      for (const [stepId, text] of Object.entries(dives)) {
        n++;
        const heads = text.split("\n").filter((l) => /^##+ /.test(l));
        expect(heads, `${lessonId}/${stepId}`).toHaveLength(1);
        expect(heads[0]).toMatch(/^## Тереңірек: /);
        expect(text.length).toBeGreaterThan(500);
        expect((text.match(/```/g) ?? []).length % 2, "balanced code fences").toBe(0);
      }
    }
    expect(n).toBeGreaterThanOrEqual(14);
  });
});
