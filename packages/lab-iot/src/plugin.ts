import type { AssessmentResult, SimulationPlugin } from "@inside-tech/sim-core";
import {
  HEAVY,
  LIFT,
  TOPICS,
  adc,
  aliasFrequency,
  batteryDays,
  dist,
  filterMetrics,
  fk,
  ik,
  kalman,
  resolutionC,
  runPid,
  thermostat,
  topicMatches,
  validFilter,
  MV_PER_C,
  type Radio,
} from "./core";

export type IotMode = "adc" | "sampling" | "filter" | "thermo" | "pid" | "arm" | "kalman" | "mqtt" | "power";
export type PlantId = "lift" | "heavy";

/** Targets for the arm; the last one is out of reach. */
export const ARM_TARGETS: [number, number][] = [
  [2.5, 1.5],
  [-1, 2.5],
  [4, 2],
];
export const REACH_TOL = 0.1;

export interface IotStats {
  modes: IotMode[];
  adcReads: { bits: number; tempC: number; errorC: number; resolution: number }[];
  samplings: { f: number; fs: number; alias: number }[];
  filterRuns: { alpha: number; noise: number; lag: number }[];
  thermoRuns: { hysteresis: number; switches: number; maxDev: number }[];
  pidRuns: { kp: number; ki: number; kd: number; plant: PlantId; overshoot: number; settle: number; ssError: number }[];
  armReaches: { target: number; by: "fk" | "ik"; elbow?: "up" | "down" }[];
  unreachable: number[];
  kalmanRuns: { q: number; r: number; gpsNoise: number; odo: number; gps: number; fused: number }[];
  subscriptions: { filter: string; matches: string[] }[];
  powerChecks: { minutes: number; radio: Radio; days: number }[];
}

export interface IotLabState {
  mode: IotMode;
  adc: { bits: number; tempC: number };
  sampling: { f: number; fs: number };
  filter: { alpha: number; ran: boolean };
  thermo: { hysteresis: number; ran: boolean };
  pid: { kp: number; ki: number; kd: number; plant: PlantId; ran: boolean };
  arm: { t1: number; t2: number; target: number; last: string | null };
  kalman: { q: number; r: number; gpsNoise: number; ran: boolean };
  mqtt: { filter: string; error: string | null };
  power: { minutes: number; radio: Radio };
  stats: IotStats;
}

export type IotLabAction =
  | { type: "mode/set"; mode: IotMode }
  | { type: "adc/set"; bits?: number; tempC?: number }
  | { type: "adc/read" }
  | { type: "sampling/set"; f?: number; fs?: number; record?: boolean }
  | { type: "filter/set"; alpha: number }
  | { type: "filter/run" }
  | { type: "thermo/set"; hysteresis: number }
  | { type: "thermo/run" }
  | { type: "pid/set"; kp?: number; ki?: number; kd?: number; plant?: PlantId }
  | { type: "pid/run" }
  | { type: "arm/set"; t1?: number; t2?: number }
  | { type: "arm/target"; target: number }
  | { type: "arm/ik"; elbow: "up" | "down" }
  | { type: "kalman/set"; q?: number; r?: number; gpsNoise?: number }
  | { type: "kalman/run" }
  | { type: "mqtt/subscribe"; filter: string }
  | { type: "power/set"; minutes?: number; radio?: Radio };

const uniq = <T>(xs: T[], x: T) => (xs.includes(x) ? xs : [...xs, x]);
const cap = <T>(xs: T[], n = 40) => xs.slice(-n);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round = (v: number, step: number) => Math.round(v / step) * step;

export function initialIotState(): IotLabState {
  return {
    mode: "adc",
    adc: { bits: 8, tempC: 23.47 },
    sampling: { f: 50, fs: 60 },
    filter: { alpha: 1, ran: false },
    thermo: { hysteresis: 0, ran: false },
    pid: { kp: 5, ki: 0, kd: 0, plant: "lift", ran: false },
    arm: { t1: 30, t2: 60, target: 0, last: null },
    kalman: { q: 0.05, r: 9, gpsNoise: 3, ran: false },
    mqtt: { filter: "", error: null },
    power: { minutes: 1, radio: "wifi" },
    stats: {
      modes: ["adc"],
      adcReads: [],
      samplings: [],
      filterRuns: [],
      thermoRuns: [],
      pidRuns: [],
      armReaches: [],
      unreachable: [],
      kalmanRuns: [],
      subscriptions: [],
      powerChecks: [],
    },
  };
}

function armReach(s: IotLabState, by: "fk" | "ik", elbow?: "up" | "down"): IotLabState {
  const target = ARM_TARGETS[s.arm.target]!;
  const tip = fk(s.arm.t1, s.arm.t2).tip;
  if (dist(tip, target) > REACH_TOL) return s;
  return { ...s, stats: { ...s.stats, armReaches: cap([...s.stats.armReaches, { target: s.arm.target, by, ...(elbow ? { elbow } : {}) }]) } };
}

