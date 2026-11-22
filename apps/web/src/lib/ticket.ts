/**
 * Емтихан билеті: a short mixed quiz. Questions come from different labs in
 * turn (interleaving), and before each answer the learner says how sure they
 * are, so the end of the ticket can show their calibration.
 */
import type { LessonProgress } from "@inside-tech/lesson-engine";
import type { LessonEntry } from "./lessons";

export interface TicketQuestion {
  key: string;
  labId: string;
  lessonId: string;
  lessonTitle: string;
  question: string;
  options: string[];
  answer: number;
  explain: string;
}

export type Confidence = 0 | 1 | 2; // болжаймын, шамамен, сенімдімін
export const CONFIDENCE_WORD: Record<Confidence, string> = { 0: "Болжаймын", 1: "Шамамен", 2: "Сенімдімін" };

const rng = (seed: number) => {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 2 ** 32;
  };
};

/** Every quiz question of the lessons the learner has opened; all lessons' first-level questions if none yet. */
export function questionPool(entries: LessonEntry[], progress: LessonProgress[]): TicketQuestion[] {
  const opened = new Set(progress.map((p) => p.lessonId));
  const from = opened.size ? entries.filter((e) => opened.has(e.lesson.id)) : entries.filter((e) => e.lesson.order <= 2);
  const out: TicketQuestion[] = [];
  for (const e of from)
    for (const step of e.lesson.steps)
      for (const q of step.quiz ?? [])
        out.push({ key: `${e.lesson.id}/${step.id}/${q.id}`, labId: e.labId, lessonId: e.lesson.id, lessonTitle: e.lesson.title, question: q.question, options: q.options, answer: q.answer, explain: q.explain });
  return out;
}

/**
 * Draw `n` questions, never two from the same lab in a row when another lab
 * is available. Same seed, same ticket.
 */
export function drawTicket(pool: TicketQuestion[], seed: number, n = 5): TicketQuestion[] {
  const r = rng(seed);
  const byLab = new Map<string, TicketQuestion[]>();
  for (const q of pool) byLab.set(q.labId, [...(byLab.get(q.labId) ?? []), q]);
  for (const list of byLab.values())
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [list[i], list[j]] = [list[j]!, list[i]!];
    }
  const labs = [...byLab.keys()].sort();
  const out: TicketQuestion[] = [];
  let last = "";
  while (out.length < n && [...byLab.values()].some((l) => l.length)) {
    const choices = labs.filter((l) => byLab.get(l)!.length && l !== last);
    const pickFrom = choices.length ? choices : labs.filter((l) => byLab.get(l)!.length);
    const lab = pickFrom[Math.floor(r() * pickFrom.length)]!;
    out.push(byLab.get(lab)!.shift()!);
    last = lab;
  }
  return out;
}

export interface TicketAnswer {
  confidence: Confidence;
  correct: boolean;
}

/** Per confidence level: how many answers, how many right. */
export function calibration(answers: TicketAnswer[]): Record<Confidence, { total: number; right: number }> {
  const out = { 0: { total: 0, right: 0 }, 1: { total: 0, right: 0 }, 2: { total: 0, right: 0 } } as Record<Confidence, { total: number; right: number }>;
  for (const a of answers) {
    out[a.confidence].total++;
    if (a.correct) out[a.confidence].right++;
  }
  return out;
}

/** The one-line verdict on calibration: overconfident, underconfident, or well calibrated. */
export function calibrationVerdict(answers: TicketAnswer[]): "over" | "under" | "good" | "unknown" {
  const c = calibration(answers);
  const sure = c[2];
  const unsure = c[0];
  if (sure.total && sure.right / sure.total < 0.75) return "over";
  if (unsure.total >= 2 && unsure.right / unsure.total > 0.75) return "under";
  if (sure.total || unsure.total) return "good";
  return "unknown";
}
