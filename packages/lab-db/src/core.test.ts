import { describe, expect, it } from "vitest";
import { lostUpdate, newRace, runOp, type ClientId, type Op } from "./concurrency";
import { seedDb } from "./data";
import { assign, loads, movedFraction } from "./sharding";
import { execute, type Session } from "./sql";

const fresh = (): Session => ({ db: seedDb(), snapshot: null });
const q = (s: Session, sql: string) => execute(s, sql);

describe("SQL engine", () => {
  it("selects, filters, orders and limits", () => {
    const r = q(fresh(), "SELECT name FROM students WHERE city = 'Алматы' ORDER BY name").result;
    expect(r.ok).toBe(true);
    expect(r.rows.map((x) => x.name)).toEqual(["Айгерім", "Аружан", "Әсел"]);
    expect(q(fresh(), "SELECT name, year FROM students WHERE year >= 3 AND city != 'Астана' ORDER BY year DESC, name LIMIT 2").result.rows).toHaveLength(2);
  });

  it("joins three tables and aggregates per group", () => {
    const s = fresh();
    const j = q(s, "SELECT s.name, c.title FROM enrollments e JOIN students s ON e.student_id = s.id JOIN courses c ON e.course_id = c.id WHERE c.title = 'Алгоритмдер' ORDER BY s.name").result;
    expect(j.ok).toBe(true);
    expect(j.rows.length).toBeGreaterThan(3);
    expect(j.plan.map((p) => p.access)).toEqual(["scan", "index", "index"]);
    const g = q(s, "SELECT c.title, COUNT(*) AS n, AVG(e.grade) AS avg FROM enrollments e JOIN courses c ON e.course_id = c.id GROUP BY c.title ORDER BY n DESC").result;
    expect(g.ok).toBe(true);
    expect(g.rows).toHaveLength(4);
    const total = q(s, "SELECT COUNT(*) AS n FROM enrollments").result.rows[0]!.n;
    expect(g.rows.reduce((t, r) => t + Number(r.n), 0)).toBe(total);
  });

  it("rejects ambiguous columns and non-grouped columns", () => {
    expect(q(fresh(), "SELECT id FROM students s JOIN enrollments e ON e.student_id = s.id").result.ok).toBe(true); // only students has id
    expect(q(fresh(), "SELECT id FROM students s JOIN courses c ON c.id = s.id").result.error).toMatch(/бірнеше кестеде/);
    expect(q(fresh(), "SELECT city, name, COUNT(*) FROM students GROUP BY city").result.error).toMatch(/GROUP BY/);
  });

  it("an index turns a scan of 5000 rows into a lookup", () => {
    const s = fresh();
    const before = q(s, "SELECT * FROM events WHERE user_id = 42").result;
    expect(before.examined).toBe(5000);
    const s2 = q(s, "CREATE INDEX ON events (user_id)").session;
    const after = q(s2, "SELECT * FROM events WHERE user_id = 42").result;
    expect(after.rows).toEqual(before.rows);
    expect(after.examined).toBeLessThan(30);
    expect(q(s2, "EXPLAIN SELECT * FROM events WHERE user_id = 42").result.plan[0]).toMatchObject({ access: "index", column: "user_id" });
  });

  it("enforces primary keys, NOT NULL and foreign keys", () => {
    const s = fresh();
    expect(q(s, "INSERT INTO students (id, name) VALUES (1, 'Қайталау')").result.error).toMatch(/PRIMARY KEY/);
    expect(q(s, "INSERT INTO students (id, name) VALUES (99, NULL)").result.error).toMatch(/NOT NULL/);
    expect(q(s, "INSERT INTO enrollments (student_id, course_id, grade) VALUES (99, 1, 90)").result.error).toMatch(/FOREIGN KEY/);
    expect(q(s, "DELETE FROM courses WHERE id = 1").result.error).toMatch(/FOREIGN KEY/);
    expect(q(s, "INSERT INTO students (id, name, city, year) VALUES (13, 'Жаңа', 'Тараз', 1)").result.ok).toBe(true);
  });

  it("transactions commit atomically or roll back completely", () => {
    let s = fresh();
    const total = (x: Session) => q(x, "SELECT SUM(balance) AS t FROM accounts").result.rows[0]!.t;
    s = q(s, "BEGIN").session;
    s = q(s, "UPDATE accounts SET balance = balance - 300 WHERE id = 1").session;
    expect(total(s)).toBe(1400);
    s = q(s, "ROLLBACK").session;
    expect(total(s)).toBe(1700);
    s = q(s, "BEGIN").session;
    s = q(s, "UPDATE accounts SET balance = balance - 300 WHERE id = 1").session;
    s = q(s, "UPDATE accounts SET balance = balance + 300 WHERE id = 3").session;
    s = q(s, "COMMIT").session;
    expect(total(s)).toBe(1700);
    expect(q(s, "SELECT balance FROM accounts WHERE id = 3").result.rows[0]!.balance).toBe(500);
    expect(q(s, "COMMIT").result.error).toMatch(/транзакция жоқ/);
  });

  it("explains its parse errors", () => {
    expect(q(fresh(), "SELEC * FROM students").result.ok).toBe(false);
    expect(q(fresh(), "SELECT * FROM nope").result.error).toMatch(/кестесі жоқ/);
    expect(q(fresh(), "SELECT name FROM students WHERE name = 'аш").result.error).toMatch(/Тырнақша/);
  });
});

describe("concurrency", () => {
  const run = (locking: boolean, schedule: [ClientId, Op][]) => schedule.reduce((r, [c, op]) => runOp(r, c, op), newRace(locking));
  it("the classic interleaving loses an update without locks", () => {
    const r = run(false, [["A", "read"], ["B", "read"], ["A", "write"], ["B", "write"]]);
    expect(r.balance).toBe(600);
    expect(lostUpdate(r)).toBe(true);
  });
  it("with FOR UPDATE the second reader waits, and the result is correct", () => {
    const r = run(true, [["A", "read"], ["B", "read"], ["A", "write"], ["B", "read"], ["B", "write"]]);
    expect(r.log.some((l) => l.includes("күтеді"))).toBe(true);
    expect(r.balance).toBe(700);
    expect(lostUpdate(r)).toBe(false);
  });
});

describe("sharding", () => {
  it("both methods balance load; consistent hashing moves far fewer keys", () => {
    for (const m of ["mod", "consistent"] as const) {
      const l = loads(assign(m, 4), 4);
      expect(Math.min(...l)).toBeGreaterThan(150);
    }
    const mod = movedFraction(assign("mod", 4), assign("mod", 5));
    const con = movedFraction(assign("consistent", 4), assign("consistent", 5));
    expect(mod).toBeGreaterThan(0.7);
    expect(con).toBeLessThan(0.3);
  });
});
