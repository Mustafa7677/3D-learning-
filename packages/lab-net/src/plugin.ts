import type { AssessmentResult, SimulationPlugin } from "@inside-tech/sim-core";
import { LINKS, cidr, congestion, natIn, natOut, newNat, packetize, sameSubnet, shortestPath, transfer, type Nat, type Protocol, type Variant } from "./core";

export type NetMode = "packets" | "ip" | "routing" | "transport" | "congestion" | "nat";
export const RTT = 10;
export const PACKETS = 50;

export interface NetStats {
  modes: NetMode[];
  packetRuns: { size: number; mtu: number; packets: number; efficiency: number }[];
  ipQueries: { addr: string; other: string; prefix: number; network: string; same: boolean }[];
  routeRuns: { from: string; to: string; failed: string[]; cost: number; path: string[]; algo: "ls" | "dv" }[];
  dvViews: { rounds: number; failed: string[] }[];
  transfers: { protocol: Protocol; window: number; loss: number; time: number; utilization: number; retransmits: number }[];
  congestionRuns: { variant: Variant; capacity: number; losses: number }[];
  natOut: number;
  natDelivered: number;
  natDropped: number;
}

export interface NetLabState {
  mode: NetMode;
  packets: { size: number; mtu: number };
  ip: { addr: string; other: string; prefix: number };
  routing: { from: string; to: string; failed: string[]; algo: "ls" | "dv"; rounds: number };
  transport: { protocol: Protocol; window: number; loss: number; t: number; playing: boolean; ran: boolean };
  congestion: { variant: Variant; capacity: number; ran: boolean };
  nat: Nat;
  speed: number;
  stats: NetStats;
}

export type NetLabAction =
  | { type: "mode/set"; mode: NetMode }
  | { type: "pkt/set"; size?: number; mtu?: number }
  | { type: "ip/set"; addr?: string; other?: string; prefix?: number }
  | { type: "route/set"; from?: string; to?: string }
  | { type: "route/toggle"; link: string }
  | { type: "route/algo"; algo: "ls" | "dv" }
  | { type: "route/rounds"; rounds: number }
  | { type: "route/send" }
  | { type: "tx/set"; protocol?: Protocol; window?: number; loss?: number }
  | { type: "tx/run" }
  | { type: "tx/finish" }
  | { type: "cc/set"; variant?: Variant; capacity?: number }
  | { type: "cc/run" }
  | { type: "nat/out"; host: string; port: number }
  | { type: "nat/in"; port: number }
  | { type: "nat/reset" };

const uniq = <T>(xs: T[], x: T) => (xs.includes(x) ? xs : [...xs, x]);
const cap = <T>(xs: T[], n = 40) => xs.slice(-n);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The transfer currently configured (pure: recomputed from settings). */
export const currentTransfer = (s: NetLabState) => transfer(s.transport.protocol, PACKETS, RTT, s.transport.window, s.transport.loss);
export const currentCongestion = (s: NetLabState) => congestion(s.congestion.variant, s.congestion.capacity, 40);

function recordPackets(s: NetLabState): NetLabState {
  const p = packetize(s.packets.size, s.packets.mtu);
  return { ...s, stats: { ...s.stats, packetRuns: cap([...s.stats.packetRuns, { size: s.packets.size, mtu: s.packets.mtu, packets: p.packets, efficiency: p.efficiency }]) } };
}

function recordIp(s: NetLabState): NetLabState {
  const c = cidr(s.ip.addr, s.ip.prefix);
  if (!c) return s;
  const same = cidr(s.ip.other, s.ip.prefix) ? sameSubnet(s.ip.addr, s.ip.other, s.ip.prefix) : false;
  return { ...s, stats: { ...s.stats, ipQueries: cap([...s.stats.ipQueries, { addr: s.ip.addr, other: s.ip.other, prefix: s.ip.prefix, network: c.network, same }]) } };
}

export function initialNetState(): NetLabState {
  return {
    mode: "packets",
    packets: { size: 1_000_000, mtu: 1500 },
    ip: { addr: "192.168.10.77", other: "192.168.10.200", prefix: 24 },
    routing: { from: "A", to: "F", failed: [], algo: "ls", rounds: 0 },
    transport: { protocol: "stopwait", window: 1, loss: 0, t: 0, playing: false, ran: false },
    congestion: { variant: "reno", capacity: 20, ran: false },
    nat: newNat(),
    speed: 20,
    stats: { modes: ["packets"], packetRuns: [], ipQueries: [], routeRuns: [], dvViews: [], transfers: [], congestionRuns: [], natOut: 0, natDelivered: 0, natDropped: 0 },
  };
}

