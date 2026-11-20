import { LessonEngine } from "@inside-tech/lesson-engine";
import { SimulationRuntime } from "@inside-tech/sim-core";
import { describe, expect, it } from "vitest";
import { aiLabPlugin, aiLessons } from "./index";

const pset = aiLessons.find((l) => l.id === "ai-9-pset")!;

function start() {
  const rt = new SimulationRuntime(aiLabPlugin, 7);
  const engine = new LessonEngine(pset);
  pset.steps[0]!.onEnter!.forEach((a) => rt.dispatch(a));
  const done = (id: string) => {
    engine.update(rt.getState(), rt.evaluate());
    return engine.view().objectives.find((o) => o.id === id)!.done;
  };
  return { rt, done };
}

describe("problem set autograder", () => {
  it("rejects a correct answer that is over budget", () => {
    const { rt, done } = start();
    rt.dispatch({ type: "hyper/set", params: { learningRate: 0.3, batchSize: 16, epochLimit: 300, epochsPerTick: 10 } });
    rt.dispatch({ type: "train/start" });
    rt.stepTicks(32);
    expect(rt.evaluate().metrics.testAcc).toBeGreaterThanOrEqual(0.95);
    expect(done("acc")).toBe(false);
    expect(done("budget")).toBe(false);
  });

  it("rejects solving an easier dataset instead of the task's", () => {
    const { rt, done } = start();
    rt.dispatch({ type: "dataset/generate", kind: "blobs", count: 200, noise: 0.1 });
    rt.dispatch({ type: "network/setHidden", hidden: [4] });
    rt.dispatch({ type: "hyper/set", params: { learningRate: 0.3, batchSize: 16, epochLimit: 200, epochsPerTick: 10 } });
    rt.dispatch({ type: "train/start" });
    rt.stepTicks(22);
    expect(rt.evaluate().metrics.testAcc).toBeGreaterThanOrEqual(0.95);
    expect(done("acc")).toBe(false);
  });

  it("rejects shrinking the test set", () => {
    const { rt, done } = start();
    rt.dispatch({ type: "split/setRatio", ratio: 0.95 });
    rt.dispatch({ type: "network/setHidden", hidden: [4] });
    rt.dispatch({ type: "hyper/set", params: { learningRate: 0.3, batchSize: 16, epochLimit: 300, epochsPerTick: 10 } });
    rt.dispatch({ type: "train/start" });
    rt.stepTicks(32);
    expect(done("acc")).toBe(false);
  });
});
