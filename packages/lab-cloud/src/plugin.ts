import type { AssessmentResult, SimulationPlugin } from "@inside-tech/sim-core";
import { runRetries, type RetryPolicy, type RetryRun } from "./retries";
import { runLb, runProbes, runQueue, type LbAlgo, type LbResult, type ProbeResult, type ProbeScenario, type QueueResult } from "./middle-core";
import {
  BAD_ORDER,
  BUG_RATE,
  STRATEGY_STEPS,
  availability,
  killPod,
  latencyMs,
  newCluster,
  orderError,
  pipeline,
  rebuild,
  reconcile,
  simulateDay,
  type Change,
  type Cluster,
  type PipelineConfig,
  type Policy,
  type ServiceId,
  type StepId,
  type Strategy,
} from "./core";

export type CloudMode = "image" | "cluster" | "scale" | "autoscale" | "pipeline" | "release" | "availability" | "incident" | "probes" | "queue" | "lb" | "retries";

export interface CloudStats {
  modes: CloudMode[];
  imageBuilds: { order: string; change: Change; seconds: number; valid: boolean }[];
  podsKilled: number;
  podsCreated: number;
  maxRunning: number;
  scaleChecks: { lambda: number; instances: number; latency: number }[];
  days: { min: number; max: number; target: number; violations: number; instanceHours: number }[];
  pipelines: { parallel: boolean; cache: boolean; failingTest: boolean; minutes: number; deployed: boolean }[];
  releases: { strategy: Strategy; maxShare: number; rolledBack: boolean }[];
  availabilityChecks: { replicas: number; zones: number; availability: number }[];
  zoneTests: { replicas: number; zones: number; survived: boolean }[];
  diagnoses: ServiceId[];
  probeRuns: { scenario: ProbeScenario; readiness: boolean; liveness: boolean; errors: number; restarts: number; deadAtEnd: boolean }[];
  queueRuns: { consumers: number; limit: number | null; maxWait: number; dropped: number }[];
  lbRuns: { algo: LbAlgo; p95: number; slowShare: number }[];
  retryRuns?: { policy: RetryPolicy; errors: number; recoveredAt: number | null; peakLoad: number }[];
}

export interface CloudLabState {
  mode: CloudMode;
  acc: number;
  image: { order: StepId[]; change: Change; last: { seconds: number; rebuilt: StepId[]; error: string | null } | null };
  cluster: Cluster;
  scale: { lambda: number; instances: number };
  autoscale: Policy & { ran: boolean };
  pipeline: PipelineConfig & { ran: boolean };
  release: { strategy: Strategy; step: number; share: number; maxShare: number; done: boolean; rolledBack: boolean };
  availability: { replicas: number; zones: number; zoneDown: boolean };
  incident: { selected: ServiceId | null };
  probes: { scenario: ProbeScenario; readiness: boolean; liveness: boolean; last: ProbeResult | null };
  queue: { consumers: number; limit: number | null; last: QueueResult | null };
  lb: { algo: LbAlgo; last: LbResult | null };
  retries?: { policy: RetryPolicy; last: RetryRun | null };
  stats: CloudStats;
}

export type CloudLabAction =
  | { type: "mode/set"; mode: CloudMode }
  | { type: "image/move"; step: StepId; delta: -1 | 1 }
  | { type: "image/order"; order: StepId[] }
  | { type: "image/build"; change: Change }
  | { type: "cluster/kill"; id: number }
  | { type: "cluster/desired"; n: number }
  | { type: "scale/set"; lambda?: number; instances?: number }
  | { type: "autoscale/set"; min?: number; max?: number; target?: number }
  | { type: "autoscale/run" }
  | { type: "pipeline/set"; parallel?: boolean; cache?: boolean; failingTest?: boolean }
  | { type: "pipeline/run" }
  | { type: "release/strategy"; strategy: Strategy }
  | { type: "release/step" }
  | { type: "release/rollback" }
  | { type: "availability/set"; replicas?: number; zones?: number }
  | { type: "availability/zoneDown"; down: boolean }
  | { type: "incident/select"; service: ServiceId }
  | { type: "probes/set"; scenario?: ProbeScenario; readiness?: boolean; liveness?: boolean }
  | { type: "probes/run" }
  | { type: "queue/set"; consumers?: number; limit?: number | null }
  | { type: "queue/run" }
  | { type: "lb/set"; algo: LbAlgo }
  | { type: "lb/run" }
  | { type: "retries/set"; policy: RetryPolicy }
  | { type: "retries/run" };

