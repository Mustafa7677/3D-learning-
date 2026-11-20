import { createHash, randomBytes, webcrypto } from "node:crypto";

/**
 * OpenID Connect authorization-code flow with PKCE, using only Node's
 * built-in crypto and fetch. Works with any standards-compliant provider
 * (Google, Microsoft Entra ID, Keycloak, Auth0, …).
 */
export interface OidcConfig {
  issuer: string;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  scope?: string;
}

export interface Discovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
}

export interface IdClaims {
  iss: string;
  sub: string;
  aud: string | string[];
  exp: number;
  iat: number;
  nonce?: string;
  email?: string;
  name?: string;
  [k: string]: unknown;
}

type Fetch = typeof fetch;

export const b64url = (buf: Buffer | Uint8Array) => Buffer.from(buf).toString("base64url");
export const randomToken = (bytes = 32) => b64url(randomBytes(bytes));
export const pkceChallenge = (verifier: string) => b64url(createHash("sha256").update(verifier).digest());

export async function discover(issuer: string, fetchFn: Fetch = fetch): Promise<Discovery> {
  const res = await fetchFn(`${issuer.replace(/\/$/, "")}/.well-known/openid-configuration`);
  if (!res.ok) throw new Error(`OIDC discovery failed: ${res.status}`);
  const d = (await res.json()) as Discovery;
  if (d.issuer.replace(/\/$/, "") !== issuer.replace(/\/$/, "")) throw new Error("OIDC issuer mismatch in discovery document");
  return d;
}

export function authorizeUrl(d: Discovery, cfg: OidcConfig, p: { state: string; nonce: string; verifier: string }): string {
  const u = new URL(d.authorization_endpoint);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", cfg.clientId);
  u.searchParams.set("redirect_uri", cfg.redirectUri);
  u.searchParams.set("scope", cfg.scope ?? "openid email profile");
  u.searchParams.set("state", p.state);
  u.searchParams.set("nonce", p.nonce);
  u.searchParams.set("code_challenge", pkceChallenge(p.verifier));
  u.searchParams.set("code_challenge_method", "S256");
  return u.toString();
}

export async function exchangeCode(d: Discovery, cfg: OidcConfig, code: string, verifier: string, fetchFn: Fetch = fetch): Promise<string> {
  const body = new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: cfg.redirectUri, client_id: cfg.clientId, code_verifier: verifier });
  if (cfg.clientSecret) body.set("client_secret", cfg.clientSecret);
  const res = await fetchFn(d.token_endpoint, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
  if (!res.ok) throw new Error(`OIDC token exchange failed: ${res.status}`);
  const json = (await res.json()) as { id_token?: string };
  if (!json.id_token) throw new Error("OIDC token response has no id_token");
  return json.id_token;
}

interface Jwk {
  kid?: string;
  kty: string;
  alg?: string;
  n?: string;
  e?: string;
  use?: string;
}

export async function fetchJwks(d: Discovery, fetchFn: Fetch = fetch): Promise<Jwk[]> {
  const res = await fetchFn(d.jwks_uri);
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
  return ((await res.json()) as { keys: Jwk[] }).keys;
}

/** Verify an RS256 ID token's signature and standard claims. Throws on any failure. */
export async function verifyIdToken(token: string, opts: { jwks: Jwk[]; issuer: string; audience: string; nonce: string; now?: number }): Promise<IdClaims> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("malformed ID token");
  const [h, p, s] = parts as [string, string, string];
  const header = JSON.parse(Buffer.from(h, "base64url").toString("utf8")) as { alg: string; kid?: string };
  if (header.alg !== "RS256") throw new Error(`unsupported alg ${header.alg}`);
  const jwk = opts.jwks.find((k) => k.kty === "RSA" && (!header.kid || k.kid === header.kid));
  if (!jwk) throw new Error("no matching signing key");
  const key = await webcrypto.subtle.importKey("jwk", { kty: "RSA", n: jwk.n, e: jwk.e }, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await webcrypto.subtle.verify("RSASSA-PKCS1-v1_5", key, Buffer.from(s, "base64url"), Buffer.from(`${h}.${p}`));
  if (!ok) throw new Error("bad ID token signature");
  const claims = JSON.parse(Buffer.from(p, "base64url").toString("utf8")) as IdClaims;
  const now = Math.floor((opts.now ?? Date.now()) / 1000);
  if (claims.iss.replace(/\/$/, "") !== opts.issuer.replace(/\/$/, "")) throw new Error("issuer mismatch");
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(opts.audience)) throw new Error("audience mismatch");
  if (typeof claims.exp !== "number" || claims.exp < now - 60) throw new Error("ID token expired");
  if (typeof claims.iat === "number" && claims.iat > now + 60) throw new Error("ID token issued in the future");
  if (claims.nonce !== opts.nonce) throw new Error("nonce mismatch");
  if (!claims.sub) throw new Error("ID token has no subject");
  return claims;
}
