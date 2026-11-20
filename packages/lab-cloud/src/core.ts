/**
 * Cloud & DevOps models: container layer caching, a desired-state
 * controller, queueing-based scaling and autoscaling, CI/CD pipelines,
 * release strategies, availability math and an incident to diagnose.
 */

// ---------------- container images ----------------

export type StepId = "base" | "workdir" | "copyPkg" | "install" | "copySrc" | "build" | "cmd";
export type Change = "none" | "src" | "package";

export const STEPS: Record<StepId, { text: string; seconds: number; reads?: "package" | "src" }> = {
  base: { text: "FROM node:20", seconds: 0 },
  workdir: { text: "WORKDIR /app", seconds: 0.1 },
  copyPkg: { text: "COPY package.json .", seconds: 0.2, reads: "package" },
  install: { text: "RUN npm install", seconds: 45 },
  copySrc: { text: "COPY src ./src", seconds: 0.5, reads: "src" },
  build: { text: "RUN npm run build", seconds: 20 },
  cmd: { text: 'CMD ["node", "dist/server.js"]', seconds: 0 },
};

export const BAD_ORDER: StepId[] = ["base", "workdir", "copySrc", "copyPkg", "install", "build", "cmd"];

/** Why an order cannot build, or null if it is valid. */
export function orderError(order: StepId[]): string | null {
  const at = (s: StepId) => order.indexOf(s);
  if (order.length !== 7 || new Set(order).size !== 7) return "Әр қадам бір реттен болуы керек";
  if (at("base") !== 0) return "FROM бірінші болуы керек";
  if (at("cmd") !== 6) return "CMD соңғы болуы керек";
  if (at("install") < at("copyPkg")) return "npm install үшін алдымен package.json көшірілуі керек";
  if (at("build") < at("install") || at("build") < at("copySrc")) return "build үшін тәуелділіктер мен бастапқы код керек";
  return null;
}

/**
 * Rebuild after a change: every layer from the first one whose inputs
 * changed is rebuilt (a changed layer invalidates all layers after it).
 */
export function rebuild(order: StepId[], change: Change): { seconds: number; rebuilt: StepId[] } {
  if (change === "none") return { seconds: 0, rebuilt: [] };
  const first = order.findIndex((s) => STEPS[s].reads === change);
  const rebuilt = first < 0 ? [] : order.slice(first);
  return { seconds: Math.round(rebuilt.reduce((t, s) => t + STEPS[s].seconds, 0) * 10) / 10, rebuilt };
}

// ---------------- desired-state controller ----------------

export interface Pod {
  id: number;
  status: "pending" | "running";
  age: number;
}

export interface Cluster {
  desired: number;
  pods: Pod[];
  nextId: number;
  events: string[];
}

export const newCluster = (desired = 3): Cluster => ({
  desired,
  pods: Array.from({ length: desired }, (_, i) => ({ id: i + 1, status: "running" as const, age: 10 })),
  nextId: desired + 1,
  events: [],
});

/** One reconcile loop: compare actual with desired and act; pending pods start after 2 loops. */
export function reconcile(c: Cluster): Cluster {
  let pods = c.pods.map((p) => ({ ...p, age: p.age + 1, status: p.status === "pending" && p.age + 1 >= 2 ? ("running" as const) : p.status }));
  const events = [...c.events];
  let nextId = c.nextId;
  if (pods.length < c.desired) {
    for (let i = pods.length; i < c.desired; i++) {
      pods.push({ id: nextId, status: "pending", age: 0 });
      events.push(`pod-${nextId} жасалды (қажет ${c.desired}, бар ${i})`);
      nextId++;
    }
  } else if (pods.length > c.desired) {
    const extra = pods.slice(c.desired);
    pods = pods.slice(0, c.desired);
    for (const p of extra) events.push(`pod-${p.id} тоқтатылды (артық)`);
  }
  return { ...c, pods, nextId, events: events.slice(-10) };
}

export const killPod = (c: Cluster, id: number): Cluster =>
  c.pods.some((p) => p.id === id) ? { ...c, pods: c.pods.filter((p) => p.id !== id), events: [...c.events, `pod-${id} құлады`].slice(-10) } : c;

// ---------------- scaling ----------------

/** Requests per second one instance can serve. */
export const MU = 100;
/** Latency SLO in milliseconds. */
export const SLO_MS = 50;

/** Mean latency with load split evenly over n instances (each an M/M/1 queue); Infinity when overloaded. */
export function latencyMs(lambda: number, n: number): number {
  const perInstance = lambda / Math.max(1, n);
  if (perInstance >= MU) return Infinity;
  return 1000 / (MU - perInstance);
}

/** Traffic over a day, requests per second at hour h (with an evening spike). */
export function traffic(h: number): number {
  const base = 150 + 650 * Math.max(0, Math.sin(((h - 6) / 16) * Math.PI));
  return Math.round(base + (h === 20 || h === 21 ? 500 : 0));
}

