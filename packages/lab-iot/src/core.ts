/** Robotics & IoT: the physics and signal processing behind the lab, all deterministic. */

/** A small seeded PRNG (LCG) so every run of a lesson sees the same noise. */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** Standard normal samples (Box-Muller) from a seeded PRNG. */
export function gauss(seed: number): () => number {
  const r = rng(seed);
  return () => {
    const u = Math.max(r(), 1e-12);
    const v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
}

// ---------------- ADC ----------------

export const VREF = 3.3;
/** LM35-style temperature sensor: 10 mV per °C. */
export const MV_PER_C = 10;

export const lsbVolts = (bits: number) => VREF / 2 ** bits;
/** Temperature resolution of an n-bit ADC reading the sensor, °C. */
export const resolutionC = (bits: number) => (lsbVolts(bits) * 1000) / MV_PER_C;

export function adc(volts: number, bits: number): { code: number; volts: number; error: number } {
  const max = 2 ** bits - 1;
  const code = Math.max(0, Math.min(max, Math.floor(volts / lsbVolts(bits))));
  const back = code * lsbVolts(bits);
  return { code, volts: back, error: volts - back };
}

/** Smallest bit count whose temperature resolution is at most `c` °C. */
export const minBitsFor = (c: number) => {
  for (let b = 1; b <= 24; b++) if (resolutionC(b) <= c) return b;
  return 24;
};

// ---------------- sampling ----------------

/** The frequency you see after sampling a sine of `f` Hz at `fs` Hz. */
export function aliasFrequency(f: number, fs: number): number {
  const k = Math.round(f / fs);
  return Math.abs(f - k * fs);
}

// ---------------- filtering ----------------

export const FILTER_N = 150;
export const STEP_AT = 50;
export const NOISE = 1.2;

/** The true signal: 20 until STEP_AT, then 30. */
export const trueSignal = (t: number) => (t < STEP_AT ? 20 : 30);

export function noisySignal(seed = 7): number[] {
  const g = gauss(seed);
  return Array.from({ length: FILTER_N }, (_, t) => trueSignal(t) + NOISE * g());
}

/** Exponential moving average: y ← y + α(x − y). */
export function ema(xs: number[], alpha: number): number[] {
  const out: number[] = [];
  let y = xs[0] ?? 0;
  for (const x of xs) {
    y = y + alpha * (x - y);
    out.push(y);
  }
  return out;
}

export function filterMetrics(alpha: number, seed = 7): { noise: number; lag: number } {
  const ys = ema(noisySignal(seed), alpha);
  const tail = ys.slice(100).map((y, i) => y - trueSignal(100 + i));
  const noise = Math.sqrt(tail.reduce((t, e) => t + e * e, 0) / tail.length);
  // Lag: steps after the step until the output first reaches 90% of the jump.
  let lag = FILTER_N - STEP_AT;
  for (let t = STEP_AT; t < FILTER_N; t++)
    if (ys[t]! >= 29) {
      lag = t - STEP_AT;
      break;
    }
  return { noise, lag };
}

// ---------------- bang-bang thermostat ----------------

export const SETPOINT = 21;
export const THERMO_STEPS = 600;

export interface ThermoRun {
  temps: number[];
  heater: boolean[];
  switches: number;
  maxDev: number;
}

/**
 * A room heated by an on/off heater, one step = 10 s. The sensor is noisy (±0.25 °C), so
 * without hysteresis the controller chatters on noise.
 */
export function thermostat(hysteresis: number, seed = 3): ThermoRun {
  const g = gauss(seed);
  let t = 18;
  let on = false;
  let switches = 0;
  let maxDev = 0;
  const temps: number[] = [];
  const heater: boolean[] = [];
  for (let i = 0; i < THERMO_STEPS; i++) {
    const reading = t + 0.25 * g();
    const want: boolean = hysteresis <= 0 ? reading < SETPOINT : on ? reading < SETPOINT + hysteresis / 2 : reading < SETPOINT - hysteresis / 2;
    if (want !== on) {
      switches++;
      on = want;
    }
    t += (on ? 0.3 : 0) - 0.01 * (t - 5);
    temps.push(t);
    heater.push(on);
    if (i >= 150) maxDev = Math.max(maxDev, Math.abs(t - SETPOINT));
  }
  return { temps, heater, switches, maxDev };
}

// ---------------- PID ----------------

export interface Gains {
  kp: number;
  ki: number;
  kd: number;
}

export interface Plant {
  /** Mass, kg. */
  m: number;
  /** Damping, N·s/m. */
  c: number;
  /** Constant load (gravity on a lift), N. */
  load: number;
  /** Actuator limit, N. */
  umax: number;
}

export const LIFT: Plant = { m: 1, c: 0.5, load: 2, umax: 12 };
export const HEAVY: Plant = { m: 3, c: 0.5, load: 6, umax: 20 };
export const PID_DT = 0.05;
export const PID_STEPS = 400;
export const TARGET = 1;

export interface PidRun {
  xs: number[];
  overshoot: number;
  settle: number;
  ssError: number;
}

/** Drive a lift from 0 to TARGET with a PID controller; 20 s at 20 Hz. */
export function runPid(g: Gains, plant: Plant = LIFT): PidRun {
  let x = 0;
  let v = 0;
  let integral = 0;
  let prevErr = TARGET;
  const xs: number[] = [];
  for (let i = 0; i < PID_STEPS; i++) {
    const err = TARGET - x;
    const deriv = (err - prevErr) / PID_DT;
    prevErr = err;
    const raw = g.kp * err + g.ki * (integral + err * PID_DT) + g.kd * deriv;
    const u = Math.max(-plant.umax, Math.min(plant.umax, raw));
    // Anti-windup: only integrate while the actuator is not saturated.
    if (u === raw) integral += err * PID_DT;
    const a = (u - plant.c * v - plant.load) / plant.m;
    v += a * PID_DT;
    x += v * PID_DT;
    xs.push(x);
  }
  const peak = Math.max(...xs);
  const overshoot = Math.max(0, (peak - TARGET) / TARGET);
  let lastOut = -1;
  xs.forEach((y, i) => {
    if (Math.abs(y - TARGET) > 0.02 * TARGET) lastOut = i;
  });
  const settle = lastOut + 1 >= xs.length ? Infinity : (lastOut + 1) * PID_DT;
  const tail = xs.slice(-40);
  const ssError = Math.abs(TARGET - tail.reduce((t, y) => t + y, 0) / tail.length);
  return { xs, overshoot, settle, ssError };
}

// ---------------- two-link arm ----------------

export const L1 = 2;
export const L2 = 1.5;
export const REACH = L1 + L2;

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Forward kinematics: joint angles (degrees) → end-effector position. */
export function fk(t1: number, t2: number): { elbow: [number, number]; tip: [number, number] } {
  const ex = L1 * Math.cos(rad(t1));
  const ey = L1 * Math.sin(rad(t1));
  return { elbow: [ex, ey], tip: [ex + L2 * Math.cos(rad(t1 + t2)), ey + L2 * Math.sin(rad(t1 + t2))] };
}

/** Inverse kinematics by the law of cosines; null if the point is out of reach. */
export function ik(x: number, y: number, elbow: "up" | "down"): { t1: number; t2: number } | null {
  const d2 = x * x + y * y;
  const c2 = (d2 - L1 * L1 - L2 * L2) / (2 * L1 * L2);
  if (c2 < -1 - 1e-9 || c2 > 1 + 1e-9) return null;
  const s2 = (elbow === "up" ? -1 : 1) * Math.sqrt(Math.max(0, 1 - c2 * c2));
  const t2 = Math.atan2(s2, c2);
  const t1 = Math.atan2(y, x) - Math.atan2(L2 * s2, L1 + L2 * c2);
  return { t1: deg(t1), t2: deg(t2) };
}

export const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// ---------------- Kalman filter ----------------

export const KF_STEPS = 100;
/** Odometry over-reads distance by 4% (wheel wear) plus a little noise. */
export const ODO_BIAS = 1.04;
export const ODO_NOISE = 0.05;
/** The robot moves 1 m every step. */
export const SPEED = 1;

export interface KalmanRun {
  truth: number[];
  odo: number[];
  gps: number[];
  fused: number[];
  gains: number[];
  rmse: { odo: number; gps: number; fused: number };
}

const rmse = (a: number[], b: number[]) => Math.sqrt(a.reduce((t, x, i) => t + (x - b[i]!) ** 2, 0) / a.length);

/**
 * 1-D localisation. Predict with odometry (variance q per step), correct with a GPS fix
 * (variance r). gpsNoise is the real GPS standard deviation in metres.
 */
export function kalman(q: number, r: number, gpsNoise = 3, seed = 11): KalmanRun {
  const g = gauss(seed);
  const truth: number[] = [];
  const odo: number[] = [];
  const gps: number[] = [];
  const fused: number[] = [];
  const gains: number[] = [];
  let x = 0;
  let odoX = 0;
  let est = 0;
  let p = 1;
  for (let i = 0; i < KF_STEPS; i++) {
    x += SPEED;
    const moved = SPEED * ODO_BIAS + ODO_NOISE * g();
    odoX += moved;
    const z = x + gpsNoise * g();
    // predict
    est += moved;
    p += q;
    // update
    const k = p / (p + r);
    est += k * (z - est);
    p = (1 - k) * p;
    truth.push(x);
    odo.push(odoX);
    gps.push(z);
    fused.push(est);
    gains.push(k);
  }
  return { truth, odo, gps, fused, gains, rmse: { odo: rmse(odo, truth), gps: rmse(gps, truth), fused: rmse(fused, truth) } };
}

// ---------------- MQTT and power ----------------

export const TOPICS = [
  "home/kitchen/temp",
  "home/kitchen/humidity",
  "home/bedroom/temp",
  "home/bedroom/light",
  "garden/temp",
  "garden/soil/moisture",
  "garage/door",
];

/** MQTT topic filter matching: `+` is one level, `#` is the rest (and must be last). */
export function topicMatches(filter: string, topic: string): boolean {
  const f = filter.split("/");
  const t = topic.split("/");
  for (let i = 0; i < f.length; i++) {
    if (f[i] === "#") return i === f.length - 1;
    if (i >= t.length) return false;
    if (f[i] !== "+" && f[i] !== t[i]) return false;
  }
  return f.length === t.length;
}

export const validFilter = (filter: string) => {
  const f = filter.split("/");
  return filter.length > 0 && f.every((p, i) => (p.includes("#") ? p === "#" && i === f.length - 1 : !p.includes("+") || p === "+"));
};

export type Radio = "wifi" | "lora";
/** Active current (mA) and time on air per report (s). */
export const RADIOS: Record<Radio, { ma: number; seconds: number }> = {
  wifi: { ma: 80, seconds: 2 },
  lora: { ma: 40, seconds: 0.2 },
};
export const BATTERY_MAH = 2000;
export const SLEEP_MA = 0.01;
export const INTERVALS = [1, 5, 10, 15, 30, 60];

/** Battery life in days when reporting every `minutes` over `radio`. */
export function batteryDays(minutes: number, radio: Radio): number {
  const r = RADIOS[radio];
  const reportsPerDay = (24 * 60) / minutes;
  const mahPerDay = SLEEP_MA * 24 + (reportsPerDay * r.ma * r.seconds) / 3600;
  return BATTERY_MAH / mahPerDay;
}