function reduce(s: IotLabState, a: IotLabAction): IotLabState {
  const st = s.stats;
  switch (a.type) {
    case "mode/set":
      return { ...s, mode: a.mode, stats: { ...st, modes: uniq(st.modes, a.mode) } };

    case "adc/set":
      return { ...s, adc: { bits: Math.round(clamp(a.bits ?? s.adc.bits, 4, 16)), tempC: clamp(a.tempC ?? s.adc.tempC, 0, 100) } };
    case "adc/read": {
      const r = adc((s.adc.tempC * MV_PER_C) / 1000, s.adc.bits);
      const read = { bits: s.adc.bits, tempC: s.adc.tempC, errorC: (r.error * 1000) / MV_PER_C, resolution: resolutionC(s.adc.bits) };
      return { ...s, stats: { ...st, adcReads: cap([...st.adcReads, read]) } };
    }

    case "sampling/set": {
      const sampling = { f: Math.round(clamp(a.f ?? s.sampling.f, 1, 500)), fs: Math.round(clamp(a.fs ?? s.sampling.fs, 1, 1000)) };
      const next = { ...s, sampling };
      if (a.record === false) return next;
      return { ...next, stats: { ...st, samplings: cap([...st.samplings, { ...sampling, alias: aliasFrequency(sampling.f, sampling.fs) }]) } };
    }

    case "filter/set":
      return { ...s, filter: { alpha: round(clamp(a.alpha, 0.01, 1), 0.01), ran: false } };
    case "filter/run": {
      const m = filterMetrics(s.filter.alpha);
      return { ...s, filter: { ...s.filter, ran: true }, stats: { ...st, filterRuns: cap([...st.filterRuns, { alpha: s.filter.alpha, ...m }]) } };
    }

    case "thermo/set":
      return { ...s, thermo: { hysteresis: round(clamp(a.hysteresis, 0, 4), 0.1), ran: false } };
    case "thermo/run": {
      const r = thermostat(s.thermo.hysteresis);
      return { ...s, thermo: { ...s.thermo, ran: true }, stats: { ...st, thermoRuns: cap([...st.thermoRuns, { hysteresis: s.thermo.hysteresis, switches: r.switches, maxDev: r.maxDev }]) } };
    }

    case "pid/set": {
      const p = s.pid;
      return {
        ...s,
        pid: { kp: round(clamp(a.kp ?? p.kp, 0, 50), 0.5), ki: round(clamp(a.ki ?? p.ki, 0, 30), 0.5), kd: round(clamp(a.kd ?? p.kd, 0, 20), 0.5), plant: a.plant ?? p.plant, ran: false },
      };
    }
    case "pid/run": {
      const { kp, ki, kd, plant } = s.pid;
      const r = runPid({ kp, ki, kd }, plant === "heavy" ? HEAVY : LIFT);
      return { ...s, pid: { ...s.pid, ran: true }, stats: { ...st, pidRuns: cap([...st.pidRuns, { kp, ki, kd, plant, overshoot: r.overshoot, settle: r.settle, ssError: r.ssError }]) } };
    }

    case "arm/set": {
      const next = { ...s, arm: { ...s.arm, t1: round(clamp(a.t1 ?? s.arm.t1, -180, 180), 1), t2: round(clamp(a.t2 ?? s.arm.t2, -170, 170), 1), last: null } };
      return armReach(next, "fk");
    }
    case "arm/target":
      return { ...s, arm: { ...s.arm, target: Math.round(clamp(a.target, 0, ARM_TARGETS.length - 1)), last: null } };
    case "arm/ik": {
      const [x, y] = ARM_TARGETS[s.arm.target]!;
      const sol = ik(x, y, a.elbow);
      if (!sol) return { ...s, arm: { ...s.arm, last: "Жету мүмкін емес: нүкте қол ұзындығынан алыс" }, stats: { ...st, unreachable: uniq(st.unreachable, s.arm.target) } };
      const next = { ...s, arm: { ...s.arm, t1: sol.t1, t2: sol.t2, last: `θ₁ = ${sol.t1.toFixed(1)}°, θ₂ = ${sol.t2.toFixed(1)}°` } };
      return armReach(next, "ik", a.elbow);
    }

    case "kalman/set": {
      const k = s.kalman;
      return { ...s, kalman: { q: clamp(a.q ?? k.q, 0.001, 100), r: clamp(a.r ?? k.r, 0.01, 1000), gpsNoise: clamp(a.gpsNoise ?? k.gpsNoise, 0.5, 20), ran: false } };
    }
    case "kalman/run": {
      const { q, r, gpsNoise } = s.kalman;
      const run = kalman(q, r, gpsNoise);
      return { ...s, kalman: { ...s.kalman, ran: true }, stats: { ...st, kalmanRuns: cap([...st.kalmanRuns, { q, r, gpsNoise, ...run.rmse }]) } };
    }

    case "mqtt/subscribe": {
      const filter = a.filter.trim().slice(0, 80);
      if (!validFilter(filter)) return { ...s, mqtt: { filter, error: "Қате сүзгі: «#» тек соңғы деңгейде, «+» тұтас деңгей болуы керек" } };
      const matches = TOPICS.filter((t) => topicMatches(filter, t));
      return { ...s, mqtt: { filter, error: null }, stats: { ...st, subscriptions: cap([...st.subscriptions, { filter, matches }]) } };
    }

    case "power/set": {
      const power = { minutes: a.minutes ?? s.power.minutes, radio: a.radio ?? s.power.radio };
      return { ...s, power, stats: { ...st, powerChecks: cap([...st.powerChecks, { ...power, days: batteryDays(power.minutes, power.radio) }]) } };
    }
  }
}

export const iotLabPlugin: SimulationPlugin<IotLabState, IotLabAction> = {
  id: "iot-lab",
  version: "1.0.0",
  initialize: () => initialIotState(),
  dispatch: reduce,
  step: (s) => s,
  snapshot: (s) => structuredClone(s),
  restore: (snap) => structuredClone(snap as IotLabState),
  evaluate: (s): AssessmentResult => ({ score: 0, metrics: { bits: s.adc.bits, fs: s.sampling.fs }, notes: [] }),
};
