"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Color } from "three";
import { assign, loads, type DbLabState } from "@inside-tech/lab-db";
import { FitCamera } from "./FitCamera";
import { Label } from "./Label";
import { C0, C1 } from "./palette";

export type DbFocus = "sql" | "race" | "shard";

const OFF = new Color("#c9d0de");
const OK = new Color("#17895c");
const BAD = new Color("#c23b3b");

function Tables({ state }: { state: DbLabState }) {
  const db = state.sql.session.db;
  const plan = state.sql.last?.plan ?? [];
  const names = Object.keys(db);
  return (
    <group>
      {names.map((name, i) => {
        const t = db[name]!;
        const h = 0.3 + Math.log10(t.rows.length + 1) * 1.1;
        const p = plan.find((x) => x.table === name);
        const color = p ? (p.access === "index" ? OK : BAD) : OFF;
        const x = -6 + i * 3;
        return (
          <group key={name} position={[x, 0, 0]}>
            <mesh position={[0, h / 2, 0]}>
              <boxGeometry args={[2.2, h, 1.6]} />
              <meshStandardMaterial color={color} transparent opacity={0.8} />
            </mesh>
            <Label text={`${name} · ${t.rows.length}`} position={[0, h + 0.4, 0]} size={0.32} />
            {p && <Label text={p.access === "index" ? `индекс (${p.column}) · ${p.rows}` : `сканерлеу · ${p.rows}`} position={[0, h + 0.95, 0]} size={0.28} />}
            {t.indexes.length > 0 && <Label text={`🔑 ${t.indexes.join(", ")}`} position={[0, 0.3, 1.1]} size={0.24} />}
          </group>
        );
      })}
      <group position={[0, 0, 4]}>
        {db.accounts!.rows.map((r, i) => {
          const h = Math.max(0.05, Number(r.balance) / 400);
          return (
            <group key={String(r.id)} position={[-2 + i * 2, 0, 0]}>
              <mesh position={[0, h / 2, 0]}>
                <boxGeometry args={[1, h, 1]} />
                <meshStandardMaterial color={C0} />
              </mesh>
              <Label text={`${r.owner}: ${r.balance}`} position={[0, h + 0.35, 0]} size={0.3} />
            </group>
          );
        })}
        <Label
          text={`Шоттар · жалпы ${db.accounts!.rows.reduce((t, r) => t + Number(r.balance), 0)}${state.sql.session.snapshot ? " · транзакция ашық" : ""}`}
          position={[0, 3.4, 0]}
          size={0.34}
        />
      </group>
      {state.sql.last && (
        <Label
          text={state.sql.last.ok ? `${state.sql.last.rows.length} жол · ${state.sql.last.examined} жол қаралды` : `Қате: ${state.sql.last.error}`}
          position={[0, 4.2, -1.5]}
          size={0.38}
        />
      )}
    </group>
  );
}

function RaceView({ state }: { state: DbLabState }) {
  const r = state.race;
  const h = r.balance / 200;
  return (
    <group>
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[1.6, h, 1.6]} />
        <meshStandardMaterial color={r.done.A && r.done.B ? (r.balance === r.initial + 200 ? OK : BAD) : C0} />
      </mesh>
      <Label text={`balance = ${r.balance}${r.lock ? ` 🔒 ${r.lock}` : ""}`} position={[0, h + 0.5, 0]} size={0.42} />
      {(["A", "B"] as const).map((c, i) => (
        <group key={c} position={[i === 0 ? -4 : 4, 0, 0]}>
          <mesh position={[0, 0.6, 0]}>
            <sphereGeometry args={[0.6, 24, 16]} />
            <meshStandardMaterial color={r.done[c] ? OK : r.seen[c] !== null ? C1 : OFF} />
          </mesh>
          <Label text={`${c}: ${r.done[c] ? "жазды" : r.seen[c] !== null ? `оқыды ${r.seen[c]}` : "күтуде"}`} position={[0, 1.7, 0]} size={0.34} />
        </group>
      ))}
    </group>
  );
}

function ShardView({ state }: { state: DbLabState }) {
  const { method, n } = state.shard;
  const l = loads(assign(method, n), n);
  return (
    <group>
      {l.map((v, i) => {
        const h = v / 60;
        return (
          <group key={i} position={[(i - (n - 1) / 2) * 1.8, 0, 0]}>
            <mesh position={[0, h / 2, 0]}>
              <boxGeometry args={[1.2, h, 1.2]} />
              <meshStandardMaterial color={C0} />
            </mesh>
            <Label text={`шард ${i}: ${v}`} position={[0, h + 0.4, 0]} size={0.3} />
          </group>
        );
      })}
      <Label text={method === "mod" ? "hash(key) mod N" : "consistent hashing"} position={[0, 6.2, 0]} size={0.4} />
    </group>
  );
}

function Contents({ state, focus }: { state: DbLabState; focus: DbFocus }) {
  const f = focus === "sql" ? { w: 16, h: 10, t: [0, 1.5, 1.5] as [number, number, number] } : focus === "race" ? { w: 11, h: 6, t: [0, 1.5, 0] as [number, number, number] } : { w: 15, h: 8, t: [0, 3, 0] as [number, number, number] };
  return (
    <>
      <ambientLight intensity={0.85} />
      <directionalLight position={[4, 9, 6]} intensity={1.2} />
      <gridHelper args={[24, 24, "#c3cad8", "#e1e6ef"]} position={[0, -0.01, 0]} />
      {focus === "sql" && <Tables state={state} />}
      {focus === "race" && <RaceView state={state} />}
      {focus === "shard" && <ShardView state={state} />}
      <FitCamera width={f.w} height={f.h} target={f.t} dir={[0, 0.9, 1]} />
      <OrbitControls makeDefault enableDamping minDistance={3} maxDistance={40} maxPolarAngle={Math.PI / 2.05} />
    </>
  );
}

export default function DbScene({ state, focus }: { state: DbLabState; focus: DbFocus }) {
  return (
    <Canvas camera={{ position: [0, 8, 14], fov: 45, near: 0.1, far: 200 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }} role="img" aria-label="3D көрініс: дерекқор">
      <Contents state={state} focus={focus} />
    </Canvas>
  );
}
