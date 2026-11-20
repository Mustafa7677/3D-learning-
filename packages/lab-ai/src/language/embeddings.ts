/**
 * Distributional word vectors: count how often words appear near each other,
 * weight by positive pointwise mutual information (PPMI), then compress with a
 * truncated SVD (power iteration with deflation). Words used in similar
 * contexts end up with similar vectors: the idea behind every embedding layer.
 */
export interface Embeddings {
  vocab: string[];
  index: Map<string, number>;
  /** Unit-length vectors, `dim` components each. */
  vectors: number[][];
  /** 3D layout for the scene (first three singular directions, scaled to ~[-1,1]). */
  coords: [number, number, number][];
  dim: number;
}

export function trainEmbeddings(sentences: string[][], dim = 8, window = 2): Embeddings {
  const vocab = [...new Set(sentences.flat())].sort();
  const index = new Map(vocab.map((w, i) => [w, i]));
  const V = vocab.length;
  const C: number[][] = Array.from({ length: V }, () => new Array<number>(V).fill(0));
  for (const s of sentences) {
    for (let i = 0; i < s.length; i++) {
      for (let j = Math.max(0, i - window); j <= Math.min(s.length - 1, i + window); j++) {
        if (i === j) continue;
        C[index.get(s[i]!)!]![index.get(s[j]!)!]! += 1 / Math.abs(i - j);
      }
    }
  }
  const row = C.map((r) => r.reduce((a, b) => a + b, 0));
  const total = row.reduce((a, b) => a + b, 0) || 1;
  const M = C.map((r, i) =>
    r.map((c, j) => {
      if (c === 0) return 0;
      const pmi = Math.log((c * total) / (row[i]! * row[j]!));
      return Math.max(0, pmi);
    }),
  );

  // Truncated SVD of the symmetric PPMI matrix via power iteration + deflation.
  const comps: { v: number[]; s: number }[] = [];
  const A = M.map((r) => r.slice());
  for (let k = 0; k < dim; k++) {
    let v = Array.from({ length: V }, (_, i) => Math.sin(i * 12.9898 + k * 78.233) + 0.01);
    let s = 0;
    for (let it = 0; it < 80; it++) {
      const w = A.map((r) => r.reduce((acc, x, j) => acc + x * v[j]!, 0));
      const n = Math.hypot(...w) || 1;
      v = w.map((x) => x / n);
      s = n;
    }
    // Sign convention: largest component positive, for stable layouts.
    const maxI = v.reduce((bi, x, i) => (Math.abs(x) > Math.abs(v[bi]!) ? i : bi), 0);
    if (v[maxI]! < 0) v = v.map((x) => -x);
    const Av = A.map((r) => r.reduce((acc, x, j) => acc + x * v[j]!, 0));
    const lambda = v.reduce((acc, x, i) => acc + x * Av[i]!, 0);
    for (let i = 0; i < V; i++) for (let j = 0; j < V; j++) A[i]![j]! -= lambda * v[i]! * v[j]!;
    comps.push({ v, s: Math.sqrt(Math.abs(lambda)) || s });
  }

  const raw = vocab.map((_, i) => comps.map((c) => c.v[i]! * c.s));
  const vectors = raw.map((x) => {
    const n = Math.hypot(...x) || 1;
    return x.map((y) => y / n);
  });
  // Layout: three components after the first (which mostly encodes word frequency),
  // centred on the mean and scaled to about [-1, 1] per axis.
  const pick = dim >= 4 ? [1, 2, 3] : [0, 1, 2];
  const coords3 = vectors.map((x) => pick.map((k) => x[k] ?? 0) as [number, number, number]);
  const mean = [0, 1, 2].map((d) => coords3.reduce((s, c) => s + c[d]!, 0) / Math.max(1, coords3.length));
  const centred = coords3.map((c) => c.map((x, d) => x - mean[d]!) as [number, number, number]);
  const span = [0, 1, 2].map((d) => Math.max(1e-6, ...centred.map((c) => Math.abs(c[d]!))));
  const coords = centred.map((c) => c.map((x, d) => x / span[d]!) as [number, number, number]);
  return { vocab, index, vectors, coords, dim };
}

export function cosine(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!;
  return s;
}

export function nearest(e: Embeddings, word: string, k = 5): { word: string; sim: number }[] {
  const i = e.index.get(word);
  if (i === undefined) return [];
  const v = e.vectors[i]!;
  return e.vocab
    .map((w, j) => ({ word: w, sim: j === i ? -Infinity : cosine(v, e.vectors[j]!) }))
    .sort((a, b) => b.sim - a.sim)
    .slice(0, k);
}
