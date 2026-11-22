"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";
import { Color } from "three";
import { BUDGET_MS, FRAMES, PATH_H, PATH_MAP, PATH_W, PLAYER_DISTANCE, WORLD, type GameLabState } from "@inside-tech/lab-game";
import { Label } from "./Label";
import { C0, C1 } from "./palette";

const OFF = new Color("#c9d0de");
const OK = new Color("#17895c");
const BAD = new Color("#c23b3b");
const MUD = new Color("#6b4a2b");
const WALL = new Color("#2a2f45");

export function PathView({ state }: { state: GameLabState }) {
  const r = state.mid.path;
  const order = useMemo(() => new Map((r?.expanded ?? []).map((c, k) => [c, k])), [r]);
  const onPath = useMemo(() => new Set(r?.path ?? []), [r]);
  const s = 0.8;
  return (
    <group>
      {PATH_MAP.flatMap((row, y) =>
        [...row].map((ch, x) => {
          const i = y * PATH_W + x;
          const wall = ch === "#";
          const path = onPath.has(i);
          const seen = order.has(i);
          const color = wall ? WALL : ch === "S" ? C0 : ch === "G" ? BAD : path ? C1 : ch === "~" ? MUD : seen ? new Color().setHSL(0.6, 0.35, 0.35 + 0.35 * (1 - order.get(i)! / Math.max(1, order.size))) : OFF;
          const h = wall ? 0.9 : path ? 0.35 : 0.12;
          return (
            <mesh key={i} position={[(x - PATH_W / 2 + 0.5) * s, h / 2, (y - PATH_H / 2 + 0.5) * s]}>
              <boxGeometry args={[s * 0.94, h, s * 0.94]} />
              <meshStandardMaterial color={color} emissive={path ? C1 : new Color("#000")} emissiveIntensity={path ? 0.3 : 0} />
            </mesh>
          );
        }),
      )}
      <Label text={r ? `баға ${r.cost} · ${r.expanded.length} ұяшық ашылды` : "Жолды ізде"} position={[0, 2, -(PATH_H / 2) * s - 0.4]} size={0.6} />
    </group>
  );
}

const STATE_Y = { patrol: 0, chase: 1, attack: 2 } as const;
const STATE_C = { patrol: OFF, chase: C1, attack: BAD };

export function FsmView({ state }: { state: GameLabState }) {
  const g = state.mid.guard;
  const w = 14 / PLAYER_DISTANCE.length;
  return (
    <group>
      {PLAYER_DISTANCE.map((d, t) => (
        <mesh key={`d${t}`} position={[-7 + t * w + w / 2, d * 0.15, -1.5]}>
          <boxGeometry args={[w * 0.8, Math.max(0.05, d * 0.3), 0.3]} />
          <meshStandardMaterial color={C0} />
        </mesh>
      ))}
      {[state.mid.see, state.mid.lose].map((r, k) => (
        <mesh key={k} position={[0, r * 0.3, -1.5]}>
          <boxGeometry args={[14.2, 0.03, 0.35]} />
          <meshStandardMaterial color={k === 0 ? OK : BAD} emissive={k === 0 ? OK : BAD} emissiveIntensity={0.5} />
        </mesh>
      ))}
      {g?.states.map((st, t) => (
        <mesh key={`s${t}`} position={[-7 + t * w + w / 2, 0.2 + STATE_Y[st] * 0.5, 1]}>
          <boxGeometry args={[w * 0.9, 0.4, 0.8]} />
          <meshStandardMaterial color={STATE_C[st]} />
        </mesh>
      ))}
      <Label text="көк: ойыншыға қашықтық · жасыл: көру · қызыл: жоғалту" position={[0, 4.4, -1.5]} size={0.6} />
      <Label text={g ? `${g.switches} ауысу · төменде: патруль, қуу (алтын), шабуыл (қызыл)` : "Күзетшіні іске қос"} position={[0, 2.4, 1]} size={0.45} />
    </group>
  );
}

