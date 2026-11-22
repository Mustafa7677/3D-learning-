import { LessonEngine } from "@inside-tech/lesson-engine";
import { SimulationRuntime, replay } from "@inside-tech/sim-core";
import { describe, expect, it } from "vitest";
import { optimLessons } from "./lessons";
import { optimLabPlugin, type OptimLabAction } from "./plugin";

describe("AI middle content", () => {
  for (const lesson of optimLessons)
    for (const step of lesson.steps)
      it(`${lesson.id}/${step.id}`, () => {
        expect(step.body.length).toBeGreaterThan(600);
        expect(step.body).toMatch(/## /);
        expect(step.body).not.toMatch(/^\|/m);
        expect(step.predict).toBeDefined();
        expect(step.quiz?.length ?? 0).toBeGreaterThanOrEqual(2);
        for (const q of step.quiz ?? []) {
          expect(q.options.length).toBeGreaterThanOrEqual(3);
          expect(new Set(q.options).size).toBe(q.options.length);
          expect(q.explain.length).toBeGreaterThan(20);
        }
      });
});

type D = (a: OptimLabAction) => void;
const scripts: Record<string, Record<string, (d: D) => void>> = {
  "ai-10-optimizers": {
    sgd: (d) => {
      d({ type: "optim/run" });
      d({ type: "optim/set", lr: 0.55 });
      d({ type: "optim/run" });
      d({ type: "optim/set", lr: 0.45 });
      d({ type: "optim/run" });
    },
    momentum: (d) => {
      d({ type: "optim/run" });
      d({ type: "optim/set", opt: "adam", lr: 0.3 });
      d({ type: "optim/run" });
    },
  },
  "ai-11-metrics": {
    paradox: (d) => {
      d({ type: "metrics/evaluate" });
      d({ type: "metrics/set", trivial: false });
      d({ type: "metrics/evaluate" });
    },
    threshold: (d) => {
      d({ type: "metrics/evaluate" });
      d({ type: "metrics/set", threshold: 0.7 });
      d({ type: "metrics/evaluate" });
    },
  },
  "ai-14-leakage": {
    future: (d) => {
      d({ type: "leak/train" });
      d({ type: "leak/set", useLeak: false });
      d({ type: "leak/train" });
    },
    patients: (d) => {
      d({ type: "leak/split" });
      d({ type: "leak/set", split: "patients" });
      d({ type: "leak/split" });
    },
  },
  "ai-13-drift": {
    decay: (d) => {
      d({ type: "drift/evaluate" });
      d({ type: "drift/week", week: 8 });
      d({ type: "drift/evaluate" });
    },
    retrain: (d) => {
      d({ type: "drift/retrain" });
      d({ type: "drift/evaluate" });
    },
  },
  "ai-12-convolution": {
    kernels: (d) => {
      d({ type: "conv/preset", preset: "blur" });
      d({ type: "conv/apply" });
      d({ type: "conv/preset", preset: "sobel-x" });
      d({ type: "conv/apply" });
    },
    design: (d) => {
      [-1, -1, -1, 0, 0, 0, 1, 1, 1].forEach((value, index) => d({ type: "conv/cell", index, value }));
      d({ type: "conv/apply" });
    },
  },
};

describe("AI middle lessons are completable", () => {
  for (const lesson of optimLessons)
    it(lesson.id, () => {
      const rt = new SimulationRuntime(optimLabPlugin, 1);
      const engine = new LessonEngine(lesson);
      const sync = () => engine.update(rt.getState(), rt.evaluate());
      const d: D = (a) => {
        rt.dispatch(a);
        sync();
      };
      engine.step.onEnter?.forEach((a) => rt.dispatch(a));
      sync();
      expect(engine.view().objectives.some((o) => o.done)).toBe(false);
      for (const step of lesson.steps) {
        scripts[lesson.id]![step.id]!(d);
        sync();
        expect(engine.view().objectives.filter((o) => !o.done).map((o) => o.text), `${lesson.id}/${step.id}`).toEqual([]);
        for (const q of step.quiz ?? []) expect(engine.answer(q.id, q.answer).correct).toBe(true);
        engine.advance()?.onEnter?.forEach((a) => rt.dispatch(a));
        sync();
      }
      expect(engine.isLessonComplete()).toBe(true);
      expect(replay(optimLabPlugin, rt.record())).toEqual(rt.getState());
    });

  it("a copied Sobel-x preset does not count as the learner's own horizontal filter", () => {
    const rt = new SimulationRuntime(optimLabPlugin, 1);
    rt.dispatch({ type: "conv/preset", preset: "sobel-y" });
    rt.dispatch({ type: "conv/apply" });
    const step = optimLessons[2]!.steps[1]!;
    expect(step.objectives[0]!.check(rt.getState(), { assessment: rt.evaluate() })).toBe(false);
  });
});
