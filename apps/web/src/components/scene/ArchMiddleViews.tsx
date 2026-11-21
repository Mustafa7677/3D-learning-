"use client";

import { Color } from "three";
import { ASSOC_LINE, ASSOC_LINES, PIPE_PROGRAM, assocAddresses, runAssoc, type ArchLabState } from "@inside-tech/lab-arch";
import { Label } from "./Label";
import { C0, C1 } from "./palette";

const OFF = new Color("#c9d0de");
const OK = new Color("#17895c");
const BAD = new Color("#c23b3b");
const STAGE: Record<string, Color> = {
  IF: new Color("#3d5bd9"),
  ID: new Color("#6b7fe0"),
  "ID·": new Color("#c23b3b"),
  EX: new Color("#c9a24a"),
  MEM: new Color("#d98a3d"),
  WB: new Color("#17895c"),
};

export function PipeView({ state }: { state: ArchLabState }) {
  const p = state.pipe;
  const last = p.last;
  const cycles = last ? last.cycles : 0;
  const w = Math.min(0.62, 14 / Math.max(10, cycles));
  const x0 = -cycles * w * 0.5 + 1.2;
  return (
    <group>
      {(last ? last.rows : p.order.map((id) => ({ instr: PIPE_PROGRAM.find((q) => q.id === id)!, cells: {} as Record<number, string> }))).map((row, r) => (
        <group key={row.instr.id} position={[0, 0, r * 0.9 - 1.8]}>
          <Label text={row.instr.text} position={[x0 - 2.6, 0.3, 0]} size={0.48} />
          {Object.entries(row.cells).map(([c, st]) => (
            <group key={c} position={[x0 + (Number(c) - 1) * w, 0, 0]}>
              <mesh position={[0, st === "ID·" ? 0.08 : 0.22, 0]}>
                <boxGeometry args={[w * 0.92, st === "ID·" ? 0.16 : 0.44, 0.7]} />
                <meshStandardMaterial color={STAGE[st] ?? OFF} />
              </mesh>
              <Label text={st === "ID·" ? "·" : st} position={[0, 0.62, 0]} size={0.32} />
            </group>
          ))}
        </group>
      ))}
      {last && Array.from({ length: cycles }, (_, i) => <Label key={i} text={String(i + 1)} position={[x0 + i * w, 0.05, -2.6]} size={0.32} />)}
      <Label text={last ? `${last.cycles} такт · ${last.stalls} кідіріс` : "Бағдарламаны орында"} position={[1, 1.6, -2.8]} size={0.62} />
    </group>
  );
}

export function BranchView({ state }: { state: ArchLabState }) {
  const last = state.branch.last;
  if (!last) return <Label text="Болжап көр" position={[0, 1, 0]} size={0.62} />;
  const n = last.outcomes.length;
  const cols = n === 40 ? 20 : 32;
  const s = 13 / cols;
  return (
    <group>
      {last.outcomes.map((t, i) => {
        const miss = last.predictions[i] !== t;
        return (
          <group key={i} position={[(i % cols) * s - 6.5 + s / 2, 0, Math.floor(i / cols) * 1.4 - 0.7]}>
            <mesh position={[0, t ? 0.45 : 0.12, 0]}>
              <boxGeometry args={[s * 0.8, t ? 0.9 : 0.24, 0.5]} />
              <meshStandardMaterial color={miss ? BAD : t ? C1 : C0} emissive={miss ? BAD : new Color("#000")} emissiveIntensity={miss ? 0.35 : 0} />
            </mesh>
          </group>
        );
      })}
      <Label text={`${last.misses} қате / ${n} · жоғалған ${last.lost} такт`} position={[0, 2.2, -0.8]} size={0.62} />
      <Label text="биік: өтті · аласа: өтпеді · қызыл: қате болжам" position={[0, 1.55, -0.8]} size={0.48} />
    </group>
  );
}

export function AssocView({ state }: { state: ArchLabState }) {
  const c = state.assoc;
  const r = c.last ?? runAssoc([], c.ways);
  const nSets = ASSOC_LINES / c.ways;
  const span = ASSOC_LINES * ASSOC_LINE;
  const tint = (line: number) => [C0, C1, new Color("#7a4fd0")][Math.floor((line * ASSOC_LINE) / span) % 3]!;
  const trace = r.trace;
  const tw = Math.min(0.14, 13 / Math.max(1, assocAddresses(c.pattern).length));
  return (
    <group>
      {Array.from({ length: nSets }, (_, set) => (
        <group key={set} position={[-4.65 + (set % 4) * 3.1, 0, Math.floor(set / 4) * 2.2 - 1.4]} scale={1.6}>
          <Label text={`жиын ${set}`} position={[0, 0.2, -0.55]} size={0.38} />
          {Array.from({ length: c.ways }, (_, w) => {
            const line = r.sets[set]?.[w];
            return (
              <mesh key={w} position={[(w - (c.ways - 1) / 2) * 0.45, 0.25, 0]}>
                <boxGeometry args={[0.4, 0.5, 0.7]} />
                <meshStandardMaterial color={line === undefined ? OFF : tint(line)} />
              </mesh>
            );
          })}
        </group>
      ))}
      {trace.map((t, i) => (
        <mesh key={i} position={[-6.5 + i * tw + tw / 2, 0.05, 2.4]}>
          <boxGeometry args={[tw * 0.85, 0.1, 0.5]} />
          <meshStandardMaterial color={t.hit ? OK : BAD} />
        </mesh>
      ))}
      <Label text={c.last ? `${r.hits} hit · ${r.misses} miss` : "Оқуды бастау"} position={[0, 1.7, -2.4]} size={0.62} />
      <Label text="көк: a · алтын: b · күлгін: c · төменде: әр оқу (жасыл hit, қызыл miss)" position={[0, 1.15, -2.4]} size={0.42} />
    </group>
  );
}
