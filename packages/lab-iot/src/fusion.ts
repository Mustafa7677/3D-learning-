/**
 * Sensor fusion for tilt: a gyroscope is smooth but drifts (it integrates a
 * small bias), an accelerometer never drifts but is noisy. A complementary
 * filter trusts the gyro for quick changes and the accelerometer for the
 * long run. 20 seconds at 50 Hz, deterministic noise.
 */

export const RATE = 50; // Hz
export const DURATION = 20; // s
export const GYRO_BIAS = 0.5; // degrees per second
export const ACCEL_NOISE = 6; // degrees, peak

export type FusionMode = "gyro" | "accel" | "complementary";

/** The real tilt: level, a 30° lean at 5 s, back at 12 s, smoothly. */
export function trueAngle(t: number): number {
  const ramp = (a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));
  return 30 * ramp(5, 6) - 30 * ramp(12, 13);
}

const noise = (() => {
  let s = 0x2f6b1a3;
  return Array.from({ length: RATE * DURATION }, () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return ((s / 2 ** 32) * 2 - 1) * ACCEL_NOISE;
  });
})();

export interface FusionRun {
  estimate: number[];
  truth: number[];
  rms: number;
  finalError: number;
}

export function runFusion(mode: FusionMode, alpha = 0.98): FusionRun {
  const dt = 1 / RATE;
  const n = RATE * DURATION;
  const truth: number[] = [];
  const estimate: number[] = [];
  let gyroAngle = 0;
  let fused = 0;
  for (let i = 0; i < n; i++) {
    const t = i * dt;
    const real = trueAngle(t);
    const rate = (trueAngle(t + dt) - real) / dt + GYRO_BIAS; // what the gyro reports
    const accel = real + noise[i]!; // what the accelerometer says
    gyroAngle += rate * dt;
    fused = alpha * (fused + rate * dt) + (1 - alpha) * accel;
    truth.push(real);
    estimate.push(mode === "gyro" ? gyroAngle : mode === "accel" ? accel : fused);
  }
  const err = estimate.map((e, i) => e - truth[i]!);
  const rms = Math.sqrt(err.reduce((s, e) => s + e * e, 0) / n);
  return { estimate, truth, rms: Math.round(rms * 100) / 100, finalError: Math.round(Math.abs(err.at(-1)!) * 100) / 100 };
}
