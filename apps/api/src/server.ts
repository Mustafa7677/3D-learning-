import { buildApp } from "./app";
import { PgStore, type Queryable } from "./pg-store";
import { MemoryStore, type Store } from "./store";

const env = process.env;
const fail = (msg: string): never => {
  console.error(msg);
  process.exit(1);
};

const secret = env.COOKIE_SECRET ?? "";
if (secret.length < 32) fail("COOKIE_SECRET must be set (at least 32 characters).");

/** PostgreSQL when DATABASE_URL is set (needs the `pg` package), in-memory otherwise. */
async function makeStore(): Promise<Store> {
  if (!env.DATABASE_URL) {
    console.warn("DATABASE_URL is not set: using the in-memory store (data is lost on restart).");
    return new MemoryStore();
  }
  let pg: { Pool: new (o: { connectionString: string }) => Queryable };
  try {
    pg = (await import(/* @vite-ignore */ "pg" as string)).default;
  } catch {
    return fail("DATABASE_URL is set but the `pg` package is missing. Install it: pnpm --filter @inside-tech/api add pg");
  }
  return new PgStore(new pg.Pool({ connectionString: env.DATABASE_URL }));
}

const oidc =
  env.OIDC_ISSUER && env.OIDC_CLIENT_ID && env.OIDC_REDIRECT_URI
    ? { issuer: env.OIDC_ISSUER, clientId: env.OIDC_CLIENT_ID, clientSecret: env.OIDC_CLIENT_SECRET, redirectUri: env.OIDC_REDIRECT_URI }
    : undefined;

const billing =
  env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET
    ? {
        secretKey: env.STRIPE_SECRET_KEY,
        webhookSecret: env.STRIPE_WEBHOOK_SECRET,
        prices: { premium: env.STRIPE_PRICE_PREMIUM, classroom: env.STRIPE_PRICE_CLASSROOM },
        successUrl: `${env.WEB_ORIGIN ?? "http://localhost:3000"}/account?checkout=success`,
        cancelUrl: `${env.WEB_ORIGIN ?? "http://localhost:3000"}/account?checkout=cancel`,
      }
    : undefined;

const app = await buildApp({
  store: await makeStore(),
  cookieSecret: secret,
  webOrigin: env.WEB_ORIGIN ?? "http://localhost:3000",
  secureCookies: env.NODE_ENV === "production",
  logger: true,
  oidc,
  billing,
  adminEmails: (env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
});

await app.listen({ port: Number(env.PORT ?? 4000), host: env.HOST ?? "127.0.0.1" });
