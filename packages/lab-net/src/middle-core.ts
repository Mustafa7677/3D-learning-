/**
 * Middle-level networking models: recursive DNS with a TTL cache, the TCP
 * connection state machine, and an Ethernet switch with ARP. Deterministic,
 * so every number quoted in a lecture is pinned by a test.
 */

// ---------------- DNS ----------------

export type DnsServer = "resolver" | "root" | "tld" | "auth";

/** Round trip from the resolver to each server, in ms (client to resolver is CLIENT_RTT). */
export const DNS_RTT: Record<Exclude<DnsServer, "resolver">, number> = { root: 40, tld: 30, auth: 20 };
export const CLIENT_RTT = 10;

export interface DnsZone {
  name: string;
  ip: string;
  ttl: number;
}

/** What the authoritative servers say. `inside.kz` can move to a new address. */
export const DNS_NAMES = ["inside.kz", "api.inside.kz", "mail.inside.kz", "example.com"] as const;
export type DnsName = (typeof DNS_NAMES)[number];
export const OLD_IP = "93.184.10.1";
export const NEW_IP = "93.184.20.1";

export function zone(name: string, moved: boolean): DnsZone | null {
  switch (name) {
    case "inside.kz":
      return { name, ip: moved ? NEW_IP : OLD_IP, ttl: 300 };
    case "api.inside.kz":
      return { name, ip: "93.184.10.2", ttl: 60 };
    case "mail.inside.kz":
      return { name, ip: "93.184.10.5", ttl: 3600 };
    case "example.com":
      return { name, ip: "93.184.216.34", ttl: 3600 };
  }
  return null;
}

/** The zone a name lives in (whose authoritative server answers) and its top-level domain. */
export const zoneOf = (name: string) => name.split(".").slice(-2).join(".");
export const tldOf = (name: string) => name.split(".").at(-1)!;

/** TTLs of the delegations: the root hands out a TLD's servers, the TLD hands out a zone's. */
export const NS_TTL = { tld: 172_800, zone: 86_400 };

export interface CacheEntry {
  /** "A inside.kz", "NS kz", "NS inside.kz". */
  key: string;
  value: string;
  expires: number;
}

export interface DnsHop {
  server: DnsServer;
  /** Who the server is, e.g. "kz", "inside.kz". */
  label: string;
  question: string;
  answer: string;
  ms: number;
}

export interface DnsResult {
  name: string;
  ip: string | null;
  hops: DnsHop[];
  ms: number;
  fromCache: boolean;
  /** The cached answer differs from what the authoritative server says now. */
  stale: boolean;
  cache: CacheEntry[];
}

const fresh = (cache: CacheEntry[], key: string, now: number) => cache.find((e) => e.key === key && e.expires > now);
const put = (cache: CacheEntry[], e: CacheEntry) => [...cache.filter((x) => x.key !== e.key), e];

/**
 * A recursive resolver: answer from cache if it can, otherwise walk down from
 * the deepest delegation it still remembers (root, then TLD, then the zone).
 */
