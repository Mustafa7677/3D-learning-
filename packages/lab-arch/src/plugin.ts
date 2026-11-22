import type { AssessmentResult, SimulationPlugin } from "@inside-tech/sim-core";
import { addTrace, toSigned, type AddTrace } from "./bits";
import { simulateCache, type Access, type CacheConfig, type Pattern } from "./cache";
import { assemble, resetCpu, run, tick, MEM_SIZE, type CpuState, type Instr } from "./cpu";
import { CIRCUITS, GATE_TYPES, inputRows, solves, type CircuitId, type GateType } from "./logic";
import { bigPlusOne, pointThree, repeatedSum, type Precision } from "./float";
import { HUGE_PAGE, PAGE, runTlb, tlbAddresses, type TlbPattern, type TlbRun } from "./tlb";
import {
  PIPE_PROGRAM,
  assocAddresses,
  branchOutcomes,
  canSwap,
  predictBranches,
  runAssoc,
  runPipeline,
  type AssocPattern,
  type AssocResult,
  type BranchPattern,
  type BranchRun,
  type PipeMode,
  type PipeResult,
  type Predictor,
} from "./middle-core";

export type ArchMode = "bits" | "gates" | "cpu" | "cache" | "pipe" | "branch" | "assoc" | "tlb" | "float";

export interface CpuRun {
  source: string;
  out: number[];
  instructions: number;
  cycles: number;
  memoryAccesses: number;
}

export interface ArchStats {
  modes: ArchMode[];
  bitToggles: number;
  /** Distinct values the learner has built (unsigned patterns). */
  values: number[];
  /** Signed values seen while the signed view was on. */
  signedValues: number[];
  additions: Pick<AddTrace, "a" | "b" | "result" | "carryOut" | "overflow">[];
  /** Input rows tried per circuit, as "0110"-style keys. */
  rowsTried: Record<string, string[]>;
  gateTypesTried: GateType[];
  /** Circuits solved, with the gate types used. */
  solved: { circuit: CircuitId; types: Record<string, GateType> }[];
  manualStages: number;
  cpuRuns: CpuRun[];
  cacheRuns: { pattern: Pattern; lines: number; lineSize: number; hits: number; misses: number; cycles: number }[];
  pipeRuns: { mode: PipeMode; cycles: number; stalls: number; order: string }[];
  branchRuns: { pattern: BranchPattern; predictor: Predictor; misses: number; total: number }[];
  assocRuns: { pattern: AssocPattern; ways: number; hits: number; misses: number }[];
  tlbRuns?: { pattern: TlbPattern; huge: boolean; hits: number; misses: number }[];
  floatRuns?: { precision: Precision; kahan: boolean; equals: boolean; plusOne: number; error: number }[];
}

export interface ArchLabState {
  mode: ArchMode;
  speed: number;
  acc: number;
  bits: { value: number; signed: boolean; add: AddTrace | null };
  gates: { circuit: CircuitId; inputs: Record<string, number>; types: Record<string, GateType> };
  cpu: { source: string; program: Instr[]; errors: { line: number; message: string }[]; initialMem: number[]; state: CpuState; running: boolean };
  cache: { pattern: Pattern; lines: number; lineSize: number; cursor: number; running: boolean };
  pipe: { mode: PipeMode; order: string[]; last: PipeResult | null };
  branch: { pattern: BranchPattern; predictor: Predictor; last: BranchRun | null };
  assoc: { pattern: AssocPattern; ways: number; last: AssocResult | null };
  tlb?: { pattern: TlbPattern; huge: boolean; last: TlbRun | null };
  float?: { precision: Precision; kahan: boolean; last: { text: string; equals: boolean; plusOne: number; sum: number; error: number } | null };
  stats: ArchStats;
}

