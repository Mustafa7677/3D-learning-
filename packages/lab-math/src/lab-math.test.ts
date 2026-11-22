import { LessonEngine, coverage } from "@inside-tech/lesson-engine";
import { SimulationRuntime } from "@inside-tech/sim-core";
import { describe, expect, it } from "vitest";
import { GAUSS_START, MATH_COURSE, PRESETS, applyOp, det, inverse, isEchelon, mathLabPlugin, mathLessons, mul, solutionOf, type MathLabAction, type MathLabState } from "./index";

type D = (a: MathLabAction) => void;
const scripts: Record<string, Record<string, (d: D) => void>> = {
  "la-1-vectors": {
    add: (d) => {
      d({ type: "vec/set", which: "v", value: [1, 2, 2] });
      d({ type: "vec/set", which: "v", value: [3, 4, 0] });
    },
    scale: (d) => {
      d({ type: "vec/k", k: -2 });
      d({ type: "vec/k", k: 0.5 });
    },
  },
  "la-2-dot": {
    ortho: (d) => {
      d({ type: "vec/set", which: "v", value: [-1, 2, 0] });
      d({ type: "vec/set", which: "v", value: [-2, 1, 0] });
    },
    proj: (d) => {
      d({ type: "vec/set", which: "v", value: [3, 1, 0] });
      d({ type: "vec/set", which: "v", value: [3, 4, 0] });
    },
  },
  "la-3-gauss": {
    forward: (d) => {
      d({ type: "gauss/op", op: { kind: "add", i: 1, j: 0, c: -2 } });
      d({ type: "gauss/op", op: { kind: "add", i: 2, j: 0, c: -1 } });
      d({ type: "gauss/op", op: { kind: "add", i: 2, j: 1, c: -2 } });
    },
    back: (d) => {
      d({ type: "gauss/op", op: { kind: "scale", i: 2, c: 1 / 7 } });
      d({ type: "gauss/op", op: { kind: "add", i: 1, j: 2, c: 3 } });
      d({ type: "gauss/op", op: { kind: "scale", i: 1, c: -1 } });
      d({ type: "gauss/op", op: { kind: "add", i: 0, j: 2, c: -1 } });
      d({ type: "gauss/op", op: { kind: "add", i: 0, j: 1, c: -1 } });
    },
  },
  "la-4-matrices": {
    columns: (d) => {
      d({ type: "matrix/cell", r: 0, c: 0, value: 0 });
      d({ type: "matrix/cell", r: 1, c: 0, value: 1 });
      d({ type: "matrix/cell", r: 0, c: 1, value: -1 });
      d({ type: "matrix/cell", r: 1, c: 1, value: 0 });
      d({ type: "matrix/preset", name: "identity" });
      d({ type: "matrix/cell", r: 0, c: 1, value: 1 });
    },
    compose: (d) => {
      for (let i = 0; i < 3; i++) d({ type: "matrix/compose", name: "rot90" });
    },
  },
  "la-5-inverse": {
    undo: (d) => {
      d({ type: "inverse/toggle", on: true });
      d({ type: "matrix/preset", name: "stretch" });
      d({ type: "inverse/toggle", on: true });
    },
    singular: (d) => d({ type: "inverse/toggle", on: true }),
  },
  "la-6-determinant": {
    volume: (d) => {
      d({ type: "matrix/cell", r: 1, c: 1, value: 2 });
      d({ type: "matrix/cell", r: 2, c: 2, value: 3 });
      d({ type: "matrix/preset", name: "shear" });
    },
    flat: (d) => {
      d({ type: "matrix/preset", name: "flatten" });
      d({ type: "matrix/preset", name: "mirror" });
    },
  },
  "la-7-basis": {
    coords: (d) => {
      d({ type: "basis/set", a: 2, b: 1 });
      d({ type: "basis/set", b1: [1, 0], b2: [0, 1], a: 3, b: 1 });
    },
    span: (d) => {
      d({ type: "basis/set", b2: [2, 0] });
      d({ type: "basis/set", b1: [1, 1], b2: [1, -1], a: 2, b: 1 });
    },
  },
  "la-8-eigen": {
    find: (d) => {
      d({ type: "eigen/probe", deg: 45 });
      d({ type: "eigen/probe", deg: 135 });
    },
    others: (d) => {
      d({ type: "eigen/probe", deg: 0 });
      d({ type: "eigen/preset", name: "rotation2" });
      for (const deg of [0, 30, 60, 90]) d({ type: "eigen/probe", deg });
    },
  },
};

