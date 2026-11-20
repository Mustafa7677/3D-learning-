import { randomUUID } from "node:crypto";
import Fastify, { type FastifyInstance, type FastifyRequest, type FastifyReply } from "fastify";
import cookie from "@fastify/cookie";
import type { LessonProgress } from "@inside-tech/lesson-engine";
import { InMemoryProgressRepository, type ProgressRepository } from "./progress-repo";

export interface AppOptions {
  repo?: ProgressRepository;
  /** Secret used to sign the anonymous learner cookie. */
  cookieSecret: string;
  /** Allowed browser origin for CORS (the web app). */
  webOrigin?: string;
  secureCookies?: boolean;
  logger?: boolean;
}

const LEARNER_COOKIE = "it_lid";
const ID_PATTERN = "^[a-z0-9-]{1,64}$";

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
    completedAt: { type: "number" },
    startedAt: { type: "number" },
    updatedAt: { type: "number" },
  },
} as const;

/**
 * Anonymous learners get a signed, httpOnly id cookie. When OAuth/OIDC lands,
 * the authenticated subject replaces this id and anonymous progress is merged.
 */
function learnerId(req: FastifyRequest, reply: FastifyReply, secure: boolean): string {
  const raw = req.cookies[LEARNER_COOKIE];
  if (raw) {
    const r = req.unsignCookie(raw);
    if (r.valid && r.value) return r.value;
  }
  const id = randomUUID();
  reply.setCookie(LEARNER_COOKIE, id, {
    signed: true,
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return id;
}

export async function buildApp(opts: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? false, bodyLimit: 64 * 1024 });
  const repo = opts.repo ?? new InMemoryProgressRepository();
  const secure = opts.secureCookies ?? false;

  await app.register(cookie, { secret: opts.cookieSecret });

  if (opts.webOrigin) {
    const origin = opts.webOrigin;
    app.addHook("onRequest", async (req, reply) => {
      if (req.headers.origin === origin) {
        reply.header("access-control-allow-origin", origin);
        reply.header("access-control-allow-credentials", "true");
        reply.header("vary", "origin");
      }
      if (req.method === "OPTIONS") {
        reply.header("access-control-allow-methods", "GET,PUT,OPTIONS");
        reply.header("access-control-allow-headers", "content-type");
        return reply.code(204).send();
      }
    });
  }

  app.get("/health", async () => ({ status: "ok" }));

  app.get("/v1/progress", async (req, reply) => {
    return repo.list(learnerId(req, reply, secure));
  });

  app.get<{ Params: { lessonId: string } }>(
    "/v1/progress/:lessonId",
    { schema: { params: { type: "object", properties: { lessonId: { type: "string", pattern: ID_PATTERN } } } } },
    async (req, reply) => {
      const p = await repo.get(learnerId(req, reply, secure), req.params.lessonId);
      if (!p) return reply.code(404).send({ error: "not_found" });
      return p;
    },
  );

  app.put<{ Params: { lessonId: string }; Body: LessonProgress }>(
    "/v1/progress/:lessonId",
    {
      schema: {
        params: { type: "object", properties: { lessonId: { type: "string", pattern: ID_PATTERN } } },
        body: progressSchema,
      },
    },
    async (req, reply) => {
      if (req.body.lessonId !== req.params.lessonId) return reply.code(400).send({ error: "lesson_mismatch" });
      await repo.put(learnerId(req, reply, secure), req.body);
      return reply.code(204).send();
    },
  );

  return app;
}
