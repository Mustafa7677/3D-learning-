import { describe, expect, it } from "vitest";
import { runLb, runProbes, runQueue } from "./middle-core";

describe("health probes", () => {
  it("a rollout without readiness sends traffic to warming pods: 1980 errors; with readiness: 0", () => {
    expect(runProbes("rollout", false, false).errors).toBe(1980);
    expect(runProbes("rollout", true, false).errors).toBe(0);
  });
  it("a deadlocked pod: 2244 errors with no probes, 99 with readiness, and only liveness restarts it", () => {
    expect(runProbes("deadlock", false, false).errors).toBe(2244);
    expect(runProbes("deadlock", true, false)).toMatchObject({ errors: 99, restarts: 0 });
    expect(runProbes("deadlock", false, true)).toMatchObject({ errors: 1089, restarts: 1 });
    const both = runProbes("deadlock", true, true);
    expect(both).toMatchObject({ errors: 99, restarts: 1 });
    // Readiness alone leaves pod B dead to the end: one pod short for good.
    expect(runProbes("deadlock", true, false).timeline.at(-1)![1]!.phase).toBe("dead");
    expect(both.timeline.at(-1)![1]!.phase).toBe("ok");
  });
});

describe("queue and backpressure", () => {
  it("one consumer, unbounded: the queue reaches 1500 and a job waits 15 s", () => {
    expect(runQueue(1, null)).toMatchObject({ maxLength: 1500, maxWait: 15, dropped: 0 });
  });
  it("two consumers: no queue at all", () => {
    expect(runQueue(2, null)).toMatchObject({ maxLength: 0, maxWait: 0 });
  });
  it("a 500-job limit: at most 5 s of waiting, 1000 jobs rejected", () => {
    expect(runQueue(1, 500)).toMatchObject({ maxLength: 500, maxWait: 5, dropped: 1000 });
  });
});

describe("load balancing with one slow server", () => {
  it("round robin gives C a third and its queue explodes: p95 1226 ms", () => {
    expect(runLb("round-robin")).toMatchObject({ counts: [100, 100, 100], p95: 1226 });
  });
  it("random is no better: p95 1858 ms", () => {
    expect(runLb("random").p95).toBe(1858);
  });
  it("least connections gives C what it can take: p95 50 ms", () => {
    expect(runLb("least-conn")).toMatchObject({ counts: [144, 104, 52], p95: 50, max: 50 });
  });
});
