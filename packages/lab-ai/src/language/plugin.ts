import { Rng, type AssessmentResult, type SimulationPlugin } from "@inside-tech/sim-core";
import { selfAttention, entropy, type AttentionParams, type AttentionResult } from "./attention";
import { trainBpe, encode, vocabSize, type BpeModel } from "./bpe";
import { SENTENCES, words } from "./corpus";
import { nearest, trainEmbeddings, type Embeddings } from "./embeddings";
import { EOS, nextDistribution, sample, shapeDistribution, trainNgram, type NgramModel, type TokenProb } from "./ngram";

export const MAX_MERGES = 200;

/** Models learned once from the built-in corpus (pure function of the corpus → deterministic). */
interface Models {
  bpe: BpeModel;
  emb: Embeddings;
  lm: NgramModel;
  corpusWords: string[];
}
let models: Models | undefined;
export function languageModels(): Models {
  if (!models) {
    const corpusWords = SENTENCES.flat();
    models = { bpe: trainBpe(corpusWords, MAX_MERGES), emb: trainEmbeddings(SENTENCES), lm: trainNgram(SENTENCES), corpusWords };
  }
  return models;
}

export interface LangStats {
  textEdits: number;
  mergeValues: number[];
  inspectedWords: string[];
  attnInspected: number[];
  causalToggled: boolean;
  minEntropy: number;
  maxEntropy: number;
  promptsSet: number;
  samples: number;
  samplesLowT: number;
  samplesHighT: number;
  greedySamples: number;
}

export interface LangLabState {
  rngSeed: number;
  text: string;
  merges: number;
  selectedWord: string | null;
  selectedToken: number | null;
  attn: AttentionParams;
  lm: { prompt: string; generated: string[]; temperature: number; topK: number; done: boolean };
  stats: LangStats;
}

export type LangLabAction =
  | { type: "text/set"; text: string }
  | { type: "bpe/setMerges"; merges: number }
  | { type: "word/select"; word: string | null }
  | { type: "token/select"; index: number | null }
  | { type: "attn/set"; params: Partial<AttentionParams> }
  | { type: "lm/setPrompt"; prompt: string }
  | { type: "lm/set"; params: Partial<{ temperature: number; topK: number }> }
  | { type: "lm/step" }
  | { type: "lm/generate"; max?: number }
  | { type: "lm/clear" };

const MAX_TEXT = 200;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo));

export function initialLangState(seed: number): LangLabState {
  return {
    rngSeed: seed >>> 0,
    text: "мысық сүт ішеді",
    merges: 40,
    selectedWord: null,
    selectedToken: null,
    attn: { sharpness: 8, posWeight: 0, causal: false, maskSelf: true },
    lm: { prompt: "мысық", generated: [], temperature: 1, topK: 10, done: false },
    stats: {
      textEdits: 0,
      mergeValues: [],
      inspectedWords: [],
      attnInspected: [],
      causalToggled: false,
      minEntropy: Infinity,
      maxEntropy: 0,
      promptsSet: 0,
      samples: 0,
      samplesLowT: 0,
      samplesHighT: 0,
      greedySamples: 0,
    },
  };
}

// ---- selectors ----

export function sentenceWords(s: LangLabState): string[] {
  return words(s.text).slice(0, 16);
}

export function tokenize(s: LangLabState): string[][] {
  return encode(sentenceWords(s), languageModels().bpe, s.merges);
}

export function attention(s: LangLabState): AttentionResult {
  return selfAttention(sentenceWords(s), languageModels().emb, s.attn);
}

export function neighbours(s: LangLabState, k = 6) {
  return s.selectedWord ? nearest(languageModels().emb, s.selectedWord, k) : [];
}

export function lmContext(s: LangLabState): string[] {
  return [...words(s.lm.prompt), ...s.lm.generated.filter((t) => t !== EOS)];
}

export function nextTokens(s: LangLabState): { raw: TokenProb[]; shaped: TokenProb[] } {
  const raw = nextDistribution(languageModels().lm, lmContext(s));
  return { raw, shaped: shapeDistribution(raw, s.lm.temperature, s.lm.topK) };
}

/** Entropy (nats) of the selected token's attention row, if any. */
function rowEntropy(s: LangLabState): number | undefined {
  if (s.selectedToken === null) return undefined;
  const row = attention(s).weights[s.selectedToken];
  return row ? entropy(row) : undefined;
}

function trackEntropy(s: LangLabState): LangLabState {
  const h = rowEntropy(s);
  if (h === undefined) return s;
  return { ...s, stats: { ...s.stats, minEntropy: Math.min(s.stats.minEntropy, h), maxEntropy: Math.max(s.stats.maxEntropy, h) } };
}

