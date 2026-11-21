import { LessonEngine } from "@inside-tech/lesson-engine";
import { SimulationRuntime } from "@inside-tech/sim-core";
import { describe, expect, it } from "vitest";
import { resolveRequest, totalDuration } from "./net";
import { scenario } from "./scenarios";
import { webLabPlugin, webLessons, type WebLabAction, type WebLabState } from "./index";

const send = (rt: SimulationRuntime<WebLabState, WebLabAction>, params: Partial<WebLabState["request"]> = {}) => {
  if (Object.keys(params).length) rt.dispatch({ type: "req/set", params });
  rt.dispatch({ type: "req/send" });
  rt.dispatch({ type: "req/skip" });
};

describe("web middle: the simulation", () => {
  it("the first full load of inside.kz takes about 350 ms (quoted in the lecture)", () => {
    const r = resolveRequest(scenario("internet"), { method: "GET", url: "https://inside.kz/" });
    expect(Math.round(totalDuration(r.stages) / 50) * 50).toBe(350);
  });

  it("an expired copy is revalidated: 304 with ETag, a full 200 without", () => {
    let w = scenario("internet");
    w = { ...w, servers: w.servers.map((s) => (s.host === "inside.kz" ? { ...s, maxAge: 60 } : s)) };
    const first = resolveRequest(w, { method: "GET", url: "https://inside.kz/" });
    const later = { ...first.world, clock: first.world.clock + 120_000 };
    expect(resolveRequest(later, { method: "GET", url: "https://inside.kz/" }).response.status).toBe(200);
    const withEtag = { ...later, servers: later.servers.map((s) => (s.host === "inside.kz" ? { ...s, etag: true } : s)) };
    const r = resolveRequest(withEtag, { method: "GET", url: "https://inside.kz/" });
    expect(r.response.status).toBe(304);
    expect(r.response.body).toBe(first.response.body);
    expect(r.stages.find((s) => s.kind === "http")!.detail).toContain("If-None-Match");
    // The copy is fresh again: the next load comes from the cache.
    expect(resolveRequest(r.world, { method: "GET", url: "https://inside.kz/" }).response.fromCache).toBe(true);
  });

  it("a new deploy breaks the ETag match: 200, not 304", () => {
    let w = scenario("internet");
    w = { ...w, servers: w.servers.map((s) => (s.host === "inside.kz" ? { ...s, maxAge: 60, etag: true } : s)) };
    const first = resolveRequest(w, { method: "GET", url: "https://inside.kz/" });
    const later = { ...first.world, clock: first.world.clock + 120_000, deployVersion: 1 };
    expect(resolveRequest(later, { method: "GET", url: "https://inside.kz/" }).response.status).toBe(200);
  });

  it("401 for nobody, 403 for a user, 200 for the admin", () => {
    const w = scenario("api");
    const go = (token?: string) => resolveRequest(w, { method: "GET", url: "https://api.inside.kz/api/admin/stats", token }).response.status;
    expect([go(), go("wrong"), go("secret-123"), go("admin-777")]).toEqual([401, 401, 403, 200]);
    // The ordinary protected route still takes both tokens.
    expect(resolveRequest(w, { method: "GET", url: "https://api.inside.kz/api/secret", token: "admin-777" }).response.status).toBe(200);
  });
});

describe("web middle: the lessons", () => {
  const scripts: Record<string, Record<string, (rt: SimulationRuntime<WebLabState, WebLabAction>) => void>> = {
    "web-10-cache": {
      maxage: (rt) => {
        send(rt);
        send(rt);
      },
      etag: (rt) => {
        rt.dispatch({ type: "server/set", ip: "93.184.10.1", patch: { etag: true } });
        rt.dispatch({ type: "clock/advance", ms: 60_000 });
        send(rt);
      },
    },
    "web-11-roles": {
      who: (rt) => send(rt),
      may: (rt) => {
        send(rt, { token: "secret-123" });
        send(rt, { token: "admin-777" });
      },
    },
    "web-12-idempotency": {
      post: (rt) => {
        send(rt);
        send(rt);
      },
      put: (rt) => {
        send(rt);
        send(rt);
      },
    },
  };

  for (const id of Object.keys(scripts))
    it(`${id} completes, and every step has a prediction`, () => {
      const lesson = webLessons.find((l) => l.id === id)!;
      const rt = new SimulationRuntime(webLabPlugin, 1);
      const engine = new LessonEngine(lesson);
      const sync = () => engine.update(rt.getState(), rt.evaluate());
      engine.step.onEnter?.forEach((a) => rt.dispatch(a));
      sync();
      for (const step of lesson.steps) {
        expect(step.predict, `${id}/${step.id} prediction`).toBeDefined();
        expect(engine.view().objectives.every((o) => !o.done)).toBe(true);
        scripts[id]![step.id]!(rt);
        sync();
        expect(engine.view().objectives.filter((o) => !o.done).map((o) => o.text), `${id}/${step.id}`).toEqual([]);
        for (const q of step.quiz ?? []) expect(engine.answer(q.id, q.answer).correct).toBe(true);
        engine.advance()?.onEnter?.forEach((a) => rt.dispatch(a));
        sync();
      }
      expect(engine.isLessonComplete()).toBe(true);
    });

  it("PUT twice leaves one row changed and the row count as it was", () => {
    const rt = new SimulationRuntime(webLabPlugin, 1);
    const lesson = webLessons.find((l) => l.id === "web-12-idempotency")!;
    lesson.steps[0]!.onEnter!.forEach((a) => rt.dispatch(a));
    const before = rt.getState().world.db.users!.rows.length;
    lesson.steps[1]!.onEnter!.forEach((a) => rt.dispatch(a));
    send(rt);
    send(rt);
    const users = rt.getState().world.db.users!.rows;
    expect(users.length).toBe(before);
    expect(users.find((r) => r.id === 1)!.city).toBe("Тараз");
  });
});
