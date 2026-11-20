import { Color } from "three";

export const C0 = new Color("#2f5bea");
export const C1 = new Color("#ee9a22");
export const MID = new Color("#c9d0de");
export const POS = new Color("#ee9a22");
export const NEG = new Color("#2f5bea");

/** World scale: data space [-1,1] maps to [-S,S] on the floor. */
export const S = 3;
/** Height of probability 1. Class-1 points float here, class-0 points sit on the floor. */
export const H = 1.8;

export const toWorld = (x: number, y: number): [number, number] => [x * S, -y * S];
export const fromWorld = (wx: number, wz: number): [number, number] => [wx / S, -wz / S];

/** Map probability (0..1) to a diverging cobalt → grey → amber colour. */
export function probColor(p: number, out: Color): Color {
  if (p < 0.5) return out.copy(C0).lerp(MID, p * 2);
  return out.copy(MID).lerp(C1, (p - 0.5) * 2);
}

/** Where the network diagram lives in the world. */
export const NETWORK_ORIGIN: [number, number, number] = [6.6, 0.4, 0];
