/**
 * Бос парақ: free recall. The learner picks a topic studied before and writes everything they
 * remember, without looking. We then check which key ideas came back: the lesson's concepts
 * (from its self-explanations) and the terms its lectures set in bold. What was missed is shown
 * to re-read, and the next recall of the topic is spaced by how much came back.
 */
import type { LessonDefinition } from "@inside-tech/lesson-engine";
import type { LessonEntry } from "./lessons";

export interface KeyIdea {
  label: string;
  /** Lowercase stems; the idea is recalled when every group has a hit. */
  groups: string[][];
  /** Where the idea comes from, to send the learner back to it. */
  stepTitle: string;
}

const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е").replace(/[«»"()`*:;,.!?]/g, " ").replace(/\s+/g, " ").trim();

/** Kazakh endings, longest first: plural, possessive and case. Stripped while at least four letters stay. */
const ENDINGS = ["ның", "нің", "дың", "дің", "тың", "тің", "нан", "нен", "дан", "ден", "тан", "тен", "мен", "бен", "пен", "лар", "лер", "дар", "дер", "тар", "тер", "ға", "ге", "қа", "ке", "на", "не", "ны", "ні", "ды", "ді", "ты", "ті", "да", "де", "та", "те", "сы", "сі", "ын", "ін"];

/** A word without its Kazakh endings: фокустарға → фокус, көбейтіндісі → көбейтін. */
export function stem(word: string): string {
  let w = norm(word);
  for (let changed = true; changed; ) {
    changed = false;
    for (const e of ENDINGS) {
      if (w.endsWith(e) && w.length - e.length >= 4) {
        w = w.slice(0, -e.length);
        changed = true;
        break;
      }
    }
  }
  return w;
}

const STOP = new Set(["және", "мен", "пен", "бен", "не", "немесе", "бір", "the", "of", "a", "an", "to", "in", "on", "is", "это"]);

/** Bold terms of a lecture: **like this**. Short, meaningful, not formulas. */
export function boldTerms(body: string): string[] {
  const out: string[] = [];
  for (const m of body.matchAll(/\*\*([^*\n]{2,40})\*\*/g)) {
    // "Cache-Control: max-age=N" names a term before its colon.
    const t = m[1]!.split(":")[0]!.trim();
    if (/[=<>{}[\]|\\/^]/.test(t)) continue;
    if (!/[a-zа-яәіңғүұқөһ]{3}/i.test(t)) continue;
    out.push(t);
  }
  return out;
}

/** The key ideas of a lesson, without duplicates, concepts first. */
export function keyIdeas(lesson: LessonDefinition<unknown, unknown>): KeyIdea[] {
  const ideas: KeyIdea[] = [];
  const seen = new Set<string>();
  const add = (k: KeyIdea) => {
    const key = norm(k.label);
    if (seen.has(key)) return;
    seen.add(key);
    ideas.push(k);
  };
  for (const s of lesson.steps) {
    for (const c of s.selfExplain?.concepts ?? []) add({ label: c.label, groups: [c.words.map((w) => norm(w))], stepTitle: s.title });
  }
  for (const s of lesson.steps) {
    for (const t of boldTerms(s.body)) {
      const words = norm(t)
        .split(" ")
        .filter((w) => w.length >= 3 && !STOP.has(w));
      if (words.length === 0) continue;
      add({ label: t, groups: words.map((w) => [stem(w)]), stepTitle: s.title });
    }
  }
  return ideas;
}

export interface RecallResult {
  found: KeyIdea[];
  missed: KeyIdea[];
  share: number;
}

export function checkRecall(ideas: KeyIdea[], text: string): RecallResult {
  const t = ` ${norm(text)} `;
  const found: KeyIdea[] = [];
  const missed: KeyIdea[] = [];
  for (const k of ideas) (k.groups.every((g) => g.some((w) => t.includes(w))) ? found : missed).push(k);
  return { found, missed, share: ideas.length ? found.length / ideas.length : 0 };
}

/** Spacing: the more came back, the longer until the next recall. */
export function nextGapDays(share: number): number {
  return share >= 0.8 ? 7 : share >= 0.5 ? 3 : 1;
}

export interface RecallRecord {
  lessonId: string;
  at: number;
  share: number;
  due: number;
}

const DAY = 86400000;
export function record(lessonId: string, share: number, now: number): RecallRecord {
  return { lessonId, at: now, share, due: now + nextGapDays(share) * DAY };
}

/** The latest record per lesson. */
export function latest(history: RecallRecord[]): Map<string, RecallRecord> {
  const m = new Map<string, RecallRecord>();
  for (const r of history) if (!m.has(r.lessonId) || m.get(r.lessonId)!.at < r.at) m.set(r.lessonId, r);
  return m;
}

/**
 * What to recall, best first: topics whose recall is due, then studied topics never recalled,
 * oldest study first (the longer the gap, the stronger the retrieval).
 */
export function suggestions(entries: LessonEntry[], studied: { lessonId: string; updatedAt: number }[], history: RecallRecord[], now: number): { entry: LessonEntry; due: boolean; last?: RecallRecord }[] {
  const last = latest(history);
  const out: { entry: LessonEntry; due: boolean; last?: RecallRecord; key: number }[] = [];
  for (const p of studied) {
    const entry = entries.find((e) => e.lesson.id === p.lessonId);
    if (!entry) continue;
    const r = last.get(p.lessonId);
    if (r && r.due > now) continue;
    out.push({ entry, due: !!r, last: r, key: r ? r.due : p.updatedAt + 1e13 });
  }
  return out.sort((a, b) => a.key - b.key).map(({ key: _k, ...x }) => x);
}

const KEY = "inside-tech:recall";
export function loadRecall(): RecallRecord[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((r) => r && typeof r.lessonId === "string" && typeof r.at === "number" && typeof r.share === "number" && typeof r.due === "number") : [];
  } catch {
    return [];
  }
}
export function saveRecall(all: RecallRecord[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(all.slice(-300)));
  } catch {
    /* storage unavailable */
  }
}
