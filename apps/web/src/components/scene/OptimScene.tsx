"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { BufferAttribute, BufferGeometry, Color, Vector3 } from "three";
import { IMG_N, loss, patients, squareImage, weekData, type OptimLabState } from "@inside-tech/lab-ai";
import type { OptimFocus } from "../lab/OptimControlPanel";
import { FitCamera } from "./FitCamera";
import { Label } from "./Label";
import { StageLook } from "./StageLook";
import { C0, C1 } from "./palette";

const OK = new Color("#17895c");
const BAD = new Color("#c23b3b");
const OFF = new Color("#c9d0de");
/** Loss surface scale: x in [-10, 10], y in [-3, 3]; height compressed. */
const SX = 0.6;
const SY = 1.6;
const H = (f: number) => Math.min(4, Math.sqrt(f) * 0.9);

function Surface() {
  const geo = useMemo(() => {
    const nx = 60;
    const ny = 30;
    const pos: number[] = [];
    const col: number[] = [];
    const idx: number[] = [];
    for (let j = 0; j <= ny; j++)
      for (let i = 0; i <= nx; i++) {
        const x = -10 + (20 * i) / nx;
        const y = -3 + (6 * j) / ny;
        const h = H(loss(x, y));
        pos.push(x * SX, h, y * SY);
        const c = new Color().setHSL(0.62 - h * 0.11, 0.55, 0.28 + h * 0.08);
        col.push(c.r, c.g, c.b);
      }
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const a = j * (nx + 1) + i;
        idx.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2);
      }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute("color", new BufferAttribute(new Float32Array(col), 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial vertexColors transparent opacity={0.82} roughness={0.7} side={2} />
    </mesh>
  );
}

function OptimView({ state }: { state: OptimLabState }) {
  const last = state.optim.last;
  const pts = (last?.path ?? []).filter(([x, y]) => Math.abs(x) <= 10 && Math.abs(y) <= 3).slice(0, 160);
  return (
    <group>
      <Surface />
      {pts.map(([x, y], i) => (
        <mesh key={i} position={new Vector3(x * SX, H(loss(x, y)) + 0.08, y * SY)}>
          <sphereGeometry args={[i === pts.length - 1 ? 0.16 : 0.08, 10, 8]} />
          <meshStandardMaterial color={last?.diverged ? BAD : i === pts.length - 1 ? OK : C1} emissive={C1} emissiveIntensity={0.25} />
        </mesh>
      ))}
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.1, 16]} />
        <meshStandardMaterial color={OK} />
      </mesh>
      <Label
        text={last ? `${state.optim.opt} · lr ${state.optim.lr} · ${last.diverged ? "жарылды" : last.steps !== null ? `${last.steps} қадам` : "жетпеді"}` : "Түсуді баста"}
        position={[0, 5, 0]}
        size={0.6}
      />
    </group>
  );
}

function MetricsView({ state }: { state: OptimLabState }) {
  const data = useMemo(() => patients(), []);
  const m = state.metrics;
  const t = m.trivial ? 1.01 : m.threshold;
  const xOf = (score: number) => -7 + score * 14;
  return (
    <group>
      {data.map((p, i) => {
        const yes = !m.trivial && p.score >= m.threshold;
        const wrong = yes !== p.sick;
        return (
          <mesh key={i} position={[xOf(p.score), p.sick ? 0.9 : 0.25, p.sick ? 1.2 : ((i * 7) % 11) * 0.22 - 1.4]}>
            {p.sick ? <octahedronGeometry args={[0.32]} /> : <sphereGeometry args={[0.15, 10, 8]} />}
            <meshStandardMaterial color={p.sick ? (yes ? OK : BAD) : wrong ? C1 : OFF} emissive={wrong ? C1 : new Color("#000")} emissiveIntensity={wrong ? 0.3 : 0} />
          </mesh>
        );
      })}
      <mesh position={[xOf(Math.min(1, t)), 1, 0]}>
        <boxGeometry args={[0.08, 2, 4]} />
        <meshStandardMaterial color={C1} emissive={C1} emissiveIntensity={0.5} transparent opacity={0.65} />
      </mesh>
      <Label text={m.trivial ? "«Бәрі сау»: ешкімге дабыл жоқ" : `шек ${m.threshold.toFixed(2)}: оң жағы «науқас»`} position={[xOf(Math.min(1, t)), 2.6, 0]} size={0.5} />
      <Label text="0" position={[xOf(0), 0, 2.4]} size={0.4} />
      <Label text="1" position={[xOf(1), 0, 2.4]} size={0.4} />
      <Label text="ромб: науқас (жасыл табылды, қызыл өткізілді) · алтын: жалған дабыл" position={[0, 3.6, 0]} size={0.42} />
    </group>
  );
}