function step(s: LangLabState): LangLabState {
  if (s.lm.done || s.lm.generated.length >= 24) return { ...s, lm: { ...s.lm, done: true } };
  const rng = new Rng(s.rngSeed);
  const tok = sample(nextTokens(s).shaped, rng);
  const t = s.lm.temperature;
  return {
    ...s,
    rngSeed: rng.seed,
    lm: { ...s.lm, generated: [...s.lm.generated, tok], done: tok === EOS },
    stats: {
      ...s.stats,
      samples: s.stats.samples + 1,
      samplesLowT: s.stats.samplesLowT + (t <= 0.3 ? 1 : 0),
      samplesHighT: s.stats.samplesHighT + (t >= 1.5 ? 1 : 0),
      greedySamples: s.stats.greedySamples + (s.lm.topK === 1 ? 1 : 0),
    },
  };
}

function reduce(s: LangLabState, a: LangLabAction): LangLabState {
  switch (a.type) {
    case "text/set": {
      const text = a.text.slice(0, MAX_TEXT);
      if (text === s.text) return s;
      return trackEntropy({ ...s, text, selectedToken: null, stats: { ...s.stats, textEdits: s.stats.textEdits + 1 } });
    }
    case "bpe/setMerges": {
      const merges = Math.round(clamp(a.merges, 0, MAX_MERGES));
      const seen = s.stats.mergeValues.includes(merges) ? s.stats.mergeValues : [...s.stats.mergeValues, merges].slice(-20);
      return { ...s, merges, stats: { ...s.stats, mergeValues: seen } };
    }
    case "word/select": {
      if (a.word !== null && !languageModels().emb.index.has(a.word)) return s;
      const inspected =
        a.word && !s.stats.inspectedWords.includes(a.word) ? [...s.stats.inspectedWords, a.word].slice(-30) : s.stats.inspectedWords;
      return { ...s, selectedWord: a.word, stats: { ...s.stats, inspectedWords: inspected } };
    }
    case "token/select": {
      const n = sentenceWords(s).length;
      if (a.index !== null && (a.index < 0 || a.index >= n)) return s;
      const seen =
        a.index !== null && !s.stats.attnInspected.includes(a.index) ? [...s.stats.attnInspected, a.index] : s.stats.attnInspected;
      return trackEntropy({ ...s, selectedToken: a.index, stats: { ...s.stats, attnInspected: seen } });
    }
    case "attn/set": {
      const p = { ...s.attn };
      if (a.params.sharpness !== undefined) p.sharpness = clamp(a.params.sharpness, 0, 100);
      if (a.params.posWeight !== undefined) p.posWeight = clamp(a.params.posWeight, 0, 2);
      if (a.params.causal !== undefined) p.causal = a.params.causal;
      if (a.params.maskSelf !== undefined) p.maskSelf = a.params.maskSelf;
      const toggled = s.stats.causalToggled || (a.params.causal !== undefined && a.params.causal !== s.attn.causal);
      return trackEntropy({ ...s, attn: p, stats: { ...s.stats, causalToggled: toggled } });
    }
    case "lm/setPrompt": {
      const prompt = a.prompt.slice(0, MAX_TEXT);
      return { ...s, lm: { ...s.lm, prompt, generated: [], done: false }, stats: { ...s.stats, promptsSet: s.stats.promptsSet + 1 } };
    }
    case "lm/set": {
      const lm = { ...s.lm };
      if (a.params.temperature !== undefined) lm.temperature = clamp(a.params.temperature, 0, 3);
      if (a.params.topK !== undefined) lm.topK = Math.round(clamp(a.params.topK, 1, 50));
      return { ...s, lm };
    }
    case "lm/step":
      return step(s);
    case "lm/generate": {
      let out = s;
      const max = Math.round(clamp(a.max ?? 12, 1, 24));
      for (let i = 0; i < max && !out.lm.done; i++) out = step(out);
      return out;
    }
    case "lm/clear":
      return { ...s, lm: { ...s.lm, generated: [], done: false } };
  }
}

export function evaluateLang(s: LangLabState): AssessmentResult {
  const ws = sentenceWords(s);
  const toks = tokenize(s);
  const m = languageModels();
  const unknown = ws.filter((w) => !m.emb.index.has(w)).length;
  const h = rowEntropy(s);
  const top = nextTokens(s).shaped[0];
  return {
    score: 0,
    metrics: {
      words: ws.length,
      tokens: toks.reduce((n, t) => n + t.length, 0),
      vocabSize: vocabSize(m.corpusWords, m.bpe, s.merges),
      unknownWords: unknown,
      entropy: h ?? -1,
      generated: s.lm.generated.length,
      topP: top?.p ?? 0,
    },
    notes: unknown > 0 ? ["unknown-words"] : [],
  };
}

export const langLabPlugin: SimulationPlugin<LangLabState, LangLabAction> = {
  id: "lang-lab",
  version: "1.0.0",
  initialize: initialLangState,
  dispatch: reduce,
  step: (s) => s,
  snapshot: (s) => structuredClone(s),
  restore: (snap) => structuredClone(snap as LangLabState),
  evaluate: evaluateLang,
};
