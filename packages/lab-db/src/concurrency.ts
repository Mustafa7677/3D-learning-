/**
 * Two clients each add 100 to the same balance: read, then write read + 100.
 * The learner chooses the interleaving. Without locks, a bad schedule loses
 * an update; with SELECT … FOR UPDATE the second reader waits.
 */
export type ClientId = "A" | "B";
export type Op = "read" | "write";

export interface Race {
  balance: number;
  initial: number;
  locking: boolean;
  /** Value each client read, or null. */
  seen: Record<ClientId, number | null>;
  done: Record<ClientId, boolean>;
  lock: ClientId | null;
  log: string[];
}

export const newRace = (locking: boolean, initial = 500): Race => ({
  balance: initial,
  initial,
  locking,
  seen: { A: null, B: null },
  done: { A: false, B: false },
  lock: null,
  log: [],
});

export function canRun(r: Race, c: ClientId, op: Op): string | null {
  if (r.done[c]) return `${c} аяқтады`;
  if (op === "read" && r.seen[c] !== null) return `${c} әлдеқашан оқыды`;
  if (op === "write" && r.seen[c] === null) return `${c} алдымен оқуы керек`;
  if (op === "read" && r.locking && r.lock !== null && r.lock !== c) return `${c} күтеді: жазбаны ${r.lock} құлыптады`;
  return null;
}

export function runOp(r: Race, c: ClientId, op: Op): Race {
  const blocked = canRun(r, c, op);
  if (blocked) return { ...r, log: [...r.log, `⏸ ${blocked}`] };
  if (op === "read") {
    return {
      ...r,
      seen: { ...r.seen, [c]: r.balance },
      lock: r.locking ? c : r.lock,
      log: [...r.log, r.locking ? `${c}: SELECT … FOR UPDATE → ${r.balance} (құлып)` : `${c}: SELECT → ${r.balance}`],
    };
  }
  const value = r.seen[c]! + 100;
  return {
    ...r,
    balance: value,
    done: { ...r.done, [c]: true },
    lock: r.lock === c ? null : r.lock,
    log: [...r.log, `${c}: UPDATE balance = ${value}${r.locking ? "; COMMIT (құлып босады)" : ""}`],
  };
}

export const finished = (r: Race) => r.done.A && r.done.B;
export const lostUpdate = (r: Race) => finished(r) && r.balance !== r.initial + 200;
