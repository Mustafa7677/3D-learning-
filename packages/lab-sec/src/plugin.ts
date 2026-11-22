import type { AssessmentResult, SimulationPlugin } from "@inside-tech/sim-core";
import { crack, login, strength, isXss, type LoginResult, type Storage } from "./attacks";
import { bitDistance, caesar, modPow, rsaKeys, sha256, utf8, xorBytes, type RsaKeys } from "./crypto";
import { CHALLENGES, type ChallengeId } from "./text";
import { evaluateCsp, type Policy } from "./csp";
import { FAULTS, scenarioChain, verifyChain, type CertError, type Fault, type Verdict } from "./certs";
import {
  BLOCK_KEY,
  DH_LARGE,
  DH_SMALL,
  FIXED_IV,
  blocksOf,
  deliver,
  dhExchange,
  encryptBlocks,
  eveBruteForce,
  picture,
  randomIv,
  type BlockMode,
  type Delivery,
  type DhExchange,
  type MacScheme,
} from "./middle-core";

export type SecMode = "cipher" | "xor" | "hash" | "passwords" | "rsa" | "attack" | "blocks" | "mac" | "dh" | "certs" | "csp";

export interface SecStats {
  modes: SecMode[];
  /** Non-zero shifts used to encrypt the learner's own text. */
  ownShifts: number[];
  /** Own ciphertexts decrypted with the right key. */
  ownDecrypted: number;
  /** Distinct keys tried against each challenge. */
  guesses: Record<string, number[]>;
  solved: ChallengeId[];
  frequencyViews: number;
  xorRuns: { msgLen: number; keyLen: number; key: string; message: string }[];
  hashes: string[];
  /** Bit distance between consecutive hashed inputs that differ by one character. */
  avalanche: number[];
  crackRuns: { storage: Storage; cracked: number; work: number }[];
  strengths: { bits: number; inDictionary: boolean }[];
  keyPairs: { n: number; e: number; d: number }[];
  roundTrips: { n: number; m: number; c: number }[];
  signatures: number;
  decryptions: { n: number; c: number; m: number }[];
  logins: { ok: boolean; injected: boolean; parameterized: boolean; as: string | null; quote: boolean }[];
  comments: { attack: boolean; escaped: boolean }[];
  blockRuns: { mode: BlockMode; iv: "fixed" | "random"; distinct: number; first: number }[];
  macRuns: { scheme: MacScheme; tampered: boolean; recomputed: boolean; accepted: boolean }[];
  dhRuns: { p: number; match: boolean; mitm: boolean; signed: boolean; aborted: boolean }[];
  eveRuns: { p: number; found: boolean; tries: number }[];
  certRuns?: { fault: Fault; ok: boolean; error: CertError }[];
  cspRuns?: { policy: Policy; attacks: number; brokenLegit: number }[];
}

export interface SecLabState {
  mode: SecMode;
  cipher: { source: "own" | ChallengeId; text: string; shift: number; guess: number; showFreq: boolean };
  xor: { message: string; key: string };
  hash: { input: string; previous: string | null };
  passwords: { storage: Storage; lastCrack: { storage: Storage; cracked: { name: string; password: string }[]; work: number; same: string[][] } | null; candidate: string };
  rsa: { p: number; q: number; e: number; keys: RsaKeys | null; error: string | null; message: number; cipher: number | null; decrypted: number | null; signature: number | null; verified: number | null };
  attack: { user: string; pass: string; parameterized: boolean; last: LoginResult | null; comment: string; escape: boolean; posted: { text: string; escaped: boolean }[] };
  blocks: { mode: BlockMode; iv: "fixed" | "random"; runs: number; last: { mode: BlockMode; iv: number; cipher: number[] } | null };
  mac: { scheme: MacScheme; last: Delivery | null };
  dh: { big: boolean; a: number; b: number; mitm: boolean; signed: boolean; last: DhExchange | null; eve: { p: number; found: number | null; tries: number } | null };
  certs?: { fault: Fault; last: Verdict | null };
  csp?: { policy: Policy; ran: string[] | null };
  stats: SecStats;
}

