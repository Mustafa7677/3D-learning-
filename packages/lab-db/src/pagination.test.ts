import { describe, expect, it } from "vitest";
import { seedDb } from "./data";
import { execute, type Session } from "./sql";

const newSession = (db: Session["db"]): Session => ({ db, snapshot: null });

const run = (sql: string, s = newSession(seedDb())) => execute(s, sql);

describe("db: OFFSET and keyset pagination", () => {
  it("OFFSET reads every skipped row; keyset seeks straight to the page", () => {
    const off = run("SELECT id FROM events ORDER BY id LIMIT 20 OFFSET 4980").result;
    expect(off.rows.map((r) => r.id)).toEqual(Array.from({ length: 20 }, (_, i) => 4981 + i));
    expect(off.examined).toBe(5000);
    const key = run("SELECT id FROM events WHERE id > 4980 ORDER BY id LIMIT 20").result;
    expect(key.rows).toEqual(off.rows);
    expect(key.examined).toBe(20);
    expect(run("SELECT id FROM events ORDER BY id LIMIT 20").result.examined).toBe(20);
  });
  it("a WHERE on another column is checked while walking: still no full scan", () => {
    const r = run("SELECT id FROM events WHERE kind = 'buy' ORDER BY id LIMIT 5").result;
    expect(r.rows).toHaveLength(5);
    expect(r.examined).toBeLessThan(100);
  });
  it("without LIMIT, or on an unindexed column, it is a full scan as before", () => {
    expect(run("SELECT id FROM events ORDER BY id").result.examined).toBe(5000);
    expect(run("SELECT id FROM events ORDER BY amount LIMIT 20").result.examined).toBe(5000);
  });
  it("an insert between pages: OFFSET repeats a row, keyset does not", () => {
    const s0 = newSession(seedDb());
    const p1 = execute(s0, "SELECT id FROM events ORDER BY id DESC LIMIT 20").result.rows.map((r) => r.id);
    const s1 = execute(s0, "INSERT INTO events (id, user_id, kind, amount) VALUES (5001, 1, 'buy', 100)").session;
    const off = execute(s1, "SELECT id FROM events ORDER BY id DESC LIMIT 20 OFFSET 20").result.rows.map((r) => r.id);
    const key = execute(s1, "SELECT id FROM events WHERE id < 4981 ORDER BY id DESC LIMIT 20").result.rows.map((r) => r.id);
    expect(off[0]).toBe(4981);
    expect(p1).toContain(4981);
    expect(key[0]).toBe(4980);
    expect(key.some((id) => p1.includes(id))).toBe(false);
  });
});
