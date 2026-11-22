"use client";

import { Color } from "three";
import { CAPACITY, LB_SERVERS, PROBE_SECONDS, type CloudLabState } from "@inside-tech/lab-cloud";
import { Label } from "./Label";
import { C0, C1 } from "./palette";

const OFF = new Color("#c9d0de");
const OK = new Color("#17895c");
const BAD = new Color("#c23b3b");
const WARM = new Color("#c9a24a");
const PHASE = { ok: OK, warming: WARM, dead: BAD, down: OFF };

export function ProbesView({ state }: { state: CloudLabState }) {
  const last = state.probes.last;
  const w = 15 / PROBE_SECONDS;
  return (
    <group>
      {["A", "B", "C"].map((pod, k) => (
        <group key={pod} position={[0, 0, k * 1.3 - 1.3]}>
          <Label text={`под ${pod}`} position={[-8.8, 0.3, 0]} size={0.63} />
          {last?.timeline.map((sec, t) => {
            const x = sec[k]!;
            const hurts = x.inRotation && x.phase !== "ok";
            return (
              <mesh key={t} position={[-7.5 + t * w + w / 2, x.inRotation ? 0.3 : 0.08, 0]}>
                <boxGeometry args={[w * 0.9, x.inRotation ? 0.6 : 0.16, 0.9]} />
                <meshStandardMaterial color={PHASE[x.phase]} emissive={hurts ? BAD : new Color("#000")} emissiveIntensity={hurts ? 0.5 : 0} />
              </mesh>
            );
          })}
        </group>
      ))}
      <Label text={last ? `${last.errors} қате · ${last.restarts} қайта іске қосу` : "90 секундты ойнат"} position={[0, 1.9, -1.6]} size={0.8} />
      <Label text="жасыл: сау · сары: жылынып жатыр · қызыл: қатып қалған · биік: трафик алады" position={[0, 1.3, -1.6]} size={0.51} />
    </group>
  );
}

export function QueueView({ state }: { state: CloudLabState }) {
  const last = state.queue.last;
  const w = 15 / 90;
  const k = 4 / 1500;
  return (
    <group>
      {last?.length.map((len, t) => (
        <mesh key={t} position={[-7.5 + t * w + w / 2, Math.max(0.02, len * k) / 2, 0]}>
          <boxGeometry args={[w * 0.85, Math.max(0.02, len * k), 0.8]} />
          <meshStandardMaterial color={len >= (state.queue.limit ?? Infinity) ? BAD : t < 30 ? C1 : C0} />
        </mesh>
      ))}
      <mesh position={[-7.5 + 15 * (30 / 90), 2.2, -0.6]}>
        <boxGeometry args={[0.04, 4.4, 0.04]} />
        <meshStandardMaterial color={OFF} />
      </mesh>
      <Label text="толқын бітті (30 с)" position={[-7.5 + 15 * (30 / 90), 4.7, -0.6]} size={0.51} />
      <Label text={last ? `ең ұзын кезек ${last.maxLength} · күту ${last.maxWait} с · 429: ${last.dropped}` : "Толқынды жібер"} position={[1.5, 5.4, 0]} size={0.75} />
    </group>
  );
}

export function LbView({ state }: { state: CloudLabState }) {
  const last = state.lb.last;
  return (
    <group>
      <mesh position={[0, 0.5, -2.2]}>
        <boxGeometry args={[2.2, 1, 1]} />
        <meshStandardMaterial color={C1} metalness={0.3} roughness={0.5} />
      </mesh>
      <Label text={`теңестіргіш · ${state.lb.algo}`} position={[0, 1.5, -2.2]} size={0.63} />
      {LB_SERVERS.map((s, i) => {
        const n = last?.counts[i] ?? 0;
        const h = n / 40;
        return (
          <group key={s.id} position={[(i - 1) * 4, 0, 2]}>
            <mesh position={[0, h / 2 + 0.02, 0]}>
              <boxGeometry args={[1.8, Math.max(0.04, h), 1.4]} />
              <meshStandardMaterial color={s.ms > 30 ? WARM : C0} />
            </mesh>
            <Label text={`${s.id} · ${s.ms} мс`} position={[0, Math.max(0.04, h) + 0.6, 0]} size={0.68} />
            {last && <Label text={`${n} сұраныс`} position={[0, -0.3, 1]} size={0.6} />}
          </group>
        );
      })}
      {last && <Label text={`p95 ${last.p95} мс`} position={[0, 4.6, 0]} size={0.8} />}
    </group>
  );
}

export function RetriesView({ state }: { state: CloudLabState }) {
  const last = state.retries?.last;
  const w = 15 / 60;
  const k = 4.5 / 400;
  return (
    <group>
      {last?.timeline.map((x, t) => {
        const h = Math.max(0.04, x.load * k);
        return (
          <mesh key={t} position={[-7.5 + t * w + w / 2, h / 2, 0]}>
            <boxGeometry args={[w * 0.85, h, 0.8]} />
            <meshStandardMaterial color={x.open ? OFF : x.failing ? BAD : OK} />
          </mesh>
        );
      })}
      <mesh position={[0, CAPACITY * k, -0.5]}>
        <boxGeometry args={[15.2, 0.04, 0.04]} />
        <meshStandardMaterial color={C1} emissive={C1} emissiveIntensity={0.5} />
      </mesh>
      <Label text="сыйымдылық 150/с" position={[8.6, CAPACITY * k, -0.5]} size={0.4} />
      <mesh position={[-7.5 + 20 * w / 2 + 10 * w, 0.02, 1]}>
        <boxGeometry args={[20 * w, 0.04, 0.3]} />
        <meshStandardMaterial color={BAD} />
      </mesh>
      <Label text="құлау 10-30 с" position={[-7.5 + 20 * w, -0.4, 1.2]} size={0.4} />
      <Label text={last ? `қате ${last.errors} · оралды: ${last.recoveredAt === null ? "ешқашан" : `${last.recoveredAt} с`}` : "60 секундты ойнат"} position={[0, 5, 0]} size={0.7} />
      <Label text="баған: қызметке жүктеме · жасыл: сау · қызыл: құлаған · сұр: сақтандырғыш ашық" position={[0, 4.3, 0]} size={0.45} />
    </group>
  );
}