export type ArchLabAction =
  | { type: "mode/set"; mode: ArchMode }
  | { type: "speed/set"; speed: number }
  | { type: "bits/toggle"; bit: number }
  | { type: "bits/set"; value: number }
  | { type: "bits/signed"; on: boolean }
  | { type: "bits/add"; a: number; b: number }
  | { type: "gates/circuit"; circuit: CircuitId }
  | { type: "gates/input"; name: string }
  | { type: "gates/type"; gate: string; gateType: GateType }
  | { type: "cpu/source"; source: string }
  | { type: "cpu/memory"; mem: number[] }
  | { type: "cpu/tick" }
  | { type: "cpu/step" }
  | { type: "cpu/play" }
  | { type: "cpu/pause" }
  | { type: "cpu/finish" }
  | { type: "cpu/reset" }
  | { type: "cache/config"; pattern?: Pattern; lines?: number; lineSize?: number }
  | { type: "cache/step" }
  | { type: "cache/play" }
  | { type: "cache/pause" }
  | { type: "cache/finish" }
  | { type: "cache/reset" }
  | { type: "pipe/mode"; mode: PipeMode }
  | { type: "pipe/swap"; index: number }
  | { type: "pipe/restore" }
  | { type: "pipe/run" }
  | { type: "branch/set"; pattern?: BranchPattern; predictor?: Predictor }
  | { type: "branch/run" }
  | { type: "assoc/set"; pattern?: AssocPattern; ways?: number }
  | { type: "assoc/run" }
  | { type: "tlb/set"; pattern?: TlbPattern; huge?: boolean }
  | { type: "tlb/run" }
  | { type: "float/set"; precision?: Precision; kahan?: boolean }
  | { type: "float/run" };

export const CACHE_LINES = [1, 2, 4, 8, 16];
export const LINE_SIZES = [4, 8, 16, 32, 64];
/** Instruction budget for "run to the end": stops runaway loops. */
export const RUN_LIMIT = 5000;

const uniq = <T>(xs: T[], x: T, max = 64) => (xs.includes(x) ? xs : [...xs, x].slice(-max));
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const PROGRAMS: Record<string, { title: string; source: string; mem?: number[] }> = {
  first: {
    title: "Алғашқы бағдарлама",
    source: `; 5 пен 7-ні қосып, нәтижені шығар
LI R0, 5
LI R1, 7
ADD R0, R1
OUT R0
HALT`,
  },
  sum: {
    title: "1-ден 10-ға дейінгі қосынды",
    source: `      LI R0, 0     ; қосынды
      LI R1, 10    ; санауыш
loop: ADD R0, R1
      DEC R1
      JNZ loop     ; R1 ≠ 0 болса, қайтала
      OUT R0
      HALT`,
  },
  array: {
    title: "Массивтің қосындысы (жад)",
    mem: [3, 1, 4, 1, 5],
    source: `; mem[0..4] қосындысы
      LI R1, 0     ; адрес
      LI R2, 5     ; элемент саны
      LI R0, 0     ; қосынды
loop: LOAD R3, [R1]
      ADD R0, R3
      INC R1
      DEC R2
      JNZ loop
      OUT R0
      HALT`,
  },
};

function cacheCfg(c: ArchLabState["cache"]): CacheConfig {
  return { lines: c.lines, lineSize: c.lineSize };
}
const traceMemo = new Map<string, Access[]>();
export function cacheTrace(c: Pick<ArchLabState["cache"], "pattern" | "lines" | "lineSize">): Access[] {
  const key = `${c.pattern}|${c.lines}|${c.lineSize}`;
  if (!traceMemo.has(key)) traceMemo.set(key, simulateCache(c.pattern, { lines: c.lines, lineSize: c.lineSize }));
  return traceMemo.get(key)!;
}

function withValue(s: ArchLabState, value: number): ArchLabState {
  const v = value & 0xff;
  const stats = { ...s.stats, values: uniq(s.stats.values, v), signedValues: s.bits.signed ? uniq(s.stats.signedValues, toSigned(v)) : s.stats.signedValues };
  return { ...s, bits: { ...s.bits, value: v }, stats };
}

