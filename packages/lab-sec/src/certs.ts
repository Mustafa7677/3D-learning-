/**
 * A certificate chain the way a browser checks it: leaf → intermediate →
 * root in the trust store. Signatures are a toy (SHA-256 of the issuer's key
 * and the certificate's content), but the checks and their order are real.
 */
import { sha256 } from "./crypto";

export interface Cert {
  subject: string;
  issuer: string;
  /** Names the certificate is valid for (subjectAltName). */
  san: string[];
  notBefore: number; // day number
  notAfter: number;
  isCA: boolean;
  /** Public key id of this certificate's own key. */
  key: string;
  signature: string;
}

const content = (c: Omit<Cert, "signature">) => JSON.stringify([c.subject, c.issuer, c.san, c.notBefore, c.notAfter, c.isCA, c.key]);
/** Only the holder of `issuerKey` can produce this (in the toy: the key id is the secret). */
export const sign = (c: Omit<Cert, "signature">, issuerKey: string): Cert => ({ ...c, signature: sha256(issuerKey + content(c)).slice(0, 16) });
const signedBy = (c: Cert, issuerKey: string) => c.signature === sha256(issuerKey + content(c)).slice(0, 16);

export const TODAY = 400;
export const ROOT = sign({ subject: "Qazaq Root CA", issuer: "Qazaq Root CA", san: [], notBefore: 0, notAfter: 7300, isCA: true, key: "root-key" }, "root-key");
export const INTERMEDIATE = sign({ subject: "Qazaq TLS CA 1", issuer: "Qazaq Root CA", san: [], notBefore: 100, notAfter: 2000, isCA: true, key: "int-key" }, "root-key");
export const leafFor = (host: string, notAfter = 500) => sign({ subject: host, issuer: "Qazaq TLS CA 1", san: [host, `www.${host}`], notBefore: 300, notAfter, isCA: false, key: `${host}-key` }, "int-key");

export type Fault = "none" | "missingIntermediate" | "expired" | "wrongHost" | "selfSigned" | "tampered" | "untrustedRoot";

export const FAULTS: Fault[] = ["none", "missingIntermediate", "expired", "wrongHost", "selfSigned", "tampered", "untrustedRoot"];

/** What the server sends (leaf first), and the browser's trust store, under one fault. */
export function scenarioChain(fault: Fault, host = "inside.kz"): { chain: Cert[]; trust: Cert[] } {
  const trust = fault === "untrustedRoot" ? [] : [ROOT];
  switch (fault) {
    case "missingIntermediate":
      return { chain: [leafFor(host)], trust };
    case "expired":
      return { chain: [leafFor(host, 390), INTERMEDIATE], trust };
    case "wrongHost":
      return { chain: [leafFor("shop.kz"), INTERMEDIATE], trust };
    case "selfSigned":
      return { chain: [sign({ subject: host, issuer: host, san: [host], notBefore: 300, notAfter: 900, isCA: false, key: "self-key" }, "self-key")], trust };
    case "tampered": {
      // An attacker takes the real certificate of shop.kz and writes inside.kz into it.
      const real = leafFor("shop.kz");
      return { chain: [{ ...real, subject: host, san: [host] }, INTERMEDIATE], trust };
    }
    default:
      return { chain: [leafFor(host), INTERMEDIATE], trust };
  }
}

export type CertError = "NAME_MISMATCH" | "EXPIRED" | "BAD_SIGNATURE" | "SELF_SIGNED" | "UNKNOWN_ISSUER" | null;

export interface CertCheck {
  subject: string;
  what: string;
  ok: boolean;
}

export interface Verdict {
  ok: boolean;
  error: CertError;
  checks: CertCheck[];
}

/** Walk the chain from the leaf up to a trusted root, checking each link. */
export function verifyChain(chain: Cert[], trust: Cert[], host: string, today = TODAY): Verdict {
  const checks: CertCheck[] = [];
  const fail = (error: CertError): Verdict => ({ ok: false, error, checks });
  const leaf = chain[0];
  if (!leaf) return fail("UNKNOWN_ISSUER");
  const nameOk = leaf.san.includes(host);
  checks.push({ subject: leaf.subject, what: `Атауы: ${host} SAN тізімінде ${nameOk ? "бар" : "жоқ"}`, ok: nameOk });
  if (!nameOk) return fail("NAME_MISMATCH");
  let cert = leaf;
  for (let depth = 0; depth < 5; depth++) {
    const fresh = today >= cert.notBefore && today <= cert.notAfter;
    checks.push({ subject: cert.subject, what: `Мерзімі: ${cert.notBefore}-${cert.notAfter} күн, бүгін ${today}`, ok: fresh });
    if (!fresh) return fail("EXPIRED");
    const anchor = trust.find((t) => t.subject === cert.issuer);
    const parent = anchor ?? chain.find((c) => c !== cert && c.subject === cert.issuer && c.isCA);
    if (!parent) {
      const self = cert.issuer === cert.subject;
      checks.push({ subject: cert.subject, what: self ? "Өзін-өзі қолтаңбалаған: сенімді орталық жоқ" : `Қолтаңба иесі «${cert.issuer}» табылмады`, ok: false });
      return fail(self ? "SELF_SIGNED" : "UNKNOWN_ISSUER");
    }
    const sigOk = signedBy(cert, parent.key);
    checks.push({ subject: cert.subject, what: `Қолтаңба: «${parent.subject}» кілтімен ${sigOk ? "расталды" : "сәйкес емес"}`, ok: sigOk });
    if (!sigOk) return fail("BAD_SIGNATURE");
    if (anchor) {
      checks.push({ subject: anchor.subject, what: "Браузердің сенім қоймасында бар", ok: true });
      return { ok: true, error: null, checks };
    }
    cert = parent;
  }
  return fail("UNKNOWN_ISSUER");
}