export type SecLabAction =
  | { type: "mode/set"; mode: SecMode }
  | { type: "cipher/source"; source: "own" | ChallengeId }
  | { type: "cipher/text"; text: string }
  | { type: "cipher/shift"; shift: number }
  | { type: "cipher/guess"; guess: number }
  | { type: "cipher/freq"; on: boolean }
  | { type: "xor/set"; message?: string; key?: string }
  | { type: "xor/encrypt" }
  | { type: "hash/input"; text: string }
  | { type: "pw/storage"; storage: Storage }
  | { type: "pw/crack" }
  | { type: "pw/test"; password: string }
  | { type: "rsa/keys"; p: number; q: number; e: number }
  | { type: "rsa/encrypt"; m: number }
  | { type: "rsa/decrypt"; c: number }
  | { type: "rsa/sign"; m: number }
  | { type: "attack/fields"; user?: string; pass?: string }
  | { type: "attack/login" }
  | { type: "attack/param"; on: boolean }
  | { type: "attack/comment"; text: string }
  | { type: "attack/escape"; on: boolean }
  | { type: "attack/post" }
  | { type: "blocks/set"; mode?: BlockMode; iv?: "fixed" | "random" }
  | { type: "blocks/encrypt" }
  | { type: "mac/scheme"; scheme: MacScheme }
  | { type: "mac/send"; tamper: boolean; recompute: boolean }
  | { type: "dh/set"; big?: boolean; a?: number; b?: number; mitm?: boolean; signed?: boolean }
  | { type: "dh/exchange" }
  | { type: "dh/eve" }
  | { type: "certs/fault"; fault: Fault }
  | { type: "certs/connect" }
  | { type: "csp/policy"; policy: Policy }
  | { type: "csp/load" };

const uniq = <T>(xs: T[], x: T, max = 60) => (xs.includes(x) ? xs : [...xs, x].slice(-max));
const mod = (k: number, n: number) => ((Math.round(k) % n) + n) % n;
const cap = <T>(xs: T[], max = 30) => xs.slice(-max);

/** The text the learner currently sees as ciphertext. */
export function cipherText(s: SecLabState): string {
  const c = s.cipher;
  if (c.source === "own") return caesar(c.text, c.shift);
  const ch = CHALLENGES[c.source];
  return caesar(ch.text, ch.key);
}
/** The ciphertext decrypted with the learner's current guess. */
export const attempt = (s: SecLabState) => caesar(cipherText(s), -s.cipher.guess);

function checkSolved(s: SecLabState): SecLabState {
  const c = s.cipher;
  if (c.source === "own") {
    return c.shift !== 0 && c.guess === c.shift ? { ...s, stats: { ...s.stats, ownDecrypted: s.stats.ownDecrypted + 1 } } : s;
  }
  const key = CHALLENGES[c.source].key;
  return c.guess === key ? { ...s, stats: { ...s.stats, solved: uniq(s.stats.solved, c.source) } } : s;
}

/** One insertion, deletion or substitution apart. */
function oneEdit(a: string, b: string): boolean {
  if (a === b) return false;
  const [x, y] = [[...a], [...b]];
  if (Math.abs(x.length - y.length) > 1) return false;
  let i = 0;
  while (i < x.length && i < y.length && x[i] === y[i]) i++;
  let j = 0;
  while (j < x.length - i && j < y.length - i && x[x.length - 1 - j] === y[y.length - 1 - j]) j++;
  return x.length - i - j <= 1 && y.length - i - j <= 1;
}