export function resolve(cache: CacheEntry[], name: string, now: number, moved: boolean): DnsResult {
  const z = zone(name, moved);
  const hops: DnsHop[] = [{ server: "resolver", label: "резолвер", question: `A ${name}?`, answer: "", ms: CLIENT_RTT }];
  const hit = fresh(cache, `A ${name}`, now);
  if (hit) {
    hops[0]!.answer = `${hit.value} (кэштен)`;
    return { name, ip: hit.value, hops, ms: CLIENT_RTT, fromCache: true, stale: !!z && hit.value !== z.ip, cache };
  }
  let c = cache.filter((e) => e.expires > now);
  const tld = tldOf(name);
  const zn = zoneOf(name);
  if (!fresh(c, `NS ${zn}`, now)) {
    if (!fresh(c, `NS ${tld}`, now)) {
      hops.push({ server: "root", label: "түбір (.)", question: `A ${name}?`, answer: `${tld} серверлері: a.nic.${tld}`, ms: DNS_RTT.root });
      c = put(c, { key: `NS ${tld}`, value: `a.nic.${tld}`, expires: now + NS_TTL.tld });
    }
    hops.push({ server: "tld", label: `.${tld}`, question: `A ${name}?`, answer: `${zn} серверлері: ns1.${zn}`, ms: DNS_RTT.tld });
    c = put(c, { key: `NS ${zn}`, value: `ns1.${zn}`, expires: now + NS_TTL.zone });
  }
  hops.push({ server: "auth", label: zn, question: `A ${name}?`, answer: z ? `${z.ip}, TTL ${z.ttl} с` : "NXDOMAIN", ms: DNS_RTT.auth });
  if (z) c = put(c, { key: `A ${name}`, value: z.ip, expires: now + z.ttl });
  hops[0]!.answer = z ? z.ip : "NXDOMAIN";
  return { name, ip: z?.ip ?? null, hops, ms: hops.reduce((s, h) => s + h.ms, 0), fromCache: false, stale: false, cache: c };
}

// ---------------- TCP state machine ----------------

export type TcpState = "CLOSED" | "LISTEN" | "SYN_SENT" | "SYN_RCVD" | "ESTABLISHED" | "FIN_WAIT_1" | "FIN_WAIT_2" | "CLOSING" | "TIME_WAIT" | "CLOSE_WAIT" | "LAST_ACK";
export type Side = "client" | "server";
export type Flag = "SYN" | "SYN-ACK" | "ACK" | "FIN" | "RST";

export interface Segment {
  from: Side;
  flag: Flag;
}

export interface Tcp {
  client: TcpState;
  server: TcpState;
  /** Segments in flight, delivered in order. */
  wire: Segment[];
  log: string[];
}

export const TCP_STATES: TcpState[] = ["CLOSED", "LISTEN", "SYN_SENT", "SYN_RCVD", "ESTABLISHED", "FIN_WAIT_1", "FIN_WAIT_2", "CLOSING", "TIME_WAIT", "CLOSE_WAIT", "LAST_ACK"];
export const newTcp = (): Tcp => ({ client: "CLOSED", server: "CLOSED", wire: [], log: [] });

export const other = (s: Side): Side => (s === "client" ? "server" : "client");
const NAME: Record<Side, string> = { client: "Клиент", server: "Сервер" };

export type TcpEvent = { kind: "listen" } | { kind: "connect" } | { kind: "close"; side: Side } | { kind: "deliver" } | { kind: "drop" } | { kind: "timer"; side: Side };

function emit(t: Tcp, from: Side, flag: Flag): Tcp {
  return { ...t, wire: [...t.wire, { from, flag }] };
}
const set = (t: Tcp, side: Side, st: TcpState): Tcp => ({ ...t, [side]: st });
const say = (t: Tcp, line: string): Tcp => ({ ...t, log: [...t.log, line].slice(-10) });

/** What a side resends when its timer fires; `null` when nothing is waiting. */
export function pendingResend(st: TcpState): Flag | null {
  return st === "SYN_SENT" ? "SYN" : st === "SYN_RCVD" ? "SYN-ACK" : st === "FIN_WAIT_1" || st === "LAST_ACK" || st === "CLOSING" ? "FIN" : null;
}

