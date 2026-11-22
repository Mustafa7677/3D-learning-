import { LessonEngine } from "@inside-tech/lesson-engine";
import { SimulationRuntime, replay } from "@inside-tech/sim-core";
import { describe, expect, it } from "vitest";
import { archDeepDives } from "./deep";
import { MUL_LIMIT, MUL_TESTS, archLabPlugin, archLessons, passesTests, type ArchLabAction, type ArchLabState } from "./index";

describe("architecture lab content", () => {
  for (const lesson of archLessons)
    for (const step of lesson.steps)
      it(`${lesson.id}/${step.id}`, () => {
        expect(step.body.length, "lecture text").toBeGreaterThan(600);
        expect(step.body).toMatch(/## /);
        expect(step.quiz?.length ?? 0).toBeGreaterThanOrEqual(2);
        for (const q of step.quiz ?? []) {
          expect(q.options.length).toBeGreaterThanOrEqual(3);
          expect(new Set(q.options).size).toBe(q.options.length);
          expect(q.answer).toBeLessThan(q.options.length);
          expect(q.explain.length).toBeGreaterThan(20);
        }
      });
  it("deep dives are well-formed", () => {
    let n = 0;
    for (const dives of Object.values(archDeepDives))
      for (const text of Object.values(dives)) {
        n++;
        expect(text.split("\n").filter((l) => /^##+ /.test(l))).toHaveLength(1);
        expect((text.match(/```/g) ?? []).length % 2).toBe(0);
      }
    expect(n).toBeGreaterThanOrEqual(4);
  });
});

const ADD = "LOAD R0, [0]\nLOAD R1, [1]\nADD R0, R1\nOUT R0\nHALT";
const COUNTDOWN = "LOAD R0, [0]\nloop: OUT R0\nDEC R0\nJNZ loop\nHALT";
const MAX = "LI R1, 1\nLI R2, 4\nLOAD R0, [0]\nloop: LOAD R3, [R1]\nCMP R0, R3\nJNC skip\nMOV R0, R3\nskip: INC R1\nDEC R2\nJNZ loop\nOUT R0\nHALT";
const MUL = `      LOAD R1, [0]
      LOAD R2, [1]
      LI R0, 0
      LI R3, 0
      CMP R1, R3
      JZ done
      CMP R2, R3
      JZ done
loop: ADD R0, R2
      DEC R1
      JNZ loop
done: OUT R0
      HALT`;
const NAIVE_MUL = "LOAD R1, [0]\nLOAD R2, [1]\nLI R0, 0\nloop: ADD R0, R2\nDEC R1\nJNZ loop\nOUT R0\nHALT";

type D = (a: ArchLabAction) => void;
const program = (d: D, source: string) => {
  d({ type: "cpu/source", source });
  d({ type: "cpu/finish" });
};

const scripts: Record<string, Record<string, (d: D) => void>> = {
  "arch-1-binary": {
    bits: (d) => [2, 4, 6].forEach((bit) => d({ type: "bits/toggle", bit })),
    range: (d) => [255, 128].forEach((value) => d({ type: "bits/set", value })),
    hex: (d) => d({ type: "bits/set", value: 0xa5 }),
  },
  "arch-2-arith": {
    add: (d) => d({ type: "bits/add", a: 7, b: 1 }),
    overflow: (d) => d({ type: "bits/add", a: 255, b: 1 }),
    twos: (d) => [255, 128].forEach((value) => d({ type: "bits/set", value })),
  },
  "arch-3-gates": {
    truth: (d) => ["A", "B", "A"].forEach((name) => d({ type: "gates/input", name })),
    types: (d) => (["OR", "XOR", "NAND", "NOR"] as const).forEach((gateType) => d({ type: "gates/type", gate: "g", gateType })),
  },
  "arch-4-adder": {
    half: (d) => {
      d({ type: "gates/type", gate: "s", gateType: "XOR" });
      d({ type: "gates/type", gate: "c", gateType: "AND" });
    },
    full: (d) => {
      d({ type: "gates/type", gate: "s", gateType: "XOR" });
      d({ type: "gates/type", gate: "co", gateType: "OR" });
    },
    ripple: (d) => d({ type: "bits/add", a: 127, b: 1 }),
  },
  "arch-5-cpu": {
    cycle: (d) => {
      for (let i = 0; i < 6; i++) d({ type: "cpu/tick" });
    },
    run: (d) => d({ type: "cpu/finish" }),
    loop: (d) => d({ type: "cpu/finish" }),
  },
  "arch-6-asm": {
    add: (d) => program(d, ADD),
    countdown: (d) => program(d, COUNTDOWN),
  },
  "arch-7-memory": {
    array: (d) => d({ type: "cpu/finish" }),
    max: (d) => program(d, MAX),
  },
  "arch-8-cache": {
    row: (d) => d({ type: "cache/finish" }),
    column: (d) => d({ type: "cache/finish" }),
    bigger: (d) => {
      d({ type: "cache/config", lines: 16 });
      d({ type: "cache/finish" });
    },
  },
  "arch-9-pset": {
    negative: (d) => d({ type: "bits/set", value: 214 }),
    nand: (d) => ["n1", "n2", "n3", "n4"].forEach((gate) => d({ type: "gates/type", gate, gateType: "NAND" })),
    multiply: (d) => program(d, MUL),
    cache: (d) => {
      d({ type: "cache/config", pattern: "row", lines: 2, lineSize: 32 });
      d({ type: "cache/finish" });
    },
  },
  "arch-10-pipeline": {
    stages: (d) => {
      d({ type: "pipe/run" });
      d({ type: "pipe/mode", mode: "stall" });
      d({ type: "pipe/run" });
    },
    forward: (d) => {
      d({ type: "pipe/run" });
      // i5 climbs above i4, i3 and i2 to sit right behind the load.
      for (const i of [3, 2, 1]) d({ type: "pipe/swap", index: i });
      d({ type: "pipe/run" });
    },
  },
  "arch-11-branch": {
    loop: (d) => {
      d({ type: "branch/run" });
      d({ type: "branch/set", predictor: "2bit" });
      d({ type: "branch/run" });
    },
    data: (d) => {
      d({ type: "branch/run" });
      d({ type: "branch/set", pattern: "sorted" });
      d({ type: "branch/run" });
    },
  },
  "arch-13-tlb": {
    translate: (d) => {
      d({ type: "tlb/run" });
      d({ type: "tlb/set", pattern: "random-few" });
      d({ type: "tlb/run" });
    },
    huge: (d) => {
      d({ type: "tlb/run" });
      d({ type: "tlb/set", huge: true });
      d({ type: "tlb/run" });
    },
  },
  "arch-12-assoc": {
    conflict: (d) => {
      d({ type: "assoc/run" });
      d({ type: "assoc/set", ways: 2 });
      d({ type: "assoc/run" });
    },
    lru: (d) => {
      d({ type: "assoc/run" });
      d({ type: "assoc/set", ways: 4 });
      d({ type: "assoc/run" });
    },
  },
};

describe("architecture lessons are completable", () => {
  for (const lesson of archLessons)
    it(lesson.id, () => {
      const rt = new SimulationRuntime(archLabPlugin, 1);
      const engine = new LessonEngine(lesson);
      const sync = () => engine.update(rt.getState(), rt.evaluate());
      const d: D = (a) => {
        rt.dispatch(a);
        sync();
      };
      engine.step.onEnter?.forEach((a) => rt.dispatch(a));
      sync();
      expect(engine.view().objectives.some((o) => o.done), "nothing done before acting").toBe(false);
      for (const step of lesson.steps) {
        scripts[lesson.id]![step.id]!(d);
        sync();
        expect(engine.view().objectives.filter((o) => !o.done).map((o) => o.text), `${lesson.id}/${step.id}`).toEqual([]);
        for (const q of step.quiz ?? []) expect(engine.answer(q.id, q.answer).correct).toBe(true);
        const next = engine.advance();
        next?.onEnter?.forEach((a) => rt.dispatch(a));
        sync();
      }
      expect(engine.isLessonComplete()).toBe(true);
    });
});

describe("autograder", () => {
  it("hidden tests catch the missing zero check and hard-coded answers", () => {
    expect(passesTests(MUL, MUL_TESTS, MUL_LIMIT)).toEqual({ passed: 6, total: 6 });
    // Without the zero check the loop runs 256 times; 256·b ≡ 0 (mod 256), so only the budget catches it.
    expect(passesTests(NAIVE_MUL, MUL_TESTS).passed).toBe(6);
    expect(passesTests(NAIVE_MUL, MUL_TESTS, MUL_LIMIT).passed).toBe(5); // fails 0 × 9
    expect(passesTests("LI R0, 42\nOUT R0\nHALT", MUL_TESTS).passed).toBe(1);
    expect(passesTests("garbage", MUL_TESTS).passed).toBe(0);
  });
  it("a program counts only after it was run, and only in its current form", () => {
    const pset = archLessons.find((l) => l.id === "arch-9-pset")!;
    const step = pset.steps.find((s) => s.id === "multiply")!;
    const rt = new SimulationRuntime(archLabPlugin, 1);
    step.onEnter!.forEach((a) => rt.dispatch(a));
    const ok = () => step.objectives[0]!.check(rt.getState(), { assessment: rt.evaluate() });
    rt.dispatch({ type: "cpu/source", source: MUL });
    expect(ok()).toBe(false);
    rt.dispatch({ type: "cpu/finish" });
    expect(ok()).toBe(true);
    rt.dispatch({ type: "cpu/source", source: MUL + "\n; edited" });
    expect(ok()).toBe(false);
  });
  it("NAND-only XOR rejects other gate mixes", () => {
    const rt = new SimulationRuntime(archLabPlugin, 1);
    rt.dispatch({ type: "gates/circuit", circuit: "nand-xor" });
    for (const gate of ["n1", "n2", "n3"]) rt.dispatch({ type: "gates/type", gate, gateType: "AND" });
    rt.dispatch({ type: "gates/type", gate: "n4", gateType: "XOR" });
    expect(rt.getState().stats.solved.some((s) => s.circuit === "nand-xor" && Object.values(s.types).every((t) => t === "NAND"))).toBe(false);
  });
});

describe("plugin", () => {
  it("plays the CPU stage by stage at the chosen speed and is replayable", () => {
    const rt = new SimulationRuntime(archLabPlugin, 3);
    rt.dispatch({ type: "mode/set", mode: "cpu" });
    rt.dispatch({ type: "speed/set", speed: 60 });
    rt.dispatch({ type: "cpu/play" });
    rt.stepTicks(60);
    const s: ArchLabState = rt.getState();
    expect(s.cpu.state.halted).toBe(true);
    expect(s.cpu.state.out).toEqual([12]);
    rt.dispatch({ type: "cache/config", pattern: "column" });
    rt.dispatch({ type: "cache/play" });
    rt.stepTicks(100);
    expect(replay(archLabPlugin, rt.record())).toEqual(rt.getState());
  });
  it("assembler errors block running", () => {
    const rt = new SimulationRuntime(archLabPlugin, 1);
    rt.dispatch({ type: "cpu/source", source: "LI R7, 1\nHALT" });
    rt.dispatch({ type: "cpu/finish" });
    expect(rt.getState().cpu.errors).toHaveLength(1);
    expect(rt.getState().stats.cpuRuns).toHaveLength(0);
  });
});
