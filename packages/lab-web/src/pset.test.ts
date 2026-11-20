import { LessonEngine } from "@inside-tech/lesson-engine";
import { SimulationRuntime } from "@inside-tech/sim-core";
import { describe, expect, it } from "vitest";
import { webLabPlugin, webLessons, type WebLabAction } from "./index";

const pset = webLessons.find((l) => l.id === "web-9-pset")!;
const API = "93.184.10.2";

function start(step: number) {
  const rt = new SimulationRuntime(webLabPlugin, 1);
  const engine = new LessonEngine(pset);
  for (let i = 0; i <= step; i++) pset.steps[i]!.onEnter?.forEach((a) => rt.dispatch(a));
  const d = (a: WebLabAction) => rt.dispatch(a);
  const done = (id: string) => {
    engine.update(rt.getState(), rt.evaluate());
    return pset.steps[step]!.objectives.find((o) => o.id === id)!.check(rt.getState(), { assessment: rt.evaluate() });
  };
  const sql = (text: string) => {
    d({ type: "sql/set", text });
    d({ type: "sql/run" });
  };
  const send = () => {
    d({ type: "req/send" });
    rt.stepTicks(600);
  };
  return { d, done, sql, send, state: () => rt.getState() };
}

describe("web problem set autograder", () => {
  it("SQL: order matters, and the right rows are required", () => {
    const { done, sql } = start(0);
    sql("SELECT name FROM users WHERE city != 'Алматы' AND city != 'Астана'");
    expect(done("q1")).toBe(false);
    sql("SELECT name FROM users ORDER BY name");
    expect(done("q1")).toBe(false);
    sql("SELECT name FROM users WHERE city != 'Алматы' AND city != 'Астана' ORDER BY name");
    expect(done("q1")).toBe(true);
  });

  it("SQL: a full scan does not pass the index problem", () => {
    const { done, sql } = start(0);
    sql("SELECT * FROM orders WHERE user_id = 5");
    expect(done("q3")).toBe(false);
  });

  it("API: returning everything, or the wrong user, fails", () => {
    const { d, done, send, state } = start(1);
    d({ type: "route/add", ip: API, route: { method: "GET", path: "/api/users/:id/orders", kind: "sql", body: "SELECT * FROM orders WHERE user_id = :id", requiresAuth: false } });
    send();
    expect(done("orders")).toBe(false);
    const id = state().world.servers.find((x) => x.ip === API)!.routes.find((r) => r.path === "/api/users/:id/orders")!.id;
    d({ type: "route/update", ip: API, id, patch: { body: "SELECT * FROM orders WHERE user_id = 1 ORDER BY price DESC LIMIT 5" } });
    send();
    expect(done("orders")).toBe(false);
    d({ type: "route/update", ip: API, id, patch: { body: "SELECT * FROM orders WHERE user_id = :id ORDER BY price DESC LIMIT 5" } });
    send();
    expect(done("orders")).toBe(true);
  });
});
