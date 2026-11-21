"use client";

import { Color, Quaternion, Vector3 } from "three";
import { LAN_HOSTS, TCP_STATES, type DnsServer, type NetLabState, type Side } from "@inside-tech/lab-net";
import { Label } from "./Label";
import { C0, C1 } from "./palette";

const OFF = new Color("#c9d0de");
const OK = new Color("#17895c");
const BAD = new Color("#c23b3b");
const GOLD = new Color("#c9a24a");
const up = new Vector3(0, 1, 0);

function Pipe({ a, b, color, r = 0.06 }: { a: Vector3; b: Vector3; color: Color; r?: number }) {
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const dir = b.clone().sub(a);
  return (
    <mesh position={mid} quaternion={new Quaternion().setFromUnitVectors(up, dir.clone().normalize())}>
      <cylinderGeometry args={[r, r, dir.length(), 10]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={color === OFF ? 0 : 0.35} />
    </mesh>
  );
}

const DNS_POS: Record<DnsServer | "client", [number, number, number]> = {
  client: [-7, 0, 0],
  resolver: [-3, 0, 0],
  root: [2, 0, -3],
  tld: [4.5, 0, 0],
  auth: [2, 0, 3],
};
const DNS_H: Record<DnsServer | "client", number> = { client: 0.8, resolver: 1.4, root: 2.6, tld: 2, auth: 1.6 };

export function DnsView({ state }: { state: NetLabState }) {
  const d = state.dns;
  const last = d.last;
  const hopped = new Set(last?.hops.map((h) => h.server) ?? []);
  const names: Record<DnsServer | "client", string> = {
    client: "Браузер",
    resolver: "Резолвер",
    root: "Түбір (.)",
    tld: ".kz / .com",
    auth: "Аймақ сервері",
  };
  const live = d.cache.filter((e) => e.expires > d.clock);
  const v = (k: DnsServer | "client", y = 0.6) => new Vector3(DNS_POS[k][0], y, DNS_POS[k][2]);
  return (
    <group>
      {(Object.keys(DNS_POS) as (DnsServer | "client")[]).map((k) => {
        const lit = k === "client" || hopped.has(k as DnsServer);
        const h = DNS_H[k];
        return (
          <group key={k} position={DNS_POS[k]}>
            <mesh position={[0, h / 2, 0]} castShadow>
              <cylinderGeometry args={[0.45, 0.6, h, 6]} />
              <meshStandardMaterial color={k === "resolver" ? C1 : k === "client" ? C0 : lit ? GOLD : OFF} metalness={0.3} roughness={0.5} />
            </mesh>
            <Label text={names[k]} position={[0, h + 0.5, 0]} size={0.51} />
          </group>
        );
      })}
      <Pipe a={v("client")} b={v("resolver")} color={last ? OK : OFF} />
      {(["root", "tld", "auth"] as const).map((k) => (
        <Pipe key={k} a={v("resolver")} b={v(k)} color={hopped.has(k) ? GOLD : OFF} r={hopped.has(k) ? 0.07 : 0.03} />
      ))}
      {last?.hops.slice(1).map((h) => (
        <Label key={h.server} text={`${h.label}: ${h.ms} мс`} position={[(DNS_POS.resolver[0] + DNS_POS[h.server][0]) / 2, 1.2, (DNS_POS.resolver[2] + DNS_POS[h.server][2]) / 2]} size={0.38} />
      ))}
      <Label
        text={last ? `${last.name} → ${last.ip ?? "NXDOMAIN"} · ${last.ms} мс${last.fromCache ? " · кэштен" : ""}${last.stale ? " · ЕСКІ" : ""}` : "Атауды сұра"}
        position={[-1, 4.2, 0]}
        size={0.6}
      />
      <Label text={`сағат ${d.clock} с${d.moved ? " · inside.kz көшті" : ""}`} position={[-1, 3.6, 0]} size={0.45} />
      {live.slice(-5).map((e, i) => (
        <Label key={e.key} text={`${e.key} · ${e.expires - d.clock} с`} position={[-5, 2.6 - i * 0.5, 1.8]} size={0.35} />
      ))}
      {last?.stale && (
        <mesh position={[DNS_POS.resolver[0], 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.8, 1, 32]} />
          <meshBasicMaterial color={BAD} />
        </mesh>
      )}
    </group>
  );
}

const SIDE_X: Record<Side, number> = { client: -4.5, server: 4.5 };

export function TcpView({ state }: { state: NetLabState }) {
  const t = state.tcp;
  const seen = state.stats.tcpSeen;
  const yOf = (i: number) => 5 - i * 0.48;
  return (
    <group>
      {(["client", "server"] as const).map((side) => (
        <group key={side} position={[SIDE_X[side], 0, 0]}>
          <Label text={side === "client" ? "Клиент" : "Сервер"} position={[0, 5.8, 0]} size={0.6} />
          {TCP_STATES.map((st, i) => {
            const cur = t[side] === st;
            const was = seen[side].includes(st);
            return (
              <group key={st} position={[0, yOf(i), 0]}>
                <mesh position={[cur ? 0.25 * (side === "client" ? 1 : -1) : 0, 0, 0]}>
                  <boxGeometry args={[2.6, 0.36, 0.5]} />
                  <meshStandardMaterial color={cur ? GOLD : was ? C0 : OFF} emissive={cur ? GOLD : new Color("#000")} emissiveIntensity={cur ? 0.4 : 0} />
                </mesh>
                <Label text={st} position={[0, 0, 0.35]} size={0.35} />
              </group>
            );
          })}
        </group>
      ))}
      {t.wire.map((seg, i) => {
        const dir = seg.from === "client" ? 1 : -1;
        // The head of the queue is next to its receiver; the rest wait behind it.
        const x = i === 0 ? dir * 1.4 : -dir * 0.6;
        return (
          <group key={i} position={[x, 2.4 - i * 0.7, 0]}>
            <mesh>
              <boxGeometry args={[1.1, 0.45, 0.45]} />
              <meshStandardMaterial color={seg.flag === "RST" ? BAD : seg.flag === "FIN" ? C1 : OK} />
            </mesh>
            <Label text={`${seg.flag} ${dir > 0 ? "→" : "←"}`} position={[0, 0.5, 0]} size={0.42} />
          </group>
        );
      })}
      <Pipe a={new Vector3(-3, 0.1, 0)} b={new Vector3(3, 0.1, 0)} color={t.wire.length ? GOLD : OFF} r={0.04} />
      {t.log.length > 0 && <Label text={t.log[t.log.length - 1]!} position={[0, -0.6, 0.6]} size={0.48} />}
    </group>
  );
}

const HOST_POS = (i: number): [number, number, number] => [-6 + i * 4, 0, 3];

export function LanView({ state }: { state: NetLabState }) {
  const l = state.lan;
  const last = l.frames.at(-1);
  const lit = new Set(last?.outPorts ?? []);
  const sw = new Vector3(0, 0.6, -1.5);
  return (
    <group>
      <mesh position={[sw.x, 0.4, sw.z]} castShadow>
        <boxGeometry args={[5, 0.8, 1.4]} />
        <meshStandardMaterial color={C1} metalness={0.4} roughness={0.4} />
      </mesh>
      <Label text="Коммутатор" position={[0, 1.4, -1.5]} size={0.6} />
      {LAN_HOSTS.map((h, i) => {
        const p = HOST_POS(i);
        const isIn = last?.inPort === h.port;
        const isOut = lit.has(h.port);
        const color = isIn ? C0 : isOut ? (last!.flooded ? GOLD : OK) : OFF;
        return (
          <group key={h.id}>
            <Pipe a={new Vector3(-1.8 + i * 1.2, 0.5, -0.8)} b={new Vector3(p[0], 0.5, p[2])} color={color} r={isIn || isOut ? 0.07 : 0.03} />
            <group position={p}>
              <mesh position={[0, 0.45, 0]} castShadow>
                <boxGeometry args={[1.3, 0.9, 1]} />
                <meshStandardMaterial color={h.id === "R" ? C1 : C0} />
              </mesh>
              <Label text={`${h.id === "R" ? "Шлюз R" : h.id} · ${h.ip}`} position={[0, 1.4, 0]} size={0.42} />
              <Label text={`порт ${h.port} · …${h.mac.slice(-5)}`} position={[0, 1.05, 0]} size={0.32} />
              {Object.keys(l.arp[h.id] ?? {}).length > 0 && <Label text={`ARP: ${Object.keys(l.arp[h.id]!).length}`} position={[0, -0.3, 0.8]} size={0.32} />}
            </group>
          </group>
        );
      })}
      {last && (
        <Label
          text={`${last.kind === "data" ? "Деректер" : last.kind === "arp-request" ? "ARP сұрауы" : "ARP жауабы"}: ${last.note} · ${last.flooded ? "барлық портқа таралды" : "бір портқа"}`}
          position={[0, 3.2, -1.5]}
          size={0.54}
        />
      )}
      <Label text={`MAC кестесі: ${Object.keys(l.macTable).length ? Object.entries(l.macTable).map(([m, p]) => `${LAN_HOSTS.find((h) => h.mac === m)?.id}:${p}`).join("  ") : "бос"}`} position={[0, 2.5, -1.5]} size={0.42} />
    </group>
  );
}