const uniq = <T>(xs: T[], x: T) => (xs.includes(x) ? xs : [...xs, x]);
const cap = <T>(xs: T[], n = 40) => xs.slice(-n);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Replica i lives in zone i mod zones; zone 0 is the one that fails. */
export const survivors = (replicas: number, zones: number) => Array.from({ length: replicas }, (_, i) => i % zones).filter((z) => z !== 0).length;

export function initialCloudState(): CloudLabState {
  return {
    mode: "image",
    acc: 0,
    image: { order: [...BAD_ORDER], change: "src", last: null },
    cluster: newCluster(3),
    scale: { lambda: 800, instances: 4 },
    autoscale: { min: 2, max: 20, target: 0.95, ran: false },
    pipeline: { parallel: false, cache: false, failingTest: false, ran: false },
    release: { strategy: "all", step: 0, share: 0, maxShare: 0, done: false, rolledBack: false },
    availability: { replicas: 1, zones: 1, zoneDown: false },
    incident: { selected: null },
    probes: { scenario: "rollout", readiness: false, liveness: false, last: null },
    queue: { consumers: 1, limit: null, last: null },
    lb: { algo: "round-robin", last: null },
    stats: {
      modes: ["image"],
      imageBuilds: [],
      podsKilled: 0,
      podsCreated: 0,
      maxRunning: 3,
      scaleChecks: [],
      days: [],
      pipelines: [],
      releases: [],
      availabilityChecks: [],
      zoneTests: [],
      diagnoses: [],
      probeRuns: [],
      queueRuns: [],
      lbRuns: [],
      retryRuns: [],
    },
    retries: { policy: "none", last: null },
  };
}

function recordScale(s: CloudLabState): CloudLabState {
  const r = { lambda: s.scale.lambda, instances: s.scale.instances, latency: latencyMs(s.scale.lambda, s.scale.instances) };
  return { ...s, stats: { ...s.stats, scaleChecks: cap([...s.stats.scaleChecks, r]) } };
}

function recordAvailability(s: CloudLabState): CloudLabState {
  const { replicas, zones } = s.availability;
  return { ...s, stats: { ...s.stats, availabilityChecks: cap([...s.stats.availabilityChecks, { replicas, zones, availability: availability(replicas) }]) } };
}

