"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Color, Quaternion, Vector3 } from "three";
import { LINKS, PUBLIC_IP, ROUTERS, RTT, currentCongestion, currentTransfer, distanceVector, packetize, parseIp, shortestPath, type NetLabState } from "@inside-tech/lab-net";
import { FitCamera } from "./FitCamera";
import { Label } from "./Label";
import { StageLook } from "./StageLook";
import { NetRoutingStage } from "./NetRoutingStage";
import { BloatView, DnsView, LanView, MtuView, StreamsView, TcpView } from "./NetMiddleViews";
import { FilmFx } from "../film/Fx";
import { QUALITY, useQuality } from "@/lib/quality";
import { C0, C1 } from "./palette";

export type NetFocus = "packets" | "ip" | "routing" | "transport" | "congestion" | "nat" | "dns" | "tcp" | "lan" | "streams" | "mtu" | "bloat";

const OFF = new Color("#c9d0de");
const OK = new Color("#17895c");
const BAD = new Color("#c23b3b");
const up = new Vector3(0, 1, 0);

function Pipe({ a, b, color, r = 0.06 }: { a: Vector3; b: Vector3; color: Color; r?: number }) {
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const dir = b.clone().sub(a);
  return (
    <mesh position={mid} quaternion={new Quaternion().setFromUnitVectors(up, dir.clone().normalize())}>
      <cylinderGeometry args={[r, r, dir.length(), 10]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function PacketsView({ state }: { state: NetLabState }) {
  const p = packetize(state.packets.size, state.packets.mtu);
  const shown = Math.min(p.packets, 40);
  const headerShare = 58 / (58 + Math.min(p.payloadPerPacket, state.packets.size));
  return (
    <group>
      {Array.from({ length: shown }, (_, i) => (
        <group key={i} position={[-7.2 + (i % 20) * 0.75, 0, i < 20 ? -1 : 1]}>
          <mesh position={[0, (headerShare * 1.4) / 2, 0]}>
            <boxGeometry args={[0.6, headerShare * 1.4, 0.6]} />
            <meshStandardMaterial color={C0} />
          </mesh>
          <mesh position={[0, headerShare * 1.4 + ((1 - headerShare) * 1.4) / 2, 0]}>
            <boxGeometry args={[0.6, (1 - headerShare) * 1.4, 0.6]} />
            <meshStandardMaterial color={OK} />
          </mesh>
        </group>
      ))}
      <Label text={`${p.packets.toLocaleString("ru-RU")} пакет${p.packets > shown ? ` (көрсетілгені ${shown})` : ""} · тиімділік ${(p.efficiency * 100).toFixed(1)}%`} position={[0, 3, 0]} size={0.42} />
      <Label text="көк: тақырыптар (Ethernet + IP + TCP), жасыл: деректер" position={[0, 2.4, 0]} size={0.3} />
    </group>
  );
}

function IpView({ state }: { state: NetLabState }) {
  const n = parseIp(state.ip.addr);
  const bits = n === null ? [] : Array.from({ length: 32 }, (_, i) => (n >>> (31 - i)) & 1);
  return (
    <group>
      {bits.map((b, i) => {
        const net = i < state.ip.prefix;
        return (
          <mesh key={i} position={[-7.75 + i * 0.5 + Math.floor(i / 8) * 0.2, b ? 0.35 : 0.12, 0]}>
            <boxGeometry args={[0.4, b ? 0.7 : 0.24, 0.6]} />
            <meshStandardMaterial color={net ? C0 : C1} />
          </mesh>
        );
      })}
      {[0, 1, 2, 3].map((o) => (
        <Label key={o} text={state.ip.addr.split(".")[o] ?? "?"} position={[-6 + o * 4.2, 1.3, 0]} size={0.38} />
      ))}
      <Label text={n === null ? "Адрес дұрыс емес" : `/${state.ip.prefix}: көк: желі (${state.ip.prefix} бит), сарғыш: хост (${32 - state.ip.prefix} бит)`} position={[0, 2.3, 0]} size={0.36} />
    </group>
  );
}

function TransportView({ state }: { state: NetLabState }) {
  const tr = currentTransfer(state);
  const t = state.transport.ran ? state.transport.t : 0;
  const S = -6;
  const R = 6;
  const items: { x: number; color: Color; key: string }[] = [];
  if (state.transport.ran) {
    for (const e of tr.events) {
      if (e.kind !== "send") continue;
      const lost = tr.events.some((x) => x.kind === "lost" && x.seq === e.seq && x.t === e.t + RTT / 2);
      const half = RTT / 2;
      if (t >= e.t && t < e.t + half) items.push({ x: S + ((t - e.t) / half) * (R - S), color: lost ? BAD : C0, key: `d${e.seq}-${e.t}` });
      else if (!lost && t >= e.t + half && t < e.t + RTT) items.push({ x: R - ((t - e.t - half) / half) * (R - S), color: OK, key: `a${e.seq}-${e.t}` });
    }
  }
  const acked = tr.events.filter((e) => e.kind === "ack" && e.t <= t).length;
  return (
    <group>
      <Pipe a={new Vector3(S, 0.5, 0)} b={new Vector3(R, 0.5, 0)} color={OFF} r={0.04} />
      {[S, R].map((x, i) => (
        <group key={x} position={[x, 0.6, 0]}>
          <mesh>
            <boxGeometry args={[1.2, 1.2, 1.2]} />
            <meshStandardMaterial color={C1} />
          </mesh>
          <Label text={i === 0 ? "Жіберуші" : "Қабылдаушы"} position={[0, 1.1, 0]} size={0.34} />
        </group>
      ))}
      {items.map((p) => (
        <mesh key={p.key} position={[p.x, p.color === OK ? 0.25 : 0.85, 0]}>
          <boxGeometry args={[0.35, 0.3, 0.35]} />
          <meshStandardMaterial color={p.color} />
        </mesh>
      ))}
      <Label text={`t = ${Math.round(t)} · жеткізілді ${acked}/50 · ұшуда ${items.length}`} position={[0, 2.4, 0]} size={0.4} />
    </group>
  );
}

function CongestionView({ state }: { state: NetLabState }) {
  const c = currentCongestion(state);
  const k = 0.12;
  return (
    <group>
      {c.cwnd.map((w, i) => (
        <mesh key={i} position={[-7.8 + i * 0.4, (w * k) / 2, 0]}>
          <boxGeometry args={[0.3, Math.max(0.02, w * k), 0.3]} />
          <meshStandardMaterial color={c.losses.includes(i) ? BAD : C0} />
        </mesh>
      ))}
      <Pipe a={new Vector3(-8, state.congestion.capacity * k, 0)} b={new Vector3(8, state.congestion.capacity * k, 0)} color={C1} r={0.03} />
      <Label text={`сыйымдылық ${state.congestion.capacity}`} position={[8.6, state.congestion.capacity * k, 0]} size={0.3} />
      <Label text={`${state.congestion.variant === "reno" ? "TCP Reno" : "TCP Tahoe"} · жоғалтулар: ${c.losses.length}`} position={[0, 5, 0]} size={0.42} />
    </group>
  );
}

function NatView({ state }: { state: NetLabState }) {
  const n = state.nat;
  return (
    <group>
      {["192.168.1.10", "192.168.1.11", "192.168.1.12"].map((h, i) => (
        <group key={h} position={[-6, 0.4, -2 + i * 2]}>
          <mesh>
            <boxGeometry args={[1, 0.6, 0.8]} />
            <meshStandardMaterial color={n.table.some((e) => e.inside === h) ? OK : OFF} />
          </mesh>
          <Label text={h} position={[0, 0.7, 0]} size={0.3} />
        </group>
      ))}
      <group position={[0, 0.6, 0]}>
        <mesh>
          <boxGeometry args={[1.6, 1, 1.6]} />
          <meshStandardMaterial color={C1} />
        </mesh>
        <Label text={`NAT · ${PUBLIC_IP}`} position={[0, 1, 0]} size={0.34} />
      </group>
      <group position={[6, 0.6, 0]}>
        <mesh>
          <sphereGeometry args={[0.8, 24, 16]} />
          <meshStandardMaterial color={C0} />
        </mesh>
        <Label text="Интернет" position={[0, 1.2, 0]} size={0.34} />
      </group>
      {n.table.slice(-5).map((e, i) => (
        <Label key={e.publicPort} text={`${e.inside}:${e.insidePort} ↔ :${e.publicPort}`} position={[0, 2.2 + i * 0.45, -0.5]} size={0.28} />
      ))}
      {n.log.length > 0 && <Label text={n.log[n.log.length - 1]!} position={[0, 0.2, 2.8]} size={0.32} />}
    </group>
  );
}

function Contents({ state, focus }: { state: NetLabState; focus: NetFocus }) {
  const frames: Record<NetFocus, { w: number; h: number; t: [number, number, number]; d: [number, number, number] }> = {
    packets: { w: 17, h: 6, t: [0, 1, 0], d: [0, 0.8, 1] },
    ip: { w: 18, h: 5, t: [0, 0.8, 0], d: [0, 0.6, 1] },
    routing: { w: 13.5, h: 8.5, t: [0, 0.4, 0], d: [0.2, 1.05, 1] },
    transport: { w: 15, h: 5, t: [0, 1, 0], d: [0, 0.6, 1] },
    congestion: { w: 19, h: 7, t: [0, 2.6, 0], d: [0, 0.3, 1] },
    nat: { w: 15, h: 8, t: [0, 1, 0], d: [0, 1.2, 1] },
    dns: { w: 15, h: 8, t: [-1, 1.2, 0], d: [0, 0.9, 1] },
    tcp: { w: 13, h: 7.5, t: [0, 2.6, 0], d: [0, 0.25, 1] },
    lan: { w: 15, h: 7, t: [0, 1, 0.5], d: [0, 0.9, 1] },
    streams: { w: 14, h: 5, t: [0, 0.4, -0.6], d: [0, 1.1, 1] },
    mtu: { w: 13, h: 5, t: [0, 0.8, 0], d: [0, 0.9, 1] },
    bloat: { w: 17, h: 6, t: [0, 2.4, 0], d: [0, 0.3, 1] },
  };
  const f = frames[focus];
  const q = QUALITY[useQuality()];
  const film = focus === "routing";
  return (
    <>
      <ambientLight intensity={0.85} />
      <directionalLight position={[4, 9, 6]} intensity={1.2} />
      {!film && <gridHelper args={[24, 24, "#36427a", "#232c55"]} position={[0, -0.01, 0]} />}
      <StageLook shadows={!film} />
      {focus === "packets" && <PacketsView state={state} />}
      {focus === "ip" && <IpView state={state} />}
      {film && <NetRoutingStage state={state} />}
      {film && <FilmFx bloom={q.bloom} />}
      {focus === "transport" && <TransportView state={state} />}
      {focus === "congestion" && <CongestionView state={state} />}
      {focus === "nat" && <NatView state={state} />}
      {focus === "dns" && <DnsView state={state} />}
      {focus === "tcp" && <TcpView state={state} />}
      {focus === "lan" && <LanView state={state} />}
      {focus === "streams" && <StreamsView state={state} />}
      {focus === "mtu" && <MtuView state={state} />}
      {focus === "bloat" && <BloatView state={state} />}
      <FitCamera width={f.w} height={f.h} target={f.t} dir={f.d} />
      <OrbitControls makeDefault enableDamping minDistance={3} maxDistance={40} maxPolarAngle={Math.PI / 2.05} />
    </>
  );
}

export default function NetScene({ state, focus }: { state: NetLabState; focus: NetFocus }) {
  return (
    <Canvas camera={{ position: [0, 8, 14], fov: 45, near: 0.1, far: 200 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }} role="img" aria-label="3D көрініс: компьютерлік желілер">
      <Contents state={state} focus={focus} />
    </Canvas>
  );
}
