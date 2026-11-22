import { describe, expect, it } from "vitest";
import { seedDb } from "./data";
import { execute, type Session } from "./sql";

const s0 = (): Session => ({ db: seedDb(), snapshot: null });
const run = (s: Session, sql: string) => execute(s, sql);

describe("db: selectivity and the planner", () => {
  it("the kinds split 60/20/20", () => {
    const n = (k: string) => seedDb().events!.rows.filter((r) => r.kind === k).length;
    expect([n("view"), n("click"), n("buy")].map((x) => Math.round(x / 500) * 10)).toEqual([60, 20, 20]);
  });
  it("an index is used when it is cheaper, skipped when it is not", () => {
    const s = run(s0(), "CREATE INDEX ON events (kind)").session;
    const buy = run(s, "EXPLAIN SELECT * FROM events WHERE kind = 'buy'").result;
    expect(buy.plan[0]).toMatchObject({ access: "index", column: "kind" });
    expect(buy.plan[0]!.cost).toBe(buy.plan[0]!.rows * 4);
    const view = run(s, "EXPLAIN SELECT * FROM events WHERE kind = 'view'").result;
    expect(view.plan[0]).toMatchObject({ access: "scan", rows: 5000, cost: 5000, skipped: "kind" });
    expect(view.rows[0]!["қол жеткізу"]).toBe("толық сканерлеу (kind индексі тиімсіз)");
  });
  it("of two indexes, the most selective one wins whatever the order of conditions", () => {
    let s = run(s0(), "CREATE INDEX ON events (kind)").session;
    s = run(s, "CREATE INDEX ON events (user_id)").session;
    for (const q of ["SELECT * FROM events WHERE kind = 'view' AND user_id = 7", "SELECT * FROM events WHERE user_id = 7 AND kind = 'view'"]) {
      const r = run(s, q).result;
      expect(r.plan[0]).toMatchObject({ access: "index", column: "user_id" });
      expect(r.examined).toBeLessThanOrEqual(20);
      expect(r.rows.every((x) => x.kind === "view" && x.user_id === 7)).toBe(true);
    }
  });
});
