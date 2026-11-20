/** 8-bit numbers: place values, two's complement and addition with carries. */
export const BITS = 8;
export const MASK = 0xff;

/** Bits of an 8-bit value, most significant first. */
export const toBits = (v: number): number[] => Array.from({ length: BITS }, (_, i) => (v >> (BITS - 1 - i)) & 1);

/** Interpret an 8-bit pattern as a two's-complement signed number (−128..127). */
export const toSigned = (v: number): number => ((v & MASK) >= 128 ? (v & MASK) - 256 : v & MASK);

/** The 8-bit pattern of a signed number (wraps like real hardware). */
export const fromSigned = (n: number): number => ((n % 256) + 256) % 256;

export const hex = (v: number): string => (v & MASK).toString(16).toUpperCase().padStart(2, "0");
export const bin = (v: number): string => (v & MASK).toString(2).padStart(BITS, "0");

export interface AddTrace {
  a: number;
  b: number;
  /** Sum bits, least significant first. */
  sum: number[];
  /** carries[i] = carry INTO bit i (carries[0] = 0); carries[8] = carry out. */
  carries: number[];
  result: number;
  carryOut: boolean;
  /** Signed overflow: both inputs have the same sign and the result's sign differs. */
  overflow: boolean;
}

/** Ripple-carry addition bit by bit — exactly what a chain of full adders computes. */
export function addTrace(a: number, b: number): AddTrace {
  const sum: number[] = [];
  const carries = [0];
  for (let i = 0; i < BITS; i++) {
    const x = (a >> i) & 1;
    const y = (b >> i) & 1;
    const c = carries[i]!;
    sum.push(x ^ y ^ c);
    carries.push((x & y) | (x & c) | (y & c));
  }
  const result = sum.reduce((acc, bit, i) => acc | (bit << i), 0);
  const sa = a & 0x80;
  const sb = b & 0x80;
  return { a: a & MASK, b: b & MASK, sum, carries, result, carryOut: carries[BITS] === 1, overflow: sa === sb && (result & 0x80) !== sa };
}
