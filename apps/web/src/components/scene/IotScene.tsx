"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { CatmullRomCurve3, Color, Group, Quaternion, TubeGeometry, Vector3 } from "three";
import {
  ARM_TARGETS,
  BATTERY_MAH,
  MV_PER_C,
  REACH,
  REACH_TOL,
  SETPOINT,
  TARGET,
  TOPICS,
  adc,
  aliasFrequency,
  batteryDays,
  ema,
  fk,
  kalman,
  lsbVolts,
  noisySignal,
  runPid,
  thermostat,
  topicMatches,
  trueSignal,
  HEAVY,
  LIFT,
  type IotLabState,
} from "@inside-tech/lab-iot";
import { FitCamera } from "./FitCamera";
import { Label } from "./Label";
import { StageLook } from "./StageLook";
import { C0, C1 } from "./palette";

export type IotFocus = "adc" | "sampling" | "filter" | "thermo" | "pid" | "arm" | "kalman" | "mqtt" | "power";

const OFF = new Color("#c9d0de");
const OK = new Color("#17895c");
const BAD = new Color("#c23b3b");
const GREY = new Color("#8a93a8");
const up = new Vector3(0, 1, 0);

type P3 = [number, number, number];

/** A smooth tube through points: thicker and clearer than a 1-px WebGL line. */
function Curve({ pts, color, r = 0.035 }: { pts: P3[]; color: Color; r?: number }) {
  const key = pts.map((p) => `${p[0].toFixed(3)},${p[1].toFixed(3)}`).join(";");
  const geo = useMemo(
    () => (pts.length < 2 ? null : new TubeGeometry(new CatmullRomCurve3(pts.map((p) => new Vector3(...p)), false, "catmullrom", 0.1), Math.min(pts.length * 3, 900), r, 6, false)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, r],
  );
  useEffect(() => () => geo?.dispose(), [geo]);
  if (!geo) return null;
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function Bar({ a, b, color, r = 0.08 }: { a: Vector3; b: Vector3; color: Color; r?: number }) {
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const dir = b.clone().sub(a);
  return (
    <mesh position={mid} quaternion={new Quaternion().setFromUnitVectors(up, dir.clone().normalize())}>
      <cylinderGeometry args={[r, r, dir.length(), 12]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function HLine({ y, x0 = -7.5, x1 = 7.5, color = GREY, r = 0.02 }: { y: number; x0?: number; x1?: number; color?: Color; r?: number }) {
  return <Bar a={new Vector3(x0, y, 0)} b={new Vector3(x1, y, 0)} color={color} r={r} />;
}

function AdcView({ state }: { state: IotLabState }) {
  const { bits, tempC } = state.adc;
  const v = (tempC * MV_PER_C) / 1000;
  const r = adc(v, bits);
  const lsb = lsbVolts(bits);
  const step = 0.55;
  const y0 = 2.6;
  const levels = Array.from({ length: 9 }, (_, i) => r.code - 4 + i).filter((c) => c >= 0 && c < 2 ** bits);
  return (
    <group>
      {levels.map((c) => {
        const y = y0 + (c * lsb - v) * (step / lsb);
        return (
          <group key={c}>
            <mesh position={[(c - r.code) * 0.7, y / 2, 0]}>
              <boxGeometry args={[0.65, Math.max(0.02, y), 0.8]} />
              <meshStandardMaterial color={c === r.code ? C0 : OFF} />
            </mesh>
            {c === r.code && <Label text={`код ${c}`} position={[(c - r.code) * 0.7, y + 0.35, 0.5]} size={0.6} />}
          </group>
        );
      })}
      <HLine y={y0} x0={-3.4} x1={3.4} color={C1} r={0.04} />
      <Label text={`шын: ${(v * 1000).toFixed(1)} мВ = ${tempC.toFixed(2)} °C`} position={[0, y0 + 1.5, 0]} size={0.68} />
      <Label
        text={`${bits} бит · LSB = ${(lsb * 1000).toFixed(2)} мВ · оқылды ${((r.volts * 1000) / MV_PER_C).toFixed(2)} °C (қате ${((r.error * 1000) / MV_PER_C).toFixed(2)} °C)`}
        position={[0, y0 + 2.2, 0]}
        size={0.6}
      />
    </group>
  );
}

const SAMPLE_WINDOW = 0.1;

function SamplingView({ state }: { state: IotLabState }) {
  const { f, fs } = state.sampling;
  const X = (t: number) => (t / SAMPLE_WINDOW) * 15 - 7.5;
  const Y = (v: number) => 2 + v * 1.4;
  const fa = aliasFrequency(f, fs);
  const k = Math.round(f / fs);
  const sign = f - k * fs >= 0 ? 1 : -1;
  const truth: P3[] = Array.from({ length: 400 }, (_, i) => {
    const t = (i / 399) * SAMPLE_WINDOW;
    return [X(t), Y(Math.sin(2 * Math.PI * f * t)), 0];
  });
  const seen: P3[] = Array.from({ length: 200 }, (_, i) => {
    const t = (i / 199) * SAMPLE_WINDOW;
    return [X(t), Y(sign * Math.sin(2 * Math.PI * fa * t)), 0.05];
  });
  const n = Math.min(400, Math.floor(SAMPLE_WINDOW * fs) + 1);
  return (
    <group>
      <Curve pts={truth} color={GREY} r={0.025} />
      {fa !== f && <Curve pts={seen} color={BAD} r={0.045} />}
      {Array.from({ length: n }, (_, i) => {
        const t = i / fs;
        return (
          <mesh key={i} position={[X(t), Y(Math.sin(2 * Math.PI * f * t)), 0.1]}>
            <sphereGeometry args={[n > 60 ? 0.07 : 0.13, 12, 8]} />
            <meshStandardMaterial color={C1} />
          </mesh>
        );
      })}
      <Label text={`сигнал ${f} Гц · өлшеу ${fs} Гц · көрінеді: ${fa} Гц ${fa === f ? "✓" : "(алиасинг!)"}`} position={[0, 4.2, 0]} size={0.68} />
      <Label text="сұр: шын сигнал, сары: өлшемдер, қызыл: өлшемдерден «көрінетін» сигнал" position={[0, -0.2, 0]} size={0.48} />
    </group>
  );
}

function FilterView({ state }: { state: IotLabState }) {
  const raw = useMemo(() => noisySignal(), []);
  const ys = ema(raw, state.filter.alpha);
  const X = (t: number) => t * 0.1 - 7.5;
  const Y = (v: number) => (v - 17) * 0.38;
  return (
    <group>
      {raw.map((v, t) => (
        <mesh key={t} position={[X(t), Y(v), -0.1]}>
          <sphereGeometry args={[0.05, 8, 6]} />
          <meshStandardMaterial color={GREY} />
        </mesh>
      ))}
      <Curve pts={raw.map((_, t) => [X(t), Y(trueSignal(t)), 0] as P3)} color={C0} r={0.03} />
      {state.filter.ran && <Curve pts={ys.map((v, t) => [X(t), Y(v), 0.1] as P3)} color={C1} r={0.045} />}
      <Label text={`α = ${state.filter.alpha.toFixed(2)} · сұр: өлшемдер, көк: шын, сары: сүзгі`} position={[0, 7, 0]} size={0.63} />
    </group>
  );
}

function ThermoView({ state }: { state: IotLabState }) {
  const run = useMemo(() => thermostat(state.thermo.hysteresis), [state.thermo.hysteresis]);
  const X = (i: number) => i * 0.025 - 7.5;
  const Y = (t: number) => (t - 17) * 1.1;
  const runs: [number, number][] = [];
  run.heater.forEach((on, i) => {
    if (!on) return;
    const last = runs[runs.length - 1];
    if (last && last[1] === i - 1) last[1] = i;
    else runs.push([i, i]);
  });
  const h = state.thermo.hysteresis;
  return (
    <group>
      {state.thermo.ran && (
        <>
          {runs.map(([a, b]) => (
            <mesh key={a} position={[(X(a) + X(b + 1)) / 2, -0.25, 0]}>
              <boxGeometry args={[Math.max(0.012, X(b + 1) - X(a)), 0.3, 0.4]} />
              <meshStandardMaterial color={BAD} />
            </mesh>
          ))}
          <Curve pts={run.temps.filter((_, i) => i % 2 === 0).map((t, i) => [X(i * 2), Y(t), 0] as P3)} color={C0} r={0.035} />
        </>
      )}
      <HLine y={Y(SETPOINT)} color={OK} r={0.025} />
      {h > 0 && <HLine y={Y(SETPOINT + h / 2)} color={C1} r={0.015} />}
      {h > 0 && <HLine y={Y(SETPOINT - h / 2)} color={C1} r={0.015} />}
      <Label text={`21 °C ± ${(h / 2).toFixed(2)} · қызыл: қыздырғыш қосулы`} position={[0, 7, 0]} size={0.63} />
      {state.thermo.ran && <Label text={`${run.switches} қосылу · ауытқу ≤ ${run.maxDev.toFixed(2)} °C`} position={[0, 6.3, 0]} size={0.63} />}
    </group>
  );
}

function PidView({ state }: { state: IotLabState }) {
  const p = state.pid;
  const run = useMemo(() => runPid({ kp: p.kp, ki: p.ki, kd: p.kd }, p.plant === "heavy" ? HEAVY : LIFT), [p.kp, p.ki, p.kd, p.plant]);
  const X = (i: number) => i * 0.0375 - 7.5;
  const Y = (x: number) => x * 4;
  const cab = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!cab.current || !p.ran) return;
    const i = Math.floor((clock.elapsedTime * 40) % run.xs.length);
    cab.current.position.y = Y(Math.max(-0.2, Math.min(2, run.xs[i]!)));
  });
  return (
    <group>
      <mesh position={[0, Y(TARGET), -0.2]}>
        <boxGeometry args={[15, Y(0.04), 0.05]} />
        <meshStandardMaterial color={OK} transparent opacity={0.25} />
      </mesh>
      <HLine y={Y(TARGET)} color={OK} r={0.02} />
      <HLine y={0} color={GREY} r={0.02} />
      {p.ran && <Curve pts={run.xs.filter((_, i) => i % 2 === 0).map((x, i) => [X(i * 2), Y(Math.max(-0.5, Math.min(2.2, x))), 0] as P3)} color={C0} r={0.05} />}
      <group position={[9, 0, 0]}>
        <mesh position={[0, 4.5, -0.4]}>
          <boxGeometry args={[1.4, 9, 0.1]} />
          <meshStandardMaterial color={OFF} />
        </mesh>
        <group ref={cab} position={[0, 0, 0]}>
          <mesh position={[0, 0.4, 0]}>
            <boxGeometry args={[1, 0.8, 0.8]} />
            <meshStandardMaterial color={C1} />
          </mesh>
        </group>
      </group>
      <Label text={`Kp ${p.kp} · Ki ${p.ki} · Kd ${p.kd} · ${p.plant === "heavy" ? "ауыр жүк (3 кг)" : "лифт (1 кг)"}`} position={[0, 9, 0]} size={0.68} />
      {p.ran && (
        <Label
          text={`асып кету ${(run.overshoot * 100).toFixed(1)}% · орнығу ${Number.isFinite(run.settle) ? run.settle.toFixed(2) + " с" : "жоқ"} · қате ${run.ssError.toFixed(3)} м`}
          position={[0, 8.3, 0]}
          size={0.68}
        />
      )}
    </group>
  );
}

function ArmView({ state }: { state: IotLabState }) {
  const k = 1.5;
  const { elbow, tip } = fk(state.arm.t1, state.arm.t2);
  const V = (p: [number, number]) => new Vector3(p[0] * k, p[1] * k, 0);
  const target = ARM_TARGETS[state.arm.target]!;
  return (
    <group position={[0, 0.3, 0]}>
      <mesh rotation={[0, 0, 0]}>
        <torusGeometry args={[REACH * k, 0.02, 6, 120, Math.PI]} />
        <meshStandardMaterial color={OFF} />
      </mesh>
      <mesh position={[0, -0.3, 0]}>
        <cylinderGeometry args={[0.5, 0.6, 0.6, 24]} />
        <meshStandardMaterial color={GREY} />
      </mesh>
      <Bar a={V([0, 0])} b={V(elbow)} color={C0} r={0.16} />
      <Bar a={V(elbow)} b={V(tip)} color={C0} r={0.12} />
      {[[0, 0], elbow, tip].map((p, i) => (
        <mesh key={i} position={V(p as [number, number])}>
          <sphereGeometry args={[i === 2 ? 0.15 : 0.22, 16, 12]} />
          <meshStandardMaterial color={i === 2 ? C1 : GREY} />
        </mesh>
      ))}
      {ARM_TARGETS.map((t, i) => (
        <group key={i} position={V(t)}>
          <mesh>
            <sphereGeometry args={[0.12, 16, 12]} />
            <meshStandardMaterial color={i === state.arm.target ? C1 : OFF} />
          </mesh>
          {i === state.arm.target && (
            <mesh>
              <torusGeometry args={[REACH_TOL * k, 0.02, 6, 32]} />
              <meshStandardMaterial color={OK} />
            </mesh>
          )}
          <Label text={`(${t[0]}; ${t[1]})`} position={[0, 0.45, 0]} size={0.48} />
        </group>
      ))}
      <Label text={`θ₁ = ${state.arm.t1.toFixed(1)}°, θ₂ = ${state.arm.t2.toFixed(1)}° → ұш (${tip[0].toFixed(2)}; ${tip[1].toFixed(2)})`} position={[0, 6.4, 0]} size={0.63} />
      {state.arm.last && <Label text={state.arm.last} position={[0, 5.8, 0]} size={0.57} />}
    </group>
  );
}

function KalmanView({ state }: { state: IotLabState }) {
  const kq = state.kalman;
  const run = useMemo(() => kalman(kq.q, kq.r, kq.gpsNoise), [kq.q, kq.r, kq.gpsNoise]);
  const X = (i: number) => i * 0.15 - 7.5;
  const Y = (e: number) => 3 + Math.max(-6, Math.min(6, e)) * 0.45;
  const err = (xs: number[]) => xs.map((x, i) => [X(i), Y(x - run.truth[i]!), 0] as P3);
  return (
    <group>
      <HLine y={Y(0)} color={GREY} r={0.025} />
      {run.gps.map((z, i) => (
        <mesh key={i} position={[X(i), Y(z - run.truth[i]!), -0.1]}>
          <sphereGeometry args={[0.06, 8, 6]} />
          <meshStandardMaterial color={GREY} />
        </mesh>
      ))}
      <Curve pts={err(run.odo)} color={C1} r={0.04} />
      {kq.ran && <Curve pts={err(run.fused)} color={C0} r={0.05} />}
      <Label text="қате (баға − шындық): сұр: GPS, сары: одометрия, көк: Калман" position={[0, 6.4, 0]} size={0.57} />
      <Label
        text={`RMSE: GPS ${run.rmse.gps.toFixed(2)} м · одометрия ${run.rmse.odo.toFixed(2)} м${kq.ran ? ` · Калман ${run.rmse.fused.toFixed(2)} м` : ""}`}
        position={[0, 5.8, 0]}
        size={0.63}
      />
    </group>
  );
}

function MqttView({ state }: { state: IotLabState }) {
  const filter = state.mqtt.error ? "" : state.mqtt.filter;
  return (
    <group>
      <mesh position={[0, 1, 0]}>
        <sphereGeometry args={[0.7, 24, 16]} />
        <meshStandardMaterial color={C0} />
      </mesh>
      <Label text="брокер" position={[0, 2, 0]} size={0.57} />
      <mesh position={[6.5, 1, 0]}>
        <boxGeometry args={[1.2, 1, 1]} />
        <meshStandardMaterial color={C1} />
      </mesh>
      <Label text={filter ? `жазылым: ${filter}` : "жазылым жоқ"} position={[6.5, 2, 0]} size={0.54} />
      {TOPICS.map((t, i) => {
        const z = (i - (TOPICS.length - 1) / 2) * 1.3;
        const hit = filter !== "" && topicMatches(filter, t);
        const dev = new Vector3(-5.5, 0.4, z);
        return (
          <group key={t}>
            <mesh position={dev}>
              <boxGeometry args={[0.6, 0.6, 0.6]} />
              <meshStandardMaterial color={hit ? OK : OFF} />
            </mesh>
            <Label text={t} position={[-5.5, 1.05, z]} size={0.45} />
            <Bar a={dev} b={new Vector3(0, 1, 0)} color={hit ? OK : OFF} r={hit ? 0.05 : 0.02} />
            {hit && <Bar a={new Vector3(0, 1, 0)} b={new Vector3(6.5, 1, 0)} color={OK} r={0.05} />}
          </group>
        );
      })}
    </group>
  );
}

function PowerView({ state }: { state: IotLabState }) {
  const { minutes, radio } = state.power;
  const days = batteryDays(minutes, radio);
  const k = 5 / 365;
  const len = Math.min(days, 1500) * k;
  return (
    <group>
      <mesh position={[-7 + len / 2, 0.5, 0]}>
        <boxGeometry args={[Math.max(0.05, len), 1, 1]} />
        <meshStandardMaterial color={days >= 365 ? OK : BAD} />
      </mesh>
      {[1, 2, 3, 4].map((y) => (
        <group key={y}>
          <Bar a={new Vector3(-7 + 365 * y * k, 0, 0.6)} b={new Vector3(-7 + 365 * y * k, 1.6, 0.6)} color={GREY} r={0.03} />
          <Label text={`${y} жыл`} position={[-7 + 365 * y * k, 1.9, 0.6]} size={0.48} />
        </group>
      ))}
      <Label text={`${radio === "wifi" ? "Wi-Fi" : "LoRa"} · әр ${minutes} мин · ${BATTERY_MAH} мА·сағ → ${days.toFixed(0)} күн${days > 1500 ? " (шкаладан тыс)" : ""}`} position={[0, 3, 0]} size={0.68} />
    </group>
  );
}

function Contents({ state, focus }: { state: IotLabState; focus: IotFocus }) {
  const frames: Record<IotFocus, { w: number; h: number; t: P3; d: P3 }> = {
    adc: { w: 13, h: 6, t: [0, 2.6, 0], d: [0, 0.2, 1] },
    sampling: { w: 17, h: 5.5, t: [0, 2, 0], d: [0, 0.15, 1] },
    filter: { w: 17, h: 7.5, t: [0, 3.5, 0], d: [0, 0.15, 1] },
    thermo: { w: 17, h: 8.5, t: [0, 3.6, 0], d: [0, 0.15, 1] },
    pid: { w: 20, h: 10, t: [1, 4.3, 0], d: [0, 0.15, 1] },
    arm: { w: 12, h: 7.5, t: [0, 3, 0], d: [0, 0.2, 1] },
    kalman: { w: 17, h: 7, t: [0, 3.2, 0], d: [0, 0.15, 1] },
    mqtt: { w: 16, h: 10, t: [0, 0.6, 0], d: [0, 1.4, 1] },
    power: { w: 17, h: 4, t: [0, 1.4, 0], d: [0, 0.6, 1] },
  };
  const f = frames[focus];
  return (
    <>
      <ambientLight intensity={0.85} />
      <directionalLight position={[4, 9, 6]} intensity={1.2} />
      <gridHelper args={[24, 24, "#36427a", "#232c55"]} position={[0, -0.01, 0]} />
      <StageLook />
      {focus === "adc" && <AdcView state={state} />}
      {focus === "sampling" && <SamplingView state={state} />}
      {focus === "filter" && <FilterView state={state} />}
      {focus === "thermo" && <ThermoView state={state} />}
      {focus === "pid" && <PidView state={state} />}
      {focus === "arm" && <ArmView state={state} />}
      {focus === "kalman" && <KalmanView state={state} />}
      {focus === "mqtt" && <MqttView state={state} />}
      {focus === "power" && <PowerView state={state} />}
      <FitCamera width={f.w} height={f.h} target={f.t} dir={f.d} />
      <OrbitControls makeDefault enableDamping minDistance={3} maxDistance={40} maxPolarAngle={Math.PI / 2.05} />
    </>
  );
}

export default function IotScene({ state, focus }: { state: IotLabState; focus: IotFocus }) {
  return (
    <Canvas camera={{ position: [0, 8, 14], fov: 45, near: 0.1, far: 200 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }} role="img" aria-label="3D көрініс: роботтар мен IoT">
      <Contents state={state} focus={focus} />
    </Canvas>
  );
}
