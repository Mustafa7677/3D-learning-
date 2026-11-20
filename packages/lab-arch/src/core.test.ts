import { describe, expect, it } from "vitest";
import { addTrace, fromSigned, hex, toBits, toSigned } from "./bits";
import { cost, simulateCache } from "./cache";
import { assemble, resetCpu, run, tick } from "./cpu";
import { CIRCUITS, solves, truthTable } from "./logic";

export const SUM_1_TO_10 = `; 10 + 9 + ... + 1
      LI R0, 0
      LI R1, 10
loop: ADD R0, R1
      DEC R1
      JNZ loop
      OUT R0
      HALT`;

describe("bits", () => {
  it("place values, hex and two's complement", () => {
    expect(toBits(42)).toEqual([0, 0, 1, 0, 1, 0, 1, 0]);
    expect(hex(255)).toBe("FF");
    expect(toSigned(0xff)).toBe(-1);
    expect(toSigned(0x80)).toBe(-128);
    expect(fromSigned(-42)).toBe(214);
    expect(toSigned(fromSigned(-42))).toBe(-42);
  });
  it("ripple-carry addition matches arithmetic and flags overflow", () => {
    for (let a = 0; a < 256; a += 7)
      for (let b = 0; b < 256; b += 11) {
        const t = addTrace(a, b);
        expect(t.result).toBe((a + b) & 0xff);
        expect(t.carryOut).toBe(a + b > 255);
        const s = toSigned(a) + toSigned(b);
        expect(t.overflow).toBe(s > 127 || s < -128);
      }
    expect(addTrace(100, 100)).toMatchObject({ result: 200, carryOut: false, overflow: true });
    expect(addTrace(255, 1)).toMatchObject({ result: 0, carryOut: true, overflow: false });
  });
});

describe("logic", () => {
  it("the starting circuits do not meet their specifications, the textbook ones do", () => {
    expect(solves(CIRCUITS.half, {})).toBe(false);
    expect(solves(CIRCUITS.half, { s: "XOR", c: "AND" })).toBe(true);
    expect(solves(CIRCUITS.full, {})).toBe(false);
    expect(solves(CIRCUITS.full, { s: "XOR", co: "OR" })).toBe(true);
    expect(solves(CIRCUITS["nand-xor"], {})).toBe(false);
    expect(solves(CIRCUITS["nand-xor"], { n1: "NAND", n2: "NAND", n3: "NAND", n4: "NAND" })).toBe(true);
  });
  it("truth tables enumerate every input row", () => {
    const t = truthTable(CIRCUITS.full, { s: "XOR", co: "OR" });
    expect(t).toHaveLength(8);
    expect(t.map((r) => `${r.outputs.Cout}${r.outputs.S}`)).toEqual(["00", "01", "01", "10", "01", "10", "10", "11"]);
  });
});

describe("cpu", () => {
  const runSrc = (src: string, mem: number[] = []) => {
    const a = assemble(src);
    expect(a.errors).toEqual([]);
    return run(resetCpu(mem), a.program, 10_000);
  };
  it("sums 1..10", () => {
    const s = runSrc(SUM_1_TO_10);
    expect(s.out).toEqual([55]);
    expect(s.halted).toBe(true);
    expect(s.instructions).toBe(2 + 3 * 10 + 2);
  });
  it("multiplies by repeated addition", () => {
    expect(runSrc("LI R0, 0\nLI R1, 6\nLI R2, 7\nloop: ADD R0, R2\nDEC R1\nJNZ loop\nOUT R0\nHALT").out).toEqual([42]);
  });
  it("sums an array through indirect loads; memory accesses cost extra cycles", () => {
    const s = runSrc("LI R1, 0\nLI R2, 5\nLI R0, 0\nloop: LOAD R3, [R1]\nADD R0, R3\nINC R1\nDEC R2\nJNZ loop\nOUT R0\nHALT", [3, 1, 4, 1, 5]);
    expect(s.out).toEqual([14]);
    expect(s.cycles).toBe(s.instructions + 5 * 3);
  });
  it("finds the maximum with CMP and JC", () => {
    const max = "LI R1, 1\nLI R2, 4\nLOAD R0, [0]\nloop: LOAD R3, [R1]\nCMP R0, R3\nJNC skip\nMOV R0, R3\nskip: INC R1\nDEC R2\nJNZ loop\nOUT R0\nHALT";
    expect(runSrc(max, [3, 9, 4, 1, 5]).out).toEqual([9]);
    expect(runSrc(max, [7, 1, 2, 3, 4]).out).toEqual([7]);
  });
  it("one instruction is three stages", () => {
    const { program } = assemble("LI R0, 5\nHALT");
    let s = resetCpu();
    s = tick(s, program);
    expect(s).toMatchObject({ stage: "decode", ir: 0, regs: [0, 0, 0, 0] });
    s = tick(tick(s, program), program);
    expect(s).toMatchObject({ stage: "fetch", pc: 1, regs: [5, 0, 0, 0], instructions: 1 });
  });
  it("reports errors per line and stops runaway loops", () => {
    expect(assemble("LI R9, 1\nFOO\nJMP nowhere\nLOAD R0, [99]").errors.map((e) => e.line)).toEqual([1, 2, 3, 4]);
    const loop = assemble("top: JMP top");
    expect(run(resetCpu(), loop.program, 500).instructions).toBe(500);
    const noHalt = assemble("LI R0, 1");
    expect(run(resetCpu(), noHalt.program, 10).error).toMatch(/HALT/);
  });
});

describe("cache", () => {
  const rate = (t: ReturnType<typeof simulateCache>) => t.filter((a) => a.hit).length / t.length;
  it("row order reuses each line; column order thrashes a small cache", () => {
    const small = { lines: 4, lineSize: 16 };
    expect(rate(simulateCache("row", small))).toBe(0.75);
    expect(rate(simulateCache("column", small))).toBe(0);
    expect(cost(simulateCache("column", small)) / cost(simulateCache("row", small))).toBeGreaterThan(3.5);
  });
  it("a cache that holds the whole matrix makes the order irrelevant", () => {
    const big = { lines: 16, lineSize: 16 };
    expect(rate(simulateCache("column", big))).toBe(0.75);
  });
});