export interface Policy {
  min: number;
  max: number;
  /** Target utilization per instance, 0..1. */
  target: number;
}

export interface Day {
  hours: { h: number; lambda: number; instances: number; latency: number; violated: boolean }[];
  violations: number;
  instanceHours: number;
}

/** Simulate 24 hours: the autoscaler decides from the previous hour's load (one hour of lag). */
export function simulateDay(p: Policy): Day {
  const hours: Day["hours"] = [];
  let instances = p.min;
  for (let h = 0; h < 24; h++) {
    const lambda = traffic(h);
    const latency = latencyMs(lambda, instances);
    hours.push({ h, lambda, instances, latency, violated: latency > SLO_MS });
    instances = Math.min(p.max, Math.max(p.min, Math.ceil(lambda / (MU * p.target))));
  }
  return { hours, violations: hours.filter((x) => x.violated).length, instanceHours: hours.reduce((t, x) => t + x.instances, 0) };
}

// ---------------- CI/CD ----------------

export interface PipelineConfig {
  parallel: boolean;
  cache: boolean;
  failingTest: boolean;
}

export interface StageRun {
  id: string;
  start: number;
  minutes: number;
  status: "ok" | "failed" | "skipped";
}

export function pipeline(c: PipelineConfig): { stages: StageRun[]; minutes: number; deployed: boolean } {
  const checks = [
    { id: "lint", minutes: 1 },
    { id: "unit", minutes: 4 },
    { id: "integration", minutes: 8 },
  ];
  const stages: StageRun[] = [];
  let t = 0;
  let failed = false;
  if (c.parallel) {
    for (const s of checks) stages.push({ ...s, start: 0, status: s.id === "unit" && c.failingTest ? "failed" : "ok" });
    t = Math.max(...checks.map((s) => s.minutes));
    failed = c.failingTest;
  } else {
    for (const s of checks) {
      if (failed) {
        stages.push({ ...s, start: t, minutes: 0, status: "skipped" });
        continue;
      }
      const f = s.id === "unit" && c.failingTest;
      stages.push({ ...s, start: t, status: f ? "failed" : "ok" });
      t += s.minutes;
      failed = f;
    }
  }
  for (const s of [{ id: "build", minutes: c.cache ? 2 : 5 }, { id: "deploy", minutes: 2 }]) {
    if (failed) stages.push({ ...s, start: t, minutes: 0, status: "skipped" });
    else {
      stages.push({ ...s, start: t, status: "ok" });
      t += s.minutes;
    }
  }
  return { stages, minutes: t, deployed: !failed };
}

// ---------------- release strategies ----------------

export type Strategy = "all" | "rolling" | "canary" | "bluegreen";
/** Share of traffic on the new version after each step. */
export const STRATEGY_STEPS: Record<Strategy, number[]> = {
  all: [1],
  rolling: [0.25, 0.5, 0.75, 1],
  canary: [0.05, 0.25, 1],
  bluegreen: [1],
};
export const USERS = 100_000;
/** The new release fails this share of requests. */
export const BUG_RATE = 0.2;

// ---------------- availability ----------------

/** Availability of one replica. */
export const REPLICA_AVAILABILITY = 0.99;
export const availability = (replicas: number, a = REPLICA_AVAILABILITY) => 1 - (1 - a) ** replicas;
export const nines = (a: number) => (a >= 1 ? Infinity : -Math.log10(1 - a));
/** Minutes of downtime a year at this availability. */
export const downtimeMinutes = (a: number) => (1 - a) * 365.25 * 24 * 60;

// ---------------- incident ----------------

export type ServiceId = "gateway" | "auth" | "orders" | "payments";
export const SERVICES: { id: ServiceId; calls: ServiceId[] }[] = [
  { id: "gateway", calls: ["auth", "orders"] },
  { id: "auth", calls: [] },
  { id: "orders", calls: ["payments"] },
  { id: "payments", calls: [] },
];
/** The root cause of the lesson's incident: payments' database is slow. */
export const ROOT_CAUSE: ServiceId = "payments";

/** Metrics during the incident: latency propagates up the call chain, the root has its own anomaly. */
export function incidentMetrics(): Record<ServiceId, { p50: number; p99: number; errors: number; cpu: number; dbMs: number }> {
  return {
    payments: { p50: 380, p99: 2400, errors: 0.02, cpu: 0.18, dbMs: 2100 },
    orders: { p50: 420, p99: 2600, errors: 0.04, cpu: 0.35, dbMs: 8 },
    auth: { p50: 12, p99: 40, errors: 0.001, cpu: 0.22, dbMs: 3 },
    gateway: { p50: 450, p99: 2700, errors: 0.06, cpu: 0.3, dbMs: 0 },
  };
}
