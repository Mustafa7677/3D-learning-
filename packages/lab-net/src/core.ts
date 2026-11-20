/**
 * Networking models for teaching: packetization and headers, IPv4/CIDR,
 * link-state and distance-vector routing, reliable transfer over a lossy
 * link, TCP congestion control and NAT. Deterministic so lessons are fair.
 */

// ---------------- packets ----------------

export const HEADERS = { ethernet: 18, ip: 20, tcp: 20 };
export const HEADER_BYTES = HEADERS.ip + HEADERS.tcp; // inside the IP MTU

export interface Packetization {
  packets: number;
  payloadPerPacket: number;
  wireBytes: number;
  efficiency: number;
}

/** Split a message into TCP/IP packets for a given MTU (IP packet size limit). */
export function packetize(messageBytes: number, mtu: number): Packetization {
  const payloadPerPacket = mtu - HEADER_BYTES;
  const packets = Math.max(1, Math.ceil(messageBytes / payloadPerPacket));
  const wireBytes = messageBytes + packets * (HEADER_BYTES + HEADERS.ethernet);
  return { packets, payloadPerPacket, wireBytes, efficiency: messageBytes / wireBytes };
}

// ---------------- IPv4 ----------------

export function parseIp(s: string): number | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s.trim());
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  if (parts.some((p) => p > 255)) return null;
  return ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0;
}
export const ipToString = (n: number) => [24, 16, 8, 0].map((s) => (n >>> s) & 255).join(".");
export const maskOf = (prefix: number) => (prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0);

export interface Cidr {
  network: string;
  broadcast: string;
  mask: string;
  first: string;
  last: string;
  /** Usable host addresses (network and broadcast are reserved). */
  hosts: number;
}

export function cidr(ip: string, prefix: number): Cidr | null {
  const n = parseIp(ip);
  if (n === null || prefix < 0 || prefix > 32 || !Number.isInteger(prefix)) return null;
  const mask = maskOf(prefix);
  const net = (n & mask) >>> 0;
  const bc = (net | (~mask >>> 0)) >>> 0;
  const size = 2 ** (32 - prefix);
  return {
    network: ipToString(net),
    broadcast: ipToString(bc),
    mask: ipToString(mask),
    first: ipToString(prefix >= 31 ? net : net + 1),
    last: ipToString(prefix >= 31 ? bc : bc - 1),
    hosts: prefix >= 31 ? size : size - 2,
  };
}

export const sameSubnet = (a: string, b: string, prefix: number) => cidr(a, prefix)?.network === cidr(b, prefix)?.network;

// ---------------- routing ----------------

export interface Link {
  id: string;
  a: string;
  b: string;
  cost: number;
}

export const ROUTERS: { id: string; x: number; z: number }[] = [
  { id: "A", x: -5, z: 0 },
  { id: "B", x: -2, z: -2.5 },
  { id: "C", x: -2, z: 2.5 },
  { id: "D", x: 1.5, z: -2.5 },
  { id: "E", x: 1.5, z: 2.5 },
  { id: "F", x: 5, z: 0 },
];

export const LINKS: Link[] = [
  { id: "AB", a: "A", b: "B", cost: 1 },
  { id: "AC", a: "A", b: "C", cost: 4 },
  { id: "BC", a: "B", b: "C", cost: 2 },
  { id: "BD", a: "B", b: "D", cost: 5 },
  { id: "CE", a: "C", b: "E", cost: 3 },
  { id: "DE", a: "D", b: "E", cost: 1 },
  { id: "DF", a: "D", b: "F", cost: 2 },
  { id: "EF", a: "E", b: "F", cost: 6 },
];

const live = (failed: string[]) => LINKS.filter((l) => !failed.includes(l.id));

/** Link state: every router knows the whole map and runs Dijkstra. */
export function shortestPath(from: string, to: string, failed: string[] = []): { path: string[]; cost: number } {
  const dist: Record<string, number> = { [from]: 0 };
  const prev: Record<string, string> = {};
  const done = new Set<string>();
  for (;;) {
    let u: string | undefined;
    for (const r of ROUTERS) if (!done.has(r.id) && r.id in dist && (u === undefined || dist[r.id]! < dist[u]!)) u = r.id;
    if (u === undefined) break;
    done.add(u);
    for (const l of live(failed)) {
      const v = l.a === u ? l.b : l.b === u ? l.a : null;
      if (v && !done.has(v) && (dist[v] === undefined || dist[u]! + l.cost < dist[v]!)) {
        dist[v] = dist[u]! + l.cost;
        prev[v] = u;
      }
    }
  }
  if (!(to in dist)) return { path: [], cost: Infinity };
  const path = [to];
  while (path[0] !== from) path.unshift(prev[path[0]!]!);
  return { path, cost: dist[to]! };
}

/**
 * Distance vector (Bellman–Ford): each round, every router learns its
 * neighbours' tables. Returns each router's best cost to `dest` after k rounds.
 */
export function distanceVector(dest: string, rounds: number, failed: string[] = []): Record<string, number> {
  let d: Record<string, number> = Object.fromEntries(ROUTERS.map((r) => [r.id, r.id === dest ? 0 : Infinity]));
  for (let k = 0; k < rounds; k++) {
    const next = { ...d };
    for (const l of live(failed)) {
      next[l.a] = Math.min(next[l.a]!, d[l.b]! + l.cost);
      next[l.b] = Math.min(next[l.b]!, d[l.a]! + l.cost);
    }
    d = next;
  }
  return d;
}

