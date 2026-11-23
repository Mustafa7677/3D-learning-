"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Color } from "three";
import {
  BUG_RATE,
  MU,
  ROOT_CAUSE,
  SERVICES,
  SLO_MS,
  STEPS,
  availability,
  incidentMetrics,
  latencyMs,
  pipeline,
  simulateDay,
  survivors,
  type CloudLabState,
  type ServiceId,
} from "@inside-tech/lab-cloud";
import { FitCamera } from "./FitCamera";
import { Label } from "./Label";
import { StageLook } from "./StageLook";
import { LbView, ProbesView, QueueView, RetriesView, ShutdownView, StampedeView } from "./CloudMiddleViews";
import { C0, C1 } from "./palette";

export type CloudFocus = "image" | "cluster" | "scale" | "autoscale" | "pipeline" | "release" | "availability" | "incident" | "probes" | "queue" | "lb" | "retries" | "stampede" | "shutdown";

const OFF = new Color("#c9d0de");
const OK = new Color("#17895c");
const BAD = new Color("#c23b3b");
const fmtMs = (v: number) => (Number.isFinite(v) ? `${v.toFixed(0)} мс` : "∞");

function ImageView({ state }: { state: CloudLabState }) {
  const last = state.image.last;
  const rebuilt = new Set(last?.rebuilt ?? []);
  return (
    <group>
      {state.image.order.map((id, i) => {
        const h = 0.3 + Math.min(STEPS[id].seconds, 45) / 30;
        const color = !last || last.error ? OFF : rebuilt.has(id) ? BAD : OK;
        return (
          <group key={id} position={[0, i * 0.75, 0]}>
            <mesh position={[0, 0.3, 0]}>
              <boxGeometry args={[4 + h, 0.6, 2]} />
              <meshStandardMaterial color={color} />
            </mesh>
            <Label text={`${STEPS[id].text} · ${STEPS[id].seconds} с`} position={[6.8, 0.35, 0]} size={0.48} />
          </group>
        );
      })}
      <Label
        text={!last ? "Образды жина" : last.error ? `Қате: ${last.error}` : `Жинау: ${last.seconds.toFixed(1)} с · қызыл: қайта жиналды, жасыл: кэштен`}
        position={[0, state.image.order.length * 0.75 + 0.6, 0]}
        size={0.61}
      />
    </group>
  );
}

function ClusterView({ state }: { state: CloudLabState }) {
  const c = state.cluster;
  return (
    <group>
      <mesh position={[0, -0.05, 0]}>
        <boxGeometry args={[12, 0.1, 4]} />
        <meshStandardMaterial color={OFF} />
      </mesh>
      {c.pods.map((p, i) => (
        <group key={p.id} position={[(i - (c.pods.length - 1) / 2) * 1.2, 0.5, 0]}>
          <mesh>
            <cylinderGeometry args={[0.4, 0.4, p.status === "running" ? 1 : 0.5, 20]} />
            <meshStandardMaterial color={p.status === "running" ? OK : C1} />
          </mesh>
          <Label text={`pod ${p.id}`} position={[0, 0.9, 0]} size={0.42} />
        </group>
      ))}
      <Label text={`Қалаған: ${c.desired} · жұмыс істейді: ${c.pods.filter((p) => p.status === "running").length} · күтуде: ${c.pods.filter((p) => p.status === "pending").length}`} position={[0, 2.6, 0]} size={0.64} />
      {c.events.length > 0 && <Label text={c.events[c.events.length - 1]!} position={[0, 2, 0]} size={0.48} />}
    </group>
  );
}

