import { describe, expect, it } from "vitest";
import { lessonEntries } from "./lessons";
import { optionOrder } from "./shuffle";

describe("option order", () => {
  it("is a stable permutation", () => {
    const a = optionOrder("Сұрақ?", 4);
    expect([...a].sort()).toEqual([0, 1, 2, 3]);
    expect(optionOrder("Сұрақ?", 4)).toEqual(a);
  });

  it("spreads the correct option over the places across the real course", () => {
    const places = [0, 0, 0];
    let n = 0;
    for (const { lesson } of lessonEntries) {
      for (const s of lesson.steps) {
        const qs = [...(s.quiz ?? []), ...(s.predict ? [{ question: s.predict.question, options: s.predict.options, answer: s.predict.answer }] : [])];
        for (const q of qs) {
          if (q.options.length !== 3) continue;
          places[optionOrder(q.question, 3).indexOf(q.answer)]! += 1;
          n += 1;
        }
      }
    }
    expect(n).toBeGreaterThan(500);
    // Each of three places holds the right answer in roughly a third of the questions.
    for (const p of places) expect(p / n).toBeGreaterThan(0.28);
  });
});
