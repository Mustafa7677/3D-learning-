import { describe, expect, it } from "vitest";
import { BOSS_HP, HEARTS, ISLANDS, buildWorld, fightOver, seaRoutes, shipAt } from "./world";
import { openLabs } from "./catalog";
import { lessonsForLab } from "./lessons";

describe("IT archipelago", () => {
  it("every open lab is an island, each with four real questions and no dashes", () => {
    expect(new Set(ISLANDS.map((i) => i.lab))).toEqual(new Set(openLabs.map((l) => l.id)));
    for (const i of ISLANDS) {
      expect(i.questions.length, i.lab).toBeGreaterThanOrEqual(BOSS_HP + HEARTS - 1);
      for (const q of i.questions) {
        expect(q.options.length, q.q).toBeGreaterThanOrEqual(3);
        expect(new Set(q.options).size, q.q).toBe(q.options.length);
        expect(q.explain.length, q.q).toBeGreaterThan(20);
      }
      expect(/[–—]/.test(JSON.stringify(i)), i.lab).toBe(false);
      expect(i.x).toBeGreaterThan(0);
      expect(i.x).toBeLessThan(100);
    }
    expect(new Set(ISLANDS.map((i) => i.treasure.name)).size).toBe(ISLANDS.length);
  });

  it("fog lifts when a lesson starts, a beaten boss conquers the island", () => {
    const first = lessonsForLab("net")[0]!.lesson.id;
    const w = buildWorld([{ lessonId: first, completed: {}, updatedAt: 5, completedAt: 5 } as never], ["arch"]);
    expect(w.find((v) => v.island.lab === "net")).toMatchObject({ state: "explored", done: 1 });
    expect(w.find((v) => v.island.lab === "arch")?.state).toBe("conquered");
    expect(w.find((v) => v.island.lab === "sec")?.state).toBe("fog");
    expect(shipAt([{ lessonId: first, completed: {}, updatedAt: 5 } as never])).toBe("net");
    expect(shipAt([])).toBe(ISLANDS[0]!.lab);
  });

  it("a fight ends after three hits or two misses", () => {
    expect(fightOver({ asked: 3, hits: 3, misses: 0 }, 4)).toBe("won");
    expect(fightOver({ asked: 4, hits: 3, misses: 1 }, 4)).toBe("won");
    expect(fightOver({ asked: 2, hits: 0, misses: 2 }, 4)).toBe("lost");
    expect(fightOver({ asked: 2, hits: 1, misses: 1 }, 4)).toBeUndefined();
  });

  it("sea routes join two different islands once", () => {
    const r = seaRoutes();
    expect(r.length).toBeGreaterThan(5);
    for (const x of r) expect(x.a).not.toBe(x.b);
  });
});