describe("math: linear algebra core", () => {
  it("Gaussian elimination reaches the staircase", () => {
    let s = GAUSS_START;
    s = applyOp(s, { kind: "add", i: 1, j: 0, c: -2 });
    s = applyOp(s, { kind: "add", i: 2, j: 0, c: -1 });
    s = applyOp(s, { kind: "add", i: 2, j: 1, c: -2 });
    expect(isEchelon(s)).toBe(true);
    expect(s[2]).toEqual([0, 0, 7, 21]);
  });
  it("determinants: rotation 1, shear 1, flatten 0, mirror −1; det(AB) = det A · det B", () => {
    expect([PRESETS.rot90!, PRESETS.shear!, PRESETS.flatten!, PRESETS.mirror!].map(det)).toEqual([1, 1, 0, -1]);
    expect(det(mul(PRESETS.stretch!, PRESETS.shear!))).toBe(det(PRESETS.stretch!) * det(PRESETS.shear!));
    expect(inverse(PRESETS.flatten!)).toBeNull();
    expect(mul(inverse(PRESETS.shear!)!, PRESETS.shear!)).toEqual(PRESETS.identity);
  });
});

describe("math: the lessons", () => {
  it("the lessons are the first subject of the course map, in order", () => {
    expect(mathLessons.map((l) => l.id)).toEqual(MATH_COURSE[0]!.lessons.map((l) => l.id));
    expect(mathLessons.map((l) => l.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(MATH_COURSE.reduce((n, s) => n + s.lessons.length, 0)).toBe(36);
  });

  for (const lesson of mathLessons)
    it(`${lesson.id}: complete content, an expert answer that covers its ideas, and a lesson that completes`, () => {
      for (const step of lesson.steps) {
        expect(step.body.length, `${step.id} body`).toBeGreaterThan(600);
        expect(step.body).toContain("## ");
        expect(step.predict, `${step.id} predict`).toBeDefined();
        expect(step.quiz?.length ?? 0).toBeGreaterThanOrEqual(2);
        for (const q of step.quiz ?? []) expect(q.explain.length).toBeGreaterThan(20);
        const visible = JSON.stringify({ b: step.body, q: step.quiz, p: step.predict, s: step.selfExplain, o: step.objectives.map((o) => o.text) });
        expect(/[–—]/.test(visible), `${step.id} dashes`).toBe(false);
      }
      const first = lesson.steps[0]!;
      const last = lesson.steps.at(-1)!;
      expect(first.comic?.panels.length ?? 0, "comic").toBeGreaterThanOrEqual(5);
      expect(first.comic!.panels.some((p) => p.board), "a board in the comic").toBe(true);
      expect(first.worked, "worked example").toBeDefined();
      expect(first.worked!.fadeFrom).toBeLessThan(first.worked!.steps.length);
      for (const s of first.worked!.steps.slice(first.worked!.fadeFrom)) expect(s.wrong?.length ?? 0, "faded steps offer wrong lines").toBeGreaterThanOrEqual(1);
      expect(last.hunt, "error hunt").toBeDefined();
      expect(last.hunt!.wrong).toBeLessThan(last.hunt!.lines.length);
      expect(last.hunt!.lines).not.toContain(last.hunt!.fix);
      const media = JSON.stringify({ c: first.comic, w: first.worked, h: last.hunt });
      expect(/[\u2013\u2014]/.test(media), "dashes in media").toBe(false);
      expect(last.selfExplain).toBeDefined();
      expect(coverage(last.selfExplain!, last.selfExplain!.model).missing).toEqual([]);

      const rt = new SimulationRuntime<MathLabState, MathLabAction>(mathLabPlugin, 1);
      const engine = new LessonEngine(lesson);
      const d: D = (a) => rt.dispatch(a);
      const sync = () => engine.update(rt.getState(), rt.evaluate());
      engine.step.onEnter?.forEach(d);
      sync();
      for (const step of lesson.steps) {
        expect(engine.view().objectives.every((o) => !o.done), `${step.id} starts undone`).toBe(true);
        expect(scripts[lesson.id]?.[step.id], `script ${step.id}`).toBeDefined();
        scripts[lesson.id]![step.id]!(d);
        sync();
        expect(engine.view().objectives.filter((o) => !o.done).map((o) => o.text), step.id).toEqual([]);
        for (const q of step.quiz ?? []) expect(engine.answer(q.id, q.answer).correct).toBe(true);
        engine.advance()?.onEnter?.forEach(d);
        sync();
      }
      expect(engine.isLessonComplete()).toBe(true);
    });

  it("the elimination lesson ends on the solution (1, 2, 3)", () => {
    const rt = new SimulationRuntime<MathLabState, MathLabAction>(mathLabPlugin, 1);
    rt.dispatch({ type: "gauss/reset" });
    scripts["la-3-gauss"]!.forward!((a) => rt.dispatch(a));
    scripts["la-3-gauss"]!.back!((a) => rt.dispatch(a));
    expect(solutionOf(rt.getState().sys)).toEqual([1, 2, 3]);
  });
});
