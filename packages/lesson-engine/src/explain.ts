/**
 * Self-explanation ("өз сөзіңмен түсіндір"): after the experiment the learner
 * writes why it happened in a sentence or two. We do not grade the prose; we
 * look for the key ideas (each a small group of word stems, so Kazakh endings
 * and synonyms both match) and then show an expert's explanation to compare.
 */

export interface SelfExplainConcept {
  /** Shown to the learner: the idea, in a few words. */
  label: string;
  /** Lowercase stems or phrases; any one present counts. */
  words: string[];
}

export interface SelfExplain {
  prompt: string;
  concepts: SelfExplainConcept[];
  /** The expert's explanation, shown after the learner has written theirs. */
  model: string;
}

/** Minimum length for an answer to count as an attempt. */
export const MIN_EXPLANATION = 25;

const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ");

export interface Coverage {
  found: string[];
  missing: string[];
  /** 0..1 */
  share: number;
}

export function coverage(se: SelfExplain, text: string): Coverage {
  const t = norm(text);
  const found: string[] = [];
  const missing: string[] = [];
  for (const c of se.concepts) (c.words.some((w) => t.includes(norm(w))) ? found : missing).push(c.label);
  return { found, missing, share: se.concepts.length ? found.length / se.concepts.length : 1 };
}