/** Rounds until distance vectors stop changing. */
export function convergenceRounds(dest: string, failed: string[] = []): number {
  for (let k = 0; k < 20; k++) if (JSON.stringify(distanceVector(dest, k, failed)) === JSON.stringify(distanceVector(dest, k + 1, failed))) return k;
  return 20;
}

// ---------------- reliable transfer ----------------

export type Protocol = "stopwait" | "window";

export interface TransferEvent {
  t: number;
  kind: "send" | "lost" | "ack" | "timeout";
  seq: number;
}

export interface Transfer {
  time: number;
  sends: number;
  retransmits: number;
  events: TransferEvent[];
  /** Fraction of the link's capacity carrying new data. */
  utilization: number;
}

/** Deterministic pseudo-random sequence for packet loss. */
function lossSeq(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return (s % 10000) / 10000;
  };
}

/**
 * Send `packets` over a link that delivers one packet per time unit with a
 * round-trip time of `rtt` units. Stop-and-wait is a window of 1. Lost packets
 * are detected by timeout (one RTT after the expected ACK) and resent
 * (selective repeat: only the lost one).
 */
export function transfer(protocol: Protocol, packets: number, rtt: number, window: number, loss: number, seed = 7): Transfer {
  const w = protocol === "stopwait" ? 1 : Math.max(1, Math.round(window));
  const rnd = lossSeq(seed);
  const events: TransferEvent[] = [];
  const acked = new Set<number>();
  let t = 0;
  let sends = 0;
  let retransmits = 0;
  // Outstanding: seq -> time it was sent and whether it will arrive.
  const flight = new Map<number, { at: number; ok: boolean }>();
  let next = 0;
  const queue: number[] = []; // seqs needing retransmission
  while (acked.size < packets && t < 100000) {
    // Fill the window: one transmission per time unit.
    if (flight.size < w && (queue.length || next < packets)) {
      const seq = queue.length ? queue.shift()! : next++;
      const ok = rnd() >= loss;
      if (events.some((e) => e.seq === seq && e.kind === "send")) retransmits++;
      flight.set(seq, { at: t, ok });
      sends++;
      events.push({ t, kind: "send", seq });
      if (!ok) events.push({ t: t + rtt / 2, kind: "lost", seq });
    }
    t++;
    for (const [seq, f] of [...flight]) {
      if (f.ok && t >= f.at + rtt) {
        flight.delete(seq);
        acked.add(seq);
        events.push({ t, kind: "ack", seq });
      } else if (!f.ok && t >= f.at + 2 * rtt) {
        flight.delete(seq);
        queue.push(seq);
        events.push({ t, kind: "timeout", seq });
      }
    }
  }
  return { time: t, sends, retransmits, events: events.slice(0, 400), utilization: packets / Math.max(1, t) };
}

/** Bandwidth-delay product in packets: the window needed to keep the link busy. */
export const bdp = (rtt: number) => rtt;

// ---------------- congestion control ----------------

export type Variant = "tahoe" | "reno";

/** cwnd per RTT round: slow start, congestion avoidance, and a loss whenever cwnd exceeds `capacity`. */
export function congestion(variant: Variant, capacity: number, rounds: number): { cwnd: number[]; losses: number[]; ssthresh: number[] } {
  let cwnd = 1;
  let ssthresh = 64;
  const out: number[] = [];
  const th: number[] = [];
  const losses: number[] = [];
  for (let r = 0; r < rounds; r++) {
    out.push(cwnd);
    th.push(ssthresh);
    if (cwnd > capacity) {
      losses.push(r);
      ssthresh = Math.max(2, Math.floor(cwnd / 2));
      cwnd = variant === "tahoe" ? 1 : ssthresh;
    } else cwnd = cwnd < ssthresh ? cwnd * 2 : cwnd + 1;
  }
  return { cwnd: out, losses, ssthresh: th };
}

// ---------------- NAT ----------------

export const PUBLIC_IP = "203.0.113.7";

export interface NatEntry {
  inside: string;
  insidePort: number;
  publicPort: number;
}

export interface Nat {
  table: NatEntry[];
  nextPort: number;
  log: string[];
}

export const newNat = (): Nat => ({ table: [], nextPort: 40000, log: [] });

/** An inside host opens a connection out: NAT rewrites the source and remembers the mapping. */
export function natOut(n: Nat, host: string, port: number): Nat {
  const existing = n.table.find((e) => e.inside === host && e.insidePort === port);
  if (existing) return { ...n, log: [...n.log, `${host}:${port} → ${PUBLIC_IP}:${existing.publicPort} (бар жазба)`].slice(-12) };
  const e = { inside: host, insidePort: port, publicPort: n.nextPort };
  return { table: [...n.table, e], nextPort: n.nextPort + 1, log: [...n.log, `${host}:${port} → ${PUBLIC_IP}:${e.publicPort} (жаңа жазба)`].slice(-12) };
}

/** A packet arrives from the internet to a public port: forwarded only if a mapping exists. */
export function natIn(n: Nat, publicPort: number): { nat: Nat; delivered: string | null } {
  const e = n.table.find((x) => x.publicPort === publicPort);
  const msg = e ? `${PUBLIC_IP}:${publicPort} → ${e.inside}:${e.insidePort} (жауап жеткізілді)` : `${PUBLIC_IP}:${publicPort} → ? (жазба жоқ — тасталды)`;
  return { nat: { ...n, log: [...n.log, msg].slice(-12) }, delivered: e ? e.inside : null };
}
