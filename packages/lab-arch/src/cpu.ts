/**
 * A tiny 8-bit CPU: four registers (R0–R3), a program counter, Z and C flags
 * and 16 bytes of data memory. Programs are written in a small assembly
 * language and run one stage (fetch, decode, execute) at a time.
 */
export type Op = "LI" | "MOV" | "ADD" | "SUB" | "INC" | "DEC" | "CMP" | "LOAD" | "STORE" | "JMP" | "JZ" | "JNZ" | "JC" | "JNC" | "OUT" | "HALT";

export interface Instr {
  op: Op;
  /** Register numbers, immediates, memory addresses or jump targets (already resolved). */
  args: number[];
  /** Memory operand uses a register as the address: LOAD R0, [R1]. */
  indirect?: boolean;
  /** Source line (1-based) for highlighting. */
  line: number;
  text: string;
}

export interface Assembled {
  program: Instr[];
  errors: { line: number; message: string }[];
}

export const MEM_SIZE = 16;
export const MAX_PROGRAM = 64;

const SPEC: Record<Op, string> = {
  LI: "r,i",
  MOV: "r,r",
  ADD: "r,r",
  SUB: "r,r",
  INC: "r",
  DEC: "r",
  CMP: "r,r",
  LOAD: "r,m",
  STORE: "r,m",
  JMP: "l",
  JZ: "l",
  JNZ: "l",
  JC: "l",
  JNC: "l",
  OUT: "r",
  HALT: "",
};

/** Two passes: collect labels, then encode. Errors are reported per line, in Kazakh. */
export function assemble(source: string): Assembled {
  const errors: Assembled["errors"] = [];
  const lines = source.replace(/\r/g, "").split("\n");
  const labels: Record<string, number> = {};
  const pending: { line: number; text: string; op: string; operands: string[] }[] = [];
  lines.forEach((raw, i) => {
    let text = raw.replace(/;.*$/, "").trim();
    const m = /^([A-Za-z_]\w*):\s*(.*)$/.exec(text);
    if (m) {
      const name = m[1]!.toLowerCase();
      if (name in labels) errors.push({ line: i + 1, message: `«${m[1]}» белгісі қайталанды` });
      labels[name] = pending.length;
      text = m[2]!.trim();
    }
    if (!text) return;
    const [op, ...rest] = text.split(/\s+/);
    const operands = rest.join(" ").split(",").map((s) => s.trim()).filter(Boolean);
    pending.push({ line: i + 1, text, op: op!.toUpperCase(), operands });
  });
  if (pending.length > MAX_PROGRAM) errors.push({ line: pending[MAX_PROGRAM]!.line, message: `Бағдарлама ${MAX_PROGRAM} нұсқаудан аспауы керек` });

  const program: Instr[] = [];
  for (const p of pending.slice(0, MAX_PROGRAM)) {
    if (!(p.op in SPEC)) {
      errors.push({ line: p.line, message: `Белгісіз нұсқау: ${p.op}` });
      continue;
    }
    const op = p.op as Op;
    const kinds = SPEC[op] ? SPEC[op].split(",") : [];
    if (p.operands.length !== kinds.length) {
      errors.push({ line: p.line, message: `${op} нұсқауына ${kinds.length} операнд керек` });
      continue;
    }
    const args: number[] = [];
    let indirect = false;
    let bad = false;
    kinds.forEach((k, j) => {
      const s = p.operands[j]!;
      const reg = /^R([0-3])$/i.exec(s);
      if (k === "r") {
        if (reg) args.push(Number(reg[1]));
        else bad = !!errors.push({ line: p.line, message: `«${s}» — регистр емес (R0–R3)` });
      } else if (k === "i") {
        const n = Number(s);
        if (Number.isInteger(n) && n >= -128 && n <= 255) args.push(((n % 256) + 256) % 256);
        else bad = !!errors.push({ line: p.line, message: `«${s}» — 0..255 (не −128..127) сан болуы керек` });
      } else if (k === "m") {
        const mem = /^\[\s*(R[0-3]|\d+)\s*\]$/i.exec(s);
        if (!mem) bad = !!errors.push({ line: p.line, message: `«${s}» — жад адресі [5] не [R1] түрінде` });
        else if (/^R/i.test(mem[1]!)) {
          indirect = true;
          args.push(Number(mem[1]!.slice(1)));
        } else if (Number(mem[1]) < MEM_SIZE) args.push(Number(mem[1]));
        else bad = !!errors.push({ line: p.line, message: `Адрес 0..${MEM_SIZE - 1} болуы керек` });
      } else {
        const target = labels[s.toLowerCase()];
        if (target === undefined) bad = !!errors.push({ line: p.line, message: `«${s}» белгісі жоқ` });
        else args.push(target);
      }
    });
    if (!bad) program.push({ op, args, indirect: indirect || undefined, line: p.line, text: p.text });
  }
  return { program, errors };
}