function loadSource(s: ArchLabState, source: string, mem = s.cpu.initialMem): ArchLabState {
  const text = source.slice(0, 4000);
  const { program, errors } = assemble(text);
  return { ...s, cpu: { source: text, program, errors, initialMem: mem, state: resetCpu(mem), running: false } };
}

function afterCpu(s: ArchLabState, next: CpuState): ArchLabState {
  let stats = s.stats;
  const finished = next.halted && !s.cpu.state.halted && !next.error;
  if (finished) {
    const memoryAccesses = (next.cycles - next.instructions) / 3;
    const r: CpuRun = { source: s.cpu.source, out: next.out, instructions: next.instructions, cycles: next.cycles, memoryAccesses };
    stats = { ...stats, cpuRuns: [...stats.cpuRuns, r].slice(-20) };
  }
  return { ...s, cpu: { ...s.cpu, state: next, running: next.halted || next.error ? false : s.cpu.running }, stats };
}

function advanceCache(s: ArchLabState, count: number): ArchLabState {
  const c = s.cache;
  const trace = cacheTrace(c);
  if (c.cursor >= trace.length) return s;
  const end = Math.min(trace.length, c.cursor + count);
  let stats = s.stats;
  if (end >= trace.length) {
    const hits = trace.filter((a) => a.hit).length;
    const misses = trace.length - hits;
    stats = { ...stats, cacheRuns: [...stats.cacheRuns, { pattern: c.pattern, lines: c.lines, lineSize: c.lineSize, hits, misses, cycles: hits + misses * 100 }].slice(-30) };
  }
  return { ...s, cache: { ...c, cursor: end, running: end >= trace.length ? false : c.running }, stats };
}

export function initialArchState(): ArchLabState {
  const base: ArchLabState = {
    mode: "bits",
    speed: 4,
    acc: 0,
    bits: { value: 0, signed: false, add: null },
    gates: { circuit: "single", inputs: { A: 0, B: 0 }, types: {} },
    cpu: { source: "", program: [], errors: [], initialMem: [], state: resetCpu(), running: false },
    cache: { pattern: "row", lines: 4, lineSize: 16, cursor: 0, running: false },
    pipe: { mode: "off", order: PIPE_PROGRAM.map((p) => p.id), last: null },
    branch: { pattern: "loop", predictor: "1bit", last: null },
    assoc: { pattern: "two", ways: 1, last: null },
    stats: {
      modes: ["bits"],
      bitToggles: 0,
      values: [0],
      signedValues: [],
      additions: [],
      rowsTried: {},
      gateTypesTried: [],
      solved: [],
      manualStages: 0,
      cpuRuns: [],
      cacheRuns: [],
      pipeRuns: [],
      branchRuns: [],
      assocRuns: [],
      tlbRuns: [],
      floatRuns: [],
    },
    float: { precision: 64, kahan: false, last: null },
    tlb: { pattern: "sequential", huge: false, last: null },
  };
  return loadSource(base, PROGRAMS.first!.source);
}

function recordGates(s: ArchLabState): ArchLabState {
  const g = s.gates;
  const c = CIRCUITS[g.circuit];
  const key = c.inputs.map((n) => g.inputs[n] ?? 0).join("");
  const rowsTried = { ...s.stats.rowsTried, [g.circuit]: uniq(s.stats.rowsTried[g.circuit] ?? [], key) };
  let solved = s.stats.solved;
  if (solves(c, g.types)) {
    const types = Object.fromEntries(c.gates.map((x) => [x.id, g.types[x.id] ?? x.type]));
    solved = [...solved, { circuit: g.circuit, types }].slice(-30);
  }
  return { ...s, stats: { ...s.stats, rowsTried, solved } };
}

