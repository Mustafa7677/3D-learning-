import { LessonEngine } from "@inside-tech/lesson-engine";
import { SimulationRuntime, replay } from "@inside-tech/sim-core";
import { describe, expect, it } from "vitest";
import { cloudDeepDives } from "./deep";
import { cloudLabPlugin, cloudLessons, type CloudLabAction, type StepId } from "./index";

describe("cloud lab content", () => {
  for (const lesson of cloudLessons)
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
    for (const dives of Object.values(cloudDeepDives))
      for (const text of Object.values(dives)) {
        n++;
        expect(text.split("\n").filter((l) => /^##+ /.test(l))).toHaveLength(1);
        expect((text.match(/```/g) ?? []).length % 2).toBe(0);
      }
    expect(n).toBeGreaterThanOrEqual(4);
  });
});

const GOOD: StepId[] = ["base", "workdir", "copyPkg", "install", "copySrc", "build", "cmd"];
type D = (a: CloudLabAction) => void;
type T = (n: number) => void;

const scripts: Record<string, Record<string, (d: D, tick: T) => void>> = {
  "cloud-1-containers": {
    build: (d) => d({ type: "image/build", change: "src" }),
    reorder: (d) => {
      d({ type: "image/order", order: GOOD });
      d({ type: "image/build", change: "src" });
    },
  },
  "cloud-2-orchestration": {
    heal: (d, tick) => {
      d({ type: "cluster/kill", id: 2 });
      tick(60);
    },
    scale: (d, tick) => {
      d({ type: "cluster/desired", n: 5 });
      tick(120);
    },
  },
  "cloud-3-scaling": {
    overload: (d) => d({ type: "scale/set", instances: 4 }),
    slo: (d) => [9, 10].forEach((instances) => d({ type: "scale/set", instances })),
  },
  "cloud-4-autoscale": {
    fixed: (d) => d({ type: "autoscale/run" }),
    auto: (d) => {
      d({ type: "autoscale/set", min: 3, max: 20, target: 0.6 });
      d({ type: "autoscale/run" });
    },
  },
  "cloud-5-cicd": {
    gate: (d) => d({ type: "pipeline/run" }),
    fast: (d) => {
      d({ type: "pipeline/set", failingTest: false, parallel: true, cache: true });
      d({ type: "pipeline/run" });
    },
  },
  "cloud-6-release": {
    bigbang: (d) => {
      d({ type: "release/step" });
      d({ type: "release/rollback" });
    },
    canary: (d) => {
      d({ type: "release/strategy", strategy: "canary" });
      d({ type: "release/step" });
      d({ type: "release/rollback" });
    },
  },
  "cloud-7-availability": {
    nines: (d) => d({ type: "availability/set", replicas: 2 }),
    zones: (d) => {
      d({ type: "availability/set", replicas: 3, zones: 1 });
      d({ type: "availability/zoneDown", down: true });
      d({ type: "availability/set", zones: 2 });
      d({ type: "availability/zoneDown", down: true });
    },
  },
  "cloud-8-incident": {
    diagnose: (d) => {
      d({ type: "incident/select", service: "gateway" });
      d({ type: "incident/select", service: "payments" });
    },
  },
  "cloud-9-pset": {
    budget: (d) => {
      d({ type: "autoscale/set", min: 4, target: 0.6 });
      d({ type: "autoscale/run" });
    },
    nines: (d) => {
      d({ type: "availability/set", replicas: 3, zones: 3 });
      d({ type: "availability/zoneDown", down: true });
    },
    ship: (d) => {
      d({ type: "pipeline/run" });
      d({ type: "pipeline/set", failingTest: false, parallel: true, cache: true });
      d({ type: "pipeline/run" });
    },
  },
};

describe("cloud lessons are completable", () => {
  for (const lesson of cloudLessons)
    it(lesson.id, () => {
      const rt = new SimulationRuntime(cloudLabPlugin, 1);
      const engine = new LessonEngine(lesson);
      const sync = () => engine.update(rt.getState(), rt.evaluate());
      const d: D = (a) => {
        rt.dispatch(a);
        sync();
      };
      const tick: T = (n) => {
        for (let i = 0; i < n; i++) {
          rt.stepTicks(1);
          sync();
        }
      };
      engine.step.onEnter?.forEach((a) => rt.dispatch(a));
      sync();
      expect(engine.view().objectives.some((o) => o.done)).toBe(false);
      for (const step of lesson.steps) {
        scripts[lesson.id]![step.id]!(d, tick);
        sync();
        expect(engine.view().objectives.filter((o) => !o.done).map((o) => o.text), `${lesson.id}/${step.id}`).toEqual([]);
        for (const q of step.quiz ?? []) expect(engine.answer(q.id, q.answer).correct).toBe(true);
        engine.advance()?.onEnter?.forEach((a) => rt.dispatch(a));
        sync();
      }
      expect(engine.isLessonComplete()).toBe(true);
      expect(replay(cloudLabPlugin, rt.record())).toEqual(rt.getState());
    });
});

describe("autograder", () => {
  const pset = cloudLessons.find((l) => l.id === "cloud-9-pset")!;
  const check = (step: string, actions: CloudLabAction[]) => {
    const rt = new SimulationRuntime(cloudLabPlugin, 1);
    const st = pset.steps.find((s) => s.id === step)!;
    st.onEnter?.forEach((a) => rt.dispatch(a));
    actions.forEach((a) => rt.dispatch(a));
    return st.objectives.every((o) => o.check(rt.getState(), { assessment: rt.evaluate() }));
  };
  it("a big fixed fleet blows the budget; more replicas than needed or one zone fail", () => {
    expect(check("budget", [{ type: "autoscale/set", min: 12, max: 12 }, { type: "autoscale/run" }])).toBe(false);
    expect(check("budget", [{ type: "autoscale/set", min: 2, target: 0.6 }, { type: "autoscale/run" }])).toBe(false);
    expect(check("nines", [{ type: "availability/set", replicas: 4, zones: 2 }, { type: "availability/zoneDown", down: true }])).toBe(false);
    expect(check("nines", [{ type: "availability/set", replicas: 3, zones: 1 }, { type: "availability/zoneDown", down: true }])).toBe(false);
  });
  it("shipping without first catching the failure is not enough", () => {
    expect(check("ship", [{ type: "pipeline/set", failingTest: false, parallel: true, cache: true }, { type: "pipeline/run" }])).toBe(false);
  });
});
