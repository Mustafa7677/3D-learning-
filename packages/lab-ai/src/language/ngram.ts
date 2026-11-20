import type { Rng } from "@inside-tech/sim-core";

export const BOS = "<s>";
export const EOS = "</s>";

/**
 * Interpolated trigram language model:
 *   P(w | a b) = λ3·P3(w | a b) + λ2·P2(w | b) + λ1·P1(w)
 * Small, but it does exactly what an LLM does at inference time: turn a
 * context into a probability distribution over the next token.
 */
export interface NgramModel {
  vocab: string[];
  uni: Map<string, number>;
  bi: Map<string, Map<string, number>>;
  tri: Map<string, Map<string, number>>;
  total: number;
}

const LAMBDA = [0.1, 0.3, 0.6] as const;

function bump(m: Map<string, Map<string, number>>, ctx: string, w: string) {
  let inner = m.get(ctx);
  if (!inner) {
    inner = new Map();
    m.set(ctx, inner);
  }
  inner.set(w, (inner.get(w) ?? 0) + 1);
}

export function trainNgram(sentences: string[][]): NgramModel {
  const uni = new Map<string, number>();
  const bi = new Map<string, Map<string, number>>();
  const tri = new Map<string, Map<string, number>>();
  let total = 0;
  for (const s of sentences) {
    const seq = [BOS, BOS, ...s, EOS];
    for (let i = 2; i < seq.length; i++) {
      const w = seq[i]!;
      uni.set(w, (uni.get(w) ?? 0) + 1);
      total++;
      bump(bi, seq[i - 1]!, w);
      bump(tri, seq[i - 2]! + " " + seq[i - 1]!, w);
    }
  }
  const vocab = [...uni.keys()].sort();
  return { vocab, uni, bi, tri, total };
}

export interface TokenProb {
  token: string;
  p: number;
}

/** Full next-token distribution given the context (last two tokens used). */
export function nextDistribution(m: NgramModel, context: string[]): TokenProb[] {
  const ctx = [BOS, BOS, ...context];
  const a = ctx[ctx.length - 2]!;
  const b = ctx[ctx.length - 1]!;
  const triC = m.tri.get(a + " " + b);
  const biC = m.bi.get(b);
  const triN = triC ? [...triC.values()].reduce((x, y) => x + y, 0) : 0;
  const biN = biC ? [...biC.values()].reduce((x, y) => x + y, 0) : 0;
  const out = m.vocab.map((w) => {
    const p1 = (m.uni.get(w) ?? 0) / m.total;
    const p2 = biN ? (biC!.get(w) ?? 0) / biN : p1;
    const p3 = triN ? (triC!.get(w) ?? 0) / triN : p2;
    return { token: w, p: LAMBDA[0] * p1 + LAMBDA[1] * p2 + LAMBDA[2] * p3 };
  });
  const z = out.reduce((s, x) => s + x.p, 0);
  return out.map((x) => ({ token: x.token, p: x.p / z })).sort((x, y) => y.p - x.p || (x.token < y.token ? -1 : 1));
}

/** Apply temperature and top-k, renormalise. T → 0 approaches greedy decoding. */
export function shapeDistribution(dist: TokenProb[], temperature: number, topK: number): TokenProb[] {
  const k = Math.max(1, Math.min(topK, dist.length));
  const kept = dist.slice(0, k);
  if (temperature <= 0.01) return kept.map((x, i) => ({ token: x.token, p: i === 0 ? 1 : 0 }));
  const logits = kept.map((x) => Math.log(Math.max(x.p, 1e-12)) / temperature);
  const mx = Math.max(...logits);
  const ex = logits.map((l) => Math.exp(l - mx));
  const z = ex.reduce((a, b) => a + b, 0);
  return kept.map((x, i) => ({ token: x.token, p: ex[i]! / z }));
}

export function sample(dist: TokenProb[], rng: Rng): string {
  const r = rng.next();
  let acc = 0;
  for (const x of dist) {
    acc += x.p;
    if (r < acc) return x.token;
  }
  return dist[dist.length - 1]!.token;
}
