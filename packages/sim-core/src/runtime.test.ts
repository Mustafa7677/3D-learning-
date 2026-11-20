import { describe, expect, it } from "vitest";
import { EventBus, Rng, SimulationRuntime, replay, type SimulationPlugin } from "./index";

interface S {
  pos: number;
  vel: number;
  seed: number;
  noise: number[];
}
type A = { type: "kick"; dv: number } | { type: "noise" };

const plugin: SimulationPlugin<S, A> = {
  id: "test-ball",
  version: "1",
  initialize: (seed) => ({ pos: 0, vel: 0, seed, noise: [] }),
  dispatch(s, a) {
    if (a.type === "kick") return { ...s, vel: s.vel + a.dv };
    const r = new Rng(s.seed);
    const v = r.next();
    return { ...s, seed: r.seed, noise: [...s.noise, v] };
  },
  step: (s, dt) => ({ ...s, pos: s.pos + s.vel * dt }),
  snapshot: (s) => structuredClone(s),
  restore: (snap) => structuredClone(snap as S),
  evaluate: (s) => ({ score: s.pos > 1 ? 1 : 0, metrics: { pos: s.pos }, notes: [] }),
};

describe("Rng", () => {
  it("is deterministic per seed", () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const xs = Array.from({ length: 5 }, () => a.next());
    expect(xs).toEqual(Array.from({ length: 5 }, () => b.next()));
    expect(new Set(xs).size).toBe(5);
    for (const x of xs) expect(x).toBeGreaterThanOrEqual(0);
  });
});

describe("EventBus", () => {
  it("delivers and unsubscribes", () => {
    const bus = new EventBus<{ ping: number }>();
    const got: number[] = [];
    const off = bus.on("ping", (n) => got.push(n));
    bus.emit("ping", 1);
    off();
    bus.emit("ping", 2);
    expect(got).toEqual([1]);
  });
});

describe("SimulationRuntime", () => {
  it("advances with a fixed timestep and keeps the remainder", () => {
    const rt = new SimulationRuntime(plugin, 1, { fixedDt: 0.1 });
    rt.dispatch({ type: "kick", dv: 1 });
    expect(rt.advance(0.25)).toBe(2);
    expect(rt.advance(0.05)).toBe(1);
    expect(rt.getState().pos).toBeCloseTo(0.3);
  });

  it("caps steps per frame", () => {
    const rt = new SimulationRuntime(plugin, 1, { fixedDt: 0.1, maxStepsPerFrame: 3 });
    expect(rt.advance(10)).toBe(3);
    expect(rt.advance(0)).toBe(0);
  });

  it("undo restores the previous state and truncates the journal", () => {
    const rt = new SimulationRuntime(plugin, 1);
    rt.dispatch({ type: "kick", dv: 2 });
    rt.dispatch({ type: "noise" });
    expect(rt.getState().noise).toHaveLength(1);
    expect(rt.undo()).toBe(true);
    expect(rt.getState().noise).toHaveLength(0);
    expect(rt.getState().vel).toBe(2);
    expect(rt.record().journal).toHaveLength(1);
  });

  it("replays a recording to the identical final state", () => {
    const rt = new SimulationRuntime(plugin, 7, { fixedDt: 0.05 });
    rt.dispatch({ type: "kick", dv: 1.5 });
    rt.stepTicks(10);
    rt.dispatch({ type: "noise" });
    rt.dispatch({ type: "kick", dv: -0.5 });
    rt.stepTicks(5);
    rt.dispatch({ type: "noise" });
    const final = replay(plugin, rt.record());
    expect(final).toEqual(rt.getState());
  });

  it("emits state events and evaluates", () => {
    const rt = new SimulationRuntime(plugin, 1, { fixedDt: 1 });
    let ticks = 0;
    rt.bus.on("state", ({ tick }) => (ticks = tick));
    rt.dispatch({ type: "kick", dv: 2 });
    rt.stepTicks(1);
    expect(ticks).toBe(1);
    expect(rt.evaluate().score).toBe(1);
  });

  it("rejects recordings for another plugin", () => {
    const rec = new SimulationRuntime(plugin, 1).record();
    expect(() => replay({ ...plugin, id: "other" }, rec)).toThrow();
  });
});