/** One step of RFC 793's state machine, without sequence numbers or data. */
export function tcpStep(t: Tcp, ev: TcpEvent): Tcp {
  switch (ev.kind) {
    case "listen":
      return t.server === "CLOSED" ? say(set(t, "server", "LISTEN"), "Сервер: LISTEN (портты тыңдайды)") : t;
    case "connect":
      return t.client === "CLOSED" ? say(emit(set(t, "client", "SYN_SENT"), "client", "SYN"), "Клиент → SYN, күйі SYN_SENT") : t;
    case "close": {
      const st = t[ev.side];
      if (st === "ESTABLISHED") return say(emit(set(t, ev.side, "FIN_WAIT_1"), ev.side, "FIN"), `${NAME[ev.side]} → FIN, күйі FIN_WAIT_1`);
      if (st === "CLOSE_WAIT") return say(emit(set(t, ev.side, "LAST_ACK"), ev.side, "FIN"), `${NAME[ev.side]} → FIN, күйі LAST_ACK`);
      return t;
    }
    case "timer": {
      const st = t[ev.side];
      if (st === "TIME_WAIT") return say(set(t, ev.side, "CLOSED"), `${NAME[ev.side]}: 2·MSL өтті, TIME_WAIT → CLOSED`);
      const flag = pendingResend(st);
      if (!flag || t.wire.some((s) => s.from === ev.side && s.flag === flag)) return t;
      return say(emit(t, ev.side, flag), `${NAME[ev.side]}: таймер, ${flag} қайта жіберілді`);
    }
    case "drop": {
      const [seg, ...rest] = t.wire;
      return seg ? say({ ...t, wire: rest }, `${NAME[seg.from]} жіберген ${seg.flag} жоғалды`) : t;
    }
    case "deliver": {
      const [seg, ...rest] = t.wire;
      if (!seg) return t;
      const to = other(seg.from);
      let u: Tcp = { ...t, wire: rest };
      const st = u[to];
      const go = (next: TcpState, reply?: Flag) => {
        let v = set(u, to, next);
        if (reply) v = emit(v, to, reply);
        return say(v, `${NAME[to]} ← ${seg.flag}: ${st} → ${next}${reply ? `, жауабы ${reply}` : ""}`);
      };
      switch (seg.flag) {
        case "SYN":
          if (st === "LISTEN") return go("SYN_RCVD", "SYN-ACK");
          if (st === "CLOSED") return say(emit(u, to, "RST"), `${NAME[to]} ← SYN: порт жабық, жауабы RST`);
          break;
        case "SYN-ACK":
          if (st === "SYN_SENT") return go("ESTABLISHED", "ACK");
          // A repeated SYN-ACK (our ACK was lost): acknowledge again.
          if (st === "ESTABLISHED") return say(emit(u, to, "ACK"), `${NAME[to]} ← қайталанған SYN-ACK, ACK қайта жіберілді`);
          break;
        case "ACK":
          if (st === "SYN_RCVD") return go("ESTABLISHED");
          if (st === "FIN_WAIT_1") return go("FIN_WAIT_2");
          if (st === "CLOSING") return go("TIME_WAIT");
          if (st === "LAST_ACK") return go("CLOSED");
          break;
        case "FIN":
          if (st === "ESTABLISHED") return go("CLOSE_WAIT", "ACK");
          if (st === "FIN_WAIT_2") return go("TIME_WAIT", "ACK");
          if (st === "FIN_WAIT_1") return go("CLOSING", "ACK");
          // A repeated FIN (our ACK was lost): acknowledge again.
          if (st === "CLOSE_WAIT" || st === "TIME_WAIT") return say(emit(u, to, "ACK"), `${NAME[to]} ← қайталанған FIN, ACK қайта жіберілді`);
          break;
        case "RST":
          return say(set(u, to, "CLOSED"), `${NAME[to]} ← RST: «connection refused», ${st} → CLOSED`);
      }
      u = say(u, `${NAME[to]} ← ${seg.flag}: ${st} күйінде еленбеді`);
      return u;
    }
  }
}

// ---------------- Ethernet switch and ARP ----------------

export interface LanHost {
  id: string;
  ip: string;
  mac: string;
  port: number;
}

export const LAN_HOSTS: LanHost[] = [
  { id: "R", ip: "192.168.1.1", mac: "aa:00:00:00:00:01", port: 1 },
  { id: "A", ip: "192.168.1.10", mac: "aa:00:00:00:00:0a", port: 2 },
  { id: "B", ip: "192.168.1.11", mac: "aa:00:00:00:00:0b", port: 3 },
  { id: "C", ip: "192.168.1.12", mac: "aa:00:00:00:00:0c", port: 4 },
];
export const GATEWAY = LAN_HOSTS[0]!;
export const LAN_PREFIX = 24;
export const BROADCAST_MAC = "ff:ff:ff:ff:ff:ff";

