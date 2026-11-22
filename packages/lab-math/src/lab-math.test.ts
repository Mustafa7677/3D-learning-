import { LessonEngine, coverage } from "@inside-tech/lesson-engine";
import { SimulationRuntime } from "@inside-tech/sim-core";
import { describe, expect, it } from "vitest";
import { CONE_HALF, conicEccentricity, conicKind, eccentricity, focalDistances, sectionCurve, semiMinor, vertexLines, shown, GAUSS_START, MATH_COURSE, PRESETS, applyOp, det, inverse, isEchelon, mathLabPlugin, mathLessons, mul, solutionOf, type MathLabAction, type MathLabState } from "./index";

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
  "ag-3-ellipse": {
    string: (d) => {
      for (const t of [60, 150]) d({ type: "ellipse/set", t });
      d({ type: "ellipse/set", c: 0 });
    },
    ecc: (d) => {
      d({ type: "ellipse/set", c: 4 });
      d({ type: "ellipse/set", a: 6.5, c: 2.5 });
    },
  },
  "ag-4-conics": {
    cut: (d) => {
      d({ type: "conic/set", tilt: 0 });
      d({ type: "conic/set", tilt: 60 });
      d({ type: "conic/set", tilt: 75 });
    },
    edge: (d) => {
      d({ type: "conic/set", tilt: 59 });
      d({ type: "conic/set", tilt: 61 });
      d({ type: "conic/set", tilt: 75, d: 0 });
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
  it("the lessons sit on the course map, in order", () => {
    const placed = MATH_COURSE.flatMap((s) => s.lessons).flatMap((l, i) => (l.id ? [{ id: l.id, order: i + 1 }] : []));
    expect(mathLessons.map((l) => ({ id: l.id, order: l.order }))).toEqual(placed);
    expect(mathLessons.map((l) => l.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 11, 12]);
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
      expect(first.film, "no film before practice").toBeUndefined();
      expect(last.film, "solution film at the end").toBeDefined();
      const stages = last.film!.frames.map((f) => f.stage);
      expect(stages[0], "the film starts by understanding").toBe(0);
      expect(stages.at(-1), "and ends with a check").toBe(3);
      expect(stages.every((x, i) => i === 0 || x >= stages[i - 1]!), "stages never go back").toBe(true);
      for (const f of last.film!.frames) if (f.mark) expect(f.board.join(" "), `mark ${f.mark}`).toContain(f.mark);
      expect(/[\u2013\u2014]/.test(JSON.stringify(last.film)), "dashes in film").toBe(false);
      // A film moves the scene but completes nothing.
      {
        const rt = new SimulationRuntime<MathLabState, MathLabAction>(mathLabPlugin, 1);
        const e = new LessonEngine(lesson);
        e.step.onEnter?.forEach((a) => rt.dispatch(a));
        for (const f of last.film!.frames) if (f.scene) rt.dispatch({ type: "film/scene", patch: f.scene });
        e.update(rt.getState(), rt.evaluate());
        expect(e.view().objectives.every((o) => !o.done), "film completes nothing").toBe(true);
      }
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

describe("math: the Gaussian film", () => {
  it("ends on the reduced system, so the scene lights the solution", () => {
    const film = mathLessons.find((l) => l.id === "la-3-gauss")!.steps.at(-1)!.film!;
    const rt = new SimulationRuntime<MathLabState, MathLabAction>(mathLabPlugin, 1);
    for (const f of film.frames) if (f.scene) rt.dispatch({ type: "film/scene", patch: f.scene });
    expect(solutionOf(shown(rt.getState()).sys)).toEqual([1, 2, 3]);
    expect(rt.getState().sys).toEqual(GAUSS_START);
    rt.dispatch({ type: "film/scene", patch: null });
    expect(shown(rt.getState()).sys).toEqual(GAUSS_START);
  });
  it("every Gaussian frame keeps (1, 2, 3) on all three planes", () => {
    const film = mathLessons.find((l) => l.id === "la-3-gauss")!.steps.at(-1)!.film!;
    for (const f of film.frames) {
      const sys = f.scene?.sys as number[][] | undefined;
      if (sys) for (const r of sys) expect(r[0]! * 1 + r[1]! * 2 + r[2]! * 3).toBeCloseTo(r[3]!, 9);
    }
  });
});

describe("fair options", () => {
  it("the right option never stands out: no lone proof after a colon, no option far longer than the rest", () => {
    for (const l of mathLessons) {
      for (const s of l.steps) {
        const qs = [...(s.quiz ?? []), ...(s.predict ? [s.predict] : []), ...(s.contrast ? [s.contrast] : [])];
        for (const q of qs) {
          const right = q.options[q.answer]!;
          const others = q.options.filter((_, i) => i !== q.answer);
          if (right.includes(":")) expect(others.some((o) => o.includes(":")), `${l.id}: ${q.question}`).toBe(true);
          expect(right.length, `${l.id}: ${q.question}`).toBeLessThanOrEqual(Math.max(...others.map((o) => o.length)) * 1.6 + 6);
        }
      }
    }
  });
});

describe("analytic geometry", () => {
  it("an ellipse keeps d1 + d2 = 2a everywhere; b and e follow from a and c", () => {
    const e = { a: 5, c: 3 };
    for (const t of [0, 37, 90, 200, 333]) {
      const [d1, d2] = focalDistances(e, t);
      expect(d1 + d2).toBeCloseTo(10, 9);
    }
    expect(semiMinor(e)).toBeCloseTo(4, 9);
    expect(eccentricity({ a: 5, c: 4 })).toBeCloseTo(0.8, 9);
    expect(semiMinor({ a: 6.5, c: 2.5 })).toBeCloseTo(6, 9);
  });

  it("the cut decides the conic; the edge is the generator angle 60°", () => {
    const kinds = [0, 40, 59, 60, 61, 75, 90].map((tilt) => conicKind({ tilt, d: 1 }));
    expect(kinds).toEqual(["circle", "ellipse", "ellipse", "parabola", "hyperbola", "hyperbola", "hyperbola"]);
    expect([30, 60, 75].map((tilt) => conicKind({ tilt, d: 0 }))).toEqual(["point", "line", "lines"]);
    expect([40, 60, 75].map((tilt) => Math.round(conicEccentricity({ tilt, d: 1 }) * 100) / 100)).toEqual([0.74, 1, 1.12]);
    expect([50, 55, 65].map((tilt) => Math.round(conicEccentricity({ tilt, d: 1 }) * 100) / 100)).toEqual([0.88, 0.95, 1.05]);
  });

  it("every point of the drawn section lies on the cone and on the plane; a hyperbola has two branches", () => {
    const t = Math.tan((CONE_HALF * Math.PI) / 180);
    for (const cut of [{ tilt: 0, d: 1 }, { tilt: 40, d: 1.2 }, { tilt: 60, d: 1 }, { tilt: 75, d: 0.6 }]) {
      const b = (cut.tilt * Math.PI) / 180;
      for (const run of sectionCurve(cut)) {
        for (const [x, y, z] of run) {
          expect(Math.hypot(x, y)).toBeCloseTo(Math.abs(z) * t, 6);
          expect(-y * Math.sin(b) + z * Math.cos(b)).toBeCloseTo(cut.d, 6);
        }
      }
    }
    const zs = sectionCurve({ tilt: 75, d: 0.6 }).map((run) => Math.sign(run[Math.floor(run.length / 2)]![2]));
    expect(new Set(zs)).toEqual(new Set([1, -1]));
    expect(sectionCurve({ tilt: 0, d: 1 })).toHaveLength(1);
    expect(vertexLines({ tilt: 75, d: 0 })).toHaveLength(2);
    expect(vertexLines({ tilt: 60, d: 0 })).toHaveLength(1);
    expect(vertexLines({ tilt: 30, d: 0 })).toHaveLength(0);
  });

  it("the plugin keeps the foci inside and the cut on its sliders", () => {
    const rt = new SimulationRuntime<MathLabState, MathLabAction>(mathLabPlugin, 1);
    rt.dispatch({ type: "ellipse/set", a: 2, c: 9 });
    expect(rt.getState().ell.c).toBe(1.5);
    rt.dispatch({ type: "conic/set", tilt: 120, d: -7 });
    expect(rt.getState().cut).toEqual({ tilt: 90, d: -2 });
    rt.dispatch({ type: "film/scene", patch: { cut: { tilt: 60, d: 1 }, ell: { a: 5, c: 4, t: 90 } } });
    expect(shown(rt.getState()).cut).toEqual({ tilt: 60, d: 1 });
    expect(rt.getState().stats.conicSnaps).toHaveLength(1);
  });

  it("every new lesson compares two cases", () => {
    for (const l of mathLessons.filter((x) => x.id.startsWith("ag-"))) expect(l.steps.some((s) => s.contrast), l.id).toBe(true);
  });
});
