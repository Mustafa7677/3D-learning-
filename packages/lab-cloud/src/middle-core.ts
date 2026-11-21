/**
 * Middle-level cloud models: health probes during a rollout and a deadlock,
 * a queue between a bursty producer and a consumer (with backpressure), and
 * load-balancing algorithms when one server is slow. Second-by-second and
 * deterministic, so every number in a lecture is pinned by a test.
 */

// ---------------- health probes ----------------

export type ProbeScenario = "rollout" | "deadlock";
export const PROBE_SECONDS = 90;
export const PODS = 3;
export const RPS = 100;
export const WARMUP = 20;
export const PROBE_PERIOD = 5;
export const LIVENESS_THRESHOLD = 3;

type PodPhase = "ok" | "warming" | "dead" | "down";

export interface ProbeResult {
  errors: number;
  restarts: number;
  /** Per second: each pod's phase and whether it is in the load balancer's rotation. */
  timeline: { phase: PodPhase; inRotation: boolean }[][];
}

/**
 * 100 requests a second are spread evenly over the pods in rotation; a
 * request that lands on a warming, deadlocked or stopped pod fails. Without
 * a readiness probe a pod is in rotation whenever its process runs; with one,
 * only after a probe (every 5 s) has seen it healthy.
 */
export function runProbes(scenario: ProbeScenario, readiness: boolean, liveness: boolean): ProbeResult {
  const start = Array.from({ length: PODS }, () => -1000); // process start time
  const deadAt: (number | null)[] = Array.from({ length: PODS }, () => null);
  const ready = Array.from({ length: PODS }, () => true);
  const fails = Array.from({ length: PODS }, () => 0);
  const killedAt: (number | null)[] = Array.from({ length: PODS }, () => null);
  let errors = 0;
  let restarts = 0;
  const timeline: ProbeResult["timeline"] = [];
  for (let t = 0; t < PROBE_SECONDS; t++) {
    // Scenario events.
    if (scenario === "rollout")
      for (let k = 0; k < PODS; k++)
        if (t === 10 + k * 25) {
          killedAt[k] = t;
          start[k] = t + 2; // the new version's process starts 2 s later
          ready[k] = false;
        }
    if (scenario === "deadlock" && t === 22) deadAt[1] = t;

    const phase = (k: number): PodPhase => (t < start[k]! ? "down" : deadAt[k] !== null && t >= deadAt[k]! ? "dead" : t < start[k]! + WARMUP ? "warming" : "ok");

    if (t % PROBE_PERIOD === 0)
      for (let k = 0; k < PODS; k++) {
        const ph = phase(k);
        if (readiness) ready[k] = ph === "ok";
        if (liveness && ph === "dead") {
          fails[k]! += 1;
          if (fails[k]! >= LIVENESS_THRESHOLD) {
            restarts++;
            fails[k] = 0;
            deadAt[k] = null;
            start[k] = t + 2;
            ready[k] = false;
          }
        } else fails[k] = 0;
      }

    const phases = Array.from({ length: PODS }, (_, k) => phase(k));
    const inRotation = phases.map((ph, k) => (readiness ? ready[k]! && ph !== "down" : ph !== "down"));
    const n = inRotation.filter(Boolean).length;
    if (n === 0) errors += RPS;
    else {
      const bad = phases.filter((ph, k) => inRotation[k] && ph !== "ok").length;
      errors += Math.round((RPS * bad) / n);
    }
    timeline.push(phases.map((phase, k) => ({ phase, inRotation: inRotation[k]! })));
  }
  return { errors, restarts, timeline };
}

// ---------------- queue and backpressure ----------------

export const QUEUE_SECONDS = 90;
/** A burst: 150 jobs/s for 30 s, then 50 jobs/s. */
export const arrivals = (t: number) => (t < 30 ? 150 : 50);

export interface QueueResult {
  /** Per second: queue length after the second, and how long a job arriving now would wait. */
  length: number[];
  wait: number[];
  maxLength: number;
  maxWait: number;
  dropped: number;
  processed: number;
}

/** `consumers` workers, each doing 100 jobs/s. `limit` = queue capacity, null for unbounded; overflow is rejected (HTTP 429). */
export function runQueue(consumers: number, limit: number | null): QueueResult {
  const mu = 100 * consumers;
  let q = 0;
  let dropped = 0;
  let processed = 0;
  const length: number[] = [];
  const wait: number[] = [];
  for (let t = 0; t < QUEUE_SECONDS; t++) {
    q += arrivals(t);
    if (limit !== null && q > limit + mu) {
      dropped += q - (limit + mu);
      q = limit + mu;
    }
    const done = Math.min(q, mu);
    processed += done;
    q -= done;
    length.push(q);
    wait.push(q / mu);
  }
  return { length, wait, maxLength: Math.max(...length), maxWait: Math.max(...wait), dropped, processed };
}

// ---------------- load balancing ----------------

export type LbAlgo = "round-robin" | "random" | "least-conn";
/** Milliseconds per request on each server; server C is an older, slower machine. */
export const LB_SERVERS = [
  { id: "A", ms: 25 },
  { id: "B", ms: 25 },
  { id: "C", ms: 50 },
];
export const LB_REQUESTS = 300;
export const LB_GAP = 12; // a request every 12 ms: about 83 req/s against a capacity of 100

export interface LbResult {
  /** Requests each server handled. */
  counts: number[];
  p50: number;
  p95: number;
  max: number;
}

const percentile = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]!;
};

/** Each server works one request at a time, first come first served. */
export function runLb(algo: LbAlgo): LbResult {
  const freeAt = LB_SERVERS.map(() => 0);
  const queues: number[][] = LB_SERVERS.map(() => []); // finish times of requests not yet done
  const counts = LB_SERVERS.map(() => 0);
  const latencies: number[] = [];
  let rr = 0;
  let seed = 0x1234567;
  const rnd = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 2 ** 32;
  };
  for (let i = 0; i < LB_REQUESTS; i++) {
    const now = i * LB_GAP;
    queues.forEach((q, k) => (queues[k] = q.filter((f) => f > now)));
    let k: number;
    if (algo === "round-robin") k = rr++ % LB_SERVERS.length;
    else if (algo === "random") k = Math.floor(rnd() * LB_SERVERS.length);
    else {
      k = 0;
      for (let j = 1; j < LB_SERVERS.length; j++) if (queues[j]!.length < queues[k]!.length) k = j;
    }
    const begin = Math.max(now, freeAt[k]!);
    const finish = begin + LB_SERVERS[k]!.ms;
    freeAt[k] = finish;
    queues[k]!.push(finish);
    counts[k]!++;
    latencies.push(finish - now);
  }
  return { counts, p50: percentile(latencies, 50), p95: percentile(latencies, 95), max: Math.max(...latencies) };
}