export function initialSecState(): SecLabState {
  return {
    mode: "cipher",
    cipher: { source: "own", text: "Кездесу сағат сегізде", shift: 0, guess: 0, showFreq: false },
    xor: { message: "HELLO", key: "XMCKL" },
    hash: { input: "Сәлем", previous: null },
    passwords: { storage: "plain", lastCrack: null, candidate: "" },
    rsa: { p: 61, q: 53, e: 17, keys: null, error: null, message: 65, cipher: null, decrypted: null, signature: null, verified: null },
    attack: { user: "", pass: "", parameterized: false, last: null, comment: "", escape: false, posted: [] },
    blocks: { mode: "ecb", iv: "fixed", runs: 0, last: null },
    mac: { scheme: "none", last: null },
    dh: { big: false, a: 6, b: 15, mitm: false, signed: false, last: null, eve: null },
    stats: {
      modes: ["cipher"],
      ownShifts: [],
      ownDecrypted: 0,
      guesses: {},
      solved: [],
      frequencyViews: 0,
      xorRuns: [],
      hashes: [],
      avalanche: [],
      crackRuns: [],
      strengths: [],
      keyPairs: [],
      roundTrips: [],
      signatures: 0,
      decryptions: [],
      logins: [],
      comments: [],
      blockRuns: [],
      macRuns: [],
      dhRuns: [],
      eveRuns: [],
      certRuns: [],
      cspRuns: [],
    },
    csp: { policy: "none", ran: null },
    certs: { fault: "none", last: null },
  };
}

