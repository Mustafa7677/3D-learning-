import type { AssessmentResult, SimulationPlugin } from "@inside-tech/sim-core";
import { canRun, finished, lostUpdate, newRace, runOp, type ClientId, type Op, type Race } from "./concurrency";
import { seedDb } from "./data";
import { assign, movedFraction, type ShardMethod } from "./sharding";
import { execute, type Result, type Session, type Value } from "./sql";

export type DbMode = "sql" | "race" | "shard";

export interface QueryLog {
  kind: Result["kind"] | "error";
  ok: boolean;
  examined: number;
  rows: number;
  /** "scan" / "index" per table in the plan. */
  access: string[];
  error?: string;
  /** The statement, so lessons can tell which technique produced a result. */
  sql?: string;
  /** Values of an "id" column in the result, in order (first 50). */
  ids?: number[];
}

export interface DbStats {
  modes: DbMode[];
  queries: QueryLog[];
  constraintErrors: string[];
  commits: number;
  rollbacks: number;
  crashes: number;
  explains: number;
  raceRuns: { locking: boolean; lost: boolean; balance: number; waited: boolean }[];
  shardMoves: { method: ShardMethod; from: number; to: number; moved: number }[];
  shardViews: { method: ShardMethod; n: number }[];
}

export interface DbLabState {
  mode: DbMode;
  sql: { session: Session; text: string; last: Result | null; lastSql: string };
  race: Race;
  shard: { method: ShardMethod; n: number };
  stats: DbStats;
}

export type DbLabAction =
  | { type: "mode/set"; mode: DbMode }
  | { type: "sql/text"; text: string }
  | { type: "sql/run" }
  | { type: "sql/reset" }
  | { type: "sql/crash" }
  | { type: "race/locking"; on: boolean }
  | { type: "race/op"; client: ClientId; op: Op }
  | { type: "race/reset" }
  | { type: "shard/method"; method: ShardMethod }
  | { type: "shard/n"; n: number };

const uniq = <T>(xs: T[], x: T) => (xs.includes(x) ? xs : [...xs, x]);
const cap = <T>(xs: T[], n = 40) => xs.slice(-n);

