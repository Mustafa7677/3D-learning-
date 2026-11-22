"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Color, Vector3 } from "three";
import { CIRCUITS, COLS, MEM_SIZE, ROWS, cacheTrace, evaluate, hex, toBits, toSigned, type ArchLabState } from "@inside-tech/lab-arch";
import { FitCamera } from "./FitCamera";
import { Label } from "./Label";
import { StageLook } from "./StageLook";
import { AssocView, BranchView, PipeView, TlbView } from "./ArchMiddleViews";
import { C0, C1 } from "./palette";

export type ArchFocus = "bits" | "gates" | "cpu" | "cache" | "pipe" | "branch" | "assoc" | "tlb";

const OFF = new Color("#c9d0de");
const ON = C1;
const OK = new Color("#17895c");
const BAD = new Color("#c23b3b");
const PANEL = new Color("#e8ecf4");

function Lamp({ x, z = 0, on, label, size = 0.9 }: { x: number; z?: number; on: boolean; label?: string; size?: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, size / 2, 0]}>
        <boxGeometry args={[size, size, size]} />
        <meshStandardMaterial color={on ? ON : OFF} emissive={on ? ON : new Color("#000")} emissiveIntensity={on ? 0.35 : 0} />
      </mesh>
      {label && <Label text={label} position={[0, size + 0.35, 0]} size={0.28} />}
    </group>
  );
}

const WEIGHTS = [128, 64, 32, 16, 8, 4, 2, 1];

function BitsView({ state }: { state: ArchLabState }) {
  const { value, signed, add } = state.bits;
  const bits = toBits(value);
  const x = (i: number) => -5.25 + i * 1.5;
  return (
    <group>
      {bits.map((b, i) => (
        <Lamp key={i} x={x(i)} on={b === 1} label={i === 0 && signed ? "−128" : String(WEIGHTS[i])} />
      ))}
      <Label text={`${value}${signed ? `  (таңбалы: ${toSigned(value)})` : ""}  ·  0x${hex(value)}`} position={[0, 2.4, 0]} size={0.5} />
      {add && (
        <group position={[0, 0, 2.6]}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
            const bit = 7 - i;
            return (
              <group key={i}>
                <Lamp x={x(i)} z={-0.2} size={0.5} on={((add.a >> bit) & 1) === 1} />
                <Lamp x={x(i)} z={0.6} size={0.5} on={((add.b >> bit) & 1) === 1} />
                <Lamp x={x(i)} z={1.6} size={0.6} on={add.sum[bit] === 1} />
                {add.carries[bit + 1] === 1 && <Label text="↰1" position={[x(i) - 0.75, 0.9, 0.2]} size={0.26} />}
              </group>
            );
          })}
          <Label text={`${add.a} + ${add.b} = ${add.result}${add.carryOut ? "  (C = 1: толып кетті)" : ""}`} position={[0, 1.2, 2.6]} size={0.36} />
        </group>
      )}
    </group>
  );
}