function Grid({ values, n, x, title, scale = 1 }: { values: number[]; n: number; x: number; title: string; scale?: number }) {
  const s = 0.5;
  const max = Math.max(1, ...values.map(Math.abs));
  return (
    <group position={[x, 0, 0]}>
      {values.map((v, i) => {
        const h = (Math.abs(v) / max) * 1.4 * scale + 0.05;
        return (
          <mesh key={i} position={[((i % n) - n / 2 + 0.5) * s, h / 2, (Math.floor(i / n) - n / 2 + 0.5) * s]}>
            <boxGeometry args={[s * 0.9, h, s * 0.9]} />
            <meshStandardMaterial color={v > 0 ? C1 : v < 0 ? C0 : OFF} />
          </mesh>
        );
      })}
      <Label text={title} position={[0, 2.1, -(n * s) / 2]} size={0.45} />
    </group>
  );
}

function ConvView({ state }: { state: OptimLabState }) {
  const img = useMemo(() => squareImage(), []);
  const c = state.conv;
  return (
    <group>
      <Grid values={img} n={IMG_N} x={-5} title="Кіріс 8×8" />
      <Grid values={c.kernel} n={3} x={0} title="Ядро 3×3" />
      <Grid values={c.output ?? Array(36).fill(0)} n={6} x={4.6} title={c.output ? "Нәтиже 6×6" : "Ядроны қолдан"} />
      <Label text="алтын: оң · көк: теріс" position={[0, 4, 0]} size={0.42} />
    </group>
  );
}

function DriftView({ state }: { state: OptimLabState }) {
  const d = state.drift ?? { week: 0, threshold: 93, trainedWeek: 0 };
  const data = useMemo(() => weekData(d.week), [d.week]);
  const bin = 10;
  const xOf = (amount: number) => -7 + (amount / 220) * 14;
  const bins = new Map<string, number>();
  for (const t of data) {
    const b = Math.max(0, Math.floor(t.amount / bin));
    const k = `${t.fraud ? "f" : "l"}${b}`;
    bins.set(k, (bins.get(k) ?? 0) + 1);
  }
  return (
    <group>
      {[...bins.entries()].map(([k, n]) => {
        const fraud = k.startsWith("f");
        const b = Number(k.slice(1));
        const h = n * 0.075;
        const flagged = (b + 0.5) * bin >= d.threshold;
        return (
          <mesh key={k} position={[xOf((b + 0.5) * bin), h / 2, fraud ? 0.6 : -0.3]}>
            <boxGeometry args={[(bin / 220) * 14 * 0.9, h, 0.7]} />
            <meshStandardMaterial color={fraud ? BAD : flagged ? C1 : C0} />
          </mesh>
        );
      })}
      <mesh position={[xOf(d.threshold), 1.4, 0.15]}>
        <boxGeometry args={[0.06, 2.8, 2.2]} />
        <meshStandardMaterial color={C1} emissive={C1} emissiveIntensity={0.5} transparent opacity={0.7} />
      </mesh>
      <Label text={`шек ${d.threshold}: оң жағы «күдікті»`} position={[xOf(d.threshold) + 2.2, 3.4, 0]} size={0.45} />
      <Label text={`${d.week}-апта · көк: қалыпты · қызыл: алаяқтық · алтын: жалған дабыл`} position={[0, 4.2, 0]} size={0.45} />
      {[0, 50, 100, 150, 200].map((a) => (
        <Label key={a} text={`${a}`} position={[xOf(a), -0.3, 1.4]} size={0.35} />
      ))}
    </group>
  );
}

function Contents({ state, focus }: { state: OptimLabState; focus: OptimFocus }) {
  const frames: Record<OptimFocus, { w: number; h: number; t: [number, number, number]; d: [number, number, number] }> = {
    optim: { w: 14, h: 8, t: [0, 1.4, 0], d: [0.35, 0.9, 1] },
    metrics: { w: 15, h: 5, t: [0, 0.8, 0], d: [0, 0.9, 1] },
    conv: { w: 14, h: 6, t: [0, 0.6, 0], d: [0, 1.3, 1] },
    drift: { w: 15, h: 5.5, t: [0, 1.8, 0], d: [0, 0.45, 1] },
  };
  const f = frames[focus];
  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[4, 9, 6]} intensity={1.3} />
      <gridHelper args={[24, 24, "#36427a", "#232c55"]} position={[0, -0.01, 0]} />
      <StageLook />
      {focus === "optim" && <OptimView state={state} />}
      {focus === "metrics" && <MetricsView state={state} />}
      {focus === "conv" && <ConvView state={state} />}
      {focus === "drift" && <DriftView state={state} />}
      <FitCamera width={f.w} height={f.h} target={f.t} dir={f.d} />
      <OrbitControls makeDefault enableDamping minDistance={3} maxDistance={40} maxPolarAngle={Math.PI / 2.05} />
    </>
  );
}

export default function OptimScene({ state, focus }: { state: OptimLabState; focus: OptimFocus }) {
  return (
    <Canvas camera={{ position: [0, 8, 12], fov: 45, near: 0.1, far: 200 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }} role="img" aria-label="3D көрініс: машиналық оқыту">
      <Contents state={state} focus={focus} />
    </Canvas>
  );
}
