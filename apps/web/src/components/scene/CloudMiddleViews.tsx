"use client";

import { Color } from "three";
import { CAPACITY, DB_CAP, DEPLOY_PODS, FIRST_STOP, HOT_RPS, STOP_EVERY, LB_SERVERS, PROBE_SECONDS, type CloudLabState } from "@inside-tech/lab-cloud";
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

const STRATEGY_WORD = { none: "кэшсіз", ttl: "TTL кэш", coalesce: "single-flight", early: "алдын ала жаңарту" } as const;

export function StampedeView({ state }: { state: CloudLabState }) {
  const c = state.stampede;
  const last = c?.last;
  const w = 15 / 60;
  // Log-like height so 1, 50 and 500 queries a second are all visible.
  const hgt = (q: number) => (q <= 0 ? 0.04 : 0.35 + Math.log10(q) * 1.4);
  return (
    <group>
      {last?.timeline.map((x, t) => {
        const h = hgt(x.db);
        return (
          <group key={t} position={[-7.5 + t * w + w / 2, 0, 0]}>
            <mesh position={[0, h / 2, 0]}>
              <boxGeometry args={[w * 0.85, h, 0.8]} />
              <meshStandardMaterial color={x.db > DB_CAP ? BAD : x.db > 0 ? WARM : OFF} />
            </mesh>
            <mesh position={[0, 0.02, 1]}>
              <boxGeometry args={[w * 0.85, 0.04, 0.4]} />
              <meshStandardMaterial color={x.hit ? OK : x.slow ? BAD : OFF} />
            </mesh>
          </group>
        );
      })}
      <mesh position={[0, hgt(DB_CAP), -0.5]}>
        <boxGeometry args={[15.2, 0.04, 0.04]} />
        <meshStandardMaterial color={C1} emissive={C1} emissiveIntensity={0.5} />
      </mesh>
      <Label text={`дерекқор шегі ${DB_CAP}/с`} position={[4.5, hgt(DB_CAP) + 0.35, -0.5]} size={0.4} />
      <Label text={`${HOT_RPS}/с`} position={[-6.6, hgt(HOT_RPS) + 0.1, -0.5]} size={0.4} />
      <Label text="төменгі жолақ: жасыл кэштен · қызыл күтті" position={[0, -0.45, 1.3]} size={0.4} />
      <Label text={last && c ? `${STRATEGY_WORD[c.strategy]} · дерекқор шыңы ${last.dbPeak}/с · шамадан тыс ${last.overload} с` : "60 секундты ойнат"} position={[0, 5, 0]} size={0.7} />
      <Label text="баған: секундына дерекқорға баратын сұраныс (логарифм шкала)" position={[0, 4.3, 0]} size={0.45} />
    </group>
  );
}

export function ShutdownView({ state }: { state: CloudLabState }) {
  const c = state.shutdown;
  const last = c?.last;
  const n = last?.errors.length ?? 130;
  const w = 15 / n;
  const k = 3.6 / 80;
  return (
    <group>
      {Array.from({ length: DEPLOY_PODS }, (_, i) => {
        const t0 = FIRST_STOP + i * STOP_EVERY;
        return (
          <group key={i}>
            <mesh position={[-7.5 + t0 * w, 0.02, 1.2]}>
              <boxGeometry args={[0.12, 0.04, 0.9]} />
              <meshStandardMaterial color={C1} />
            </mesh>
            <Label text={`под ${i + 1}`} position={[-7.5 + t0 * w, -0.35, 1.5]} size={0.36} />
          </group>
        );
      })}
      {last?.errors.map((e, t) =>
        e > 0 ? (
          <mesh key={t} position={[-7.5 + t * w + w / 2, (e * k) / 2, 0]}>
            <boxGeometry args={[w * 0.9, e * k, 0.8]} />
            <meshStandardMaterial color={BAD} />
          </mesh>
        ) : null,
      )}
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[15.2, 0.04, 0.9]} />
        <meshStandardMaterial color={last && last.total === 0 ? OK : OFF} />
      </mesh>
      <Label text={last ? `қате ${last.total} · под ${last.stopSeconds} с-та тоқтайды` : "Deploy жаса"} position={[0, 4.6, 0]} size={0.65} />
      <Label text="қызыл баған: секундына үзілген сұраныстар · алтын белгі: под тоқтай бастады" position={[0, 4, 0]} size={0.42} />
    </group>
  );
}