function GatesView({ state }: { state: ArchLabState }) {
  const g = state.gates;
  const c = CIRCUITS[g.circuit];
  const v = evaluate(c, g.types, g.inputs);
  const pos: Record<string, Vector3> = {};
  c.inputs.forEach((name, i) => (pos[name] = new Vector3(-4.5, 0.5, (i - (c.inputs.length - 1) / 2) * 1.8)));
  for (const gate of c.gates) pos[gate.id] = new Vector3(-4.5 + gate.at[0] * 2.6, 0.5, gate.at[1] * 1.8);
  const outs = Object.entries(c.outputs);
  outs.forEach(([name], i) => (pos[`out:${name}`] = new Vector3(-4.5 + (Math.max(...c.gates.map((x) => x.at[0])) + 1) * 2.6, 0.5, (i - (outs.length - 1) / 2) * 1.8)));
  const wire = (from: string, to: string, key: string) => {
    const a = pos[from]!;
    const b = pos[to]!;
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const len = a.distanceTo(b);
    const angle = Math.atan2(b.z - a.z, b.x - a.x);
    const on = v[from] === 1;
    return (
      <mesh key={key} position={[mid.x, 0.15, mid.z]} rotation={[0, -angle, 0]}>
        <boxGeometry args={[len, 0.07, 0.07]} />
        <meshStandardMaterial color={on ? ON : OFF} emissive={on ? ON : new Color("#000")} emissiveIntensity={on ? 0.4 : 0} />
      </mesh>
    );
  };
  return (
    <group>
      {c.gates.flatMap((gate) => [...new Set(gate.in)].map((src) => wire(src, gate.id, `${src}-${gate.id}`)))}
      {outs.map(([name, node]) => wire(node, `out:${name}`, `o-${name}`))}
      {c.inputs.map((name) => (
        <group key={name} position={pos[name]}>
          <mesh>
            <sphereGeometry args={[0.38, 20, 14]} />
            <meshStandardMaterial color={g.inputs[name] ? ON : OFF} />
          </mesh>
          <Label text={`${name} = ${g.inputs[name] ?? 0}`} position={[0, 0.75, 0]} size={0.3} />
        </group>
      ))}
      {c.gates.map((gate) => {
        const type = g.types[gate.id] ?? gate.type;
        const editable = c.editable.includes(gate.id);
        return (
          <group key={gate.id} position={pos[gate.id]}>
            <mesh>
              <boxGeometry args={[1.3, 0.7, 0.9]} />
              <meshStandardMaterial color={editable ? C0 : new Color("#56617c")} />
            </mesh>
            <Label text={`${type}${editable ? " ✎" : ""}`} position={[0, 0.75, 0]} size={0.3} />
          </group>
        );
      })}
      {outs.map(([name, node]) => (
        <group key={name} position={pos[`out:${name}`]}>
          <mesh>
            <boxGeometry args={[0.7, 0.7, 0.7]} />
            <meshStandardMaterial color={v[node] ? ON : OFF} emissive={v[node] ? ON : new Color("#000")} emissiveIntensity={v[node] ? 0.4 : 0} />
          </mesh>
          <Label text={`${name} = ${v[node]}`} position={[0, 0.75, 0]} size={0.3} />
        </group>
      ))}
    </group>
  );
}

function Block({ position, size, color, label, hot, labelSize = 0.4 }: { position: [number, number, number]; size: [number, number, number]; color: Color; label: string; hot?: boolean; labelSize?: number }) {
  return (
    <group position={position}>
      <mesh position={[0, size[1] / 2, 0]}>
        <boxGeometry args={size} />
        <meshStandardMaterial color={hot ? ON : color} emissive={hot ? ON : new Color("#000")} emissiveIntensity={hot ? 0.35 : 0} />
      </mesh>
      <Label text={label} position={[0, size[1] + 0.32, 0]} size={labelSize} />
    </group>
  );
}

function CpuView({ state }: { state: ArchLabState }) {
  const cpu = state.cpu.state;
  const program = state.cpu.program;
  const stage = cpu.stage;
  const executing = stage === "fetch" && cpu.instructions > 0; // the last stage just finished was execute
  const ir = cpu.ir !== null ? program[cpu.ir] : undefined;
  return (
    <group>
      <Block position={[-4.2, 0, -2]} size={[1.6, 0.6, 1]} color={PANEL} label={`PC = ${cpu.pc}`} hot={stage === "decode"} />
      <Block position={[-4.2, 0, 0.4]} size={[1.6, 0.6, 1]} color={PANEL} label={`IR: ${ir?.text ?? "-"}`} hot={stage === "decode" || stage === "execute"} />
      <Block position={[-1.6, 0, -1]} size={[1.6, 0.9, 1.4]} color={new Color("#7c4ddb")} label="Басқару" hot={stage === "execute"} />
      <Block position={[1, 0, -2]} size={[1.6, 0.9, 1.2]} color={C0} label={`ALU · Z=${cpu.z ? 1 : 0} C=${cpu.c ? 1 : 0}`} hot={executing && cpu.touched.regs.length > 0} />
      {cpu.regs.map((r, i) => (
        <Block key={i} position={[0.2 + i * 1.1, 0, 0.6]} size={[0.9, 0.5, 0.9]} color={PANEL} label={`R${i}=${r}`} hot={executing && cpu.touched.regs.includes(i)} />
      ))}
      {Array.from({ length: MEM_SIZE }, (_, i) => (
        <Block
          key={i}
          position={[4.6 + (i % 4) * 0.95, 0, -2.2 + Math.floor(i / 4) * 1.2]}
          size={[0.8, 0.25 + (cpu.mem[i]! / 255) * 1.2, 0.8]}
          color={OFF}
          label={`[${i}] ${cpu.mem[i]}`}
          labelSize={0.3}
          hot={executing && cpu.touched.mem.includes(i)}
        />
      ))}
      <Label text={`Шығыс: ${cpu.out.join(", ") || "-"}`} position={[0, 2.6, 2.6]} size={0.42} />
      <Label
        text={cpu.error ? `Қате: ${cpu.error}` : cpu.halted ? "HALT" : `Келесі кезең: ${stage === "fetch" ? "fetch" : stage === "decode" ? "decode" : "execute"}`}
        position={[0, 3.3, 2.6]}
        size={0.36}
      />
    </group>
  );
}

