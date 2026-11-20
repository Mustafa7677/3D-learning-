import { sha256, slowHash } from "./crypto";

// ---------------- passwords ----------------

/** The most common passwords: every attacker's first dictionary. */
export const DICTIONARY = [
  "123456", "password", "123456789", "12345678", "qwerty", "111111", "123123", "1234567", "qwerty123", "000000",
  "1q2w3e", "abc123", "password1", "iloveyou", "admin", "welcome", "monkey", "dragon", "sunshine", "princess",
  "football", "letmein", "654321", "superman", "qazwsx", "michael", "shadow", "master", "666666", "baseball",
  "almaty", "astana", "qazaqstan", "kazakhstan", "aigerim", "nurlan", "erlan", "dana", "asel", "timur",
  "zxcvbnm", "121212", "flower", "hello", "freedom", "whatever", "trustno1", "batman", "login", "starwars",
];

export type Storage = "plain" | "hash" | "salted" | "slow";

export interface User {
  name: string;
  password: string;
  salt: string;
}

export const USERS: User[] = [
  { name: "aigerim", password: "qwerty", salt: "x7Kp" },
  { name: "nurlan", password: "almaty", salt: "Qm2z" },
  { name: "dana", password: "Kökjiek-Tau!91", salt: "a9Lr" },
  { name: "erlan", password: "qwerty", salt: "Vt4e" },
  { name: "asel", password: "123456", salt: "pP0w" },
];

export const SLOW_ROUNDS = 1000;

/** What a leaked database row looks like under each storage scheme. */
export function stored(u: User, s: Storage): string {
  switch (s) {
    case "plain":
      return u.password;
    case "hash":
      return sha256(u.password);
    case "salted":
      return `${u.salt}$${sha256(u.salt + u.password)}`;
    case "slow":
      return `${u.salt}$${SLOW_ROUNDS}$…`;
  }
}

export interface CrackResult {
  cracked: { name: string; password: string }[];
  /** Hash computations the attacker performed. */
  work: number;
  /** Identical hashes reveal that two users share a password (without cracking it). */
  sameHashGroups: string[][];
}

/**
 * A dictionary attack on a leaked table. Unsalted: hash every word once and
 * look all rows up. Salted: every row needs its own pass. Slow: every guess
 * costs SLOW_ROUNDS hashes. (Slow hashing is counted, not computed, to stay fast.)
 */
export function crack(s: Storage, users: User[] = USERS, dictionary: string[] = DICTIONARY): CrackResult {
  const cracked: CrackResult["cracked"] = [];
  let work = 0;
  if (s === "plain") {
    return { cracked: users.map((u) => ({ name: u.name, password: u.password })), work: 0, sameHashGroups: [] };
  }
  if (s === "hash") {
    const table = new Map<string, string>();
    for (const w of dictionary) {
      table.set(sha256(w), w);
      work++;
    }
    for (const u of users) {
      const hit = table.get(sha256(u.password));
      if (hit !== undefined) cracked.push({ name: u.name, password: hit });
    }
    const groups = new Map<string, string[]>();
    for (const u of users) groups.set(sha256(u.password), [...(groups.get(sha256(u.password)) ?? []), u.name]);
    return { cracked, work, sameHashGroups: [...groups.values()].filter((g) => g.length > 1) };
  }
  const rounds = s === "slow" ? SLOW_ROUNDS : 1;
  for (const u of users) {
    const target = sha256(u.salt + u.password);
    for (const w of dictionary) {
      work += rounds;
      if (sha256(u.salt + w) === target) {
        cracked.push({ name: u.name, password: w });
        break;
      }
    }
  }
  return { cracked, work, sameHashGroups: [] };
}

export { slowHash };

// ---------------- password strength ----------------

export interface Strength {
  length: number;
  pool: number;
  bits: number;
  inDictionary: boolean;
  /** Seconds to try every combination at 10¹⁰ guesses per second (one modern GPU on a fast hash). */
  seconds: number;
}

export const GUESSES_PER_SECOND = 1e10;