function ScaleView({ state }: { state: CloudLabState }) {
  const { lambda, instances } = state.scale;
  const per = lambda / instances;
  const lat = latencyMs(lambda, instances);
  const rho = Math.min(per / MU, 1.2);
  const queue = Number.isFinite(lat) ? Math.min(8, rho / Math.max(1e-6, 1 - rho)) : 8;
  return (
    <group>
      {Array.from({ length: Math.min(instances, 16) }, (_, i) => {
        const x = -7 + (i % 8) * 2;
        const z = i < 8 ? -1.5 : 2.5;
        return (
          <group key={i} position={[x, 0, z]}>
            <mesh position={[0, 0.5, 0]}>
              <boxGeometry args={[0.9, 1, 0.9]} />
              <meshStandardMaterial color={rho >= 1 ? BAD : rho > 0.8 ? C1 : OK} />
            </mesh>
            <mesh position={[0, 1 + (Math.min(rho, 1) * 1.6) / 2, 0]}>
              <boxGeometry args={[0.5, Math.max(0.02, Math.min(rho, 1) * 1.6), 0.5]} />
              <meshStandardMaterial color={C0} />
            </mesh>
            {queue > 0.3 && (
              <mesh position={[0.75, (queue * 0.3) / 2, 0]}>
                <boxGeometry args={[0.25, queue * 0.3, 0.25]} />
                <meshStandardMaterial color={BAD} />
              </mesh>
            )}
          </group>
        );
      })}
      <Label text={`${lambda} сұраныс/с ÷ ${instances} сервер = ${per.toFixed(1)} әрқайсысына (μ = ${MU})`} position={[0, 4, 0]} size={0.64} />
      <Label text={`Кешігу: ${fmtMs(lat)} · SLO ≤ ${SLO_MS} мс ${lat <= SLO_MS ? "✓" : "✗"}`} position={[0, 3.4, 0]} size={0.64} />
    </group>
  );
}

function AutoscaleView({ state }: { state: CloudLabState }) {
  const day = simulateDay(state.autoscale);
  const k = 0.18;
  return (
    <group>
      {day.hours.map((h) => (
        <group key={h.h} position={[-9.2 + h.h * 0.8, 0, 0]}>
          <mesh position={[0, (h.instances * k) / 2, 0]}>
            <boxGeometry args={[0.55, h.instances * k, 0.55]} />
            <meshStandardMaterial color={h.violated && state.autoscale.ran ? BAD : C0} />
          </mesh>
          <mesh position={[0, ((h.lambda / 80) * k), 0.5]}>
            <sphereGeometry args={[0.12, 12, 8]} />
            <meshStandardMaterial color={C1} />
          </mesh>
          {h.h % 6 === 0 && <Label text={`${h.h}:00`} position={[0, -0.35, 0.6]} size={0.42} />}
        </group>
      ))}
      <Label text="көк: серверлер, сары: трафик/80 (SLO-ға керегі), қызыл: бұзылу" position={[0, 4.6, 0]} size={0.51} />
      {state.autoscale.ran && <Label text={`SLO бұзылуы: ${day.violations} сағат · ${day.instanceHours} сервер·сағат`} position={[0, 5.2, 0]} size={0.64} />}
    </group>
  );
}

function PipelineView({ state }: { state: CloudLabState }) {
  const r = pipeline(state.pipeline);
  const rows: Record<string, number> = { lint: 0, unit: 1, integration: 2, build: 3, deploy: 4 };
  const k = 0.7;
  return (
    <group>
      {r.stages.map((s) => {
        const ran = state.pipeline.ran;
        const color = !ran ? OFF : s.status === "ok" ? OK : s.status === "failed" ? BAD : OFF;
        const w = Math.max(0.15, s.minutes * k);
        const y = rows[s.id] ?? 0;
        return (
          <group key={s.id}>
            <mesh position={[-7 + s.start * k + w / 2, 0.4 + (4 - y) * 1.1, 0]}>
              <boxGeometry args={[w, 0.6, 0.5]} />
              <meshStandardMaterial color={color} transparent opacity={ran && s.status === "skipped" ? 0.35 : 1} />
            </mesh>
            <Label text={`${s.id} ${s.minutes} мин${ran && s.status !== "ok" ? ` · ${s.status === "failed" ? "ҚҰЛАДЫ" : "өткізілді"}` : ""}`} position={[-7 + s.start * k + w / 2, 0.95 + (4 - y) * 1.1, 0]} size={0.42} />
          </group>
        );
      })}
      <Label text={state.pipeline.ran ? `${r.minutes} мин · ${r.deployed ? "production-ға шықты ✓" : "deploy болмады ✗"}` : "Конвейерді іске қос"} position={[0, 6.4, 0]} size={0.67} />
    </group>
  );
}

