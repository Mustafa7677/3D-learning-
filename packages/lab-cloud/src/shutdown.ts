/**
 * A rolling deploy replaces 4 pods one by one while users send 100 requests a
 * second (25 per pod), each taking 2 s. How a pod stops decides how many
 * users see an error: killed at once (in-flight requests die, and the load
 * balancer keeps sending to it for 5 s until it learns), closing its port on
 * SIGTERM (in-flight finish, but the 5 s lag still hits a closed port), or
 * draining (keep serving through a preStop wait until the balancer has
 * removed it, then finish what is in flight and exit).
 */

export type StopPolicy = "kill" | "close" | "drain";
export const STOP_POLICIES: StopPolicy[] = ["kill", "close", "drain"];
export const DEPLOY_PODS = 4;
export const PER_POD_RPS = 25;
export const REQUEST_S = 2;
/** Seconds until every load balancer has removed a terminating pod. */
export const LB_LAG = 5;
export const FIRST_STOP = 10;
export const STOP_EVERY = 30;
export const DEPLOY_SECONDS = 130;

export interface ShutdownRun {
  policy: StopPolicy;
  /** Failed requests per second. */
  errors: number[];
  total: number;
  /** Seconds a pod takes from SIGTERM to exit. */
  stopSeconds: number;
}

export function runShutdown(policy: StopPolicy): ShutdownRun {
  const errors = Array.from({ length: DEPLOY_SECONDS }, () => 0);
  for (let i = 0; i < DEPLOY_PODS; i++) {
    const t0 = FIRST_STOP + i * STOP_EVERY;
    if (policy === "kill") errors[t0]! += PER_POD_RPS * REQUEST_S; // the requests it was serving
    if (policy !== "drain") for (let t = t0; t < t0 + LB_LAG; t++) errors[t]! += PER_POD_RPS; // still routed to it
  }
  return {
    policy,
    errors,
    total: errors.reduce((a, b) => a + b, 0),
    stopSeconds: policy === "kill" ? 0 : policy === "close" ? REQUEST_S : LB_LAG + REQUEST_S,
  };
}