export interface Frame {
  kind: "arp-request" | "arp-reply" | "data";
  srcMac: string;
  dstMac: string;
  /** Who the frame is for at the IP level (data) or which IP is asked about (ARP). */
  note: string;
  inPort: number;
  outPorts: number[];
  flooded: boolean;
}

export interface Lan {
  /** Switch MAC table: MAC to port. */
  macTable: Record<string, number>;
  /** ARP caches per host id: IP to MAC. */
  arp: Record<string, Record<string, string>>;
  frames: Frame[];
}

export const newLan = (): Lan => ({ macTable: {}, arp: Object.fromEntries(LAN_HOSTS.map((h) => [h.id, {}])), frames: [] });
const hostByIp = (ip: string) => LAN_HOSTS.find((h) => h.ip === ip);
const ports = LAN_HOSTS.map((h) => h.port);

/** The switch: learn the sender's port, then forward to the known port or flood. */
function switchFrame(lan: Lan, f: Omit<Frame, "outPorts" | "flooded">): { lan: Lan; frame: Frame } {
  const macTable = { ...lan.macTable, [f.srcMac]: f.inPort };
  const known = f.dstMac === BROADCAST_MAC ? undefined : lan.macTable[f.dstMac];
  const frame: Frame = known !== undefined ? { ...f, outPorts: [known], flooded: false } : { ...f, outPorts: ports.filter((p) => p !== f.inPort), flooded: true };
  return { lan: { ...lan, macTable, frames: [...lan.frames, frame] }, frame };
}

function inSubnet(a: string, b: string): boolean {
  const n = (s: string) => s.split(".").slice(0, 3).join(".");
  return n(a) === n(b);
}

export interface LanSend {
  lan: Lan;
  frames: Frame[];
  /** The IP whose MAC the sender needed (the target, or the gateway). */
  nextHop: string;
  arped: boolean;
}

/** Host `from` sends one IP packet to `toIp`. */
export function lanSend(lan0: Lan, fromId: string, toIp: string): LanSend {
  const from = LAN_HOSTS.find((h) => h.id === fromId)!;
  const nextHop = inSubnet(from.ip, toIp) ? toIp : GATEWAY.ip;
  let lan: Lan = { ...lan0, frames: [] };
  const out: Frame[] = [];
  let mac = lan.arp[from.id]![nextHop];
  let arped = false;
  if (!mac) {
    arped = true;
    let r = switchFrame(lan, { kind: "arp-request", srcMac: from.mac, dstMac: BROADCAST_MAC, note: `${nextHop} кімде?`, inPort: from.port });
    lan = r.lan;
    out.push(r.frame);
    const target = hostByIp(nextHop);
    if (!target) return { lan: { ...lan, frames: out }, frames: out, nextHop, arped };
    // The target also learns the asker from the request.
    lan = { ...lan, arp: { ...lan.arp, [target.id]: { ...lan.arp[target.id], [from.ip]: from.mac } } };
    r = switchFrame(lan, { kind: "arp-reply", srcMac: target.mac, dstMac: from.mac, note: `${nextHop} мында: ${target.mac}`, inPort: target.port });
    lan = r.lan;
    out.push(r.frame);
    mac = target.mac;
    lan = { ...lan, arp: { ...lan.arp, [from.id]: { ...lan.arp[from.id], [nextHop]: mac } } };
  }
  const r = switchFrame(lan, { kind: "data", srcMac: from.mac, dstMac: mac, note: `IP ${from.ip} → ${toIp}`, inPort: from.port });
  out.push(r.frame);
  return { lan: { ...r.lan, frames: out }, frames: out, nextHop, arped };
}

/** Forget learned ports (as when entries age out after 300 s), keep the hosts' ARP caches. */
export const ageSwitch = (lan: Lan): Lan => ({ ...lan, macTable: {} });