function reduce(s: SecLabState, a: SecLabAction): SecLabState {
  const st = s.stats;
  switch (a.type) {
    case "mode/set":
      return { ...s, mode: a.mode, stats: { ...st, modes: uniq(st.modes, a.mode) } };

    case "cipher/source":
      return { ...s, mode: "cipher", cipher: { ...s.cipher, source: a.source, guess: 0, showFreq: false } };
    case "cipher/text":
      return { ...s, cipher: { ...s.cipher, source: "own", text: a.text.slice(0, 400) } };
    case "cipher/shift": {
      const shift = mod(a.shift, 42);
      return { ...s, cipher: { ...s.cipher, shift }, stats: shift ? { ...st, ownShifts: uniq(st.ownShifts, shift) } : st };
    }
    case "cipher/guess": {
      const guess = mod(a.guess, 42);
      const key = s.cipher.source;
      const next = { ...s, cipher: { ...s.cipher, guess }, stats: { ...st, guesses: { ...st.guesses, [key]: uniq(st.guesses[key] ?? [], guess, 42) } } };
      return checkSolved(next);
    }
    case "cipher/freq":
      return { ...s, cipher: { ...s.cipher, showFreq: a.on }, stats: a.on ? { ...st, frequencyViews: st.frequencyViews + 1 } : st };

    case "xor/set":
      return { ...s, mode: "xor", xor: { message: (a.message ?? s.xor.message).slice(0, 60), key: (a.key ?? s.xor.key).slice(0, 60) } };
    case "xor/encrypt": {
      const { message, key } = s.xor;
      if (!message || !key) return s;
      const run = { msgLen: utf8(message).length, keyLen: utf8(key).length, key, message };
      return { ...s, stats: { ...st, xorRuns: cap([...st.xorRuns, run]) } };
    }

    case "hash/input": {
      const text = a.text.slice(0, 300);
      if (text === s.hash.input) return s;
      const avalanche = oneEdit(s.hash.input, text) ? cap([...st.avalanche, bitDistance(sha256(s.hash.input), sha256(text))]) : st.avalanche;
      return { ...s, mode: "hash", hash: { input: text, previous: s.hash.input }, stats: { ...st, hashes: cap(uniq(st.hashes, text, 200)), avalanche } };
    }

    case "pw/storage":
      return { ...s, mode: "passwords", passwords: { ...s.passwords, storage: a.storage, lastCrack: null } };
    case "pw/crack": {
      const r = crack(s.passwords.storage);
      return {
        ...s,
        passwords: { ...s.passwords, lastCrack: { storage: s.passwords.storage, cracked: r.cracked, work: r.work, same: r.sameHashGroups } },
        stats: { ...st, crackRuns: cap([...st.crackRuns, { storage: s.passwords.storage, cracked: r.cracked.length, work: r.work }]) },
      };
    }
    case "pw/test": {
      const pw = a.password.slice(0, 64);
      if (!pw) return { ...s, passwords: { ...s.passwords, candidate: pw } };
      const x = strength(pw);
      // Only the strength is recorded, never the password itself.
      return { ...s, passwords: { ...s.passwords, candidate: pw }, stats: { ...st, strengths: cap([...st.strengths, { bits: x.bits, inDictionary: x.inDictionary }]) } };
    }

    case "rsa/keys": {
      const r = rsaKeys(Math.round(a.p), Math.round(a.q), Math.round(a.e));
      const base = { ...s.rsa, p: a.p, q: a.q, e: a.e, cipher: null, decrypted: null, signature: null, verified: null };
      if ("error" in r) return { ...s, mode: "rsa", rsa: { ...base, keys: null, error: r.error } };
      return { ...s, mode: "rsa", rsa: { ...base, keys: r, error: null }, stats: { ...st, keyPairs: cap([...st.keyPairs, { n: r.n, e: r.e, d: r.d }]) } };
    }
    case "rsa/encrypt": {
      const k = s.rsa.keys;
      if (!k) return s;
      const m = Math.round(a.m);
      if (m < 0 || m >= k.n) return s;
      const c = modPow(m, k.e, k.n);
      const back = modPow(c, k.d, k.n);
      return { ...s, rsa: { ...s.rsa, message: m, cipher: c, decrypted: back }, stats: { ...st, roundTrips: cap([...st.roundTrips, { n: k.n, m, c }]) } };
    }
    case "rsa/decrypt": {
      const k = s.rsa.keys;
      if (!k) return s;
      const c = Math.round(a.c);
      if (c < 0 || c >= k.n) return s;
      const m = modPow(c, k.d, k.n);
      return { ...s, rsa: { ...s.rsa, cipher: c, decrypted: m }, stats: { ...st, decryptions: cap([...st.decryptions, { n: k.n, c, m }]) } };
    }
    case "rsa/sign": {
      const k = s.rsa.keys;
      if (!k) return s;
      const m = Math.round(a.m);
      if (m < 0 || m >= k.n) return s;
      const sig = modPow(m, k.d, k.n);
      return { ...s, rsa: { ...s.rsa, message: m, signature: sig, verified: modPow(sig, k.e, k.n) }, stats: { ...st, signatures: st.signatures + 1 } };
    }

    case "attack/fields":
      return { ...s, mode: "attack", attack: { ...s.attack, user: (a.user ?? s.attack.user).slice(0, 80), pass: (a.pass ?? s.attack.pass).slice(0, 80) } };
    case "attack/login": {
      const r = login(s.attack.user, s.attack.pass, s.attack.parameterized);
      return { ...s, attack: { ...s.attack, last: r }, stats: { ...st, logins: cap([...st.logins, { ok: r.ok, injected: r.injected, parameterized: s.attack.parameterized, as: r.as, quote: /'/.test(s.attack.user + s.attack.pass) }]) } };
    }
    case "attack/param":
      return { ...s, attack: { ...s.attack, parameterized: a.on, last: null } };
    case "attack/comment":
      return { ...s, attack: { ...s.attack, comment: a.text.slice(0, 200) } };
    case "attack/escape":
      return { ...s, attack: { ...s.attack, escape: a.on } };
    case "attack/post": {
      const text = s.attack.comment;
      if (!text.trim()) return s;
      return {
        ...s,
        attack: { ...s.attack, posted: cap([...s.attack.posted, { text, escaped: s.attack.escape }], 6), comment: "" },
        stats: { ...st, comments: cap([...st.comments, { attack: isXss(text), escaped: s.attack.escape }]) },
      };
    }

    case "blocks/set":
      return { ...s, mode: "blocks", blocks: { ...s.blocks, mode: a.mode ?? s.blocks.mode, iv: a.iv ?? s.blocks.iv } };
    case "blocks/encrypt": {
      const b = s.blocks;
      const iv = b.iv === "fixed" ? FIXED_IV : randomIv(b.runs);
      const cipher = encryptBlocks(blocksOf(picture()), b.mode, BLOCK_KEY, iv);
      return {
        ...s,
        mode: "blocks",
        blocks: { ...b, runs: b.runs + 1, last: { mode: b.mode, iv, cipher } },
        stats: { ...st, blockRuns: cap([...st.blockRuns, { mode: b.mode, iv: b.iv, distinct: new Set(cipher).size, first: cipher[0]! }]) },
      };
    }

    case "mac/scheme":
      return { ...s, mode: "mac", mac: { scheme: a.scheme, last: null } };
    case "mac/send": {
      const d = deliver(s.mac.scheme, a.tamper, a.recompute);
      return { ...s, mode: "mac", mac: { ...s.mac, last: d }, stats: { ...st, macRuns: cap([...st.macRuns, { scheme: s.mac.scheme, tampered: d.tampered, recomputed: d.recomputed, accepted: d.accepted }]) } };
    }

    case "dh/set": {
      const d = s.dh;
      const big = a.big ?? d.big;
      const p = (big ? DH_LARGE : DH_SMALL).p;
      const pick = (v: number | undefined, old: number) => Math.round(Math.min(p - 2, Math.max(2, v ?? old)));
      const a2 = a.big !== undefined && a.big !== d.big ? (big ? 123_456_789 : 6) : pick(a.a, d.a);
      const b2 = a.big !== undefined && a.big !== d.big ? (big ? 987_654_321 : 15) : pick(a.b, d.b);
      return { ...s, mode: "dh", dh: { ...d, big, a: a2, b: b2, mitm: a.mitm ?? d.mitm, signed: a.signed ?? d.signed, last: null, eve: a.big !== undefined && a.big !== d.big ? null : d.eve } };
    }
    case "dh/exchange": {
      const d = s.dh;
      const { p, g } = d.big ? DH_LARGE : DH_SMALL;
      const x = dhExchange(p, g, d.a, d.b, d.mitm, d.signed);
      return {
        ...s,
        mode: "dh",
        dh: { ...d, last: x },
        stats: { ...st, dhRuns: cap([...st.dhRuns, { p, match: !x.aborted && x.alice === x.bob, mitm: d.mitm, signed: d.signed, aborted: x.aborted }]) },
      };
    }
    case "csp/policy":
      return ["none", "self", "nonce"].includes(a.policy) ? { ...s, mode: "csp", csp: { policy: a.policy, ran: null } } : s;
    case "csp/load": {
      const policy = s.csp?.policy ?? "none";
      const r = evaluateCsp(policy);
      return { ...s, mode: "csp", csp: { policy, ran: r.ran }, stats: { ...st, cspRuns: cap([...(st.cspRuns ?? []), { policy, attacks: r.attacks, brokenLegit: r.brokenLegit }]) } };
    }
    case "certs/fault":
      return FAULTS.includes(a.fault) ? { ...s, mode: "certs", certs: { fault: a.fault, last: null } } : s;
    case "certs/connect": {
      const fault = s.certs?.fault ?? "none";
      const { chain, trust } = scenarioChain(fault);
      const v = verifyChain(chain, trust, "inside.kz");
      return { ...s, mode: "certs", certs: { fault, last: v }, stats: { ...st, certRuns: cap([...(st.certRuns ?? []), { fault, ok: v.ok, error: v.error }]) } };
    }
    case "dh/eve": {
      const d = s.dh;
      if (!d.last) return s;
      const { p, g } = d.big ? DH_LARGE : DH_SMALL;
      const r = eveBruteForce(p, g, d.last.A);
      return { ...s, dh: { ...d, eve: { p, ...r } }, stats: { ...st, eveRuns: cap([...st.eveRuns, { p, found: r.found !== null, tries: r.tries }]) } };
    }
  }
}

export function evaluateSec(s: SecLabState): AssessmentResult {
  return {
    score: 0,
    metrics: { solved: s.stats.solved.length, hashes: s.stats.hashes.length, cracked: s.passwords.lastCrack?.cracked.length ?? 0 },
    notes: [],
  };
}

export const secLabPlugin: SimulationPlugin<SecLabState, SecLabAction> = {
  id: "sec-lab",
  version: "1.0.0",
  initialize: () => initialSecState(),
  dispatch: reduce,
  step: (s) => s,
  snapshot: (s) => structuredClone(s),
  restore: (snap) => structuredClone(snap as SecLabState),
  evaluate: evaluateSec,
};

export { xorBytes };
