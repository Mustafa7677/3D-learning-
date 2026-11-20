import { describe, expect, it } from "vitest";
import { buildApp } from "./app";

const SECRET = "test-secret-test-secret-test-secret-1234";
const progress = (over: Record<string, unknown> = {}) => ({
  lessonId: "ai-1-data",
  stepIndex: 1,
  completed: { explore: ["inspect"] },
  startedAt: 1,
  updatedAt: 2,
  ...over,
});

async function setup() {
  const app = await buildApp({ cookieSecret: SECRET, webOrigin: "http://web.test" });
  const first = await app.inject({ method: "GET", url: "/v1/progress" });
  const cookie = first.cookies[0]!;
  const headers = { cookie: `${cookie.name}=${cookie.value}` };
  return { app, headers };
}

describe("api", () => {
  it("health", async () => {
    const app = await buildApp({ cookieSecret: SECRET });
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.json()).toEqual({ status: "ok" });
  });

  it("issues a signed httpOnly learner cookie", async () => {
    const app = await buildApp({ cookieSecret: SECRET });
    const res = await app.inject({ method: "GET", url: "/v1/progress" });
    expect(res.cookies[0]?.httpOnly).toBe(true);
    expect(res.cookies[0]?.sameSite).toBe("Lax");
  });

  it("stores and returns progress per learner", async () => {
    const { app, headers } = await setup();
    const put = await app.inject({ method: "PUT", url: "/v1/progress/ai-1-data", headers, payload: progress() });
    expect(put.statusCode).toBe(204);
    const get = await app.inject({ method: "GET", url: "/v1/progress/ai-1-data", headers });
    expect(get.json()).toEqual(progress());
    const other = await app.inject({ method: "GET", url: "/v1/progress/ai-1-data" });
    expect(other.statusCode).toBe(404);
  });

  it("ignores stale writes", async () => {
    const { app, headers } = await setup();
    await app.inject({ method: "PUT", url: "/v1/progress/ai-1-data", headers, payload: progress({ updatedAt: 10, stepIndex: 3 }) });
    await app.inject({ method: "PUT", url: "/v1/progress/ai-1-data", headers, payload: progress({ updatedAt: 5, stepIndex: 0 }) });
    const get = await app.inject({ method: "GET", url: "/v1/progress/ai-1-data", headers });
    expect(get.json().stepIndex).toBe(3);
  });

  it("rejects forged cookies, bad bodies and mismatched ids", async () => {
    const { app, headers } = await setup();
    const forged = await app.inject({ method: "GET", url: "/v1/progress", headers: { cookie: "it_lid=someone-else" } });
    expect(forged.cookies[0]?.value).not.toBe("someone-else");
    const bad = await app.inject({ method: "PUT", url: "/v1/progress/ai-1-data", headers, payload: { lessonId: "ai-1-data", evil: true } });
    expect(bad.statusCode).toBe(400);
    const mismatch = await app.inject({ method: "PUT", url: "/v1/progress/ai-1-data", headers, payload: progress({ lessonId: "ai-2-neuron" }) });
    expect(mismatch.statusCode).toBe(400);
    const badId = await app.inject({ method: "GET", url: "/v1/progress/..%2Fetc", headers });
    expect(badId.statusCode).toBe(400);
  });

  it("answers CORS preflight only for the web origin", async () => {
    const { app } = await setup();
    const ok = await app.inject({ method: "OPTIONS", url: "/v1/progress/x", headers: { origin: "http://web.test" } });
    expect(ok.headers["access-control-allow-origin"]).toBe("http://web.test");
    const no = await app.inject({ method: "OPTIONS", url: "/v1/progress/x", headers: { origin: "http://evil.test" } });
    expect(no.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