function reduce(s: ArchLabState, a: ArchLabAction): ArchLabState {
  switch (a.type) {
    case "mode/set":
      return { ...s, mode: a.mode, acc: 0, stats: { ...s.stats, modes: uniq(s.stats.modes, a.mode) } };
    case "speed/set":
      return { ...s, speed: clamp(a.speed, 0.5, 200) };

    case "bits/toggle": {
      if (a.bit < 0 || a.bit > 7) return s;
      const next = withValue(s, s.bits.value ^ (1 << (7 - a.bit)));
      return { ...next, mode: "bits", stats: { ...next.stats, bitToggles: next.stats.bitToggles + 1 } };
    }
    case "bits/set":
      return { ...withValue(s, Math.round(a.value)), mode: "bits" };
    case "bits/signed": {
      const next = { ...s, bits: { ...s.bits, signed: a.on } };
      return a.on ? { ...next, stats: { ...next.stats, signedValues: uniq(next.stats.signedValues, toSigned(s.bits.value)) } } : next;
    }
    case "bits/add": {
      const t = addTrace(Math.round(a.a) & 0xff, Math.round(a.b) & 0xff);
      const rec = { a: t.a, b: t.b, result: t.result, carryOut: t.carryOut, overflow: t.overflow };
      return { ...s, mode: "bits", bits: { ...s.bits, add: t }, stats: { ...s.stats, additions: [...s.stats.additions, rec].slice(-30) } };
    }

    case "gates/circuit": {
      const c = CIRCUITS[a.circuit];
      if (!c) return s;
      return recordGates({ ...s, mode: "gates", gates: { circuit: a.circuit, inputs: Object.fromEntries(c.inputs.map((n) => [n, 0])), types: {} } });
    }
    case "gates/input": {
      const c = CIRCUITS[s.gates.circuit];
      if (!c.inputs.includes(a.name)) return s;
      return recordGates({ ...s, gates: { ...s.gates, inputs: { ...s.gates.inputs, [a.name]: 1 - (s.gates.inputs[a.name] ?? 0) } } });
    }
    case "gates/type": {
      const c = CIRCUITS[s.gates.circuit];
      if (!c.editable.includes(a.gate) || !GATE_TYPES.includes(a.gateType)) return s;
      const next = { ...s, gates: { ...s.gates, types: { ...s.gates.types, [a.gate]: a.gateType } }, stats: { ...s.stats, gateTypesTried: s.gates.circuit === "single" ? uniq(s.stats.gateTypesTried, a.gateType) : s.stats.gateTypesTried } };
      return recordGates(next);
    }

    case "cpu/source":
      return { ...loadSource(s, a.source), mode: "cpu" };
    case "cpu/memory": {
      const mem = Array.from({ length: MEM_SIZE }, (_, i) => Math.round(clamp(a.mem[i] ?? 0, 0, 255)));
      return { ...s, cpu: { ...s.cpu, initialMem: mem, state: resetCpu(mem), running: false } };
    }
    case "cpu/reset":
      return { ...s, cpu: { ...s.cpu, state: resetCpu(s.cpu.initialMem), running: false } };
    case "cpu/tick": {
      if (s.cpu.errors.length) return s;
      const next = afterCpu(s, tick(s.cpu.state, s.cpu.program));
      return { ...next, stats: { ...next.stats, manualStages: next.stats.manualStages + 1 } };
    }
    case "cpu/step": {
      if (s.cpu.errors.length) return s;
      let st = tick(s.cpu.state, s.cpu.program);
      while (st.stage !== "fetch" && !st.halted && !st.error) st = tick(st, s.cpu.program);
      return afterCpu(s, st);
    }
    case "cpu/play":
      return s.cpu.errors.length || s.cpu.state.halted ? s : { ...s, mode: "cpu", acc: 0, cpu: { ...s.cpu, running: true } };
    case "cpu/pause":
      return { ...s, cpu: { ...s.cpu, running: false } };
    case "cpu/finish":
      return s.cpu.errors.length ? s : afterCpu(s, run(s.cpu.state, s.cpu.program, RUN_LIMIT));

    case "cache/config": {
      const c = s.cache;
      const lines = a.lines !== undefined && CACHE_LINES.includes(a.lines) ? a.lines : c.lines;
      const lineSize = a.lineSize !== undefined && LINE_SIZES.includes(a.lineSize) ? a.lineSize : c.lineSize;
      return { ...s, mode: "cache", cache: { pattern: a.pattern ?? c.pattern, lines, lineSize, cursor: 0, running: false } };
    }
    case "cache/reset":
      return { ...s, cache: { ...s.cache, cursor: 0, running: false } };

    case "pipe/mode":
      return { ...s, mode: "pipe", pipe: { ...s.pipe, mode: a.mode, last: null } };
    case "pipe/swap": {
      const o = s.pipe.order;
      const i = Math.round(a.index);
      if (i < 0 || i + 1 >= o.length) return s;
      const at = (id: string) => PIPE_PROGRAM.find((p) => p.id === id)!;
      if (!canSwap(at(o[i]!), at(o[i + 1]!))) return s;
      const order = [...o];
      [order[i], order[i + 1]] = [order[i + 1]!, order[i]!];
      return { ...s, mode: "pipe", pipe: { ...s.pipe, order, last: null } };
    }
    case "pipe/restore":
      return { ...s, pipe: { ...s.pipe, order: PIPE_PROGRAM.map((p) => p.id), last: null } };
    case "pipe/run": {
      const program = s.pipe.order.map((id) => PIPE_PROGRAM.find((p) => p.id === id)!);
      const r = runPipeline(program, s.pipe.mode);
      const run = { mode: s.pipe.mode, cycles: r.cycles, stalls: r.stalls, order: s.pipe.order.join(",") };
      return { ...s, mode: "pipe", pipe: { ...s.pipe, last: r }, stats: { ...s.stats, pipeRuns: [...s.stats.pipeRuns, run].slice(-40) } };
    }

    case "branch/set":
      return { ...s, mode: "branch", branch: { pattern: a.pattern ?? s.branch.pattern, predictor: a.predictor ?? s.branch.predictor, last: null } };
    case "branch/run": {
      const r = predictBranches(s.branch.predictor, branchOutcomes(s.branch.pattern));
      const run = { pattern: s.branch.pattern, predictor: s.branch.predictor, misses: r.misses, total: r.outcomes.length };
      return { ...s, mode: "branch", branch: { ...s.branch, last: r }, stats: { ...s.stats, branchRuns: [...s.stats.branchRuns, run].slice(-40) } };
    }

    case "assoc/set": {
      const ways = a.ways !== undefined && [1, 2, 4].includes(a.ways) ? a.ways : s.assoc.ways;
      return { ...s, mode: "assoc", assoc: { pattern: a.pattern ?? s.assoc.pattern, ways, last: null } };
    }
    case "float/set": {
      const cur = s.float ?? { precision: 64 as Precision, kahan: false, last: null };
      const precision = a.precision === 32 || a.precision === 64 ? a.precision : cur.precision;
      return { ...s, mode: "float", float: { precision, kahan: a.kahan ?? cur.kahan, last: null } };
    }
    case "float/run": {
      const cur = s.float ?? { precision: 64 as Precision, kahan: false, last: null };
      const p3 = pointThree(cur.precision);
      const sum = repeatedSum(cur.precision, cur.kahan);
      const last = { text: p3.text, equals: p3.equals, plusOne: bigPlusOne(cur.precision), sum: sum.sum, error: sum.error };
      const run = { precision: cur.precision, kahan: cur.kahan, equals: p3.equals, plusOne: last.plusOne, error: sum.error };
      return { ...s, mode: "float", float: { ...cur, last }, stats: { ...s.stats, floatRuns: [...(s.stats.floatRuns ?? []), run].slice(-40) } };
    }
    case "tlb/set": {
      const cur = s.tlb ?? { pattern: "sequential" as TlbPattern, huge: false, last: null };
      const pattern = a.pattern && ["sequential", "stride", "random-few"].includes(a.pattern) ? a.pattern : cur.pattern;
      return { ...s, mode: "tlb", tlb: { pattern, huge: a.huge ?? cur.huge, last: null } };
    }
    case "tlb/run": {
      const cur = s.tlb ?? { pattern: "sequential" as TlbPattern, huge: false, last: null };
      const r = runTlb(tlbAddresses(cur.pattern), cur.huge ? HUGE_PAGE : PAGE);
      const run = { pattern: cur.pattern, huge: cur.huge, hits: r.hits, misses: r.misses };
      return { ...s, mode: "tlb", tlb: { ...cur, last: r }, stats: { ...s.stats, tlbRuns: [...(s.stats.tlbRuns ?? []), run].slice(-40) } };
    }
    case "assoc/run": {
      const r = runAssoc(assocAddresses(s.assoc.pattern), s.assoc.ways);
      const run = { pattern: s.assoc.pattern, ways: s.assoc.ways, hits: r.hits, misses: r.misses };
      return { ...s, mode: "assoc", assoc: { ...s.assoc, last: r }, stats: { ...s.stats, assocRuns: [...s.stats.assocRuns, run].slice(-40) } };
    }
    case "cache/step":
      return advanceCache({ ...s, cache: { ...s.cache, running: false } }, 1);
    case "cache/play":
      return { ...s, mode: "cache", acc: 0, cache: { ...s.cache, running: s.cache.cursor < 64 } };
    case "cache/pause":
      return { ...s, cache: { ...s.cache, running: false } };
    case "cache/finish":
      return advanceCache(s, 64);
  }
}

