import { generateKeyPairSync, createSign } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app";
import { canAccessLesson, signWebhook, verifyWebhook } from "./billing";
import { pkceChallenge, verifyIdToken } from "./oidc";
import { MemoryStore } from "./store";

const SECRET = "test-secret-test-secret-test-secret-1234";
const WEB = "http://web.test";
const ISSUER = "https://idp.test";

// ---- A fake OpenID provider with a real RSA key ----
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kty: "RSA", kid: "k1", alg: "RS256", use: "sig" };

function idToken(claims: Record<string, unknown>, key = privateKey): string {
  const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const head = enc({ alg: "RS256", kid: "k1", typ: "JWT" });
  const body = enc(claims);
  const sig = createSign("RSA-SHA256").update(`${head}.${body}`).sign(key).toString("base64url");
  return `${head}.${body}.${sig}`;
}

function fakeIdp(user: { sub: string; email: string; name: string }) {
  let lastNonce = "";
  let lastChallenge = "";
  const fetchFn = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    const json = (o: unknown) => new Response(JSON.stringify(o), { headers: { "content-type": "application/json" } });
    if (u.endsWith("/.well-known/openid-configuration"))
      return json({ issuer: ISSUER, authorization_endpoint: `${ISSUER}/authorize`, token_endpoint: `${ISSUER}/token`, jwks_uri: `${ISSUER}/jwks` });
    if (u === `${ISSUER}/jwks`) return json({ keys: [jwk] });
    if (u === `${ISSUER}/token`) {
      const form = new URLSearchParams(String(init?.body));
      if (pkceChallenge(form.get("code_verifier") ?? "") !== lastChallenge) return new Response("bad verifier", { status: 400 });
      const t = Math.floor(Date.now() / 1000);
      return json({ id_token: idToken({ iss: ISSUER, aud: "client-1", sub: user.sub, email: user.email, name: user.name, iat: t, exp: t + 300, nonce: lastNonce }) });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
  return {
    fetchFn,
    remember(authorizeLocation: string) {
      const q = new URL(authorizeLocation).searchParams;
      lastNonce = q.get("nonce")!;
      lastChallenge = q.get("code_challenge")!;
      return q.get("state")!;
    },
  };
}

type Jar = { cookie: string };
const jarFrom = (res: { cookies: { name: string; value: string }[] }, jar: Jar = { cookie: "" }): Jar => {
  const map = new Map(jar.cookie ? jar.cookie.split("; ").map((c) => c.split("=") as [string, string]) : []);
  for (const c of res.cookies) map.set(c.name, c.value);
  return { cookie: [...map].map(([k, v]) => `${k}=${v}`).join("; ") };
};

async function signIn(app: FastifyInstance, idp: ReturnType<typeof fakeIdp>, jar: Jar): Promise<Jar> {
  const login = await app.inject({ method: "GET", url: "/auth/login?returnTo=/labs/ai", headers: jar });
  expect(login.statusCode).toBe(302);
  const state = idp.remember(login.headers.location as string);
  const withLogin = jarFrom(login, jar);
  const cb = await app.inject({ method: "GET", url: `/auth/callback?code=abc&state=${state}`, headers: withLogin });
  expect(cb.statusCode, cb.body).toBe(302);
  expect(cb.headers.location).toBe(`${WEB}/labs/ai`);
  return jarFrom(cb, withLogin);
}

async function setup(user = { sub: "u1", email: "teacher@school.kz", name: "Айгерім" }, adminEmails: string[] = []) {
  const idp = fakeIdp(user);
  const store = new MemoryStore();
  const app = await buildApp({
    cookieSecret: SECRET,
    webOrigin: WEB,
    store,
    fetchFn: idp.fetchFn,
    adminEmails,
    oidc: { issuer: ISSUER, clientId: "client-1", redirectUri: "http://api.test/auth/callback" },
    billing: { secretKey: "sk_test", webhookSecret: "whsec_test", prices: { premium: "price_p", classroom: "price_c" }, successUrl: `${WEB}/ok`, cancelUrl: `${WEB}/no` },
  });
  return { app, idp, store };
}

const progress = (lessonId: string, updatedAt = 2) => ({ lessonId, stepIndex: 1, completed: { s1: ["o1"] }, startedAt: 1, updatedAt });

describe("OIDC", () => {
  it("verifies signature, audience, expiry and nonce", async () => {
    const t = Math.floor(Date.now() / 1000);
    const good = idToken({ iss: ISSUER, aud: "client-1", sub: "x", iat: t, exp: t + 60, nonce: "n" });
    await expect(verifyIdToken(good, { jwks: [jwk], issuer: ISSUER, audience: "client-1", nonce: "n" })).resolves.toMatchObject({ sub: "x" });
    await expect(verifyIdToken(good, { jwks: [jwk], issuer: ISSUER, audience: "other", nonce: "n" })).rejects.toThrow(/audience/);
    await expect(verifyIdToken(good, { jwks: [jwk], issuer: ISSUER, audience: "client-1", nonce: "z" })).rejects.toThrow(/nonce/);
    const expired = idToken({ iss: ISSUER, aud: "client-1", sub: "x", iat: t - 900, exp: t - 600, nonce: "n" });
    await expect(verifyIdToken(expired, { jwks: [jwk], issuer: ISSUER, audience: "client-1", nonce: "n" })).rejects.toThrow(/expired/);
    const otherKey = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
    const forged = idToken({ iss: ISSUER, aud: "client-1", sub: "x", iat: t, exp: t + 60, nonce: "n" }, otherKey);
    await expect(verifyIdToken(forged, { jwks: [jwk], issuer: ISSUER, audience: "client-1", nonce: "n" })).rejects.toThrow(/signature/);
  });

  it("signs in, merges anonymous progress and keeps the session", async () => {
    const { app, idp } = await setup();
    const first = await app.inject({ method: "PUT", url: "/v1/progress/ai-1-data", payload: progress("ai-1-data") });
    expect(first.statusCode).toBe(204);
    let jar = jarFrom(first);
    jar = await signIn(app, idp, jar);
    const me = await app.inject({ method: "GET", url: "/auth/me", headers: jar });
    expect(me.json()).toMatchObject({ signedIn: true, email: "teacher@school.kz", role: "student" });
    const list = await app.inject({ method: "GET", url: "/v1/progress", headers: jar });
    expect(list.json()).toHaveLength(1);

    // Same person signing in from another browser lands on the same account with merged progress.
    const other = await app.inject({ method: "PUT", url: "/v1/progress/ai-2-neuron", payload: progress("ai-2-neuron") });
    const jar2 = await signIn(app, idp, jarFrom(other));
    const merged = await app.inject({ method: "GET", url: "/v1/progress", headers: jar2 });
    expect(merged.json().map((p: { lessonId: string }) => p.lessonId).sort()).toEqual(["ai-1-data", "ai-2-neuron"]);
  });

  it("rejects a callback with a wrong state", async () => {
    const { app } = await setup();
    const login = await app.inject({ method: "GET", url: "/auth/login" });
    const res = await app.inject({ method: "GET", url: "/auth/callback?code=abc&state=wrong", headers: jarFrom(login) });
    expect(res.statusCode).toBe(400);
  });

  it("never redirects outside the web origin", async () => {
    const { app, idp } = await setup();
    const login = await app.inject({ method: "GET", url: "/auth/login?returnTo=https://evil.test/x" });
    const state = idp.remember(login.headers.location as string);
    const cb = await app.inject({ method: "GET", url: `/auth/callback?code=c&state=${state}`, headers: jarFrom(login) });
    expect(cb.headers.location).toBe(WEB);
  });
});

describe("classes", () => {
  it("teacher creates a class, student joins, report shows assigned lessons", async () => {
    const { app, idp, store } = await setup();
    const teacherJar = await signIn(app, idp, { cookie: "" });
    const teacher = (await app.inject({ method: "GET", url: "/auth/me", headers: teacherJar })).json();
    // Students cannot create classes.
    expect((await app.inject({ method: "POST", url: "/v1/classes", headers: teacherJar, payload: { name: "7А" } })).statusCode).toBe(403);
    await store.updateLearner(teacher.id, { role: "teacher" });
    const created = await app.inject({ method: "POST", url: "/v1/classes", headers: teacherJar, payload: { name: "7А" } });
    expect(created.statusCode).toBe(201);
    const cls = created.json();
    expect(cls.code).toMatch(/^[A-Z0-9]{6}$/);
    await app.inject({ method: "POST", url: `/v1/classes/${cls.id}/assignments`, headers: teacherJar, payload: { lessonId: "ai-1-data" } });

    const studentIdp = fakeIdp({ sub: "s1", email: "s@school.kz", name: "Ерлан" });
    const studentApp = app; // same server, different person
    const login = await studentApp.inject({ method: "GET", url: "/auth/login" });
    const state = studentIdp.remember(login.headers.location as string);
    // Swap the IdP answers for this sign-in by building a second app sharing the store.
    const app2 = await buildApp({ cookieSecret: SECRET, webOrigin: WEB, store, fetchFn: studentIdp.fetchFn, oidc: { issuer: ISSUER, clientId: "client-1", redirectUri: "http://api.test/auth/callback" } });
    const cb = await app2.inject({ method: "GET", url: `/auth/callback?code=c&state=${state}`, headers: jarFrom(login) });
    const studentJar = jarFrom(cb, jarFrom(login));
    expect((await app2.inject({ method: "POST", url: "/v1/classes/join", headers: studentJar, payload: { code: cls.code.toLowerCase() } })).json()).toMatchObject({ name: "7А" });
    await app2.inject({ method: "PUT", url: "/v1/progress/ai-1-data", headers: studentJar, payload: { ...progress("ai-1-data"), completedAt: 3 } });

    const report = (await app.inject({ method: "GET", url: `/v1/classes/${cls.id}/report`, headers: teacherJar })).json();
    expect(report.students).toHaveLength(1);
    expect(report.students[0]).toMatchObject({ name: "Ерлан", lessons: { "ai-1-data": { started: true, completed: true, objectivesDone: 1 } } });
    // The student can see assignments but not the report.
    expect((await app2.inject({ method: "GET", url: `/v1/classes/${cls.id}/assignments`, headers: studentJar })).json()).toHaveLength(1);
    expect((await app2.inject({ method: "GET", url: `/v1/classes/${cls.id}/report`, headers: studentJar })).statusCode).toBe(403);

    // ---- learning analytics: the student's session reaches the teacher, students cannot read it
    const events = [
      { t: 0, type: "enter", step: "explore" },
      { t: 30_000, type: "wrong", step: "explore", q: "q1", o: 2 },
      { t: 35_000, type: "wrong", step: "explore", q: "q1", o: 0 },
      { t: 40_000, type: "undo", step: "explore" },
      { t: 60_000, type: "done", step: "explore" },
      { t: 61_000, type: "enter", step: "label" },
      { t: 90_000, type: "restart", step: "label" },
    ];
    const recording = { pluginId: "ai-lab", pluginVersion: "1", seed: 1, fixedDt: 0.05, ticks: 4, journal: [{ tick: 2, action: { type: "dataset/generate" } }] };
    expect((await app2.inject({ method: "PUT", url: "/v1/sessions/ai-1-data", headers: studentJar, payload: { kind: "classifier", events, recording } })).statusCode).toBe(204);
    expect((await app2.inject({ method: "PUT", url: "/v1/sessions/ai-1-data", headers: studentJar, payload: { kind: "classifier", events: [{ t: 0, type: "hack", step: "x" }] } })).statusCode).toBe(400);
    // A log sent on tab close (no recording field) keeps the stored replay.
    expect((await app2.inject({ method: "PUT", url: "/v1/sessions/ai-1-data", headers: studentJar, payload: { kind: "classifier", events } })).statusCode).toBe(204);
    const sessions = (await app.inject({ method: "GET", url: `/v1/classes/${cls.id}/sessions/ai-1-data`, headers: teacherJar })).json();
    expect(sessions.students[0]).toMatchObject({ name: "Ерлан", started: true, hasRecording: true, undos: 1, restarts: 1, wrong: { "explore/q1": 2 }, stepMs: { explore: 60_000, label: 29_000 }, stepsDone: ["explore"] });
    expect(sessions.hardest[0]).toEqual({ key: "explore/q1", wrong: 2, learners: 1 });
    const student = report.students[0].id;
    const full = await app.inject({ method: "GET", url: `/v1/classes/${cls.id}/sessions/ai-1-data/${student}`, headers: teacherJar });
    expect(full.json()).toMatchObject({ kind: "classifier", recording });
    expect((await app2.inject({ method: "GET", url: `/v1/classes/${cls.id}/sessions/ai-1-data`, headers: studentJar })).statusCode).toBe(403);
  });

  it("authored lessons: save, update by the author only, assign, play for free", async () => {
    const { app, idp, store } = await setup({ sub: "t9", email: "t9@school.kz", name: "Мұғалім" });
    const jar = await signIn(app, idp, { cookie: "" });
    const me = (await app.inject({ method: "GET", url: "/auth/me", headers: jar })).json();
    await store.updateLearner(me.id, { role: "teacher" });
    const spec = {
      format: "inside-tech/lesson@1",
      id: "my-lesson",
      labId: "iot",
      kind: "iot",
      title: "PID-ті баптау",
      summary: "Өз сабағым",
      estimatedMinutes: 10,
      steps: [{ id: "s1", title: "Бірінші", body: "Мәтін", objectives: [{ id: "o1", text: "Жүргіз", when: { path: "stats.pidRuns", op: "lengthAtLeast", value: 1 } }] }],
    };
    const anon = await app.inject({ method: "POST", url: "/v1/lessons", payload: { spec } });
    expect(anon.statusCode).toBe(401);
    const created = await app.inject({ method: "POST", url: "/v1/lessons", headers: jar, payload: { spec } });
    expect(created.statusCode, created.body).toBe(201);
    const { id } = created.json();
    expect(id).toMatch(/^custom-/);
    expect((await app.inject({ method: "POST", url: "/v1/lessons", headers: jar, payload: { spec: { ...spec, steps: [] } } })).statusCode).toBe(400);
    expect((await app.inject({ method: "PUT", url: `/v1/lessons/${id}`, headers: jar, payload: { spec: { ...spec, title: "Жаңа" } } })).json()).toEqual({ id, title: "Жаңа" });
    const pub = (await app.inject({ method: "GET", url: `/v1/lessons/${id}` })).json();
    expect(pub).toMatchObject({ id, title: "Жаңа", spec: { id, kind: "iot" } });
    expect((await app.inject({ method: "GET", url: "/v1/lessons", headers: jar })).json()).toEqual([expect.objectContaining({ id, title: "Жаңа" })]);
    // Someone else cannot overwrite it.
    const other = await app.inject({ method: "GET", url: "/v1/progress" });
    const otherJar = jarFrom(other);
    expect((await app.inject({ method: "PUT", url: `/v1/lessons/${id}`, headers: otherJar, payload: { spec } })).statusCode).toBe(401);
    // Assign it, and an unknown custom lesson is refused.
    const cls = (await app.inject({ method: "POST", url: "/v1/classes", headers: jar, payload: { name: "8Б" } })).json();
    expect((await app.inject({ method: "POST", url: `/v1/classes/${cls.id}/assignments`, headers: jar, payload: { lessonId: id } })).statusCode).toBe(201);
    expect((await app.inject({ method: "POST", url: `/v1/classes/${cls.id}/assignments`, headers: jar, payload: { lessonId: "custom-nope" } })).statusCode).toBe(404);
    // Free learners may save progress in teacher lessons.
    expect((await app.inject({ method: "PUT", url: `/v1/progress/${id}`, headers: otherJar, payload: progress(id) })).statusCode).toBe(204);
  });
});

describe("billing", () => {
  it("free plan covers lessons 1–4 only", () => {
    expect(canAccessLesson("free", "ai-4-training")).toBe(true);
    expect(canAccessLesson("free", "ai-5-overfitting")).toBe(false);
    expect(canAccessLesson("premium", "game-8-create")).toBe(true);
  });

  it("verifies webhook signatures and tolerances", () => {
    const body = JSON.stringify({ id: "evt_1", type: "x", data: { object: {} } });
    const sig = signWebhook(body, "whsec");
    expect(verifyWebhook(body, sig, "whsec").id).toBe("evt_1");
    expect(() => verifyWebhook(body, sig, "other")).toThrow(/mismatch/);
    expect(() => verifyWebhook(body + " ", sig, "whsec")).toThrow(/mismatch/);
    const old = signWebhook(body, "whsec", Math.floor(Date.now() / 1000) - 3600);
    expect(() => verifyWebhook(body, old, "whsec")).toThrow(/tolerance/);
  });

  it("a paid checkout upgrades the plan once; premium lessons unlock", async () => {
    const { app, idp } = await setup();
    const jar = await signIn(app, idp, { cookie: "" });
    expect((await app.inject({ method: "PUT", url: "/v1/progress/ai-5-overfitting", headers: jar, payload: progress("ai-5-overfitting") })).statusCode).toBe(402);
    const me = (await app.inject({ method: "GET", url: "/auth/me", headers: jar })).json();
    const event = JSON.stringify({ id: "evt_9", type: "checkout.session.completed", data: { object: { client_reference_id: me.id, metadata: { plan: "classroom" } } } });
    const send = () => app.inject({ method: "POST", url: "/v1/billing/webhook", headers: { "content-type": "application/json", "stripe-signature": signWebhook(event, "whsec_test") }, payload: event });
    expect((await send()).json()).toEqual({ received: true });
    expect((await send()).json()).toMatchObject({ duplicate: true });
    expect((await app.inject({ method: "GET", url: "/auth/me", headers: jar })).json()).toMatchObject({ plan: "classroom", role: "teacher" });
    expect((await app.inject({ method: "PUT", url: "/v1/progress/ai-5-overfitting", headers: jar, payload: progress("ai-5-overfitting") })).statusCode).toBe(204);
    const bad = await app.inject({ method: "POST", url: "/v1/billing/webhook", headers: { "content-type": "application/json", "stripe-signature": "t=1,v1=00" }, payload: event });
    expect(bad.statusCode).toBe(400);
  });
});

describe("security", () => {
  it("blocks cross-origin writes and rate-limits", async () => {
    const app = await buildApp({ cookieSecret: SECRET, webOrigin: WEB, rateLimit: 3 });
    const evil = await app.inject({ method: "PUT", url: "/v1/progress/ai-1-data", headers: { origin: "https://evil.test" }, payload: progress("ai-1-data") });
    expect(evil.statusCode).toBe(403);
    const codes = [];
    for (let i = 0; i < 4; i++) codes.push((await app.inject({ method: "POST", url: "/auth/logout" })).statusCode);
    expect(codes.at(-1)).toBe(429);
  });

  it("admin role comes from the configured email list", async () => {
    const { app, idp } = await setup({ sub: "a1", email: "Boss@Inside.kz", name: "Admin" }, ["boss@inside.kz"]);
    const jar = await signIn(app, idp, { cookie: "" });
    const list = await app.inject({ method: "GET", url: "/v1/admin/learners", headers: jar });
    expect(list.statusCode).toBe(200);
    expect(list.json().some((l: { role: string }) => l.role === "admin")).toBe(true);
  });
});
