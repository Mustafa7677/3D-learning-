import type { Embeddings } from "./embeddings";

export interface AttentionParams {
  /**
   * Multiplies the scaled scores q·k/√d before softmax (an inverse temperature):
   * low → attention spread evenly, high → focused on the most similar token.
   */
  sharpness: number;
  /** How much sinusoidal position information is added to each vector. */
  posWeight: number;
  /** Causal (decoder) mask: a token may only look at itself and earlier tokens. */
  causal: boolean;
  /** Hide each token's attention to itself, to make relations to others visible. */
  maskSelf: boolean;
}

export interface AttentionResult {
  tokens: string[];
  /** weights[i][j]: how much token i attends to token j; each row sums to 1 (or 0 if fully masked). */
  weights: number[][];
  /** Raw scaled scores before softmax (masked entries are -Infinity). */
  scores: number[][];
  known: boolean[];
}

/** Classic sinusoidal positional encoding (Vaswani et al., 2017). */
export function positionalEncoding(pos: number, dim: number): number[] {
  return Array.from({ length: dim }, (_, i) => {
    const k = Math.floor(i / 2);
    const angle = pos / Math.pow(100, (2 * k) / dim);
    return i % 2 === 0 ? Math.sin(angle) : Math.cos(angle);
  });
}

export function softmax(xs: number[]): number[] {
  const finite = xs.filter(Number.isFinite);
  if (finite.length === 0) return xs.map(() => 0);
  const m = Math.max(...finite);
  const ex = xs.map((x) => (Number.isFinite(x) ? Math.exp(x - m) : 0));
  const z = ex.reduce((a, b) => a + b, 0);
  return ex.map((e) => e / z);
}

export function entropy(p: number[]): number {
  return -p.reduce((acc, x) => (x > 0 ? acc + x * Math.log(x) : acc), 0);
}

/**
 * Single-head self-attention with Q = K = V = (word vector + position).
 * A trained transformer learns separate W_Q, W_K, W_V; here the projections are
 * the identity so that attention directly reflects meaning similarity.
 */
export function selfAttention(tokens: string[], e: Embeddings, p: AttentionParams): AttentionResult {
  const d = e.dim;
  const known = tokens.map((t) => e.index.has(t));
  const x = tokens.map((t, i) => {
    const base = known[i] ? e.vectors[e.index.get(t)!]! : new Array<number>(d).fill(0);
    const pe = positionalEncoding(i, d);
    return base.map((v, k) => v + p.posWeight * pe[k]! * 0.5);
  });
  const scale = Math.sqrt(d);
  const scores = x.map((qi, i) =>
    x.map((kj, j) => {
      if (p.causal && j > i) return -Infinity;
      if (p.maskSelf && i === j && !(p.causal && i === 0)) return -Infinity;
      let s = 0;
      for (let k = 0; k < d; k++) s += qi[k]! * kj[k]!;
      return (s / scale) * p.sharpness;
    }),
  );
  return { tokens, weights: scores.map(softmax), scores, known };
}