function CacheView({ state }: { state: ArchLabState }) {
  const c = state.cache;
  const trace = cacheTrace(c).slice(0, c.cursor);
  const last = trace[trace.length - 1];
  const status = new Map<string, boolean>();
  for (const a of trace) status.set(`${a.r},${a.c}`, a.hit);
  const lines: (number | null)[] = Array(c.lines).fill(null);
  for (const a of trace) lines[a.line] = Math.floor(a.addr / c.lineSize);
  const hits = trace.filter((a) => a.hit).length;
  return (
    <group>
      {Array.from({ length: ROWS }, (_, r) =>
        Array.from({ length: COLS }, (_, col) => {
          const k = `${r},${col}`;
          const isLast = last && last.r === r && last.c === col;
          const s = status.get(k);
          const color = isLast ? ON : s === undefined ? OFF : s ? OK : BAD;
          return (
            <mesh key={k} position={[-6 + col * 0.8, isLast ? 0.35 : 0.15, -3 + r * 0.8]}>
              <boxGeometry args={[0.66, isLast ? 0.7 : 0.3, 0.66]} />
              <meshStandardMaterial color={color} />
            </mesh>
          );
        }),
      )}
      <Label text="Жад: 8×8 int (жол бойымен жатыр)" position={[-3.2, 1.2, -3.9]} size={0.3} />
      {lines.map((b, i) => (
        <Block key={i} position={[3.6, 0, -3 + i * (6 / Math.max(4, c.lines))]} size={[2.6, 0.35, 0.5]} color={b === null ? OFF : C0} label={`${i}-жол: ${b === null ? "бос" : `блок ${b}`}`} hot={last?.line === i} />
      ))}
      <Label text={`Hit ${hits} · Miss ${trace.length - hits} · ${hits + (trace.length - hits) * 100} такт`} position={[0, 2.4, 3.4]} size={0.42} />
    </group>
  );
}

function Contents({ state, focus }: { state: ArchLabState; focus: ArchFocus }) {
  const frame: Record<ArchFocus, { w: number; h: number; t: [number, number, number]; d: [number, number, number] }> = {
    bits: { w: 13, h: 9, t: [0, 0.6, 1.6], d: [0, 1.4, 1] },
    gates: { w: 13, h: 8, t: [0, 0, 0], d: [0, 1.6, 1] },
    cpu: { w: 13.5, h: 7.5, t: [1.2, 0.5, 0], d: [0, 1.2, 1] },
    cache: { w: 15, h: 9, t: [-0.5, 0, 0], d: [0, 1.7, 1] },
    pipe: { w: 16, h: 7, t: [0, 0, 0], d: [0, 1.5, 1] },
    branch: { w: 14, h: 5, t: [0, 0.6, 0], d: [0, 1.1, 1] },
    assoc: { w: 14, h: 7, t: [0, 0, 0.2], d: [0, 1.5, 1] },
    tlb: { w: 14, h: 6, t: [0, 0.6, 0.3], d: [0, 1.1, 1] },
  };
  const f = frame[focus];
  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[4, 9, 6]} intensity={1.3} />
      <directionalLight position={[-6, 4, -4]} intensity={0.35} />
      <gridHelper args={[20, 20, "#36427a", "#232c55"]} position={[0, -0.01, 0]} />
      <StageLook />
      {focus === "bits" && <BitsView state={state} />}
      {focus === "gates" && <GatesView state={state} />}
      {focus === "cpu" && <CpuView state={state} />}
      {focus === "cache" && <CacheView state={state} />}
      {focus === "pipe" && <PipeView state={state} />}
      {focus === "branch" && <BranchView state={state} />}
      {focus === "assoc" && <AssocView state={state} />}
      {focus === "tlb" && <TlbView state={state} />}
      <FitCamera width={f.w} height={f.h} target={f.t} dir={f.d} />
      <OrbitControls makeDefault enableDamping minDistance={3} maxDistance={40} maxPolarAngle={Math.PI / 2.05} />
    </>
  );
}

export default function ArchScene({ state, focus }: { state: ArchLabState; focus: ArchFocus }) {
  return (
    <Canvas camera={{ position: [0, 8, 12], fov: 45, near: 0.1, far: 200 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }} role="img" aria-label="3D көрініс: компьютер архитектурасы">
      <Contents state={state} focus={focus} />
    </Canvas>
  );
}
