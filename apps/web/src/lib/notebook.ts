/**
 * Қателер дәптері (the mistakes notebook): every quiz question the learner
 * once answered wrongly and every prediction the experiment proved wrong,
 * gathered from saved progress and reviewed on a Leitner schedule.
 */
import type { LessonProgress } from "@inside-tech/lesson-engine";
import { INTERVAL_DAYS } from "./cards";
import type { LessonEntry } from "./lessons";

export interface Mistake {
  /** Stable key: lesson/step/question, or lesson/step/predict. */
  key: string;
  kind: "quiz" | "predict";
  labId: string;
  lessonId: string;
  lessonTitle: string;
  stepTitle: string;
  question: string;
  options: string[];
  answer: number;
  /** What the learner chose (known for predictions). */
  chosen?: number;
  explain: string;
}

/** Collect mistakes from progress records, in course order. */
export function collectMistakes(entries: LessonEntry[], progress: LessonProgress[]): Mistake[] {
  const byId = new Map(progress.map((p) => [p.lessonId, p]));
  const out: Mistake[] = [];
  for (const e of entries) {
    const p = byId.get(e.lesson.id);
    if (!p) continue;
    for (const step of e.lesson.steps) {
      const base = { labId: e.labId, lessonId: e.lesson.id, lessonTitle: e.lesson.title, stepTitle: step.title };
      const chosen = p.predictions?.[step.id];
      const done = step.objectives.every((o: { id: string }) => (p.completed[step.id] ?? []).includes(o.id));
      if (step.predict && chosen !== undefined && done && chosen !== step.predict.answer)
        out.push({ ...base, key: `${e.lesson.id}/${step.id}/predict`, kind: "predict", question: step.predict.question, options: step.predict.options, answer: step.predict.answer, chosen, explain: step.predict.explain });
      for (const qid of p.misses?.[step.id] ?? []) {
        const q = step.quiz?.find((x: { id: string }) => x.id === qid);
        if (q) out.push({ ...base, key: `${e.lesson.id}/${step.id}/${q.id}`, kind: "quiz", question: q.question, options: q.options, answer: q.answer, explain: q.explain });
      }
    }
  }
  return out;
}

export const MASTERED_BOX = 5;
export interface Slot {
  box: number;
  due: number;
}
export type Review = Record<string, Slot>;
const DAY = 86_400_000;

/** A new mistake starts in box 1, due now. */
export function schedule(review: Review, mistakes: Mistake[], now: number): Review {
  const next = { ...review };
  for (const m of mistakes) if (!next[m.key]) next[m.key] = { box: 1, due: now };
  return next;
}

/** Right: one box up (1, 3, 7, 14 days); wrong: back to box 1, today. */
export function gradeMistake(review: Review, key: string, right: boolean, now: number): Review {
  const cur = review[key] ?? { box: 1, due: now };
  const box = right ? Math.min(MASTERED_BOX, cur.box + 1) : 1;
  return { ...review, [key]: { box, due: now + (INTERVAL_DAYS[box] ?? 0) * DAY } };
}

export const dueMistakes = (review: Review, mistakes: Mistake[], now: number) => mistakes.filter((m) => (review[m.key]?.due ?? now) <= now && (review[m.key]?.box ?? 1) < MASTERED_BOX);
export const mastered = (review: Review, mistakes: Mistake[]) => mistakes.filter((m) => (review[m.key]?.box ?? 1) >= MASTERED_BOX).length;

export function sanitizeReview(raw: unknown): Review {
  if (!raw || typeof raw !== "object") return {};
  const out: Review = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const s = v as Partial<Slot> | null;
    if (s && Number.isInteger(s.box) && s.box! >= 1 && s.box! <= MASTERED_BOX && Number.isFinite(s.due)) out[k] = { box: s.box!, due: s.due! };
  }
  return out;
}