function reduce(s: NetLabState, a: NetLabAction): NetLabState {
  const st = s.stats;
  switch (a.type) {
    case "mode/set":
      return { ...s, mode: a.mode, stats: { ...st, modes: uniq(st.modes, a.mode) } };
    case "pkt/set":
      return recordPackets({
        ...s,
        mode: "packets",
        packets: { size: Math.round(clamp(a.size ?? s.packets.size, 1, 1e9)), mtu: Math.round(clamp(a.mtu ?? s.packets.mtu, 100, 9000)) },
      });
    case "ip/set":
      return recordIp({ ...s, mode: "ip", ip: { addr: (a.addr ?? s.ip.addr).slice(0, 15), other: (a.other ?? s.ip.other).slice(0, 15), prefix: Math.round(clamp(a.prefix ?? s.ip.prefix, 0, 32)) } });

    case "route/set":
      return { ...s, mode: "routing", routing: { ...s.routing, from: a.from ?? s.routing.from, to: a.to ?? s.routing.to } };
    case "route/toggle": {
      if (!LINKS.some((l) => l.id === a.link)) return s;
      const failed = s.routing.failed.includes(a.link) ? s.routing.failed.filter((x) => x !== a.link) : [...s.routing.failed, a.link];
      return { ...s, routing: { ...s.routing, failed, rounds: s.routing.algo === "dv" ? 0 : s.routing.rounds } };
    }
    case "route/algo":
      return { ...s, mode: "routing", routing: { ...s.routing, algo: a.algo, rounds: 0 } };
    case "route/rounds": {
      const rounds = Math.round(clamp(a.rounds, 0, 12));
      return { ...s, routing: { ...s.routing, rounds }, stats: { ...st, dvViews: cap([...st.dvViews, { rounds, failed: [...s.routing.failed].sort() }]) } };
    }
    case "route/send": {
      const r = shortestPath(s.routing.from, s.routing.to, s.routing.failed);
      const run = { from: s.routing.from, to: s.routing.to, failed: [...s.routing.failed].sort(), cost: Number.isFinite(r.cost) ? r.cost : -1, path: r.path, algo: s.routing.algo };
      return { ...s, stats: { ...st, routeRuns: cap([...st.routeRuns, run]) } };
    }

    case "tx/set": {
      const t = s.transport;
      const protocol = a.protocol ?? t.protocol;
      return {
        ...s,
        mode: "transport",
        transport: { ...t, protocol, window: protocol === "stopwait" ? 1 : Math.round(clamp(a.window ?? (t.protocol === "stopwait" ? 4 : t.window), 1, 30)), loss: clamp(a.loss ?? t.loss, 0, 0.4), t: 0, playing: false, ran: false },
      };
    }
    case "tx/run": {
      const r = currentTransfer(s);
      const t = s.transport;
      return {
        ...s,
        mode: "transport",
        transport: { ...t, t: 0, playing: true, ran: true },
        stats: { ...st, transfers: cap([...st.transfers, { protocol: t.protocol, window: t.window, loss: t.loss, time: r.time, utilization: r.utilization, retransmits: r.retransmits }]) },
      };
    }
    case "tx/finish":
      return { ...s, transport: { ...s.transport, t: currentTransfer(s).time, playing: false } };

    case "cc/set":
      return { ...s, mode: "congestion", congestion: { variant: a.variant ?? s.congestion.variant, capacity: Math.round(clamp(a.capacity ?? s.congestion.capacity, 4, 60)), ran: false } };
    case "cc/run": {
      const c = currentCongestion(s);
      return { ...s, congestion: { ...s.congestion, ran: true }, stats: { ...st, congestionRuns: cap([...st.congestionRuns, { variant: s.congestion.variant, capacity: s.congestion.capacity, losses: c.losses.length }]) } };
    }

    case "nat/out":
      return { ...s, mode: "nat", nat: natOut(s.nat, a.host, a.port), stats: { ...st, natOut: st.natOut + 1 } };
    case "nat/in": {
      const r = natIn(s.nat, a.port);
      return { ...s, nat: r.nat, stats: r.delivered ? { ...st, natDelivered: st.natDelivered + 1 } : { ...st, natDropped: st.natDropped + 1 } };
    }
    case "nat/reset":
      return { ...s, nat: newNat() };
  }
}

export const netLabPlugin: SimulationPlugin<NetLabState, NetLabAction> = {
  id: "net-lab",
  version: "1.0.0",
  initialize: () => initialNetState(),
  dispatch: reduce,
  step(s, dt) {
    if (!s.transport.playing) return s;
    const end = currentTransfer(s).time;
    const t = Math.min(end, s.transport.t + dt * s.speed);
    return { ...s, transport: { ...s.transport, t, playing: t < end } };
  },
  snapshot: (s) => structuredClone(s),
  restore: (snap) => structuredClone(snap as NetLabState),
  evaluate: (s): AssessmentResult => ({ score: 0, metrics: { routes: s.stats.routeRuns.length, transfers: s.stats.transfers.length }, notes: [] }),
};