export function evaluateArch(s: ArchLabState): AssessmentResult {
  const trace = cacheTrace(s.cache).slice(0, s.cache.cursor);
  const hits = trace.filter((x) => x.hit).length;
  return {
    score: 0,
    metrics: {
      value: s.bits.value,
      signed: toSigned(s.bits.value),
      instructions: s.cpu.state.instructions,
      cycles: s.cpu.state.cycles,
      cacheHits: hits,
      cacheMisses: trace.length - hits,
    },
    notes: s.cpu.errors.length ? ["asm-errors"] : [],
  };
}

export const archLabPlugin: SimulationPlugin<ArchLabState, ArchLabAction> = {
  id: "arch-lab",
  version: "1.0.0",
  initialize: () => initialArchState(),
  dispatch: reduce,
  step(s, dt) {
    const running = s.mode === "cpu" ? s.cpu.running : s.mode === "cache" ? s.cache.running : false;
    if (!running) return s;
    const acc = s.acc + dt * s.speed;
    const whole = Math.floor(acc);
    if (whole < 1) return { ...s, acc };
    const rest = { ...s, acc: acc - whole };
    if (s.mode === "cache") return advanceCache(rest, whole);
    let st = s.cpu.state;
    for (let i = 0; i < whole && !st.halted && !st.error; i++) st = tick(st, s.cpu.program);
    return afterCpu(rest, st);
  },
  snapshot: (s) => structuredClone(s),
  restore: (snap) => structuredClone(snap as ArchLabState),
  evaluate: evaluateArch,
};

/** Hidden tests: run the learner's program on other inputs (an autograder). */
export function passesTests(source: string, cases: { mem: number[]; out: number[] }[], maxInstructions = RUN_LIMIT): { passed: number; total: number } {
  const { program, errors } = assemble(source);
  if (errors.length || program.length === 0) return { passed: 0, total: cases.length };
  let passed = 0;
  for (const c of cases) {
    const r = run(resetCpu(c.mem), program, maxInstructions);
    if (r.halted && !r.error && JSON.stringify(r.out) === JSON.stringify(c.out)) passed++;
  }
  return { passed, total: cases.length };
}

/** The learner ran exactly this source to HALT at least once. */
export const ranSource = (s: ArchLabState) => s.stats.cpuRuns.some((r) => r.source === s.cpu.source);

export { cacheCfg, inputRows };
