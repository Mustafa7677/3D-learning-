import { describe, expect, it } from "vitest";
import { webLessons } from "./index";

describe("web lab lesson content", () => {
  for (const lesson of webLessons) {
    for (const step of lesson.steps) {
      it(`${lesson.id}/${step.id}`, () => {
        expect(step.body.length, "lecture text").toBeGreaterThan(600);
        expect(step.body).toMatch(/## /);
        expect(step.quiz?.length ?? 0).toBeGreaterThanOrEqual(2);
        for (const q of step.quiz ?? []) {
          expect(q.options.length).toBeGreaterThanOrEqual(3);
          expect(new Set(q.options).size).toBe(q.options.length);
          expect(q.answer).toBeGreaterThanOrEqual(0);
          expect(q.answer).toBeLessThan(q.options.length);
          expect(q.explain.length).toBeGreaterThan(20);
        }
      });
    }
  }
});

import { webDeepDives } from "./deep";

describe("deep dives", () => {
  it("are well-formed collapsible sections", () => {
    let n = 0;
    for (const [lessonId, dives] of Object.entries(webDeepDives)) {
      for (const [stepId, text] of Object.entries(dives)) {
        n++;
        const heads = text.split("\n").filter((l) => /^##+ /.test(l));
        expect(heads, `${lessonId}/${stepId}`).toHaveLength(1);
        expect(heads[0]).toMatch(/^## Тереңірек: /);
        expect(text.length).toBeGreaterThan(500);
        expect((text.match(/```/g) ?? []).length % 2, "balanced code fences").toBe(0);
      }
    }
    expect(n).toBeGreaterThanOrEqual(10);
  });
});
