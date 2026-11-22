import type { AssessmentResult, SimulationPlugin } from "@inside-tech/sim-core";
import { countPresses } from "./debounce";
import { WATCHDOG_MODES, runWatchdog, type WatchdogMode, type WatchdogRun } from "./watchdog";
import { runFusion, type FusionMode, type FusionRun } from "./fusion";
import { TASKS, dec, enc, i2cRead, pwm, schedule, transferTime, uartReceive, type Bus, type PwmResult, type Schedule, type Scheduler } from "./middle-core";
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

export type IotMode = "adc" | "sampling" | "filter" | "thermo" | "pid" | "arm" | "kalman" | "mqtt" | "power" | "pwm" | "serial" | "rtos" | "fusion" | "debounce" | "watchdog";
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
  pwmRuns: { duty: number; freq: number; ripple: number }[];
  uartRuns: { tx: number; rx: number; ok: boolean }[];
  busRuns: { bus: Bus; ms: number }[];
  i2cRuns: { a: number; b: number; ok: boolean }[];
  rtosRuns: { kind: Scheduler; logger: number; controlMisses: number; loggerMisses: number; utilization: number }[];
  fusionRuns?: { mode: FusionMode; alpha: number; rms: number; finalError: number }[];
  debounceRuns?: { window: number; counted: number }[];
  watchdogRuns?: { mode: WatchdogMode; downtime: number; resets: number }[];
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
  pwm: { duty: number; freq: number; last: PwmResult | null };
  serial: { tx: number; rx: number; received: string | null; addrB: number; i2c: { ok: boolean; answered: number } | null; bus: Bus; ms: number | null };
  rtos: { kind: Scheduler; logger: number; last: Schedule | null };
  fusion?: { mode: FusionMode; alpha: number; last: FusionRun | null };
  debounce?: { window: number; counted: number | null };
  watchdog?: { mode: WatchdogMode; last: WatchdogRun | null };
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
  | { type: "power/set"; minutes?: number; radio?: Radio }
  | { type: "pwm/set"; duty?: number; freq?: number }
  | { type: "pwm/run" }
  | { type: "uart/set"; tx?: number; rx?: number }
  | { type: "uart/send" }
  | { type: "i2c/address"; addrB: number }
  | { type: "i2c/read" }
  | { type: "bus/send"; bus: Bus }
  | { type: "rtos/set"; kind?: Scheduler; logger?: number }
  | { type: "rtos/run" }
  | { type: "fusion/set"; mode?: FusionMode; alpha?: number }
  | { type: "fusion/run" }
  | { type: "debounce/set"; window: number }
  | { type: "debounce/run" }
  | { type: "watchdog/set"; mode: WatchdogMode }
  | { type: "watchdog/run" };

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
    pwm: { duty: 0.5, freq: 20, last: null },
    serial: { tx: 9600, rx: 115200, received: null, addrB: 0x76, i2c: null, bus: "uart", ms: null },
    rtos: { kind: "superloop", logger: 30, last: null },
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
      pwmRuns: [],
      uartRuns: [],
      busRuns: [],
      i2cRuns: [],
      rtosRuns: [],
      fusionRuns: [],
      debounceRuns: [],
    },
    debounce: { window: 0, counted: null },
    fusion: { mode: "gyro", alpha: 0.98, last: null },
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

    case "pwm/set": {
      const duty = a.duty !== undefined ? Math.round(Math.min(1, Math.max(0, a.duty)) * 20) / 20 : s.pwm.duty;
      const freq = a.freq !== undefined && [20, 200, 2000, 20000].includes(a.freq) ? a.freq : s.pwm.freq;
      return { ...s, mode: "pwm", pwm: { duty, freq, last: null } };
    }
    case "pwm/run": {
      const r = pwm(s.pwm.duty, s.pwm.freq);
      return { ...s, mode: "pwm", pwm: { ...s.pwm, last: r }, stats: { ...st, pwmRuns: cap([...st.pwmRuns, { duty: s.pwm.duty, freq: s.pwm.freq, ripple: r.ripple }]) } };
    }
    case "uart/set": {
      const ok = (b: number | undefined) => b !== undefined && [9600, 115200].includes(b);
      return { ...s, mode: "serial", serial: { ...s.serial, tx: ok(a.tx) ? a.tx! : s.serial.tx, rx: ok(a.rx) ? a.rx! : s.serial.rx, received: null } };
    }
    case "uart/send": {
      const r = uartReceive(enc("HELLO"), s.serial.tx, s.serial.rx);
      const text = dec(r.bytes);
      return { ...s, mode: "serial", serial: { ...s.serial, received: text }, stats: { ...st, uartRuns: cap([...st.uartRuns, { tx: s.serial.tx, rx: s.serial.rx, ok: text === "HELLO" }]) } };
    }
    case "i2c/address":
      return [0x76, 0x77].includes(a.addrB) ? { ...s, mode: "serial", serial: { ...s.serial, addrB: a.addrB, i2c: null } } : s;
    case "i2c/read": {
      const r = i2cRead(0x76, s.serial.addrB, 0x76);
      return { ...s, mode: "serial", serial: { ...s.serial, i2c: r }, stats: { ...st, i2cRuns: cap([...st.i2cRuns, { a: 0x76, b: s.serial.addrB, ok: r.ok }]) } };
    }
    case "bus/send": {
      const ms = Math.round(transferTime(a.bus, 1024) * 100000) / 100;
      return { ...s, mode: "serial", serial: { ...s.serial, bus: a.bus, ms }, stats: { ...st, busRuns: cap([...st.busRuns, { bus: a.bus, ms }]) } };
    }
    case "watchdog/set":
      return WATCHDOG_MODES.includes(a.mode) ? { ...s, mode: "watchdog", watchdog: { mode: a.mode, last: null } } : s;
    case "watchdog/run": {
      const mode = s.watchdog?.mode ?? "none";
      const r = runWatchdog(mode);
      return { ...s, mode: "watchdog", watchdog: { mode, last: r }, stats: { ...s.stats, watchdogRuns: [...(s.stats.watchdogRuns ?? []), { mode, downtime: r.downtime, resets: r.resets }].slice(-40) } };
    }
    case "debounce/set":
      return [0, 2, 10, 60].includes(a.window) ? { ...s, mode: "debounce", debounce: { window: a.window, counted: null } } : s;
    case "debounce/run": {
      const window = s.debounce?.window ?? 0;
      const r = countPresses(window);
      return { ...s, mode: "debounce", debounce: { window, counted: r.counted }, stats: { ...st, debounceRuns: cap([...(st.debounceRuns ?? []), { window, counted: r.counted }]) } };
    }
    case "fusion/set": {
      const cur = s.fusion ?? { mode: "gyro" as FusionMode, alpha: 0.98, last: null };
      const mode = a.mode && ["gyro", "accel", "complementary"].includes(a.mode) ? a.mode : cur.mode;
      const alpha = a.alpha !== undefined && [0.5, 0.9, 0.98, 0.999].includes(a.alpha) ? a.alpha : cur.alpha;
      return { ...s, mode: "fusion", fusion: { mode, alpha, last: null } };
    }
    case "fusion/run": {
      const cur = s.fusion ?? { mode: "gyro" as FusionMode, alpha: 0.98, last: null };
      const r = runFusion(cur.mode, cur.alpha);
      return { ...s, mode: "fusion", fusion: { ...cur, last: r }, stats: { ...st, fusionRuns: cap([...(st.fusionRuns ?? []), { mode: cur.mode, alpha: cur.alpha, rms: r.rms, finalError: r.finalError }]) } };
    }
    case "rtos/set": {
      const logger = a.logger !== undefined && [30, 70].includes(a.logger) ? a.logger : s.rtos.logger;
      return { ...s, mode: "rtos", rtos: { kind: a.kind ?? s.rtos.kind, logger, last: null } };
    }
    case "rtos/run": {
      const r = schedule(s.rtos.kind, TASKS(s.rtos.logger));
      const run = { kind: s.rtos.kind, logger: s.rtos.logger, controlMisses: r.misses.control!, loggerMisses: r.misses.logger!, utilization: r.utilization };
      return { ...s, mode: "rtos", rtos: { ...s.rtos, last: r }, stats: { ...st, rtosRuns: cap([...st.rtosRuns, run]) } };
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
