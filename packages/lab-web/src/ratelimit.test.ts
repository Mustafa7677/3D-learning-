import { LessonEngine } from "@inside-tech/lesson-engine";
import { SimulationRuntime } from "@inside-tech/sim-core";
import { describe, expect, it } from "vitest";
import { RATE_WINDOW_MS, resolveRequest, type World } from "./net";
import { scenario } from "./scenarios";
import { webLabPlugin, webLessons, type WebLabAction, type WebLabState } from "./index";

const limited = (n: number): World => {
  const w = scenario("api");
  return { ...w, servers: w.servers.map((s) => (s.host === "api.inside.kz" ? { ...s, rateLimit: n } : s)) };
};
const users = { method: "GET" as const, url: "https://api.inside.kz/api/users" };

describe("web: rate limiting", () => {
  it("five pass, the sixth gets 429 with Retry-After and never reaches the database", () => {
    let w = limited(5);
    const statuses: number[] = [];
    let last = resolveRequest(w, users);
    for (let i = 0; i < 6; i++) {
      last = resolveRequest(w, users);
      statuses.push(last.response.status);
      w = { ...last.world, clock: last.world.clock + last.response.ms };
    }
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
    // The five requests themselves took about a second of the window.
    expect(last.response.retryAfter).toBe(59);
    expect(last.stages.some((s) => s.kind === "db")).toBe(false);
    expect(last.stages.find((s) => s.title === "Rate limiter")!.detail).toContain("5/5");
  });

  it("the limit is per caller, and the window slides", () => {
    let w = limited(2);
    for (let i = 0; i < 2; i++) w = resolveRequest(w, users).world;
    expect(resolveRequest(w, users).response.status).toBe(429);
    expect(resolveRequest(w, { ...users, token: "secret-123" }).response.status).toBe(200);
    expect(resolveRequest({ ...w, clock: w.clock + RATE_WINDOW_MS - 1000 }, users).response.status).toBe(429);
    expect(resolveRequest({ ...w, clock: w.clock + RATE_WINDOW_MS + 1000 }, users).response.status).toBe(200);
  });

  it("rejected requests do not extend the wait", () => {
    let w = limited(1);
    w = resolveRequest(w, users).world;
    for (let i = 0; i < 5; i++) w = resolveRequest({ ...w, clock: w.clock + 5000 }, users).world;
    expect(w.rateLog!["93.184.10.2|anon"]).toHaveLength(1);
  });

  it("the lesson completes", () => {
    const lesson = webLessons.find((l) => l.id === "web-14-ratelimit")!;
    const rt = new SimulationRuntime<WebLabState, WebLabAction>(webLabPlugin, 1);
    const engine = new LessonEngine(lesson);
    const sync = () => engine.update(rt.getState(), rt.evaluate());
    const send = (p: Partial<WebLabState["request"]> = {}) => {
      if (Object.keys(p).length) rt.dispatch({ type: "req/set", params: p });
      rt.dispatch({ type: "req/send" });
      rt.dispatch({ type: "req/skip" });
    };
    engine.step.onEnter?.forEach((a) => rt.dispatch(a));
    sync();
    for (let i = 0; i < 5; i++) send();
    sync();
    expect(engine.view().objectives.map((o) => o.done)).toEqual([true, false]);
    send();
    sync();
    expect(rt.getState().history[0]!.status).toBe(429);
    for (const q of lesson.steps[0]!.quiz ?? []) engine.answer(q.id, q.answer);
    engine.advance()?.onEnter?.forEach((a) => rt.dispatch(a));
    sync();
    expect(engine.view().objectives.every((o) => !o.done)).toBe(true);
    send({ token: "secret-123" });
    send({ token: "" });
    expect(rt.getState().history[0]!.status).toBe(429);
    rt.dispatch({ type: "clock/advance", ms: 60_000 });
    send();
    sync();
    expect(rt.getState().history[0]!.status).toBe(200);
    expect(engine.view().objectives.every((o) => o.done)).toBe(true);
    expect(lesson.steps.every((s) => s.predict && (s.quiz?.length ?? 0) >= 2)).toBe(true);
  });
});