export function strength(pw: string): Strength {
  const chars = [...pw];
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/[0-9]/.test(pw)) pool += 10;
  if (/[^A-Za-z0-9]/.test(pw) && /[^\u0000-\u007f]/.test(pw)) pool += 84; // Kazakh letters, both cases
  if (/[!-/:-@[-`{-~ ]/.test(pw)) pool += 33;
  const inDictionary = DICTIONARY.includes(pw.toLowerCase());
  const bits = inDictionary ? Math.log2(DICTIONARY.length) : chars.length * Math.log2(Math.max(1, pool));
  return { length: chars.length, pool, bits, inDictionary, seconds: 2 ** bits / GUESSES_PER_SECOND };
}

export function humanTime(sec: number): string {
  if (sec < 1) return "секундтан аз";
  const units: [number, string][] = [
    [31_557_600 * 1e9, "млрд жыл"],
    [31_557_600 * 1e6, "млн жыл"],
    [31_557_600, "жыл"],
    [86_400, "күн"],
    [3_600, "сағат"],
    [60, "минут"],
    [1, "секунд"],
  ];
  for (const [s, name] of units) if (sec >= s) return `≈ ${(sec / s).toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ${name}`;
  return "секундтан аз";
}

// ---------------- injection ----------------

export const ACCOUNTS = [
  { login: "admin", password: "S3cure!Pass" },
  { login: "dana", password: "Kökjiek-Tau!91" },
];

export interface LoginResult {
  query: string;
  ok: boolean;
  /** Logged in as this account. */
  as: string | null;
  injected: boolean;
}

/**
 * Evaluate a login the way a vulnerable app builds SQL by concatenation: or
 * safely with parameters. The tiny evaluator understands the WHERE clauses
 * such an app produces, which is enough to show why `' OR '1'='1` works.
 */
export function login(user: string, pass: string, parameterized: boolean): LoginResult {
  if (parameterized) {
    const acc = ACCOUNTS.find((a) => a.login === user && a.password === pass);
    return { query: "SELECT * FROM users WHERE login = ? AND password = ?", ok: !!acc, as: acc?.login ?? null, injected: false };
  }
  const query = `SELECT * FROM users WHERE login = '${user}' AND password = '${pass}'`;
  const where = query.slice(query.indexOf("WHERE") + 6).replace(/--.*$/, "").trim();
  const match = (acc: (typeof ACCOUNTS)[number]) => evalWhere(where, acc);
  const acc = ACCOUNTS.find(match);
  const honest = ACCOUNTS.find((a) => a.login === user && a.password === pass);
  return { query, ok: !!acc, as: acc?.login ?? null, injected: !!acc && !honest };
}

/** Evaluate `a = 'x' AND b = 'y' OR 'k' = 'k'` with AND binding tighter than OR. */
function evalWhere(where: string, acc: { login: string; password: string }): boolean {
  const tokens = where.match(/'(?:[^']*)'|\w+|=|\S/g) ?? [];
  let i = 0;
  const value = (): string | undefined => {
    const t = tokens[i++];
    if (t === undefined) return undefined;
    if (t.startsWith("'")) return t.slice(1, -1);
    if (t === "login") return acc.login;
    if (t === "password") return acc.password;
    return t;
  };
  const comparison = (): boolean => {
    const l = value();
    if (tokens[i] !== "=") return false;
    i++;
    const r = value();
    return l !== undefined && l === r;
  };
  const and = (): boolean => {
    let v = comparison();
    while (tokens[i]?.toUpperCase() === "AND") {
      i++;
      v = comparison() && v;
    }
    return v;
  };
  let v = and();
  while (tokens[i]?.toUpperCase() === "OR") {
    i++;
    v = and() || v;
  }
  // Unbalanced quotes or leftovers make the SQL invalid: the query fails.
  return i === tokens.length && !/'[^']*$/.test(where.replace(/'[^']*'/g, "")) ? v : false;
}

/** HTML-escape so user text is shown, never executed. */
export const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
/** Whether rendering this comment raw would run script in the page. */
export const isXss = (s: string) => /<\s*script|on\w+\s*=|javascript:/i.test(s);
