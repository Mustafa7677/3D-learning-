/**
 * MTU along a path with a VPN tunnel in the middle. A packet larger than a
 * link's MTU is either cut into fragments (DF off) or dropped (DF on); in the
 * second case the router normally sends ICMP "fragmentation needed" back, and
 * the sender shrinks its packets (Path MTU Discovery). If a firewall eats that
 * ICMP, the big packets vanish silently: a PMTU black hole.
 */

export interface Hop {
  name: string;
  mtu: number;
}

export const MTU_PATH: Hop[] = [
  { name: "Үй роутері", mtu: 1500 },
  { name: "VPN туннелі", mtu: 1400 },
  { name: "Сервер желісі", mtu: 1500 },
];
export const IP_HEADER = 20;
export const PACKET_SIZES = [1000, 1400, 1500] as const;
/** The size an MSS-clamping router lets through the tunnel. */
export const CLAMP_TO = 1400;
/** One-way trip time across the path, ms; a silent drop costs a whole timeout. */
export const MTU_RTT = 40;
export const SILENT_TIMEOUT = 1000;
export const MAX_ATTEMPTS = 3;

export type AttemptResult = "delivered" | "fragmented" | "icmp" | "silent";

export interface MtuAttempt {
  size: number;
  result: AttemptResult;
  /** Index of the hop that could not carry the packet whole. */
  hop: number | null;
  fragments: number;
  ms: number;
}

export interface MtuRun {
  size: number;
  df: boolean;
  icmpBlocked: boolean;
  clamp: boolean;
  attempts: MtuAttempt[];
  delivered: boolean;
  fragments: number;
  ms: number;
}

/** Fragments needed to carry `size` bytes over a link of `mtu`: payload goes in multiples of 8 bytes. */
export function fragmentCount(size: number, mtu: number): number {
  if (size <= mtu) return 1;
  const perFragment = Math.floor((mtu - IP_HEADER) / 8) * 8;
  return Math.ceil((size - IP_HEADER) / perFragment);
}

export function runMtu(size: number, df: boolean, icmpBlocked: boolean, clamp: boolean): MtuRun {
  let cur = clamp ? Math.min(size, CLAMP_TO) : size;
  const attempts: MtuAttempt[] = [];
  let delivered = false;
  let fragments = 1;
  for (let i = 0; i < MAX_ATTEMPTS && !delivered; i++) {
    const hop = MTU_PATH.findIndex((h) => h.mtu < cur);
    if (hop < 0) {
      attempts.push({ size: cur, result: "delivered", hop: null, fragments: 1, ms: MTU_RTT });
      delivered = true;
    } else if (!df) {
      fragments = fragmentCount(cur, MTU_PATH[hop]!.mtu);
      attempts.push({ size: cur, result: "fragmented", hop, fragments, ms: MTU_RTT });
      delivered = true;
    } else if (!icmpBlocked) {
      attempts.push({ size: cur, result: "icmp", hop, fragments: 0, ms: MTU_RTT });
      cur = MTU_PATH[hop]!.mtu;
    } else {
      attempts.push({ size: cur, result: "silent", hop, fragments: 0, ms: SILENT_TIMEOUT });
    }
  }
  return { size, df, icmpBlocked, clamp, attempts, delivered, fragments, ms: attempts.reduce((a, x) => a + x.ms, 0) };
}