export function BroadView({ state }: { state: GameLabState }) {
  const b = state.mid.broad;
  const k = 10 / WORLD;
  const pts = (b?.points ?? []).slice(0, 1000);
  const cell = state.mid.cell;
  const lines = cell >= 10 ? Array.from({ length: WORLD / cell + 1 }, (_, i) => i * cell) : [];
  return (
    <group>
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial color="#1c2340" />
      </mesh>
      {lines.map((v) => (
        <group key={v}>
          <mesh position={[(v - WORLD / 2) * k, 0.01, 0]}>
            <boxGeometry args={[0.03, 0.02, 10]} />
            <meshStandardMaterial color={C1} />
          </mesh>
          <mesh position={[0, 0.01, (v - WORLD / 2) * k]}>
            <boxGeometry args={[10, 0.02, 0.03]} />
            <meshStandardMaterial color={C1} />
          </mesh>
        </group>
      ))}
      {pts.map(([x, y], i) => (
        <mesh key={i} position={[(x - WORLD / 2) * k, 0.1, (y - WORLD / 2) * k]}>
          <sphereGeometry args={[Math.max(0.06, k), 8, 6]} />
          <meshStandardMaterial color={C0} />
        </mesh>
      ))}
      <Label
        text={b ? `әр жұп ${b.brute.checks.toLocaleString("ru-RU")} · тормен ${b.grid.checks.toLocaleString("ru-RU")} · соқтығыс ${b.grid.hits}` : "Соқтығыстарды ізде"}
        position={[0, 1.4, -5.6]}
        size={0.55}
      />
    </group>
  );
}

export function PoolView({ state }: { state: GameLabState }) {
  const last = state.mid.pool?.last;
  const w = 15 / FRAMES;
  const k = 0.1;
  return (
    <group>
      {last?.frames.map((ms, i) => (
        <mesh key={i} position={[-7.5 + i * w + w / 2, (ms * k) / 2, 0]}>
          <boxGeometry args={[w * 0.9, ms * k, 0.6]} />
          <meshStandardMaterial color={ms > BUDGET_MS ? BAD : C0} emissive={ms > BUDGET_MS ? BAD : new Color("#000")} emissiveIntensity={ms > BUDGET_MS ? 0.4 : 0} />
        </mesh>
      ))}
      <mesh position={[0, BUDGET_MS * k, -0.4]}>
        <boxGeometry args={[15.2, 0.04, 0.04]} />
        <meshStandardMaterial color={C1} emissive={C1} emissiveIntensity={0.5} />
      </mesh>
      <Label text="16,7 мс: 60 FPS шегі" position={[-5.5, BUDGET_MS * k + 0.35, -0.4]} size={0.42} />
      <Label text={last ? `${last.janky} кадр қатты · ең баяуы ${last.worst} мс` : "300 кадр ойна"} position={[0, 4.6, 0]} size={0.6} />
    </group>
  );
}

function Platform({ trace, fps }: { trace: number[]; fps: number }) {
  const ref = useRef<Mesh>(null);
  const t0 = useRef(0);
  useFrame((_, dt) => {
    t0.current += dt;
    const i = Math.floor(t0.current * fps) % Math.max(1, trace.length);
    const x = Math.max(-2.5, Math.min(2.5, trace[i] ?? 1));
    if (ref.current) ref.current.position.y = 3 + x;
  });
  return (
    <group position={[-6.5, 0, 0]}>
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 3, 8]} />
        <meshStandardMaterial color={OFF} />
      </mesh>
      <mesh ref={ref} position={[0, 4, 0]}>
        <boxGeometry args={[1.6, 0.3, 1.2]} />
        <meshStandardMaterial color={C1} />
      </mesh>
    </group>
  );
}

export function TimestepView({ state }: { state: GameLabState }) {
  const t = state.mid.timestep;
  const last = t?.last;
  const n = last?.trace.length ?? 0;
  const w = 11 / Math.max(1, n);
  return (
    <group>
      {last && <Platform trace={last.trace} fps={t!.fps} />}
      {last?.trace.map((x, i) => {
        const over = Math.abs(x) > 2.5;
        const y = 3 + Math.max(-2.5, Math.min(2.5, x));
        return (
          <mesh key={i} position={[-4.5 + i * w + w / 2, y, 0]}>
            <boxGeometry args={[Math.max(0.03, w * 0.9), 0.12, 0.3]} />
            <meshStandardMaterial color={over ? BAD : C0} />
          </mesh>
        );
      })}
      <mesh position={[1, 3, -0.3]}>
        <boxGeometry args={[11.2, 0.02, 0.02]} />
        <meshStandardMaterial color={OFF} />
      </mesh>
      <Label text={last ? `амплитуда ${last.amplitude >= 1000 ? Math.round(last.amplitude).toLocaleString("ru-RU") : last.amplitude} · ${last.steps} физика қадамы` : "3 секунд ойнат"} position={[1, 6.4, 0]} size={0.55} />
      <Label text="қызыл: шектен шықты (±2,5)" position={[1, -0.1, 0.6]} size={0.4} />
    </group>
  );
}