function ReleaseView({ state }: { state: CloudLabState }) {
  const r = state.release;
  const users = 100;
  return (
    <group>
      {Array.from({ length: users }, (_, i) => {
        const v2 = i < Math.round(r.share * users);
        const broken = v2 && (i * 7 + Math.floor(i / 10) * 3) % 5 === 0;
        return (
          <mesh key={i} position={[-4.5 + (i % 10), 0.25, -4.5 + Math.floor(i / 10)]}>
            <boxGeometry args={[0.7, 0.5, 0.7]} />
            <meshStandardMaterial color={broken ? BAD : v2 ? C1 : C0} />
          </mesh>
        );
      })}
      <Label text={`v2 трафикте: ${(r.share * 100).toFixed(0)}% · қате үлесі ${(r.share * BUG_RATE * 100).toFixed(1)}%${r.rolledBack ? " · кері қайтарылды" : ""}`} position={[0, 2, -5.5]} size={0.64} />
      <Label text="көк: v1, сары: v2, қызыл: қатеге тап болғандар" position={[0, 1.4, -5.5]} size={0.48} />
    </group>
  );
}

function AvailabilityView({ state }: { state: CloudLabState }) {
  const { replicas, zones, zoneDown } = state.availability;
  const a = availability(replicas);
  const alive = zoneDown ? survivors(replicas, zones) : replicas;
  return (
    <group>
      {Array.from({ length: zones }, (_, z) => (
        <group key={z} position={[(z - (zones - 1) / 2) * 4.5, 0, 0]}>
          <mesh position={[0, -0.05, 0]}>
            <boxGeometry args={[3.8, 0.1, 3]} />
            <meshStandardMaterial color={zoneDown && z === 0 ? BAD : OFF} />
          </mesh>
          <Label text={`зона ${String.fromCharCode(97 + z)}${zoneDown && z === 0 ? ": ҚҰЛАДЫ" : ""}`} position={[0, 0.2, 1.9]} size={0.48} />
          {Array.from({ length: replicas }, (_, i) => i)
            .filter((i) => i % zones === z)
            .map((i, j) => (
              <mesh key={i} position={[-1.2 + j * 1.2, 0.5, 0]}>
                <boxGeometry args={[0.8, 1, 0.8]} />
                <meshStandardMaterial color={zoneDown && z === 0 ? BAD : OK} transparent opacity={zoneDown && z === 0 ? 0.35 : 1} />
              </mesh>
            ))}
        </group>
      ))}
      <Label text={`${replicas} реплика · ${(a * 100).toFixed(a >= 0.9999 ? 4 : 2)}%`} position={[0, 2.8, 0]} size={0.67} />
      {zoneDown && <Label text={alive > 0 ? `Тірі қалды: ${alive} реплика ✓` : "Сервис құлады ✗"} position={[0, 2.2, 0]} size={0.64} />}
    </group>
  );
}

const POS: Record<ServiceId, [number, number, number]> = { gateway: [-5, 0, 0], auth: [0, 0, -2.5], orders: [0, 0, 2], payments: [5, 0, 2] };

function IncidentView({ state }: { state: CloudLabState }) {
  const m = incidentMetrics();
  const sel = state.incident.selected;
  return (
    <group>
      {SERVICES.flatMap((s) =>
        s.calls.map((t) => {
          const a = POS[s.id];
          const b = POS[t];
          const mid: [number, number, number] = [(a[0] + b[0]) / 2, 0.5, (a[2] + b[2]) / 2];
          const len = Math.hypot(b[0] - a[0], b[2] - a[2]);
          return (
            <mesh key={s.id + t} position={mid} rotation={[0, -Math.atan2(b[2] - a[2], b[0] - a[0]), 0]}>
              <boxGeometry args={[len, 0.06, 0.06]} />
              <meshStandardMaterial color={OFF} />
            </mesh>
          );
        }),
      )}
      {SERVICES.map((s) => {
        const x = m[s.id];
        const h = 0.4 + Math.min(x.p99, 3000) / 1000;
        const solved = sel === s.id && s.id === ROOT_CAUSE;
        return (
          <group key={s.id} position={POS[s.id]}>
            <mesh position={[0, h / 2, 0]}>
              <boxGeometry args={[1.2, h, 1.2]} />
              <meshStandardMaterial color={solved ? OK : x.p99 > 1000 ? BAD : C0} emissive={sel === s.id ? new Color("#333") : new Color("#000")} />
            </mesh>
            <Label text={`${s.id} · p99 ${x.p99} мс`} position={[0, h + 0.45, 0]} size={0.48} />
          </group>
        );
      })}
      <Label text={sel ? (sel === ROOT_CAUSE ? "Түпкі себеп табылды ✓" : `${sel}: симптом, себеп емес`) : "Бағандар: p99 кешігу. Түпкі себеп қайда?"} position={[0, 4.4, 0]} size={0.64} />
    </group>
  );
}

