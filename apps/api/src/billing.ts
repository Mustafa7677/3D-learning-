import { createHmac, timingSafeEqual } from "node:crypto";
import type { Plan } from "./store";

/**
 * Stripe Checkout over plain HTTPS (no SDK). The API creates a Checkout
 * Session for a plan's price; Stripe calls back the webhook, whose signature
 * is verified before the learner's plan changes.
 */
export interface BillingConfig {
  secretKey: string;
  webhookSecret: string;
  prices: Partial<Record<Exclude<Plan, "free">, string>>;
  successUrl: string;
  cancelUrl: string;
}

type Fetch = typeof fetch;

export async function createCheckoutSession(
  cfg: BillingConfig,
  plan: Exclude<Plan, "free">,
  learner: { id: string; email: string | null },
  fetchFn: Fetch = fetch,
): Promise<{ id: string; url: string }> {
  const price = cfg.prices[plan];
  if (!price) throw new Error(`no price configured for plan ${plan}`);
  const body = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": price,
    "line_items[0][quantity]": "1",
    success_url: cfg.successUrl,
    cancel_url: cfg.cancelUrl,
    client_reference_id: learner.id,
    "metadata[plan]": plan,
    "metadata[learner_id]": learner.id,
  });
  if (learner.email) body.set("customer_email", learner.email);
  const res = await fetchFn("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { authorization: `Bearer ${cfg.secretKey}`, "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as { id?: string; url?: string; error?: { message?: string } };
  if (!res.ok || !json.url || !json.id) throw new Error(`Stripe: ${json.error?.message ?? res.status}`);
  return { id: json.id, url: json.url };
}

export interface StripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

/** Verify a `Stripe-Signature` header (t=…,v1=…) against the raw request body. */
export function verifyWebhook(payload: string, header: string | undefined, secret: string, now = Date.now(), toleranceSec = 300): StripeEvent {
  if (!header) throw new Error("missing signature");
  const parts = Object.fromEntries(
    header.split(",").map((kv) => {
      const i = kv.indexOf("=");
      return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()];
    }),
  );
  const t = Number(parts.t);
  const sigs = header
    .split(",")
    .filter((kv) => kv.trim().startsWith("v1="))
    .map((kv) => kv.trim().slice(3));
  if (!Number.isFinite(t) || sigs.length === 0) throw new Error("malformed signature header");
  if (Math.abs(now / 1000 - t) > toleranceSec) throw new Error("signature timestamp outside tolerance");
  const expected = createHmac("sha256", secret).update(`${t}.${payload}`).digest();
  const match = sigs.some((s) => {
    const got = Buffer.from(s, "hex");
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
  if (!match) throw new Error("signature mismatch");
  return JSON.parse(payload) as StripeEvent;
}

export function signWebhook(payload: string, secret: string, t = Math.floor(Date.now() / 1000)): string {
  return `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex")}`;
}

/** Free tier: the first four lessons of every lab. Paid plans unlock everything. */
export function canAccessLesson(plan: Plan, lessonId: string): boolean {
  if (plan !== "free") return true;
  const n = Number(/^[a-z]+-(\d+)-/.exec(lessonId)?.[1]);
  return Number.isFinite(n) && n <= 4;
}
