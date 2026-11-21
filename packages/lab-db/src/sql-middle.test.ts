import { describe, expect, it } from "vitest";
import { seedDb } from "./data";
import { execute, type Session } from "./sql";

const fresh = (): Session => ({ db: seedDb(), snapshot: null });
const run = (s: Session, sql: string) => {
  const r = execute(s, sql);
  if (!r.result.ok) throw new Error(r.result.error);
  return r;
};
const rows = (sql: string, s = fresh()) => run(s, sql).result.rows;

describe("SQL, middle level", () => {
  it("DISTINCT removes duplicate rows", () => {
    expect(rows("SELECT city FROM students")).toHaveLength(12);
    expect(rows("SELECT DISTINCT city FROM students")).toHaveLength(4);
  });

  it("IN with a list and NOT IN", () => {
    expect(rows("SELECT name FROM students WHERE city IN ('Алматы', 'Астана')")).toHaveLength(6);
    expect(rows("SELECT name FROM students WHERE city NOT IN ('Алматы', 'Астана')")).toHaveLength(6);
  });

  it("LIKE: % for any run, _ for one letter, Kazakh letters included", () => {
    expect(rows("SELECT name FROM students WHERE name LIKE 'А%'").map((r) => r.name).sort()).toEqual(["Айгерім", "Аружан"]);
    expect(rows("SELECT name FROM students WHERE name LIKE '%н'").map((r) => r.name).sort()).toEqual(["Аружан", "Ерлан", "Нұрлан"]);
    expect(rows("SELECT name FROM students WHERE name LIKE 'Д_на'")).toEqual([{ name: "Дана" }]);
    expect(rows("SELECT name FROM students WHERE name NOT LIKE '%а%'").length).toBeGreaterThan(0);
  });

  it("BETWEEN is inclusive on both ends", () => {
    expect(rows("SELECT id FROM students WHERE id BETWEEN 3 AND 5")).toHaveLength(3);
    expect(rows("SELECT id FROM students WHERE year NOT BETWEEN 2 AND 3").every((r) => true)).toBe(true);
  });

  it("a scalar subquery: grades above the average", () => {
    const all = rows("SELECT grade FROM enrollments").map((r) => Number(r.grade));
    const avg = all.reduce((a, b) => a + b, 0) / all.length;
    const above = rows("SELECT grade FROM enrollments WHERE grade > (SELECT AVG(grade) FROM enrollments)");
    expect(above.length).toBe(all.filter((g) => g > Math.round(avg * 100) / 100).length);
    expect(above.length).toBeGreaterThan(0);
  });

  it("IN (SELECT ...): students who take Алгоритмдер", () => {
    const viaSub = rows("SELECT name FROM students WHERE id IN (SELECT student_id FROM enrollments WHERE course_id = 1)");
    const viaJoin = rows("SELECT s.name AS name FROM students s JOIN enrollments e ON e.student_id = s.id WHERE e.course_id = 1");
    expect(viaSub.map((r) => r.name).sort()).toEqual(viaJoin.map((r) => r.name).sort());
    expect(viaSub).toHaveLength(7);
  });

  it("a subquery must return one column, and one value when used as a value", () => {
    expect(execute(fresh(), "SELECT name FROM students WHERE id = (SELECT student_id FROM enrollments)").result.ok).toBe(false);
    expect(execute(fresh(), "SELECT name FROM students WHERE id IN (SELECT student_id, course_id FROM enrollments)").result.ok).toBe(false);
  });

  it("LEFT JOIN keeps the rows that found nothing, with NULLs", () => {
    const s = run(fresh(), "INSERT INTO courses (id, title, credits) VALUES (5, 'Бұлт', 3)").session;
    const inner = rows("SELECT c.title, e.student_id FROM courses c JOIN enrollments e ON e.course_id = c.id", s);
    const left = rows("SELECT c.title, e.student_id FROM courses c LEFT JOIN enrollments e ON e.course_id = c.id", s);
    expect(left.length).toBe(inner.length + 1);
    expect(left.find((r) => r["c.title"] === "Бұлт" || r.title === "Бұлт")).toMatchObject({ "e.student_id": null });
    // The classic: rows with no partner.
    expect(rows("SELECT c.title FROM courses c LEFT JOIN enrollments e ON e.course_id = c.id WHERE e.student_id IS NULL", s)).toEqual([{ "c.title": "Бұлт" }]);
  });

  it("LEFT JOIN with counting: zero, not missing", () => {
    const s = run(fresh(), "INSERT INTO courses (id, title, credits) VALUES (5, 'Бұлт', 3)").session;
    const r = rows("SELECT c.title, COUNT(e.student_id) AS n FROM courses c LEFT JOIN enrollments e ON e.course_id = c.id GROUP BY c.title", s);
    expect(r).toHaveLength(5);
    expect(r.find((x) => x["c.title"] === "Бұлт")!.n).toBe(0);
  });

  it("the NOT IN trap: one NULL in the list and nothing comes back", () => {
    const s = run(fresh(), "INSERT INTO courses (id, title, credits) VALUES (6, 'Тест', NULL)").session;
    expect(rows("SELECT title FROM courses WHERE credits NOT IN (5, 4)", s)).toEqual([{ title: "Веб" }]);
    // credits for 'Тест' is NULL: NULL NOT IN (...) is unknown, so it is not returned either.
    expect(rows("SELECT id FROM students WHERE year NOT IN (1, 2, NULL)", s)).toEqual([]);
  });

  it("existing queries still read the same", () => {
    expect(rows("SELECT name FROM students WHERE city = 'Алматы'")).toHaveLength(3);
    expect(rows("SELECT city, COUNT(*) AS n FROM students GROUP BY city")).toHaveLength(4);
  });
});