function Contents({ state, focus }: { state: CloudLabState; focus: CloudFocus }) {
  const frames: Record<CloudFocus, { w: number; h: number; t: [number, number, number]; d: [number, number, number] }> = {
    image: { w: 17, h: 7, t: [3, 2.6, 0], d: [0, 0.25, 1] },
    cluster: { w: 13, h: 5, t: [0, 1, 0], d: [0, 0.8, 1] },
    scale: { w: 17, h: 7, t: [0, 1.5, 0.5], d: [0, 1, 1] },
    autoscale: { w: 20, h: 7, t: [0, 2.4, 0], d: [0, 0.3, 1] },
    pipeline: { w: 17, h: 7.5, t: [0, 3.2, 0], d: [0, 0.25, 1] },
    release: { w: 12, h: 10, t: [0, 0, -0.5], d: [0, 1.6, 1] },
    availability: { w: 15, h: 6, t: [0, 1, 0], d: [0, 0.8, 1] },
    incident: { w: 14, h: 8, t: [0, 1, 0], d: [0, 1, 1] },
    probes: { w: 18, h: 5, t: [0, 0.4, -0.3], d: [0, 1.2, 1] },
    queue: { w: 17, h: 7, t: [0, 2.4, 0], d: [0, 0.35, 1] },
    lb: { w: 13, h: 7, t: [0, 1.4, 0], d: [0, 0.8, 1] },
    retries: { w: 17, h: 6, t: [0, 1.9, 0], d: [0, 0.45, 1] },
    stampede: { w: 17, h: 6, t: [0, 1.9, 0], d: [0, 0.45, 1] },
    shutdown: { w: 17, h: 6, t: [0, 1.9, 0.4], d: [0, 0.5, 1] },
  };
  const f = frames[focus];
  return (
    <>
      <ambientLight intensity={0.85} />
      <directionalLight position={[4, 9, 6]} intensity={1.2} />
      <gridHelper args={[24, 24, "#36427a", "#232c55"]} position={[0, -0.01, 0]} />
      <StageLook />
      {focus === "image" && <ImageView state={state} />}
      {focus === "cluster" && <ClusterView state={state} />}
      {focus === "scale" && <ScaleView state={state} />}
      {focus === "autoscale" && <AutoscaleView state={state} />}
      {focus === "pipeline" && <PipelineView state={state} />}
      {focus === "release" && <ReleaseView state={state} />}
      {focus === "availability" && <AvailabilityView state={state} />}
      {focus === "incident" && <IncidentView state={state} />}
      {focus === "probes" && <ProbesView state={state} />}
      {focus === "queue" && <QueueView state={state} />}
      {focus === "lb" && <LbView state={state} />}
      {focus === "retries" && <RetriesView state={state} />}
      {focus === "stampede" && <StampedeView state={state} />}
      {focus === "shutdown" && <ShutdownView state={state} />}
      <FitCamera width={f.w} height={f.h} target={f.t} dir={f.d} />
      <OrbitControls makeDefault enableDamping minDistance={3} maxDistance={40} maxPolarAngle={Math.PI / 2.05} />
    </>
  );
}

export default function CloudScene({ state, focus }: { state: CloudLabState; focus: CloudFocus }) {
  return (
    <Canvas frameloop="demand" camera={{ position: [0, 8, 14], fov: 45, near: 0.1, far: 200 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }} role="img" aria-label="3D көрініс: бұлт және DevOps">
      <Contents state={state} focus={focus} />
    </Canvas>
  );
}
