/**
 * A timing attack on a token check. The server compares the token with its
 * secret character by character and stops at the first difference, so each
 * correct leading character makes the answer 1 µs slower. Network noise is
 * 2 µs, so one measurement says little; the average of many says a lot. The
 * attacker guesses one position at a time: 16 hex digits × 8 positions
 * instead of 16⁸ tokens. A constant-time comparison always takes the same
 * time, and the attack has nothing to measure.
 */

export type Compare = "early" | "constant";
export const SECRET = "a7f3c9e1";
export const HEX = "0123456789abcdef";
export const SAMPLE_COUNTS = [1, 10, 100];
export const STEP_US = 1;
export const NOISE_US = 2;
export const BASE_US = 50;

const rng = (seed: number) => {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return (s + 0.5) / 2 ** 32;
  };
};

/** How long the server takes to reject `token`. */
export function serverTime(token: string, compare: Compare): number {
  if (compare === "constant") return BASE_US + SECRET.length * STEP_US;
  let k = 0;
  while (k < SECRET.length && token[k] === SECRET[k]) k++;
  return BASE_US + k * STEP_US;
}

export interface TimingRun {
  compare: Compare;
  samples: number;
  guess: string;
  /** Characters of the guess that match the secret at the same position. */
  correct: number;
  requests: number;
  /** Average measured time of each candidate (16) at each position (8), µs above BASE_US. */
  times: number[][];
}

export function runTiming(compare: Compare, samples: number): TimingRun {
  const r = rng(0x71e + samples * 31 + (compare === "constant" ? 7 : 0));
  const noise = () => Math.sqrt(-2 * Math.log(r())) * Math.cos(2 * Math.PI * r()) * NOISE_US;
  let guess = "";
  const times: number[][] = [];
  for (let pos = 0; pos < SECRET.length; pos++) {
    const row = [...HEX].map((c) => {
      const token = (guess + c).padEnd(SECRET.length, "0");
      let sum = 0;
      for (let i = 0; i < samples; i++) sum += serverTime(token, compare) + noise();
      return Math.round((sum / samples - BASE_US) * 100) / 100;
    });
    times.push(row);
    guess += HEX[row.indexOf(Math.max(...row))]!;
  }
  return { compare, samples, guess, correct: [...guess].filter((c, i) => c === SECRET[i]).length, requests: HEX.length * SECRET.length * samples, times };
}