export type Stage = "fetch" | "decode" | "execute";

export interface CpuState {
  regs: number[];
  pc: number;
  z: boolean;
  c: boolean;
  mem: number[];
  out: number[];
  /** Instructions completed. */
  instructions: number;
  /** Clock cycles: 1 per instruction, +3 for each memory access (memory is slow). */
  cycles: number;
  halted: boolean;
  /** Next stage to perform. */
  stage: Stage;
  /** Instruction register: what was fetched. */
  ir: number | null;
  error: string | null;
  /** What the last execute stage touched, for highlighting. */
  touched: { regs: number[]; mem: number[] };
}

export const MEMORY_PENALTY = 3;

export function resetCpu(mem: number[] = []): CpuState {
  const m = Array.from({ length: MEM_SIZE }, (_, i) => (mem[i] ?? 0) & 0xff);
  return { regs: [0, 0, 0, 0], pc: 0, z: false, c: false, mem: m, out: [], instructions: 0, cycles: 0, halted: false, stage: "fetch", ir: null, error: null, touched: { regs: [], mem: [] } };
}

function exec(s: CpuState, ins: Instr): CpuState {
  const regs = s.regs.slice();
  const mem = s.mem.slice();
  let { pc, z, c } = s;
  let out = s.out;
  let cycles = s.cycles + 1;
  const touched = { regs: [] as number[], mem: [] as number[] };
  const [a = 0, b = 0] = ins.args;
  const setZ = (v: number) => (z = (v & 0xff) === 0);
  pc++;
  switch (ins.op) {
    case "LI":
      regs[a] = b;
      touched.regs.push(a);
      break;
    case "MOV":
      regs[a] = regs[b]!;
      touched.regs.push(a);
      break;
    case "ADD": {
      const r = regs[a]! + regs[b]!;
      c = r > 0xff;
      regs[a] = r & 0xff;
      setZ(regs[a]!);
      touched.regs.push(a);
      break;
    }
    case "SUB": {
      const r = regs[a]! - regs[b]!;
      c = r < 0;
      regs[a] = (r + 256) & 0xff;
      setZ(regs[a]!);
      touched.regs.push(a);
      break;
    }
    case "INC":
      regs[a] = (regs[a]! + 1) & 0xff;
      setZ(regs[a]!);
      touched.regs.push(a);
      break;
    case "DEC":
      regs[a] = (regs[a]! + 255) & 0xff;
      setZ(regs[a]!);
      touched.regs.push(a);
      break;
    case "CMP":
      setZ(regs[a]! - regs[b]!);
      c = regs[a]! < regs[b]!;
      break;
    case "LOAD": {
      const addr = ins.indirect ? regs[b]! % MEM_SIZE : b;
      regs[a] = mem[addr]!;
      cycles += MEMORY_PENALTY;
      touched.regs.push(a);
      touched.mem.push(addr);
      break;
    }
    case "STORE": {
      const addr = ins.indirect ? regs[b]! % MEM_SIZE : b;
      mem[addr] = regs[a]!;
      cycles += MEMORY_PENALTY;
      touched.mem.push(addr);
      break;
    }
    case "JMP":
      pc = a;
      break;
    case "JZ":
      if (z) pc = a;
      break;
    case "JNZ":
      if (!z) pc = a;
      break;
    case "JC":
      if (c) pc = a;
      break;
    case "JNC":
      if (!c) pc = a;
      break;
    case "OUT":
      out = [...out, regs[a]!].slice(-32);
      break;
    case "HALT":
      return { ...s, halted: true, cycles, instructions: s.instructions + 1, stage: "fetch", ir: null, touched };
  }
  return { ...s, regs, mem, pc, z, c, out, cycles, instructions: s.instructions + 1, stage: "fetch", ir: null, touched };
}

/** Advance one stage of the fetch–decode–execute cycle. */
export function tick(s: CpuState, program: Instr[]): CpuState {
  if (s.halted || s.error) return s;
  if (s.stage === "fetch") {
    if (s.pc >= program.length) return { ...s, halted: true, error: "PC бағдарламаның соңынан шығып кетті (HALT жоқ па?)" };
    return { ...s, ir: s.pc, stage: "decode", touched: { regs: [], mem: [] } };
  }
  if (s.stage === "decode") return { ...s, stage: "execute" };
  return exec(s, program[s.ir ?? s.pc]!);
}

/** Run whole instructions; stops at HALT, an error, or the step limit (runaway loops). */
export function run(s: CpuState, program: Instr[], maxInstructions: number): CpuState {
  let cur = s;
  const limit = s.instructions + maxInstructions;
  while (!cur.halted && !cur.error && cur.instructions < limit) {
    cur = tick(cur, program);
    if (cur.stage !== "fetch") cur = tick(tick(cur, program), program);
  }
  return cur;
}
