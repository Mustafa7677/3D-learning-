/**
 * Byte-pair encoding, character level. Training repeatedly merges the most
 * frequent adjacent pair of symbols across the corpus (ties broken
 * alphabetically, so merges are deterministic). "▁" marks the end of a word.
 */
export const EOW = "▁";

export interface BpeModel {
  merges: [string, string][];
}

export function trainBpe(corpusWords: string[], maxMerges: number): BpeModel {
  const freq = new Map<string, number>();
  for (const w of corpusWords) freq.set(w, (freq.get(w) ?? 0) + 1);
  let vocab = [...freq.entries()].map(([w, f]) => ({ syms: [...w, EOW], f }));
  const merges: [string, string][] = [];

  for (let m = 0; m < maxMerges; m++) {
    const pairs = new Map<string, number>();
    for (const { syms, f } of vocab) {
      for (let i = 0; i < syms.length - 1; i++) {
        const k = syms[i] + "\u0000" + syms[i + 1];
        pairs.set(k, (pairs.get(k) ?? 0) + f);
      }
    }
    let best: string | undefined;
    let bestN = 1; // a pair must occur at least twice to be worth merging
    for (const [k, n] of pairs) {
      if (n > bestN || (n === bestN && best !== undefined && k < best)) {
        best = k;
        bestN = n;
      }
    }
    if (!best) break;
    const [a, b] = best.split("\u0000") as [string, string];
    merges.push([a, b]);
    vocab = vocab.map(({ syms, f }) => ({ syms: applyMerge(syms, a, b), f }));
  }
  return { merges };
}

function applyMerge(syms: string[], a: string, b: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < syms.length; i++) {
    if (i < syms.length - 1 && syms[i] === a && syms[i + 1] === b) {
      out.push(a + b);
      i++;
    } else out.push(syms[i]!);
  }
  return out;
}

/** Tokenise one word using the first `n` merges, in training order. */
export function encodeWord(word: string, model: BpeModel, n: number): string[] {
  let syms = [...word, EOW];
  const limit = Math.min(n, model.merges.length);
  for (let i = 0; i < limit; i++) {
    const [a, b] = model.merges[i]!;
    if (syms.length === 1) break;
    syms = applyMerge(syms, a, b);
  }
  return syms;
}

export function encode(wordsIn: string[], model: BpeModel, n: number): string[][] {
  return wordsIn.map((w) => encodeWord(w, model, n));
}

/** Number of distinct tokens available after `n` merges (characters + merged symbols). */
export function vocabSize(corpusWords: string[], model: BpeModel, n: number): number {
  const chars = new Set<string>([EOW]);
  for (const w of corpusWords) for (const c of w) chars.add(c);
  return chars.size + Math.min(n, model.merges.length);
}
