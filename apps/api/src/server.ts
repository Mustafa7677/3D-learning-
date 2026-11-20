import { buildApp } from "./app";

const secret = process.env.COOKIE_SECRET;
if (!secret || secret.length < 32) {
  console.error("COOKIE_SECRET must be set (at least 32 characters).");
  process.exit(1);
}

const app = await buildApp({
  cookieSecret: secret,
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
  secureCookies: process.env.NODE_ENV === "production",
  logger: true,
});

await app.listen({ port: Number(process.env.PORT ?? 4000), host: process.env.HOST ?? "127.0.0.1" });
