/**
 * Fixed timestep: a spring (a bouncy platform) simulated for 3 seconds.
 * Stepping physics with each frame's delta and explicit Euler adds energy
 * every step, more at low frame rates; a fixed small step with an
 * accumulator (and a stable integrator) gives the same motion on every
 * machine.
 */

export const STIFFNESS = 400; // k/m, 1/s²: ω = 20 rad/s
export const SECONDS = 3;
export const FIXED_DT = 1 / 240;

export type Stepper = "frame-euler" | "fixed-symplectic";

export interface StepRun {
  /** Peak displacement in the last half second, relative to the start (1 = energy kept). */
  amplitude: number;
  /** Position samples for drawing, one per frame. */
  trace: number[];
  steps: number;
}

export function runSpring(stepper: Stepper, fps: number): StepRun {
  let x = 1;
  let v = 0;
  const frameDt = 1 / fps;
  const frames = Math.round(SECONDS * fps);
  const trace: number[] = [];
  let acc = 0;
  let steps = 0;
  let peakLate = 0;
  for (let f = 0; f < frames; f++) {
    if (stepper === "frame-euler") {
      // Explicit Euler with the frame's delta: position uses the old velocity.
      const a = -STIFFNESS * x;
      x += v * frameDt;
      v += a * frameDt;
      steps++;
    } else {
      acc += frameDt;
      while (acc >= FIXED_DT - 1e-12) {
        // Semi-implicit (symplectic) Euler: velocity first, then position.
        v += -STIFFNESS * x * FIXED_DT;
        x += v * FIXED_DT;
        acc -= FIXED_DT;
        steps++;
      }
    }
    trace.push(x);
    if ((f + 1) / fps > SECONDS - 0.5) peakLate = Math.max(peakLate, Math.abs(x));
  }
  return { amplitude: Math.round(peakLate * 100) / 100, trace, steps };
}
