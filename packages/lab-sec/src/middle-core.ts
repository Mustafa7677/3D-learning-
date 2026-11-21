/**
 * Middle-level cryptography: block cipher modes on a picture (ECB leaks the
 * pattern, CBC hides it), hash versus HMAC for integrity, and Diffie-Hellman
 * with an eavesdropper and a man in the middle. Deterministic for fair tests.
 */
import { modPow, sha256 } from "./crypto";

// ---------------- block cipher modes ----------------

export const IMG = 16;
export const BLOCK = 4; // pixels (bytes) per block: a 32-bit block

/** A 16×16 picture with a large flat background: a diamond ornament. */
export function picture(): number[] {
  const px: number[] = [];
  for (let y = 0; y < IMG; y++)
    for (let x = 0; x < IMG; x++) {
      const d = Math.abs(x - 7.5) + Math.abs(y - 7.5);
      px.push(d < 2.5 ? 2 : d >= 4.5 && d < 6.5 ? 1 : 0);
    }
  return px;
}

export const blocksOf = (px: number[]) => Array.from({ length: px.length / BLOCK }, (_, i) => px.slice(i * BLOCK, i * BLOCK + BLOCK).reduce((v, b) => ((v << 8) | b) >>> 0, 0));

function mix16(x: number, key: number, round: number): number {
  let h = (x * 0x45d9f3b + key * 0x27d4eb2d + round * 0x9e3779b1) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d) >>> 0;
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39) >>> 0;
  h ^= h >>> 15;
  return h & 0xffff;
}

/** A toy 32-bit Feistel cipher, 4 rounds. Same key and block: same output, always. */
export function encryptBlock(block: number, key: number): number {
  let l = block >>> 16;
  let r = block & 0xffff;
  for (let i = 0; i < 4; i++) [l, r] = [r, l ^ mix16(r, key, i)];
  return ((l << 16) | r) >>> 0;
}

export function decryptBlock(block: number, key: number): number {
  let l = block >>> 16;
  let r = block & 0xffff;
  for (let i = 3; i >= 0; i--) [l, r] = [r ^ mix16(l, key, i), l];
  return ((l << 16) | r) >>> 0;
}

export type BlockMode = "ecb" | "cbc";
export const BLOCK_KEY = 0x5ec;
export const FIXED_IV = 0x12345678;

export function encryptBlocks(blocks: number[], mode: BlockMode, key: number, iv: number): number[] {
  let prev = iv >>> 0;
  return blocks.map((p) => {
    const c = encryptBlock(mode === "cbc" ? (p ^ prev) >>> 0 : p, key);
    prev = c;
    return c;
  });
}

export function decryptBlocks(cipher: number[], mode: BlockMode, key: number, iv: number): number[] {
  let prev = iv >>> 0;
  return cipher.map((c) => {
    const p = decryptBlock(c, key);
    const out = mode === "cbc" ? (p ^ prev) >>> 0 : p;
    prev = c;
    return out;
  });
}

/** A fresh IV per message, derived from a counter so runs are reproducible. */
export const randomIv = (n: number) => (Math.imul(n + 1, 0x9e3779b1) ^ 0xa5a5a5a5) >>> 0;

// ---------------- integrity: hash versus HMAC ----------------

const hexBytes = (hex: string) => new Uint8Array(hex.match(/../g)!.map((h) => parseInt(h, 16)));
const enc = (s: string) => new TextEncoder().encode(s);

/** HMAC-SHA256 (RFC 2104): H((K ⊕ opad) ‖ H((K ⊕ ipad) ‖ m)). */
export function hmac(key: string, message: string): string {
  let k = enc(key);
  if (k.length > 64) k = hexBytes(sha256(k));
  const pad = (byte: number) => {
    const out = new Uint8Array(64).fill(byte);
    k.forEach((b, i) => (out[i] = b ^ byte));
    return out;
  };
  const cat = (a: Uint8Array, b: Uint8Array) => {
    const out = new Uint8Array(a.length + b.length);
    out.set(a);
    out.set(b, a.length);
    return out;
  };
  const inner = hexBytes(sha256(cat(pad(0x36), enc(message))));
  return sha256(cat(pad(0x5c), inner));
}

export type MacScheme = "none" | "hash" | "hmac";
export const BANK_KEY = "bank-7f3a-secret";
export const PAYMENT = "Кімге: Әлия · Сома: 1000 ₸";
export const FORGED = "Кімге: Әлия · Сома: 9000 ₸";

export const tagOf = (scheme: MacScheme, message: string, key = BANK_KEY) => (scheme === "none" ? "" : scheme === "hash" ? sha256(message) : hmac(key, message));

export interface Delivery {
  message: string;
  tag: string;
  tampered: boolean;
  recomputed: boolean;
  accepted: boolean;
}

/**
 * The app sends a payment with a tag; on the way an attacker may change the
 * amount and recompute the tag with what she knows: the hash function, never
 * the bank's key. The bank checks the tag with its key.
 */
export function deliver(scheme: MacScheme, tamper: boolean, recompute: boolean): Delivery {
  let message = PAYMENT;
  let tag = tagOf(scheme, message);
  if (tamper) {
    message = FORGED;
    if (recompute) tag = scheme === "hmac" ? hmac("attacker-guess", message) : tagOf(scheme, message);
  }
  const accepted = scheme === "none" || tag === tagOf(scheme, message);
  return { message, tag, tampered: tamper, recomputed: tamper && recompute, accepted };
}

// ---------------- Diffie-Hellman ----------------

export const DH_SMALL = { p: 23, g: 5 };
/** 2^31 - 1 is prime and 7 generates its whole group. Still tiny next to real 2048-bit groups. */
export const DH_LARGE = { p: 2_147_483_647, g: 7 };
export const MALLORY_SECRET = 13;
export const EVE_BUDGET = 1_000_000;

export interface DhExchange {
  A: number;
  B: number;
  /** What each side computes as the shared key. */
  alice: number;
  bob: number;
  mitm: boolean;
  /** Public keys were signed and the substitution was caught: no key agreed. */
  aborted: boolean;
  /** The keys Mallory holds with Alice and with Bob. */
  mallory: [number, number] | null;
}

export function dhExchange(p: number, g: number, a: number, b: number, mitm: boolean, signed: boolean): DhExchange {
  const A = modPow(g, a, p);
  const B = modPow(g, b, p);
  if (!mitm) return { A, B, alice: modPow(B, a, p), bob: modPow(A, b, p), mitm, aborted: false, mallory: null };
  const M = modPow(g, MALLORY_SECRET, p);
  if (signed) return { A, B, alice: 0, bob: 0, mitm, aborted: true, mallory: null };
  return { A, B, alice: modPow(M, a, p), bob: modPow(M, b, p), mitm, aborted: false, mallory: [modPow(A, MALLORY_SECRET, p), modPow(B, MALLORY_SECRET, p)] };
}

/** Eve sees p, g and A. She tries every exponent until g^k = A. */
export function eveBruteForce(p: number, g: number, A: number, budget = EVE_BUDGET): { found: number | null; tries: number } {
  let x = 1;
  for (let k = 1; k <= Math.min(budget, p - 1); k++) {
    x = Number((BigInt(x) * BigInt(g)) % BigInt(p));
    if (x === A) return { found: k, tries: k };
  }
  return { found: null, tries: Math.min(budget, p - 1) };
}
