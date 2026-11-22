import { describe, expect, it } from "vitest";
import { findLab } from "./catalog";
import { PARSONS, check, hint, orders, score, shuffled } from "./parsons";

const DASH = /[–—]/;

describe("Parsons problems", () => {
  it("one puzzle per lab, every lab real, no long dashes in the text", () => {
    expect(new Set(PARSONS.map((p) => p.labId)).size).toBe(10);
    for (const p of PARSONS) {
      expect(findLab(p.labId), p.id).toBeDefined();
      const all = [p.title, p.task, p.explain, ...p.lines, ...p.distractors.flatMap((d) => [d.text, d.why])].join(" ");
      expect(DASH.test(all), p.id).toBe(false);
      for (const o of orders(p)) expect([...o].sort((a, b) => a - b)).toEqual(p.lines.map((_, i) => i));
      // A distractor never duplicates a real line.
      for (const d of p.distractors) expect(p.lines).not.toContain(d.text);
    }
  });

  it("a shuffle holds every tile once and never starts solved", () => {
    for (const p of PARSONS)
      for (const seed of [1, 2, 3, 42]) {
        const t = shuffled(p, seed);
        expect(t).toHaveLength(p.lines.length + p.distractors.length);
        expect(check(p, t.filter((x) => x >= 0)).correct).toBe(false);
      }
  });

  it("checks: correct orders, alternatives, a distractor and the first wrong line", () => {
    const loop = PARSONS.find((p) => p.id === "train-loop")!;
    expect(check(loop, [0, 1, 2, 3, 4, 5, 6]).correct).toBe(true);
    expect(check(loop, [0, 1, 3, 4, 2, 5, 6]).correct).toBe(true);
    expect(check(loop, [0, 1, 3, 4, 5, 2, 6])).toMatchObject({ correct: false, prefix: 4 });
    const sql = PARSONS.find((p) => p.id === "sql-clauses")!;
    expect(check(sql, [0, 1, -1, 3, 4, 5, 6])).toMatchObject({ correct: false, prefix: 2, distractor: 0, missing: 1 });
  });

  it("a hint keeps the good prefix and places the next line; enough hints solve it", () => {
    const p = PARSONS.find((x) => x.id === "binary-search")!;
    let a = shuffled(p, 5).filter((t) => t >= 0);
    let n = 0;
    while (!check(p, a).correct && n < 20) {
      const before = check(p, a).prefix;
      a = hint(p, a);
      expect(check(p, a).prefix).toBeGreaterThan(before);
      n++;
    }
    expect(check(p, a).correct).toBe(true);
    expect(hint(p, [0, -1])).toEqual([0, 1]);
  });

  it("score: 3 for clean, at least 1", () => {
    expect(score(1, 0)).toBe(3);
    expect(score(2, 1)).toBe(1);
    expect(score(9, 9)).toBe(1);
  });
});
