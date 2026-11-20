import { describe, expect, it } from "vitest";
import { BAD_ORDER, availability, downtimeMinutes, killPod, latencyMs, newCluster, nines, orderError, pipeline, rebuild, reconcile, simulateDay, traffic, type StepId } from "./core";

const GOOD: StepId[] = ["base", "workdir", "copyPkg", "install", "copySrc", "build", "cmd"];

describe("image layers", () => {
  it("copying source before installing dependencies reinstalls on every code change", () => {
    expect(orderError(BAD_ORDER)).toBeNull();
    expect(rebuild(BAD_ORDER, "src").seconds).toBe(65.7);
    expect(rebuild(GOOD, "src")).toEqual({ seconds: 20.5, rebuilt: ["copySrc", "build", "cmd"] });
    expect(rebuild(GOOD, "package").seconds).toBe(65.7);
    expect(orderError(["base", "workdir", "install", "copyPkg", "copySrc", "build", "cmd"])).toMatch(/package.json/);
  });
});

describe("controller", () => {
  it("restores the desired number of pods", () => {
    let c = killPod(newCluster(3), 2);
    expect(c.pods).toHaveLength(2);
    c = reconcile(c);
    expect(c.pods).toHaveLength(3);
    expect(c.pods.filter((p) => p.status === "pending")).toHaveLength(1);
    c = reconcile(reconcile(c));
    expect(c.pods.every((p) => p.status === "running")).toBe(true);
    c = reconcile({ ...c, desired: 1 });
    expect(c.pods).toHaveLength(1);
  });
});

describe("scaling", () => {
  it("latency explodes as an instance approaches capacity", () => {
    expect(latencyMs(0, 1)).toBe(10);
    expect(latencyMs(50, 1)).toBe(20);
    expect(latencyMs(80, 1)).toBe(50);
    expect(latencyMs(90, 1)).toBe(100);
    expect(latencyMs(100, 1)).toBe(Infinity);
    expect(latencyMs(800, 10)).toBe(50);
  });
  it("a fixed small fleet violates the SLO at the peak; autoscaling with headroom does not", () => {
    expect(traffic(14)).toBeGreaterThan(700);
    expect(simulateDay({ min: 4, max: 4, target: 0.7 }).violations).toBeGreaterThan(5);
    const tuned = simulateDay({ min: 3, max: 20, target: 0.6 });
    const naive = simulateDay({ min: 2, max: 20, target: 0.95 });
    expect(naive.violations).toBeGreaterThan(tuned.violations);
    expect(simulateDay({ min: 20, max: 20, target: 0.5 }).violations).toBe(0);
  });
});

describe("CI/CD", () => {
  it("parallel checks and a build cache shorten the pipeline; a failing test blocks the deploy", () => {
    expect(pipeline({ parallel: false, cache: false, failingTest: false }).minutes).toBe(20);
    expect(pipeline({ parallel: true, cache: true, failingTest: false }).minutes).toBe(12);
    const f = pipeline({ parallel: false, cache: false, failingTest: true });
    expect(f.deployed).toBe(false);
    expect(f.stages.find((s) => s.id === "deploy")!.status).toBe("skipped");
  });
});

describe("availability", () => {
  it("replicas multiply the nines; downtime shrinks tenfold per nine", () => {
    expect(availability(1)).toBeCloseTo(0.99);
    expect(nines(availability(2))).toBeCloseTo(4);
    expect(downtimeMinutes(0.999)).toBeCloseTo(526, 0);
  });
});