function reduce(s: CloudLabState, a: CloudLabAction): CloudLabState {
  const st = s.stats;
  switch (a.type) {
    case "mode/set":
      return { ...s, mode: a.mode, stats: { ...st, modes: uniq(st.modes, a.mode) } };

    case "image/move": {
      const order = [...s.image.order];
      const i = order.indexOf(a.step);
      const j = i + a.delta;
      if (i < 0 || j < 0 || j >= order.length) return s;
      [order[i], order[j]] = [order[j]!, order[i]!];
      return { ...s, image: { ...s.image, order, last: null } };
    }
    case "image/order":
      return { ...s, image: { ...s.image, order: a.order.slice(0, 7), last: null } };
    case "image/build": {
      const error = orderError(s.image.order);
      const r = error ? { seconds: 0, rebuilt: [] as StepId[] } : rebuild(s.image.order, a.change);
      return {
        ...s,
        image: { ...s.image, change: a.change, last: { ...r, error } },
        stats: { ...st, imageBuilds: cap([...st.imageBuilds, { order: s.image.order.join(","), change: a.change, seconds: r.seconds, valid: !error }]) },
      };
    }

    case "cluster/kill":
      return s.cluster.pods.some((p) => p.id === a.id) ? { ...s, cluster: killPod(s.cluster, a.id), stats: { ...st, podsKilled: st.podsKilled + 1 } } : s;
    case "cluster/desired":
      return { ...s, cluster: { ...s.cluster, desired: Math.round(clamp(a.n, 0, 10)) } };

    case "scale/set":
      return recordScale({ ...s, mode: "scale", scale: { lambda: Math.round(clamp(a.lambda ?? s.scale.lambda, 0, 2000)), instances: Math.round(clamp(a.instances ?? s.scale.instances, 1, 30)) } });

    case "autoscale/set": {
      const p = s.autoscale;
      const min = Math.round(clamp(a.min ?? p.min, 1, 20));
      const max = Math.round(clamp(a.max ?? p.max, min, 30));
      return { ...s, mode: "autoscale", autoscale: { min, max, target: clamp(a.target ?? p.target, 0.3, 1), ran: false } };
    }
    case "autoscale/run": {
      const d = simulateDay(s.autoscale);
      const { min, max, target } = s.autoscale;
      return { ...s, autoscale: { ...s.autoscale, ran: true }, stats: { ...st, days: cap([...st.days, { min, max, target, violations: d.violations, instanceHours: d.instanceHours }]) } };
    }

    case "pipeline/set": {
      const p = s.pipeline;
      return { ...s, mode: "pipeline", pipeline: { parallel: a.parallel ?? p.parallel, cache: a.cache ?? p.cache, failingTest: a.failingTest ?? p.failingTest, ran: false } };
    }
    case "pipeline/run": {
      const r = pipeline(s.pipeline);
      const { parallel, cache, failingTest } = s.pipeline;
      return { ...s, pipeline: { ...s.pipeline, ran: true }, stats: { ...st, pipelines: cap([...st.pipelines, { parallel, cache, failingTest, minutes: r.minutes, deployed: r.deployed }]) } };
    }

    case "release/strategy":
      return { ...s, mode: "release", release: { strategy: a.strategy, step: 0, share: 0, maxShare: 0, done: false, rolledBack: false } };
    case "release/step": {
      const r = s.release;
      if (r.done) return s;
      const steps = STRATEGY_STEPS[r.strategy];
      const share = steps[Math.min(r.step, steps.length - 1)]!;
      const done = r.step + 1 >= steps.length;
      const next = { ...r, step: r.step + 1, share, maxShare: Math.max(r.maxShare, share), done };
      return {
        ...s,
        release: next,
        stats: done ? { ...st, releases: cap([...st.releases, { strategy: r.strategy, maxShare: next.maxShare, rolledBack: false }]) } : st,
      };
    }
    case "release/rollback": {
      const r = s.release;
      if (r.share === 0 && !r.done) return s;
      const releases = cap([...st.releases.filter((x) => !(r.done && x.strategy === r.strategy && x.maxShare === r.maxShare && !x.rolledBack)), { strategy: r.strategy, maxShare: r.maxShare, rolledBack: true }]);
      return { ...s, release: { ...r, share: 0, done: true, rolledBack: true }, stats: { ...st, releases } };
    }

    case "availability/set":
      return recordAvailability({
        ...s,
        mode: "availability",
        availability: { replicas: Math.round(clamp(a.replicas ?? s.availability.replicas, 1, 6)), zones: Math.round(clamp(a.zones ?? s.availability.zones, 1, 3)), zoneDown: false },
      });
    case "availability/zoneDown": {
      const { replicas, zones } = s.availability;
      const next = { ...s, availability: { ...s.availability, zoneDown: a.down } };
      return a.down ? { ...next, stats: { ...st, zoneTests: cap([...st.zoneTests, { replicas, zones, survived: survivors(replicas, zones) > 0 }]) } } : next;
    }

    case "incident/select":
      return { ...s, incident: { selected: a.service }, stats: { ...st, diagnoses: cap([...st.diagnoses, a.service], 10) } };

    case "probes/set": {
      const p = s.probes;
      return { ...s, mode: "probes", probes: { scenario: a.scenario ?? p.scenario, readiness: a.readiness ?? p.readiness, liveness: a.liveness ?? p.liveness, last: null } };
    }
    case "probes/run": {
      const p = s.probes;
      const r = runProbes(p.scenario, p.readiness, p.liveness);
      const run = { scenario: p.scenario, readiness: p.readiness, liveness: p.liveness, errors: r.errors, restarts: r.restarts, deadAtEnd: r.timeline.at(-1)!.some((x) => x.phase === "dead") };
      return { ...s, mode: "probes", probes: { ...p, last: r }, stats: { ...st, probeRuns: cap([...st.probeRuns, run]) } };
    }
    case "queue/set": {
      const q = s.queue;
      const consumers = a.consumers !== undefined ? Math.round(clamp(a.consumers, 1, 4)) : q.consumers;
      const limit = a.limit === undefined ? q.limit : a.limit === null ? null : Math.round(clamp(a.limit, 100, 5000));
      return { ...s, mode: "queue", queue: { consumers, limit, last: null } };
    }
    case "queue/run": {
      const q = s.queue;
      const r = runQueue(q.consumers, q.limit);
      return { ...s, mode: "queue", queue: { ...q, last: r }, stats: { ...st, queueRuns: cap([...st.queueRuns, { consumers: q.consumers, limit: q.limit, maxWait: r.maxWait, dropped: r.dropped }]) } };
    }
    case "retries/set":
      return ["none", "immediate", "backoff", "breaker"].includes(a.policy) ? { ...s, mode: "retries", retries: { policy: a.policy, last: null } } : s;
    case "retries/run": {
      const policy = s.retries?.policy ?? "none";
      const r = runRetries(policy);
      return { ...s, mode: "retries", retries: { policy, last: r }, stats: { ...st, retryRuns: cap([...(st.retryRuns ?? []), { policy, errors: r.errors, recoveredAt: r.recoveredAt, peakLoad: r.peakLoad }]) } };
    }
    case "lb/set":
      return { ...s, mode: "lb", lb: { algo: a.algo, last: null } };
    case "lb/run": {
      const r = runLb(s.lb.algo);
      const total = r.counts.reduce((x, y) => x + y, 0);
      return { ...s, mode: "lb", lb: { ...s.lb, last: r }, stats: { ...st, lbRuns: cap([...st.lbRuns, { algo: s.lb.algo, p95: r.p95, slowShare: r.counts[2]! / total }]) } };
    }
  }
}

export const cloudLabPlugin: SimulationPlugin<CloudLabState, CloudLabAction> = {
  id: "cloud-lab",
  version: "1.0.0",
  initialize: () => initialCloudState(),
  dispatch: reduce,
  step(s, dt) {
    // The controller reconciles twice a second.
    const acc = s.acc + dt;
    if (acc < 0.5) return { ...s, acc };
    const cluster = reconcile(s.cluster);
    const known = new Set(s.cluster.pods.map((p) => p.id));
    const created = cluster.pods.filter((p) => !known.has(p.id)).length;
    const running = cluster.pods.filter((p) => p.status === "running").length;
    return { ...s, acc: 0, cluster, stats: { ...s.stats, podsCreated: s.stats.podsCreated + created, maxRunning: Math.max(s.stats.maxRunning, running) } };
  },
  snapshot: (s) => structuredClone(s),
  restore: (snap) => structuredClone(snap as CloudLabState),
  evaluate: (s): AssessmentResult => ({ score: 0, metrics: { pods: s.cluster.pods.length, errorShare: s.release.share * BUG_RATE }, notes: [] }),
};
