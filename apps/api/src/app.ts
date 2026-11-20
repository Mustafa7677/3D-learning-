import { randomInt, randomUUID } from "node:crypto";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import type { LessonProgress } from "@inside-tech/lesson-engine";
import { canAccessLesson, createCheckoutSession, verifyWebhook, type BillingConfig } from "./billing";
import { authorizeUrl, discover, exchangeCode, fetchJwks, randomToken, verifyIdToken, type Discovery, type OidcConfig } from "./oidc";
import { MemoryStore, type Learner, type Plan, type Store } from "./store";

export interface AppOptions {
  store?: Store;
  /** Secret used to sign cookies (learner id, login state). */
  cookieSecret: string;
  /** Allowed browser origin for CORS and CSRF checks (the web app). */
  webOrigin?: string;
  secureCookies?: boolean;
  logger?: boolean;
  oidc?: OidcConfig;
  billing?: BillingConfig;
  /** Emails that get the admin role on login. */
  adminEmails?: string[];
  fetchFn?: typeof fetch;
  now?: () => number;
  /** Requests per minute per IP for auth and write endpoints. */
  rateLimit?: number;
}

const LEARNER_COOKIE = "it_lid";
const LOGIN_COOKIE = "it_login";
const ID_PATTERN = "^[a-z0-9-]{1,64}$";

declare module "fastify" {
  interface FastifyRequest {
    rawBody?: string;
  }
}

const progressSchema = {
  type: "object",
  additionalProperties: false,
  required: ["lessonId", "stepIndex", "completed", "startedAt", "updatedAt"],
  properties: {
    lessonId: { type: "string", pattern: ID_PATTERN },
    stepIndex: { type: "integer", minimum: 0, maximum: 100 },
    completed: {
      type: "object",
      maxProperties: 50,
      propertyNames: { pattern: ID_PATTERN },
      additionalProperties: { type: "array", maxItems: 50, items: { type: "string", pattern: ID_PATTERN } },
    },
    answers: {
      type: "object",
      maxProperties: 50,
      propertyNames: { pattern: ID_PATTERN },
      additionalProperties: { type: "array", maxItems: 20, items: { type: "string", pattern: ID_PATTERN } },
    },
    completedAt: { type: "number" },
    startedAt: { type: "number" },
    updatedAt: { type: "number" },
  },
} as const;

const lessonParams = { type: "object", properties: { lessonId: { type: "string", pattern: ID_PATTERN } } } as const;
const uuidParams = { type: "object", properties: { id: { type: "string", format: "uuid" } } } as const;

const publicLearner = (l: Learner) => ({ id: l.id, name: l.name, email: l.email, role: l.role, plan: l.plan, signedIn: !!l.authSubject });

/** Six-character class code without look-alike characters. */
function joinCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join("");
}

