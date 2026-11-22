/**
 * Bufferbloat: one TCP upload through a 10 Mbit/s home router. TCP keeps
 * growing its window until a packet is lost, so whatever buffer the router
 * has fills up, and every packet (your video call's too) waits in it. A huge
 * buffer: no loss, full speed, seconds of delay. A tiny one: low delay, but
 * after each halving the link sits idle. A buffer the size of the path's
 * bandwidth-delay product refills exactly what one halving empties.
 */

export type QueuePolicy = "huge" | "tiny" | "bdp";
export const QUEUE_POLICIES: QueuePolicy[] = ["huge", "bdp", "tiny"];
export const BUFFER: Record<QueuePolicy, number> = { huge: 1000, bdp: 33, tiny: 10 };
/** Packets the path holds without queueing: 10 Mbit/s × 40 ms / 12 000 bit. */
export const BDP = 33;
export const BASE_RTT = 40;
/** Time to send one 1500-byte packet at 10 Mbit/s. */
export const PKT_MS = 1.2;
export const ROUNDS = 600;

export interface BloatRun {
  policy: QueuePolicy;
  rtt: number[];
  /** Mean round-trip time, ms (rounded). */
  avgRtt: number;
  maxRtt: number;
  /** Share of time the link was busy, 0..1 (two decimals). */
  utilization: number;
  drops: number;
}

export function runBloat(policy: QueuePolicy): BloatRun {
  let cwnd = 10;
  let drops = 0;
  let busy = 0;
  const rtt: number[] = [];
  for (let r = 0; r < ROUNDS; r++) {
    const queue = Math.max(0, cwnd - BDP);
    rtt.push(Math.round((BASE_RTT + queue * PKT_MS) * 10) / 10);
    busy += Math.min(1, cwnd / BDP);
    if (queue > BUFFER[policy]) {
      drops++;
      cwnd = Math.max(2, Math.floor(cwnd / 2));
    } else cwnd += 1;
  }
  // Skip the first 50 rounds of slow growth from the start.
  const steady = rtt.slice(50);
  return {
    policy,
    rtt,
    avgRtt: Math.round(steady.reduce((a, b) => a + b, 0) / steady.length),
    maxRtt: Math.max(...steady),
    utilization: Math.round((busy / ROUNDS) * 100) / 100,
    drops,
  };
}