/** Split a script into statements on semicolons outside quotes. */
export function splitStatements(src: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inStr = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (ch === "'") inStr = !inStr;
    if (ch === "-" && src[i + 1] === "-" && !inStr) {
      while (i < src.length && src[i] !== "\n") i++;
      cur += "\n";
      continue;
    }
    if (ch === ";" && !inStr) {
      if (cur.trim()) out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.slice(0, 30);
}

function runScript(s: DbLabState): DbLabState {
  let session = s.sql.session;
  let stats = s.stats;
  let last: Result | null = null;
  let lastSql = "";
  for (const stmt of splitStatements(s.sql.text)) {
    const r = execute(session, stmt);
    session = r.session;
    last = r.result;
    lastSql = stmt;
    const log: QueryLog = { kind: r.result.ok ? r.result.kind : "error", ok: r.result.ok, examined: r.result.examined, rows: r.result.rows.length, access: r.result.plan.map((p) => p.access), error: r.result.error, sql: stmt.slice(0, 300), ids: r.result.rows.map((x) => x.id).filter((v): v is number => typeof v === "number").slice(0, 50) };
    stats = { ...stats, queries: cap([...stats.queries, log]) };
    if (!r.result.ok) {
      const c = /(PRIMARY KEY|FOREIGN KEY|NOT NULL)/.exec(r.result.error ?? "")?.[1];
      if (c) stats = { ...stats, constraintErrors: uniq(stats.constraintErrors, c) };
      break;
    }
    if (r.result.kind === "commit") stats = { ...stats, commits: stats.commits + 1 };
    if (r.result.kind === "rollback") stats = { ...stats, rollbacks: stats.rollbacks + 1 };
    if (r.result.kind === "explain") stats = { ...stats, explains: stats.explains + 1 };
  }
  return { ...s, sql: { ...s.sql, session, last, lastSql }, stats };
}

export function initialDbState(): DbLabState {
  return {
    mode: "sql",
    sql: { session: { db: seedDb(), snapshot: null }, text: "SELECT * FROM students", last: null, lastSql: "" },
    race: newRace(false),
    shard: { method: "mod", n: 4 },
    stats: { modes: ["sql"], queries: [], constraintErrors: [], commits: 0, rollbacks: 0, crashes: 0, explains: 0, raceRuns: [], shardMoves: [], shardViews: [] },
  };
}

function reduce(s: DbLabState, a: DbLabAction): DbLabState {
  const st = s.stats;
  switch (a.type) {
    case "mode/set":
      return { ...s, mode: a.mode, stats: { ...st, modes: uniq(st.modes, a.mode) } };
    case "sql/text":
      return { ...s, sql: { ...s.sql, text: a.text.slice(0, 2000) } };
    case "sql/run":
      return runScript({ ...s, mode: "sql" });
    case "sql/reset":
      return { ...s, sql: { ...s.sql, session: { db: seedDb(), snapshot: null }, last: null, lastSql: "" } };
    case "sql/crash": {
      // Power failure: anything not committed is gone; committed data survives (durability).
      const open = s.sql.session.snapshot;
      return {
        ...s,
        sql: { ...s.sql, session: { db: open ?? s.sql.session.db, snapshot: null }, last: null },
        stats: open ? { ...st, crashes: st.crashes + 1 } : st,
      };
    }

    case "race/locking":
      return { ...s, mode: "race", race: newRace(a.on) };
    case "race/reset":
      return { ...s, race: newRace(s.race.locking) };
    case "race/op": {
      if (finished(s.race)) return s;
      const waited = canRun(s.race, a.client, a.op)?.includes("күтеді") ?? false;
      const race = runOp(s.race, a.client, a.op);
      let stats = st;
      if (waited) stats = { ...stats, raceRuns: stats.raceRuns };
      const anyWait = waited || race.log.some((l) => l.includes("күтеді"));
      if (finished(race)) stats = { ...stats, raceRuns: cap([...stats.raceRuns, { locking: race.locking, lost: lostUpdate(race), balance: race.balance, waited: anyWait }]) };
      return { ...s, race, stats };
    }

    case "shard/method":
      return { ...s, mode: "shard", shard: { ...s.shard, method: a.method }, stats: { ...st, shardViews: cap([...st.shardViews, { method: a.method, n: s.shard.n }]) } };
    case "shard/n": {
      const n = Math.round(Math.min(8, Math.max(2, a.n)));
      if (n === s.shard.n) return s;
      const moved = movedFraction(assign(s.shard.method, s.shard.n), assign(s.shard.method, n));
      return {
        ...s,
        mode: "shard",
        shard: { ...s.shard, n },
        stats: { ...st, shardMoves: cap([...st.shardMoves, { method: s.shard.method, from: s.shard.n, to: n, moved }]), shardViews: cap([...st.shardViews, { method: s.shard.method, n }]) },
      };
    }
  }
}

export function evaluateDb(s: DbLabState): AssessmentResult {
  const r = s.sql.last;
  return { score: 0, metrics: { examined: r?.examined ?? 0, rows: r?.rows.length ?? 0, inTransaction: s.sql.session.snapshot ? 1 : 0 }, notes: [] };
}

export const dbLabPlugin: SimulationPlugin<DbLabState, DbLabAction> = {
  id: "db-lab",
  version: "1.0.0",
  initialize: () => initialDbState(),
  dispatch: reduce,
  step: (s) => s,
  snapshot: (s) => structuredClone(s),
  restore: (snap) => structuredClone(snap as DbLabState),
  evaluate: evaluateDb,
};

// ---------------- grading helpers ----------------

/** A row as a sorted list of its values: robust to column names, aliases and order. */
const rowKey = (row: Record<string, Value>) => JSON.stringify(Object.values(row).map((v) => (typeof v === "number" ? Math.round(v * 100) / 100 : v)).sort((x, y) => String(x).localeCompare(String(y))));

/**
 * The learner's last SELECT returned the same rows as `reference` on the same
 * data (as a multiset, or in order when `ordered`).
 */
export function lastMatches(s: DbLabState, reference: string, ordered = false): boolean {
  const last = s.sql.last;
  if (!last?.ok || last.kind !== "select") return false;
  const ref = execute({ db: s.sql.session.db, snapshot: null }, reference).result;
  if (!ref.ok || ref.rows.length !== last.rows.length || ref.rows.length === 0) return false;
  const a = last.rows.map(rowKey);
  const b = ref.rows.map(rowKey);
  if (ordered) return a.every((k, i) => k === b[i]);
  return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
}

export const usedJoin = (s: DbLabState) => (s.sql.last?.plan.length ?? 0) > 1;
export const total = (s: DbLabState) => s.sql.session.db.accounts!.rows.reduce((t, r) => t + Number(r.balance), 0);
export const balance = (s: DbLabState, id: number) => Number(s.sql.session.db.accounts!.rows.find((r) => r.id === id)?.balance);
