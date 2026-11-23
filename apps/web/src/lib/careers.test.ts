import { describe, expect, it } from "vitest";
import { CAREERS, QUIZ, maxScore, rank, readiness } from "./careers";
import { lessonEntries } from "./lessons";

describe("careers", () => {
  it("eight professions, each with a day, tools and a road of eight real lessons", () => {
    expect(CAREERS).toHaveLength(8);
    const ids = new Set(lessonEntries.map((e) => e.lesson.id));
    for (const c of CAREERS) {
      expect(c.road, c.id).toHaveLength(8);
      for (const id of c.road) expect(ids.has(id), `${c.id}: ${id}`).toBe(true);
      expect(new Set(c.road).size, c.id).toBe(8);
      expect(c.day.length, c.id).toBeGreaterThanOrEqual(4);
      expect(c.tools.length, c.id).toBeGreaterThanOrEqual(4);
    }
    expect(/[–—]/.test(JSON.stringify([CAREERS, QUIZ]))).toBe(false);
  });

  it("every career can be reached by the test, and every question has four answers", () => {
    for (const q of QUIZ) expect(q.options, q.q).toHaveLength(4);
    for (const c of CAREERS) expect(maxScore(c.id), c.id).toBeGreaterThan(4);
  });

  it("answering for a career puts it on top at 100%", () => {
    for (const c of CAREERS) {
      const best = QUIZ.map((q) => {
        let k = 0;
        q.options.forEach((o, i) => {
          if ((o.adds[c.id] ?? 0) > (q.options[k]!.adds[c.id] ?? 0)) k = i;
        });
        return k;
      });
      const r = rank(best);
      expect(r.find((x) => x.id === c.id)!.percent, c.id).toBe(100);
      expect(r[0]!.percent).toBe(100);
    }
  });

  it("readiness counts finished lessons of the road and names the next", () => {
    const c = CAREERS[0]!;
    const done = c.road.slice(0, 2).map((id) => ({ lessonId: id, completed: {}, updatedAt: 1, completedAt: 1 }));
    const r = readiness(c, done as never);
    expect(r.percent).toBe(25);
    expect(r.next).toBe(c.road[2]);
    expect(readiness(c, []).percent).toBe(0);
  });
});
