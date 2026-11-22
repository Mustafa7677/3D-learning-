import { SimulationRuntime } from "@inside-tech/sim-core";
import { describe, expect, it } from "vitest";
import { dbLabPlugin, dbLessons, type DbLabState } from "./index";

const after = (...sqls: string[]) => {
  const rt = new SimulationRuntime(dbLabPlugin, 1);
  for (const text of sqls) {
    rt.dispatch({ type: "sql/text", text });
    rt.dispatch({ type: "sql/run" });
  }
  return rt.getState() as DbLabState;
};
const objective = (lesson: string, step: string, id: string) => dbLessons.find((l) => l.id === lesson)!.steps.find((s) => s.id === step)!.objectives.find((o) => o.id === id)!;
const passes = (o: ReturnType<typeof objective>, st: DbLabState) => o.check(st, { assessment: dbLabPlugin.evaluate(st) });

describe("middle objectives cannot be gamed", () => {
  it("the average must come from a subquery, not from the screen", () => {
    const o = objective("db-11-subqueries", "scalar", "above");
    expect(passes(o, after("SELECT student_id, course_id, grade FROM enrollments WHERE grade > 84.89"))).toBe(false);
    expect(passes(o, after("SELECT student_id, course_id, grade FROM enrollments WHERE grade > (SELECT AVG(grade) FROM enrollments)"))).toBe(true);
  });

  it("all courses need LEFT JOIN: an inner join misses the empty course", () => {
    const o = objective("db-10-left-join", "orphans", "all");
    const setup = ["INSERT INTO courses (id, title, credits) VALUES (5, 'Бұлт', 3)"];
    expect(passes(o, after(...setup, "SELECT c.title, e.student_id FROM courses c JOIN enrollments e ON e.course_id = c.id"))).toBe(false);
    expect(passes(o, after(...setup, "SELECT c.title, e.student_id FROM courses c LEFT JOIN enrollments e ON e.course_id = c.id"))).toBe(true);
  });

  it("counting with COUNT(*) gives the empty course 1, which is wrong", () => {
    const o = objective("db-10-left-join", "zero", "count");
    const setup = ["INSERT INTO courses (id, title, credits) VALUES (5, 'Бұлт', 3)"];
    expect(passes(o, after(...setup, "SELECT c.title, COUNT(*) AS n FROM courses c LEFT JOIN enrollments e ON e.course_id = c.id GROUP BY c.title"))).toBe(false);
  });

  it("the middle lessons come after the problem set, in order", () => {
    expect(dbLessons.map((l) => l.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  });
});
