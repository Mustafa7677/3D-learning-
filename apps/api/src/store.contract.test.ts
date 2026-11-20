import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it, beforeAll } from "vitest";
import { PgStore, type Queryable } from "./pg-store";
import { MemoryStore, type Learner, type Store } from "./store";

/**
 * One behavioural contract, run against every Store implementation.
 * PostgreSQL runs when PGTEST_PORT is set (CI starts a postgres:16 service);
 * it talks to the server through `psql`, so no driver dependency is needed for tests.
 */
function contract(name: string, make: () => Promise<Store>) {
  describe(`Store contract: ${name}`, () => {
    let store: Store;
    beforeAll(async () => {
      store = await make();
    });
    const learner = (over: Partial<Learner> = {}): Learner => ({ id: randomUUID(), authSubject: null, email: null, name: null, role: "student", plan: "free", createdAt: 1_700_000_000_000, ...over });

    it("creates, finds and updates learners", async () => {
      const l = learner({ name: "Дана" });
      await store.createLearner(l);
      await store.createLearner({ ...l, name: "ignored duplicate" });
      expect(await store.getLearner(l.id)).toMatchObject({ id: l.id, name: "Дана", role: "student", plan: "free" });
      await store.updateLearner(l.id, { authSubject: "iss|sub-1", email: "d@x.kz", role: "teacher", plan: "classroom" });
      expect(await store.findLearnerBySubject("iss|sub-1")).toMatchObject({ id: l.id, email: "d@x.kz", role: "teacher", plan: "classroom" });
      expect(await store.findLearnerBySubject("nobody")).toBeUndefined();
    });

    it("stores progress with jsonb and refuses stale writes", async () => {
      const l = learner();
      await store.createLearner(l);
      const p = { lessonId: "ai-1-data", stepIndex: 2, completed: { explore: ["inspect"], label: ["add0", "add1"] }, startedAt: 1_700_000_000_000, updatedAt: 1_700_000_100_000 };
      await store.putProgress(l.id, p);
      await store.putProgress(l.id, { ...p, stepIndex: 0, updatedAt: 1_700_000_050_000 });
      expect(await store.getProgress(l.id, "ai-1-data")).toEqual(p);
      await store.putProgress(l.id, { ...p, stepIndex: 3, updatedAt: 1_700_000_200_000, completedAt: 1_700_000_200_000 });
      expect((await store.listProgress(l.id))[0]).toMatchObject({ stepIndex: 3, completedAt: 1_700_000_200_000 });
    });

    it("classes, members and assignments", async () => {
      const t = learner({ role: "teacher", name: "Мұғалім" });
      const s = learner({ name: "Оқушы" });
      await store.createLearner(t);
      await store.createLearner(s);
      const code = Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "X").replace(/[^A-Z0-9]/g, "Q");
      const c = { id: randomUUID(), teacherId: t.id, name: "7А", code, createdAt: 1_700_000_000_000 };
      await store.createClass(c);
      expect(await store.findClassByCode(code)).toEqual(c);
      await store.joinClass(c.id, s.id);
      await store.joinClass(c.id, s.id);
      expect((await store.classMembers(c.id)).map((m) => m.id)).toEqual([s.id]);
      expect((await store.classesForStudent(s.id)).map((x) => x.id)).toEqual([c.id]);
      expect((await store.classesForTeacher(t.id)).map((x) => x.id)).toEqual([c.id]);
      const a = { id: randomUUID(), classId: c.id, lessonId: "web-1-internet", dueAt: null, createdAt: 1_700_000_000_000 };
      await store.addAssignment(a);
      expect(await store.assignments(c.id)).toEqual([a]);
    });
  });
}

contract("memory", async () => new MemoryStore());

const PORT = process.env.PGTEST_PORT;
if (PORT) {
  const host = process.env.PGTEST_HOST ?? "localhost";
  const user = process.env.PGTEST_USER ?? "postgres";
  const psql = (db: string, input: string) =>
    execFileSync("psql", ["-h", host, "-p", PORT, "-U", user, "-d", db, "-X", "-q", "-tA", "-v", "ON_ERROR_STOP=1"], { input, encoding: "utf8", env: { ...process.env, PGPASSWORD: process.env.PGTEST_PASSWORD ?? "" } });

  const literal = (v: unknown): string => {
    if (v === null || v === undefined) return "NULL";
    if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
    if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
    return `'${String(v).replace(/'/g, "''")}'`;
  };

  /** Test-only Queryable: server-side PREPARE/EXECUTE through psql, rows back as JSON. */
  const viaPsql = (db: string): Queryable => ({
    async query<R>(text: string, params: unknown[] = []) {
      const isSelect = /^\s*select/i.test(text);
      const body = isSelect ? `select coalesce(json_agg(q), '[]'::json) from (${text}) q` : text;
      const args = params.length ? `(${params.map(literal).join(", ")})` : "";
      const out = psql(db, `PREPARE s AS ${body};\nEXECUTE s${args};\n`);
      return { rows: isSelect ? (JSON.parse(out.trim().split("\n").pop() || "[]") as R[]) : [] };
    },
  });

  contract("postgres", async () => {
    const db = `inside_test_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
    psql("postgres", `create database ${db};`);
    for (const m of ["0001_init.sql", "0002_platform.sql"]) psql(db, readFileSync(new URL(`../db/migrations/${m}`, import.meta.url), "utf8"));
    return new PgStore(viaPsql(db));
  });
}