export async function buildApp(opts: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? false, bodyLimit: 64 * 1024, trustProxy: true });
  const store = opts.store ?? new MemoryStore();
  const secure = opts.secureCookies ?? false;
  const now = opts.now ?? Date.now;
  const fetchFn = opts.fetchFn ?? fetch;
  const admins = new Set((opts.adminEmails ?? []).map((e) => e.toLowerCase()));

  await app.register(cookie, { secret: opts.cookieSecret });

  // Keep the raw JSON body (Stripe signs the exact bytes) and parse it ourselves.
  app.addContentTypeParser("application/json", { parseAs: "string" }, (req, body, done) => {
    req.rawBody = body as string;
    if (!body) return done(null, {});
    try {
      done(null, JSON.parse(body as string));
    } catch {
      const err = new Error("invalid JSON") as Error & { statusCode: number };
      err.statusCode = 400;
      done(err, undefined);
    }
  });

  // ---- CORS + CSRF: only the web app's origin may call state-changing endpoints from a browser.
  if (opts.webOrigin) {
    const origin = opts.webOrigin;
    app.addHook("onRequest", async (req, reply) => {
      const from = req.headers.origin;
      if (from === origin) {
        reply.header("access-control-allow-origin", origin);
        reply.header("access-control-allow-credentials", "true");
        reply.header("vary", "origin");
      }
      if (req.method === "OPTIONS") {
        reply.header("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
        reply.header("access-control-allow-headers", "content-type");
        return reply.code(204).send();
      }
      const unsafe = !["GET", "HEAD"].includes(req.method);
      if (unsafe && from && from !== origin && !req.url.startsWith("/v1/billing/webhook")) {
        return reply.code(403).send({ error: "forbidden_origin" });
      }
    });
  }

  // ---- Simple fixed-window rate limit per IP for auth and writes.
  const limit = opts.rateLimit ?? 120;
  const hits = new Map<string, { n: number; reset: number }>();
  app.addHook("onRequest", async (req, reply) => {
    const sensitive = req.url.startsWith("/auth/") || !["GET", "HEAD", "OPTIONS"].includes(req.method);
    if (!sensitive) return;
    const t = now();
    const h = hits.get(req.ip);
    if (!h || h.reset < t) hits.set(req.ip, { n: 1, reset: t + 60_000 });
    else if (++h.n > limit) return reply.code(429).send({ error: "rate_limited" });
  });

  const cookieOpts = { signed: true, httpOnly: true, sameSite: "lax" as const, secure, path: "/" };

  /** Current learner (created on first visit). */
  async function learner(req: FastifyRequest, reply: FastifyReply): Promise<Learner> {
    const raw = req.cookies[LEARNER_COOKIE];
    if (raw) {
      const r = req.unsignCookie(raw);
      if (r.valid && r.value) {
        const l = await store.getLearner(r.value);
        if (l) return l;
      }
    }
    const l: Learner = { id: randomUUID(), authSubject: null, email: null, name: null, role: "student", plan: "free", createdAt: now() };
    await store.createLearner(l);
    reply.setCookie(LEARNER_COOKIE, l.id, { ...cookieOpts, maxAge: 60 * 60 * 24 * 365 });
    return l;
  }

  const requireRole = async (req: FastifyRequest, reply: FastifyReply, roles: Learner["role"][]) => {
    const l = await learner(req, reply);
    if (!l.authSubject) {
      reply.code(401).send({ error: "sign_in_required" });
      return undefined;
    }
    if (!roles.includes(l.role)) {
      reply.code(403).send({ error: "forbidden" });
      return undefined;
    }
    return l;
  };

  app.get("/health", async () => ({ status: "ok" }));

  // ---------------- auth ----------------

  app.get("/auth/me", async (req, reply) => {
    const l = await learner(req, reply);
    return publicLearner(l);
  });

  let discovery: Discovery | undefined;
  const getDiscovery = async () => (discovery ??= await discover(opts.oidc!.issuer, fetchFn));

  /** Only redirect back into the web app. */
  const safeReturn = (to: unknown) => {
    const base = opts.webOrigin ?? "/";
    if (typeof to !== "string" || !opts.webOrigin) return base;
    try {
      const u = new URL(to, opts.webOrigin);
      return u.origin === opts.webOrigin ? u.toString() : base;
    } catch {
      return base;
    }
  };

  app.get<{ Querystring: { returnTo?: string } }>("/auth/login", async (req, reply) => {
    if (!opts.oidc) return reply.code(501).send({ error: "sign_in_not_configured" });
    const d = await getDiscovery();
    const state = randomToken(16);
    const nonce = randomToken(16);
    const verifier = randomToken(32);
    reply.setCookie(LOGIN_COOKIE, JSON.stringify({ state, nonce, verifier, returnTo: safeReturn(req.query.returnTo) }), { ...cookieOpts, maxAge: 600 });
    return reply.redirect(authorizeUrl(d, opts.oidc, { state, nonce, verifier }));
  });

  app.get<{ Querystring: { code?: string; state?: string } }>("/auth/callback", async (req, reply) => {
    if (!opts.oidc) return reply.code(501).send({ error: "sign_in_not_configured" });
    const raw = req.cookies[LOGIN_COOKIE];
    const un = raw ? req.unsignCookie(raw) : undefined;
    reply.clearCookie(LOGIN_COOKIE, { path: "/" });
    if (!un?.valid || !un.value) return reply.code(400).send({ error: "login_expired" });
    const pending = JSON.parse(un.value) as { state: string; nonce: string; verifier: string; returnTo: string };
    if (!req.query.code || req.query.state !== pending.state) return reply.code(400).send({ error: "state_mismatch" });

    let claims;
    try {
      const d = await getDiscovery();
      const idToken = await exchangeCode(d, opts.oidc, req.query.code, pending.verifier, fetchFn);
      claims = await verifyIdToken(idToken, { jwks: await fetchJwks(d, fetchFn), issuer: d.issuer, audience: opts.oidc.clientId, nonce: pending.nonce, now: now() });
    } catch (e) {
      req.log.warn({ err: e }, "oidc callback failed");
      return reply.code(401).send({ error: "sign_in_failed" });
    }

    const current = await learner(req, reply);
    const subject = `${claims.iss}|${claims.sub}`;
    const existing = await store.findLearnerBySubject(subject);
    const email = typeof claims.email === "string" ? claims.email : null;
    const role = email && admins.has(email.toLowerCase()) ? "admin" : undefined;
    let account: Learner;
    if (existing) {
      // Merge anonymous progress into the account; newer progress wins per lesson.
      if (existing.id !== current.id && !current.authSubject) {
        for (const p of await store.listProgress(current.id)) await store.putProgress(existing.id, p);
      }
      await store.updateLearner(existing.id, { email, name: claims.name ?? existing.name, ...(role ? { role } : {}) });
      account = (await store.getLearner(existing.id))!;
    } else if (!current.authSubject) {
      await store.updateLearner(current.id, { authSubject: subject, email, name: claims.name ?? null, ...(role ? { role } : {}) });
      account = (await store.getLearner(current.id))!;
    } else {
      account = { id: randomUUID(), authSubject: subject, email, name: claims.name ?? null, role: role ?? "student", plan: "free", createdAt: now() };
      await store.createLearner(account);
    }
    reply.setCookie(LEARNER_COOKIE, account.id, { ...cookieOpts, maxAge: 60 * 60 * 24 * 365 });
    return reply.redirect(pending.returnTo);
  });

  app.post("/auth/logout", async (_req, reply) => {
    reply.clearCookie(LEARNER_COOKIE, { path: "/" });
    return reply.code(204).send();
  });

  // ---------------- progress ----------------

  app.get("/v1/progress", async (req, reply) => store.listProgress((await learner(req, reply)).id));

  app.get<{ Params: { lessonId: string } }>("/v1/progress/:lessonId", { schema: { params: lessonParams } }, async (req, reply) => {
    const p = await store.getProgress((await learner(req, reply)).id, req.params.lessonId);
    if (!p) return reply.code(404).send({ error: "not_found" });
    return p;
  });

  app.put<{ Params: { lessonId: string }; Body: LessonProgress }>(
    "/v1/progress/:lessonId",
    { schema: { params: lessonParams, body: progressSchema } },
    async (req, reply) => {
      if (req.body.lessonId !== req.params.lessonId) return reply.code(400).send({ error: "lesson_mismatch" });
      const l = await learner(req, reply);
      if (!canAccessLesson(l.plan, req.params.lessonId)) return reply.code(402).send({ error: "plan_required" });
      await store.putProgress(l.id, req.body);
      return reply.code(204).send();
    },
  );

  app.get<{ Params: { lessonId: string } }>("/v1/access/:lessonId", { schema: { params: lessonParams } }, async (req, reply) => {
    const l = await learner(req, reply);
    return { lessonId: req.params.lessonId, allowed: canAccessLesson(l.plan, req.params.lessonId), plan: l.plan };
  });

  // ---------------- classes (teachers) ----------------

  app.post<{ Body: { name: string } }>(
    "/v1/classes",
    { schema: { body: { type: "object", additionalProperties: false, required: ["name"], properties: { name: { type: "string", minLength: 1, maxLength: 80 } } } } },
    async (req, reply) => {
      const t = await requireRole(req, reply, ["teacher", "admin"]);
      if (!t) return;
      let code = joinCode();
      for (let i = 0; i < 5 && (await store.findClassByCode(code)); i++) code = joinCode();
      const c = { id: randomUUID(), teacherId: t.id, name: req.body.name.trim(), code, createdAt: now() };
      await store.createClass(c);
      return reply.code(201).send(c);
    },
  );

  app.get("/v1/classes", async (req, reply) => {
    const l = await learner(req, reply);
    const [teaching, joined] = await Promise.all([store.classesForTeacher(l.id), store.classesForStudent(l.id)]);
    return { teaching, joined: joined.map(({ id, name, teacherId }) => ({ id, name, teacherId })) };
  });

  app.post<{ Body: { code: string } }>(
    "/v1/classes/join",
    { schema: { body: { type: "object", additionalProperties: false, required: ["code"], properties: { code: { type: "string", pattern: "^[A-Za-z0-9]{6}$" } } } } },
    async (req, reply) => {
      const l = await learner(req, reply);
      if (!l.authSubject) return reply.code(401).send({ error: "sign_in_required" });
      const c = await store.findClassByCode(req.body.code.toUpperCase());
      if (!c) return reply.code(404).send({ error: "class_not_found" });
      await store.joinClass(c.id, l.id);
      return { id: c.id, name: c.name };
    },
  );

  const ownClass = async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const t = await requireRole(req, reply, ["teacher", "admin"]);
    if (!t) return undefined;
    const c = await store.getClass(req.params.id);
    if (!c || (c.teacherId !== t.id && t.role !== "admin")) {
      reply.code(404).send({ error: "class_not_found" });
      return undefined;
    }
    return c;
  };

  app.post<{ Params: { id: string }; Body: { lessonId: string; dueAt?: number } }>(
    "/v1/classes/:id/assignments",
    {
      schema: {
        params: uuidParams,
        body: { type: "object", additionalProperties: false, required: ["lessonId"], properties: { lessonId: { type: "string", pattern: ID_PATTERN }, dueAt: { type: "number" } } },
      },
    },
    async (req, reply) => {
      const c = await ownClass(req, reply);
      if (!c) return;
      const a = { id: randomUUID(), classId: c.id, lessonId: req.body.lessonId, dueAt: req.body.dueAt ?? null, createdAt: now() };
      await store.addAssignment(a);
      return reply.code(201).send(a);
    },
  );

  /** Students × lessons: completion per assigned lesson, for the class's teacher. */
  app.get<{ Params: { id: string } }>("/v1/classes/:id/report", { schema: { params: uuidParams } }, async (req, reply) => {
    const c = await ownClass(req, reply);
    if (!c) return;
    const [members, assignments] = await Promise.all([store.classMembers(c.id), store.assignments(c.id)]);
    const students = await Promise.all(
      members.map(async (m) => {
        const progress = await store.listProgress(m.id);
        const byLesson = Object.fromEntries(progress.map((p) => [p.lessonId, p]));
        return {
          id: m.id,
          name: m.name ?? m.email ?? "Оқушы",
          lessons: Object.fromEntries(
            assignments.map((a) => {
              const p = byLesson[a.lessonId];
              const done = p ? Object.values(p.completed).reduce((n, xs) => n + xs.length, 0) : 0;
              return [a.lessonId, { started: !!p, completed: !!p?.completedAt, objectivesDone: done, updatedAt: p?.updatedAt ?? null }];
            }),
          ),
        };
      }),
    );
    return { class: c, assignments, students };
  });

  app.get<{ Params: { id: string } }>("/v1/classes/:id/assignments", { schema: { params: uuidParams } }, async (req, reply) => {
    const l = await learner(req, reply);
    const c = await store.getClass(req.params.id);
    const member = c && ((await store.classesForStudent(l.id)).some((x) => x.id === c.id) || c.teacherId === l.id);
    if (!c || !member) return reply.code(404).send({ error: "class_not_found" });
    return store.assignments(c.id);
  });

  // ---------------- billing ----------------

  app.post<{ Body: { plan: Exclude<Plan, "free"> } }>(
    "/v1/billing/checkout",
    { schema: { body: { type: "object", additionalProperties: false, required: ["plan"], properties: { plan: { type: "string", enum: ["premium", "classroom"] } } } } },
    async (req, reply) => {
      if (!opts.billing) return reply.code(501).send({ error: "billing_not_configured" });
      const l = await learner(req, reply);
      if (!l.authSubject) return reply.code(401).send({ error: "sign_in_required" });
      try {
        const s = await createCheckoutSession(opts.billing, req.body.plan, l, fetchFn);
        return { url: s.url };
      } catch (e) {
        req.log.error({ err: e }, "checkout failed");
        return reply.code(502).send({ error: "checkout_failed" });
      }
    },
  );

  const seenEvents = new Set<string>();
  app.post("/v1/billing/webhook", async (req, reply) => {
    if (!opts.billing) return reply.code(501).send({ error: "billing_not_configured" });
    let event;
    try {
      event = verifyWebhook(req.rawBody ?? "", req.headers["stripe-signature"] as string | undefined, opts.billing.webhookSecret, now());
    } catch {
      return reply.code(400).send({ error: "bad_signature" });
    }
    if (seenEvents.has(event.id)) return { received: true, duplicate: true };
    seenEvents.add(event.id);
    const obj = event.data.object as { client_reference_id?: string; metadata?: { plan?: string; learner_id?: string } };
    const learnerId = obj.client_reference_id ?? obj.metadata?.learner_id;
    if (event.type === "checkout.session.completed" && learnerId) {
      const plan = obj.metadata?.plan === "classroom" ? "classroom" : "premium";
      const l = await store.getLearner(learnerId);
      if (l) await store.updateLearner(l.id, { plan, ...(plan === "classroom" && l.role === "student" ? { role: "teacher" as const } : {}) });
    }
    if (event.type === "customer.subscription.deleted" && learnerId) {
      await store.updateLearner(learnerId, { plan: "free" });
    }
    return { received: true };
  });

  // ---------------- admin ----------------

  app.get("/v1/admin/learners", async (req, reply) => {
    const a = await requireRole(req, reply, ["admin"]);
    if (!a) return;
    return (await store.listLearners(200)).map(publicLearner);
  });

  app.patch<{ Params: { id: string }; Body: { role?: Learner["role"]; plan?: Plan } }>(
    "/v1/admin/learners/:id",
    {
      schema: {
        params: uuidParams,
        body: { type: "object", additionalProperties: false, properties: { role: { type: "string", enum: ["student", "teacher", "admin"] }, plan: { type: "string", enum: ["free", "premium", "classroom"] } } },
      },
    },
    async (req, reply) => {
      const a = await requireRole(req, reply, ["admin"]);
      if (!a) return;
      if (!(await store.getLearner(req.params.id))) return reply.code(404).send({ error: "not_found" });
      await store.updateLearner(req.params.id, req.body);
      return publicLearner((await store.getLearner(req.params.id))!);
    },
  );

  return app;
}
