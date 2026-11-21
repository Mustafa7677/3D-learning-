"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, type Mesh } from "three";
import { HORIZON, type IotLabState } from "@inside-tech/lab-iot";
import { Label } from "./Label";
import { C0, C1 } from "./palette";

const OFF = new Color("#c9d0de");
const OK = new Color("#17895c");
const BAD = new Color("#c23b3b");

function Rotor({ speed }: { speed: number }) {
  const ref = useRef<Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.z -= dt * speed * 12;
  });
  return (
    <group position={[5, 1.4, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1, 1, 1.6, 24]} />
        <meshStandardMaterial color={C0} metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh ref={ref} position={[0, 0, 0.9]}>
        <boxGeometry args={[2.4, 0.25, 0.1]} />
        <meshStandardMaterial color={C1} />
      </mesh>
      <Label text="мотор" position={[0, 1.6, 0]} size={0.5} />
    </group>
  );
}

export function PwmView({ state }: { state: IotLabState }) {
  const p = state.pwm;
  const last = p.last;
  const w = 9 / 40;
  return (
    <group>
      {Array.from({ length: 40 }, (_, k) => {
        const on = (k % 20) / 20 < p.duty;
        return (
          <mesh key={`v${k}`} position={[-7 + k * w + w / 2, on ? 0.6 : 0.03, -1.2]}>
            <boxGeometry args={[w * 0.95, on ? 1.2 : 0.06, 0.3]} />
            <meshStandardMaterial color={on ? C1 : OFF} />
          </mesh>
        );
      })}
      {last?.wave.map((v, k) => (
        <mesh key={`s${k}`} position={[-7 + k * w + w / 2, v * 1.2 + 0.05, 0.6]}>
          <boxGeometry args={[w * 0.95, 0.12, 0.3]} />
          <meshStandardMaterial color={last.ripple > 0.1 ? BAD : OK} />
        </mesh>
      ))}
      <Label text={`пин: 0 / ${12} В`} position={[-2.5, 2, -1.2]} size={0.45} />
      <Label text={last ? `мотор жылдамдығы · ырғақ ${(last.ripple * 100).toFixed(1)}%` : "Моторды іске қос"} position={[-2.5, 2, 0.6]} size={0.45} />
      <Rotor speed={last ? p.duty : 0} />
    </group>
  );
}

export function SerialView({ state }: { state: IotLabState }) {
  const s = state.serial;
  const devices: [string, number, boolean][] = [
    ["датчик A · 0x76", -3, true],
    [`датчик B · 0x${s.addrB.toString(16)}`, 3, s.addrB === 0x76],
  ];
  return (
    <group>
      <mesh position={[0, 0.4, 2.4]}>
        <boxGeometry args={[3, 0.6, 1.6]} />
        <meshStandardMaterial color={C0} metalness={0.3} roughness={0.5} />
      </mesh>
      <Label text="микроконтроллер" position={[0, 1.2, 2.4]} size={0.5} />
      {[0, 0.35].map((z, k) => (
        <mesh key={k} position={[0, 0.08, z - 0.6]}>
          <boxGeometry args={[9, 0.05, 0.08]} />
          <meshStandardMaterial color={k === 0 ? C1 : OK} />
        </mesh>
      ))}
      <Label text="SDA · SCL" position={[-4.2, 0.5, -0.4]} size={0.35} />
      {devices.map(([name, x, answers]) => {
        const clash = s.i2c && !s.i2c.ok && answers;
        return (
          <group key={name} position={[x, 0, -2]}>
            <mesh position={[0, 0.35, 0]}>
              <boxGeometry args={[1.6, 0.5, 1]} />
              <meshStandardMaterial color={clash ? BAD : s.i2c?.ok && answers ? OK : OFF} />
            </mesh>
            <Label text={name} position={[0, 1, 0]} size={0.42} />
          </group>
        );
      })}
      {s.received !== null && <Label text={`UART: «${s.received.slice(0, 16)}»`} position={[0, 2.4, 2.4]} size={0.5} />}
      {s.ms !== null && <Label text={`1 КБ · ${s.bus.toUpperCase()} · ${s.ms} мс`} position={[0, 3.1, 2.4]} size={0.5} />}
    </group>
  );
}

const TASK_C: Record<string, Color> = { control: BAD, sensor: C1, logger: C0 };

export function RtosView({ state }: { state: IotLabState }) {
  const r = state.rtos.last;
  const w = 15 / HORIZON;
  const rows = ["control", "sensor", "logger"];
  const names: Record<string, string> = { control: "басқару", sensor: "датчик", logger: "лог" };
  return (
    <group>
      {rows.map((id, k) => (
        <group key={id} position={[0, 0, k * 1.3 - 1.3]}>
          <Label text={names[id]!} position={[-8.6, 0.3, 0]} size={0.6} />
          {r?.timeline.map((run, t) =>
            run === id ? (
              <mesh key={t} position={[-7.5 + t * w + w / 2, 0.25, 0]}>
                <boxGeometry args={[w, 0.5, 0.8]} />
                <meshStandardMaterial color={TASK_C[id]} />
              </mesh>
            ) : null,
          )}
        </group>
      ))}
      {Array.from({ length: HORIZON / 10 + 1 }, (_, i) => (
        <mesh key={i} position={[-7.5 + i * 10 * w, 0.02, 0]}>
          <boxGeometry args={[0.02, 0.02, 3.4]} />
          <meshStandardMaterial color={i % 10 === 0 ? C1 : OFF} />
        </mesh>
      ))}
      <Label
        text={r ? `басқару өткізді: ${r.misses.control} · жүктеме ${Math.round(r.utilization * 100)}%` : "Жоспарлауды іске қос"}
        position={[0, 1.6, -1.8]}
        size={0.6}
      />
      <Label text="сызықтар: әр 10 мс, басқарудың мерзімдері" position={[0, 1.05, -1.8]} size={0.5} />
    </group>
  );
}
