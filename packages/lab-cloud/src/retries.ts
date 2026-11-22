/**
 * Retries and circuit breakers, second by second. A dependency is down from
 * 10 s to 30 s; afterwards it can take 150 requests a second. Clients send
 * 100 a second. How the clients retry decides whether it ever comes back.
 */

export type RetryPolicy = "none" | "immediate" | "backoff" | "breaker";
export const SECONDS = 60;
export const OUTAGE: [number, number] = [10, 30];
export const CLIENT_RPS = 100;
export const CAPACITY = 150;
export const BREAKER_OPEN = 5;
export const PROBE = 10;

export interface RetryRun {
  /** Per second: load on the dependency, and what users saw. */
  timeline: { load: number; failing: boolean; errors: number; degraded: number; open: boolean }[];
  errors: number;
  degraded: number;
  /** First second after the outage when requests succeed again (null: never). */
  recoveredAt: number | null;
  peakLoad: number;
}

export function runRetries(policy: RetryPolicy): RetryRun {
  const timeline: RetryRun["timeline"] = [];
  let prevFailing = false;
  let openUntil = -1;
  for (let t = 0; t < SECONDS; t++) {
    const outage = t >= OUTAGE[0] && t < OUTAGE[1];
    let load = CLIENT_RPS;
    let open = false;
    let probe = false;
    if (policy === "immediate" && prevFailing) load = CLIENT_RPS * 4; // each request tried 1 + 3 times
    if (policy === "backoff" && prevFailing) load = CAPACITY; // spread out, capped by a retry budget
    if (policy === "breaker") {
      if (t < openUntil) {
        open = true;
        load = 0;
      } else if (prevFailing) {
        probe = true;
        load = PROBE; // half-open: a few requests test the water
      }
    }
    const failing = load > 0 && (outage || load > CAPACITY);
    let errors = 0;
    let degraded = 0;
    if (open) degraded = CLIENT_RPS;
    else if (probe) {
      errors = failing ? PROBE : 0;
      degraded = CLIENT_RPS - PROBE;
    } else if (failing) errors = CLIENT_RPS;
    if (policy === "breaker" && failing && !open) openUntil = t + 1 + BREAKER_OPEN;
    timeline.push({ load, failing, errors, degraded, open });
    prevFailing = open ? true : failing;
    if (policy === "breaker" && probe && !failing) prevFailing = false;
  }
  const recovered = timeline.findIndex((x, t) => t >= OUTAGE[1] && !x.failing && !x.open && x.load >= CLIENT_RPS);
  return {
    timeline,
    errors: timeline.reduce((s, x) => s + x.errors, 0),
    degraded: timeline.reduce((s, x) => s + x.degraded, 0),
    recoveredAt: recovered >= 0 ? recovered : null,
    peakLoad: Math.max(...timeline.map((x) => x.load)),
  };
}
