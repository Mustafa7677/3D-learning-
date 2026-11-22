import { LessonEngine } from "@inside-tech/lesson-engine";
import { SimulationRuntime, replay } from "@inside-tech/sim-core";
import { describe, expect, it } from "vitest";
import { dbDeepDives } from "./deep";
import { dbLabPlugin, dbLessons, splitStatements, topThree, type DbLabAction, type DbLabState } from "./index";

describe("databases lab content", () => {
  for (const lesson of dbLessons)
    for (const step of lesson.steps)
      it(`${lesson.id}/${step.id}`, () => {
        expect(step.body.length, "lecture text").toBeGreaterThan(600);
        expect(step.body).toMatch(/## /);
        expect(step.quiz?.length ?? 0).toBeGreaterThanOrEqual(2);
        for (const q of step.quiz ?? []) {
          expect(q.options.length).toBeGreaterThanOrEqual(3);
          expect(new Set(q.options).size).toBe(q.options.length);
          expect(q.answer).toBeLessThan(q.options.length);
          expect(q.explain.length).toBeGreaterThan(20);
        }
      });
  it("deep dives are well-formed", () => {
    let n = 0;
    for (const dives of Object.values(dbDeepDives))
      for (const text of Object.values(dives)) {
        n++;
        expect(text.split("\n").filter((l) => /^##+ /.test(l))).toHaveLength(1);
        expect((text.match(/```/g) ?? []).length % 2).toBe(0);
      }
    expect(n).toBeGreaterThanOrEqual(4);
  });
});

type D = (a: DbLabAction) => void;
const sql = (d: D, text: string) => {
  d({ type: "sql/text", text });
  d({ type: "sql/run" });
};

const scripts: Record<string, Record<string, (d: D) => void>> = {
  "db-10-left-join": {
    orphans: (d) => {
      sql(d, "SELECT c.title, e.student_id FROM courses c LEFT JOIN enrollments e ON e.course_id = c.id");
      sql(d, "SELECT c.title FROM courses c LEFT JOIN enrollments e ON e.course_id = c.id WHERE e.student_id IS NULL");
    },
    zero: (d) => {
      sql(d, "SELECT c.title, COUNT(e.student_id) AS n FROM courses c LEFT JOIN enrollments e ON e.course_id = c.id GROUP BY c.title");
      sql(d, "SELECT s.name FROM students s LEFT JOIN enrollments e ON e.student_id = s.id WHERE e.course_id IS NULL");
    },
  },
  "db-11-subqueries": {
    scalar: (d) => sql(d, "SELECT student_id, course_id, grade FROM enrollments WHERE grade > (SELECT AVG(grade) FROM enrollments)"),
    in: (d) => {
      sql(d, "SELECT name FROM students WHERE id IN (SELECT student_id FROM enrollments WHERE course_id = 1)");
      sql(d, "SELECT name FROM students WHERE id NOT IN (SELECT student_id FROM enrollments WHERE course_id = 1)");
    },
  },
  "db-13-normalization": {
    anomaly: (d) => {
      sql(d, "UPDATE enrollments_flat SET student_city = 'Тараз' WHERE id = 1");
      sql(d, "UPDATE enrollments_flat SET student_city = 'Тараз' WHERE student_name = 'Айгерім'");
    },
    normalize: (d) => {
      sql(d, "SELECT s.name, s.city, c.title FROM enrollments e JOIN students s ON s.id = e.student_id JOIN courses c ON c.id = e.course_id");
      sql(d, "UPDATE students SET city = 'Тараз' WHERE id = 1");
      sql(d, "SELECT s.name, s.city, c.title FROM enrollments e JOIN students s ON s.id = e.student_id JOIN courses c ON c.id = e.course_id");
    },
  },
  "db-14-pagination": {
    deep: (d) => {
      sql(d, "SELECT id, kind, amount FROM events ORDER BY id LIMIT 20 OFFSET 4980");
      sql(d, "SELECT id, kind, amount FROM events WHERE id > 4980 ORDER BY id LIMIT 20");
    },
    feed: (d) => {
      sql(d, "SELECT id, kind FROM events ORDER BY id DESC LIMIT 20");
      sql(d, "INSERT INTO events (id, user_id, kind, amount) VALUES (5001, 1, 'buy', 100)");
      sql(d, "SELECT id, kind FROM events ORDER BY id DESC LIMIT 20 OFFSET 20");
      sql(d, "SELECT id, kind FROM events WHERE id < 4981 ORDER BY id DESC LIMIT 20");
    },
  },
  "db-12-patterns": {
    distinct: (d) => sql(d, "SELECT DISTINCT city FROM students"),
    like: (d) => {
      sql(d, "SELECT name FROM students WHERE name LIKE 'А%'");
      sql(d, "SELECT student_id, course_id, grade FROM enrollments WHERE grade BETWEEN 70 AND 85");
    },
  },
  "db-1-select": {
    where: (d) => sql(d, "SELECT name FROM students WHERE city = 'Алматы'"),
    order: (d) => sql(d, "SELECT name FROM students WHERE year >= 3 ORDER BY name"),
  },
  "db-2-join": {
    two: (d) => sql(d, "SELECT s.name, e.course_id FROM enrollments e JOIN students s ON e.student_id = s.id"),
    three: (d) => sql(d, "SELECT s.name FROM enrollments e JOIN students s ON e.student_id = s.id JOIN courses c ON e.course_id = c.id WHERE c.title = 'Алгоритмдер'"),
  },
  "db-3-aggregate": {
    count: (d) => sql(d, "SELECT city, COUNT(*) AS n FROM students GROUP BY city"),
    avg: (d) => sql(d, "SELECT c.title, AVG(e.grade) AS avg FROM enrollments e JOIN courses c ON e.course_id = c.id GROUP BY c.title ORDER BY avg DESC"),
    having: (d) => sql(d, "SELECT c.title, COUNT(*) AS n FROM enrollments e JOIN courses c ON e.course_id = c.id GROUP BY c.title HAVING COUNT(*) >= 7"),
  },
  "db-4-index": {
    scan: (d) => d({ type: "sql/run" }),
    index: (d) => sql(d, "CREATE INDEX ON events (user_id); SELECT * FROM events WHERE user_id = 42"),
    explain: (d) => sql(d, "EXPLAIN SELECT * FROM events WHERE user_id = 42"),
  },
  "db-5-constraints": {
    pk: (d) => d({ type: "sql/run" }),
    fk: (d) => sql(d, "DELETE FROM courses WHERE id = 1"),
  },
  "db-6-transactions": {
    transfer: (d) => sql(d, "BEGIN; UPDATE accounts SET balance = balance - 300 WHERE id = 1; UPDATE accounts SET balance = balance + 300 WHERE id = 3; COMMIT"),
    rollback: (d) => sql(d, "BEGIN; UPDATE accounts SET balance = 0; ROLLBACK"),
    crash: (d) => {
      sql(d, "BEGIN; UPDATE accounts SET balance = balance - 300 WHERE id = 1");
      d({ type: "sql/crash" });
    },
  },
  "db-7-concurrency": {
    lost: (d) => race(d, false),
    lock: (d) => race(d, true),
  },
  "db-8-sharding": {
    spread: (d) => d({ type: "shard/n", n: 6 }),
    add: (d) => {
      d({ type: "shard/n", n: 4 });
      d({ type: "shard/n", n: 5 });
      d({ type: "shard/method", method: "consistent" });
      d({ type: "shard/n", n: 4 });
      d({ type: "shard/n", n: 5 });
    },
  },
  "db-9-pset": {
    top: (d) => sql(d, "SELECT s.name, AVG(e.grade) AS avg FROM enrollments e JOIN students s ON e.student_id = s.id GROUP BY s.name ORDER BY avg DESC LIMIT 3"),
    fast: (d) => sql(d, "CREATE INDEX ON events (user_id); SELECT SUM(amount) FROM events WHERE user_id = 7 AND kind = 'buy'"),
    transfer: (d) => sql(d, "BEGIN; UPDATE accounts SET balance = balance - 250 WHERE id = 2; UPDATE accounts SET balance = balance + 250 WHERE id = 3; COMMIT"),
    serial: (d) => {
      for (const [client, op] of [["A", "read"], ["A", "write"], ["B", "read"], ["B", "write"]] as const) d({ type: "race/op", client, op });
    },
  },
};

function race(d: D, locking: boolean) {
  d({ type: "race/locking", on: locking });
  const order = locking
    ? ([["A", "read"], ["B", "read"], ["A", "write"], ["B", "read"], ["B", "write"]] as const)
    : ([["A", "read"], ["B", "read"], ["A", "write"], ["B", "write"]] as const);
  for (const [client, op] of order) d({ type: "race/op", client, op });
}

describe("databases lessons are completable", () => {
  for (const lesson of dbLessons)
    it(lesson.id, () => {
      const rt = new SimulationRuntime(dbLabPlugin, 1);
      const engine = new LessonEngine(lesson);
      const sync = () => engine.update(rt.getState(), rt.evaluate());
      const d: D = (a) => {
        rt.dispatch(a);
        sync();
      };
      engine.step.onEnter?.forEach((a) => rt.dispatch(a));
      sync();
      expect(engine.view().objectives.some((o) => o.done)).toBe(false);
      for (const step of lesson.steps) {
        scripts[lesson.id]![step.id]!(d);
        sync();
        expect(engine.view().objectives.filter((o) => !o.done).map((o) => o.text), `${lesson.id}/${step.id}`).toEqual([]);
        for (const q of step.quiz ?? []) expect(engine.answer(q.id, q.answer).correct).toBe(true);
        engine.advance()?.onEnter?.forEach((a) => rt.dispatch(a));
        sync();
      }
      expect(engine.isLessonComplete()).toBe(true);
      expect(replay(dbLabPlugin, rt.record())).toEqual(rt.getState());
    });
});

describe("autograder", () => {
  const run = (text: string) => {
    const rt = new SimulationRuntime(dbLabPlugin, 1);
    rt.dispatch({ type: "sql/text", text });
    rt.dispatch({ type: "sql/run" });
    return rt.getState() as DbLabState;
  };
  it("splits scripts on semicolons outside quotes", () => {
    expect(splitStatements("SELECT 'a;b' FROM t; -- x;\nCOMMIT;")).toEqual(["SELECT 'a;b' FROM t", "COMMIT"]);
  });
  it("top three: wrong order, wrong count or plain grades fail", () => {
    expect(topThree(run("SELECT s.name, AVG(e.grade) AS a FROM enrollments e JOIN students s ON e.student_id = s.id GROUP BY s.name ORDER BY a LIMIT 3"))).toBe(false);
    expect(topThree(run("SELECT s.name, AVG(e.grade) AS a FROM enrollments e JOIN students s ON e.student_id = s.id GROUP BY s.name ORDER BY a DESC LIMIT 4"))).toBe(false);
    expect(topThree(run("SELECT s.name, e.grade FROM enrollments e JOIN students s ON e.student_id = s.id ORDER BY e.grade DESC LIMIT 3"))).toBe(false);
  });
  it("the fast query needs the selective index", () => {
    const pset = dbLessons.find((l) => l.id === "db-9-pset")!;
    const fast = pset.steps.find((s) => s.id === "fast")!.objectives[0]!;
    const st = run("CREATE INDEX ON events (kind); SELECT SUM(amount) FROM events WHERE user_id = 7 AND kind = 'buy'");
    expect(fast.check(st, { assessment: dbLabPlugin.evaluate(st) })).toBe(false);
  });
});
