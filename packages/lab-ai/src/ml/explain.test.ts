import { Rng } from "@inside-tech/sim-core";
import { describe, expect, it } from "vitest";
import { createNetwork, type Network } from "./network";
import { numericGradient, walkthrough } from "./explain";

describe("walkthrough", () => {
  it("reproduces the lecture's hand-worked single-neuron step", () => {
    const net: Network = { layers: [{ W: [[0.5, -0.25]], b: [0.1], act: "sigmoid" }] };
    const w = walkthrough(net, [1, 2], 1, 0.5);
    expect(w.layers[0]!.z[0]).toBeCloseTo(0.1);
    expect(w.p).toBeCloseTo(0.525, 3);
    expect(w.loss).toBeCloseTo(0.644, 3);
    expect(w.layers[0]!.delta[0]).toBeCloseTo(-0.475, 3);
    expect(w.layers[0]!.gW[0]).toEqual([expect.closeTo(-0.475, 3), expect.closeTo(-0.95, 3)]);
    expect(w.next.layers[0]!.W[0]![0]).toBeCloseTo(0.7375, 3);
    expect(w.next.layers[0]!.W[0]![1]).toBeCloseTo(0.225, 3);
    expect(w.next.layers[0]!.b[0]).toBeCloseTo(0.3375, 3);
    expect(w.nextP).toBeCloseTo(0.821, 3);
    expect(w.nextLoss).toBeLessThan(w.loss);
  });

  it("backprop agrees with finite differences on every parameter (gradient check)", () => {
    for (const act of ["tanh", "sigmoid", "relu"] as const) {
      const net = createNetwork(2, [5, 4], act, new Rng(3));
      const x = [0.3, -0.7];
      const w = walkthrough(net, x, 1, 0.1);
      net.layers.forEach((l, k) => {
        l.W.forEach((row, j) =>
          row.forEach((_, i) => {
            expect(w.layers[k]!.gW[j]![i]!).toBeCloseTo(numericGradient(net, x, 1, k, j, i), 5);
          }),
        );
        l.b.forEach((_, j) => expect(w.layers[k]!.gb[j]!).toBeCloseTo(numericGradient(net, x, 1, k, j, "b"), 5));
      });
    }
  });

  it("does not mutate the network", () => {
    const net = createNetwork(2, [3], "tanh", new Rng(1));
    const before = JSON.stringify(net);
    walkthrough(net, [0.1, 0.2], 0, 0.5, 0.01);
    expect(JSON.stringify(net)).toBe(before);
  });
});
