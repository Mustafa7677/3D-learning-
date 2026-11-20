import { describe, expect, it } from "vitest";
import { Rng, SimulationRuntime, replay } from "@inside-tech/sim-core";
import { LessonEngine } from "@inside-tech/lesson-engine";
import {
  aiLabPlugin,
  aiLessons,
  bce,
  createNetwork,
  forward,
  generateDataset,
  measure,
  predict,
  predictionGrid,
  selectedTrace,
  trainEpoch,
  type AiLabAction,
  type AiLabState,
  type Network,
  type Sample,
} from "./index";

describe("network math", () => {
  it("backprop gradient matches numerical gradient", () => {
    const rng = new Rng(3);
    const net = createNetwork(2, [3], "tanh", rng);
    const s: Sample = { x: [0.3, -0.7], y: 1 };
    const lr = 1e-3;
    // One SGD step with batch 1: Δw = -lr * dL/dw  ⇒  dL/dw = -(w' - w) / lr
    const after = trainEpoch(net, [s], { learningRate: lr, batchSize: 1, l2: 0 }, new Rng(1));
    const h = 1e-5;
    for (const [l, j, i] of [[0, 0, 0], [0, 2, 1], [1, 0, 1]] as const) {
      const plus = structuredClone(net) as Network;
      const minus = structuredClone(net) as Network;
      plus.layers[l]!.W[j]![i]! += h;
      minus.layers[l]!.W[j]![i]! -= h;
      const numeric = (bce(predict(plus, s.x), 1) - bce(predict(minus, s.x), 1)) / (2 * h);
      const analytic = -(after.layers[l]!.W[j]![i]! - net.layers[l]!.W[j]![i]!) / lr;
      expect(analytic).toBeCloseTo(numeric, 4);
    }
  });

  it("learns XOR with one hidden layer", () => {
    const rng = new Rng(11);
    const data: Sample[] = generateDataset("xor", 200, 0.05, rng).map((p) => ({ x: [p.x, p.y], y: p.label }));
    let net = createNetwork(2, [8], "tanh", rng);
    for (let e = 0; e < 200; e++) net = trainEpoch(net, data, { learningRate: 0.3, batchSize: 16, l2: 0 }, rng);
    expect(measure(net, data).accuracy).toBeGreaterThan(0.95);
  });

  it("forward trace has one activation vector per layer", () => {
    const net = createNetwork(2, [4, 3], "relu", new Rng(1));
    const t = forward(net, [0.1, 0.2]);
    expect(t.a.map((v) => v.length)).toEqual([2, 4, 3, 1]);
  });

  it("generates every dataset kind within bounds", () => {
    for (const kind of ["blobs", "xor", "circles", "spiral", "moons"] as const) {
      const pts = generateDataset(kind, 100, 0.3, new Rng(5));
      expect(pts).toHaveLength(100);
      for (const p of pts) {
        expect(Math.abs(p.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(p.y)).toBeLessThanOrEqual(1);
      }
      expect(pts.some((p) => p.label === 0) && pts.some((p) => p.label === 1)).toBe(true);
    }
  });
});

describe("ai-lab plugin", () => {
  it("initial state has a split dataset", () => {
    const s = aiLabPlugin.initialize(1);
    expect(s.points.length).toBe(160);
    const test = s.points.filter((p) => p.split === "test").length;
    expect(test).toBe(32);
  });

  it("training runs inside fixed steps and stops at the epoch limit", () => {
    const rt = new SimulationRuntime(aiLabPlugin, 42);
    rt.dispatch({ type: "hyper/set", params: { epochLimit: 10, epochsPerTick: 3 } });
    rt.dispatch({ type: "train/start" });
    rt.stepTicks(10);
    const s = rt.getState();
    expect(s.training.epoch).toBe(10);
    expect(s.training.running).toBe(false);
    expect(s.training.history).toHaveLength(10);
  });

  it("is deterministic: replay reproduces trained weights exactly", () => {
    const rt = new SimulationRuntime(aiLabPlugin, 9);
    rt.dispatch({ type: "dataset/generate", kind: "moons", count: 100 });
    rt.dispatch({ type: "point/add", x: 0.1, y: 0.2, label: 1 });
    rt.dispatch({ type: "train/start" });
    rt.stepTicks(25);
    rt.dispatch({ type: "hyper/set", params: { learningRate: 0.05 } });
    rt.stepTicks(5);
    expect(replay(aiLabPlugin, rt.record())).toEqual(rt.getState());
  });

  it("undo restores the network after training", () => {
    const rt = new SimulationRuntime(aiLabPlugin, 9);
    const before = rt.getState().network;
    rt.dispatch({ type: "train/epoch", count: 5 });
    expect(rt.getState().network).not.toEqual(before);
    rt.undo();
    expect(rt.getState().network).toEqual(before);
  });

  it("detects divergence with an absurd learning rate", () => {
    const rt = new SimulationRuntime(aiLabPlugin, 2);
    rt.dispatch({ type: "network/setActivation", activation: "relu" });
    rt.dispatch({ type: "hyper/set", params: { learningRate: 10, batchSize: 1 } });
    rt.dispatch({ type: "train/start" });
    rt.stepTicks(60);
    expect(rt.getState().stats.diverged).toBe(true);
    expect(rt.evaluate().notes).toContain("diverged");
  });

  it("selectors produce a grid and a trace", () => {
    let s = aiLabPlugin.initialize(1);
    expect(predictionGrid(s, 8)).toHaveLength(64);
    s = aiLabPlugin.dispatch(s, { type: "point/select", id: s.points[0]!.id });
    expect(selectedTrace(s)?.a).toHaveLength(4);
  });

  it("ignores invalid input safely", () => {
    let s = aiLabPlugin.initialize(1);
    s = aiLabPlugin.dispatch(s, { type: "point/remove", id: 999999 });
    s = aiLabPlugin.dispatch(s, { type: "network/setHidden", hidden: [999, -5, 3, 3, 3, 3] });
    expect(s.hidden).toEqual([16, 1, 3, 3]);
    s = aiLabPlugin.dispatch(s, { type: "hyper/set", params: { learningRate: Number.NaN } });
    expect(Number.isFinite(s.hyper.learningRate)).toBe(true);
  });
});

/**
 * A scripted learner walks through every lesson using only the actions the UI
 * exposes. Guarantees every objective is reachable.
 */
const scripts: Record<string, Record<string, (d: (a: AiLabAction) => void, s: () => AiLabState, tick: (n: number) => void) => void>> = {
  "ai-1-data": {
    explore: (d, s) => d({ type: "point/select", id: s().points[0]!.id }),
    label: (d, s) => {
      for (let i = 0; i < 3; i++) {
        d({ type: "point/add", x: -0.5 + i * 0.1, y: -0.5, label: 0 });
        d({ type: "point/add", x: 0.5, y: 0.5 - i * 0.1, label: 1 });
      }
      d({ type: "point/relabel", id: s().points[0]!.id });
    },
    split: (d) => {
      d({ type: "split/setRatio", ratio: 0.75 });
      d({ type: "split/reshuffle" });
    },
    noise: (d) => {
      d({ type: "dataset/generate", kind: "circles", noise: 0.2 });
      d({ type: "dataset/generate", kind: "moons", noise: 0.6 });
    },
  },
  "ai-2-neuron": {
    anatomy: (d) => {
      d({ type: "neuron/set", params: { w1: 1 } });
      d({ type: "neuron/set", params: { w2: 1 } });
    },
    boundary: (d) => d({ type: "neuron/set", params: { w1: 3, w2: 3, b: 0.1 } }),
    activation: (d) => d({ type: "neuron/set", params: { activation: "sigmoid", w1: 4, w2: 4 } }),
    limits: (d) => {
      for (let i = 0; i < 5; i++) d({ type: "neuron/set", params: { w1: i - 2 } });
    },
  },
  "ai-3-network": {
    layers: (d) => d({ type: "network/setHidden", hidden: [4] }),
    forward: (d, s) => {
      for (const p of s().points.slice(0, 3)) d({ type: "point/select", id: p.id });
    },
    depth: (d) => d({ type: "network/setHidden", hidden: [4, 4] }),
    activations: (d) => {
      d({ type: "network/setActivation", activation: "relu" });
      d({ type: "network/setActivation", activation: "tanh" });
    },
  },
  "ai-4-training": {
    first: (d, _s, tick) => {
      d({ type: "train/start" });
      tick(60);
    },
    lr: (d, _s, tick) => {
      d({ type: "hyper/set", params: { learningRate: 1.5, epochLimit: 1000 } });
      d({ type: "train/start" });
      tick(25);
      d({ type: "train/reset" });
      d({ type: "hyper/set", params: { learningRate: 0.05 } });
      d({ type: "train/start" });
      tick(25);
    },
    batch: (d, _s, tick) => {
      d({ type: "train/reset" });
      d({ type: "hyper/set", params: { learningRate: 0.05, batchSize: 1 } });
      d({ type: "train/start" });
      tick(12);
      d({ type: "hyper/set", params: { learningRate: 0.3, batchSize: 32 } });
      tick(12);
    },
    goal: (d, _s, tick) => {
      d({ type: "train/reset" });
      d({ type: "hyper/set", params: { learningRate: 0.3, batchSize: 16, epochLimit: 400 } });
      d({ type: "train/start" });
      tick(250);
    },
  },
};

describe("lessons are completable", () => {
  for (const lesson of aiLessons) {
    it(lesson.id, () => {
      const rt = new SimulationRuntime(aiLabPlugin, 1234);
      const engine = new LessonEngine(lesson);
      const sync = () => engine.update(rt.getState(), rt.evaluate());
      const enter = () => engine.step.onEnter?.forEach((a) => rt.dispatch(a));
      const d = (a: AiLabAction) => {
        rt.dispatch(a);
        sync();
      };
      const tick = (n: number) => {
        for (let i = 0; i < n; i++) {
          rt.stepTicks(1);
          sync();
        }
      };
      enter();
      sync();
      for (const step of lesson.steps) {
        const script = scripts[lesson.id]?.[step.id];
        expect(script, `script for ${step.id}`).toBeDefined();
        script!(d, () => rt.getState(), tick);
        sync();
        expect(engine.view().objectives, `${lesson.id}/${step.id}`).toEqual(
          engine.view().objectives.map((o) => ({ ...o, done: true })),
        );
        if (!engine.isLastStep()) {
          engine.advance();
          enter();
          sync();
        }
      }
      expect(engine.isLessonComplete()).toBe(true);
    });
  }
});
