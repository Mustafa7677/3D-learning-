/**
 * Middle-level architecture models: a five-stage pipeline with hazards and
 * forwarding, branch predictors, and a set-associative cache with LRU.
 * Deterministic: every number in the lectures is pinned by a test.
 */

// ---------------- pipeline ----------------

export interface PInstr {
  id: string;
  text: string;
  kind: "alu" | "load" | "store";
  dst: string | null;
  src: string[];
}

/** A load, a chain that depends on it, and one independent instruction at the end. */
export const PIPE_PROGRAM: PInstr[] = [
  { id: "i1", text: "LOAD r1, [a]", kind: "load", dst: "r1", src: [] },
  { id: "i2", text: "ADD r2, r1, r1", kind: "alu", dst: "r2", src: ["r1"] },
  { id: "i3", text: "ADD r3, r2, 1", kind: "alu", dst: "r3", src: ["r2"] },
  { id: "i4", text: "STORE r3, [b]", kind: "store", dst: null, src: ["r3"] },
  { id: "i5", text: "ADD r4, r5, r6", kind: "alu", dst: "r4", src: ["r5", "r6"] },
];

export type PipeMode = "off" | "stall" | "forward";
export const STAGES = ["IF", "ID", "EX", "MEM", "WB"] as const;

export interface PipeRow {
  instr: PInstr;
  /** Stage name per cycle (1-based cycle index); "ID·" marks a stall bubble. */
  cells: Record<number, string>;
  ex: number;
  wb: number;
}

export interface PipeResult {
  rows: PipeRow[];
  cycles: number;
  stalls: number;
}

/**
 * Without a pipeline every instruction takes five cycles. With one, an
 * instruction reads its registers in ID: without forwarding it must wait for
 * the producer's WB (same cycle is fine: write first, read second); with
 * forwarding an ALU result is ready after EX, a loaded value after MEM.
 */
export function runPipeline(program: PInstr[], mode: PipeMode): PipeResult {
  if (mode === "off") {
    const rows = program.map((instr, i) => {
      const cells: Record<number, string> = {};
      STAGES.forEach((st, k) => (cells[i * 5 + k + 1] = st));
      return { instr, cells, ex: i * 5 + 3, wb: i * 5 + 5 };
    });
    return { rows, cycles: program.length * 5, stalls: 0 };
  }
  const rows: PipeRow[] = [];
  program.forEach((instr, i) => {
    const prev = rows[i - 1];
    const fetch = i + 1;
    const idFirst = Math.max(fetch + 1, prev ? prev.ex : 0);
    let ex = Math.max(idFirst + 1, prev ? prev.ex + 1 : 0);
    for (const r of instr.src) {
      let p: PipeRow | undefined;
      for (let k = rows.length - 1; k >= 0; k--)
        if (rows[k]!.instr.dst === r) {
          p = rows[k];
          break;
        }
      if (!p) continue;
      const ready = mode === "stall" ? p.wb + 1 : p.instr.kind === "load" ? p.ex + 2 : p.ex + 1;
      ex = Math.max(ex, ready);
    }
    const cells: Record<number, string> = {};
    for (let c = fetch; c < idFirst; c++) cells[c] = "IF";
    for (let c = idFirst; c < ex; c++) cells[c] = c === idFirst ? "ID" : "ID·";
    cells[ex] = "EX";
    cells[ex + 1] = "MEM";
    cells[ex + 2] = "WB";
    rows.push({ instr, cells, ex, wb: ex + 2 });
  });
  const cycles = rows.at(-1)!.wb;
  return { rows, cycles, stalls: cycles - (program.length + 4) };
}

/** Two neighbouring instructions may swap if neither reads or writes what the other writes. */
export function canSwap(a: PInstr, b: PInstr): boolean {
  const writes = (x: PInstr) => (x.dst ? [x.dst] : []);
  const touches = (x: PInstr) => [...writes(x), ...x.src];
  const memory = (x: PInstr) => x.kind !== "alu";
  if (memory(a) && memory(b)) return false;
  return !writes(a).some((r) => touches(b).includes(r)) && !writes(b).some((r) => touches(a).includes(r));
}

// ---------------- branch prediction ----------------

export type Predictor = "taken" | "1bit" | "2bit";
export type BranchPattern = "loop" | "sorted" | "random";
export const MISS_PENALTY = 15;

/** Outcomes (true = taken) of one branch instruction over a run. */
export function branchOutcomes(p: BranchPattern): boolean[] {
  if (p === "loop") return Array.from({ length: 10 }, () => [true, true, true, false]).flat();
  // `if (x >= 128)` over 64 bytes, sorted or not.
  let r = 0x2545f491;
  const xs = Array.from({ length: 64 }, () => {
    r ^= r << 13;
    r ^= r >>> 17;
    r ^= r << 5;
    return (r >>> 0) % 256;
  });
  if (p === "sorted") xs.sort((a, b) => a - b);
  return xs.map((x) => x >= 128);
}

export interface BranchRun {
  predictions: boolean[];
  outcomes: boolean[];
  misses: number;
  /** Extra cycles lost to mispredictions. */
  lost: number;
}

/** 1-bit: repeat the last outcome. 2-bit: a saturating counter 0..3, predict taken at 2 or 3, start at 2. */
export function predictBranches(p: Predictor, outcomes: boolean[]): BranchRun {
  let last = true;
  let counter = 2;
  const predictions = outcomes.map((t) => {
    const guess = p === "taken" ? true : p === "1bit" ? last : counter >= 2;
    last = t;
    counter = t ? Math.min(3, counter + 1) : Math.max(0, counter - 1);
    return guess;
  });
  const misses = predictions.filter((g, i) => g !== outcomes[i]).length;
  return { predictions, outcomes, misses, lost: misses * MISS_PENALTY };
}

// ---------------- set-associative cache ----------------

export const ASSOC_LINES = 8;
export const ASSOC_LINE = 16; // bytes
export type AssocPattern = "two" | "three" | "sequential";

/** Byte addresses read: interleaved 4-byte elements of arrays placed one cache size (128 B) apart. */
export function assocAddresses(p: AssocPattern): number[] {
  const span = ASSOC_LINES * ASSOC_LINE;
  if (p === "sequential") return Array.from({ length: 64 }, (_, i) => i * 4);
  const arrays = p === "two" ? 2 : 3;
  const out: number[] = [];
  for (let i = 0; i < 32; i++) for (let k = 0; k < arrays; k++) out.push(k * span + i * 4);
  return out;
}

export interface AssocResult {
  hits: number;
  misses: number;
  /** Per access: set index and whether it hit. */
  trace: { addr: number; set: number; hit: boolean }[];
  /** Final contents: per set, the line numbers held, most recent last. */
  sets: number[][];
}

export function runAssoc(addresses: number[], ways: number): AssocResult {
  const nSets = ASSOC_LINES / ways;
  const sets: number[][] = Array.from({ length: nSets }, () => []);
  const trace: AssocResult["trace"] = [];
  let hits = 0;
  for (const addr of addresses) {
    const line = Math.floor(addr / ASSOC_LINE);
    const set = line % nSets;
    const s = sets[set]!;
    const at = s.indexOf(line);
    const hit = at >= 0;
    if (hit) {
      hits++;
      s.splice(at, 1);
    } else if (s.length >= ways) s.shift(); // evict the least recently used
    s.push(line);
    trace.push({ addr, set, hit });
  }
  return { hits, misses: addresses.length - hits, trace, sets };
}
