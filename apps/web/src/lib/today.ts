/**
 * "Бүгін": a daily study plan built from what the learner has done. Three short moves, in
 * the order learning research suggests for a session: retrieve what you learned before,
 * learn something new, then stretch on a hard problem. Plus a weekly goal and a heatmap.
 */
import type { LessonProgress } from "@inside-tech/lesson-engine";
import { dayTotal, type ActivityLog } from "./activity";
import type { LessonEntry } from "./lessons";
import { dayKey } from "./problems";

/** The lesson to open now: the latest one started and unfinished, else the next one after the latest finished, else the first. */
export function nextLesson(entries: LessonEntry[], progress: LessonProgress[]): { entry: LessonEntry; resume: boolean } | undefined {
  const byId = new Map(progress.map((p) => [p.lessonId, p]));
  const known = progress.filter((p) => entries.some((e) => e.lesson.id === p.lessonId)).sort((a, b) => b.updatedAt - a.updatedAt);
  const open = known.find((p) => !p.completedAt);
  if (open) return { entry: entries.find((e) => e.lesson.id === open.lessonId)!, resume: true };
  const last = known[0];
  if (last) {
    const i = entries.findIndex((e) => e.lesson.id === last.lessonId);
    const lab = entries[i]!.labId;
    const after = entries.slice(i + 1).find((e) => e.labId === lab && !byId.get(e.lesson.id)?.completedAt);
    const anyLeft = after ?? entries.find((e) => e.labId === lab && !byId.get(e.lesson.id)?.completedAt) ?? entries.find((e) => !byId.get(e.lesson.id)?.completedAt);
    return anyLeft ? { entry: anyLeft, resume: false } : undefined;
  }
  return entries[0] ? { entry: entries[0], resume: false } : undefined;
}

export interface PlanItem {
  id: "review" | "learn" | "stretch";
  kicker: string;
  title: string;
  detail: string;
  href: string;
  done: boolean;
}

export function todayPlan(input: {
  entries: LessonEntry[];
  progress: LessonProgress[];
  activity: ActivityLog;
  cardsDue: number;
  mistakesDue: number;
  daily: { id: string; title: string };
  now: Date;
}): PlanItem[] {
  const today = input.activity.days[dayKey(input.now)] ?? {};
  const next = nextLesson(input.entries, input.progress);
  const review: PlanItem =
    input.mistakesDue > 0
      ? { id: "review", kicker: "1 · ЕСКЕ ТҮСІР", title: `${input.mistakesDue} қатені қайта шеш`, detail: "Қателер дәптері: кешегі қатенің бүгінгі жауабы ең берік есте қалады.", href: "/notebook", done: (today.review ?? 0) > 0 }
      : { id: "review", kicker: "1 · ЕСКЕ ТҮСІР", title: input.cardsDue > 0 ? `${input.cardsDue} карточканы қайтала` : "Карточкалармен жылыну", detail: "Еске түсіру жаңа нәрсені үйренуге ми дайындайды: бес минут жеткілікті.", href: "/cards", done: (today.review ?? 0) > 0 };
  const learn: PlanItem = next
    ? { id: "learn", kicker: "2 · ЖАҢА МАТЕРИАЛ", title: next.entry.lesson.title, detail: next.resume ? "Тоқтаған жеріңнен жалғастыр." : "Келесі сабақ сені күтіп тұр.", href: `/labs/${next.entry.labId}/${next.entry.lesson.id}`, done: (today.lesson ?? 0) > 0 }
    : { id: "learn", kicker: "2 · ЖАҢА МАТЕРИАЛ", title: "Барлық сабақ аяқталды", detail: "Енді Тактика алаңында өзіңді сына.", href: "/tactics", done: true };
  const stretch: PlanItem = { id: "stretch", kicker: "3 · ҚИЫН ЕСЕП", title: input.daily.title, detail: "Маман талдайды, ұқсасын өзің шығарасың.", href: `/problems?p=${input.daily.id}`, done: (today.problem ?? 0) > 0 };
  return [review, learn, stretch];
}

/** Monday of the week containing `d`. */
export function weekStart(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const wd = (x.getDay() + 6) % 7;
  return new Date(x.getFullYear(), x.getMonth(), x.getDate() - wd);
}

/** Active days in the current week (Monday first). */
export function activeThisWeek(log: ActivityLog, now: Date): number {
  const s = weekStart(now);
  let n = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(s.getFullYear(), s.getMonth(), s.getDate() + i);
    if (d > now) break;
    if (dayTotal(log.days[dayKey(d)]) > 0) n++;
  }
  return n;
}

export interface HeatCell {
  key: string;
  total: number;
  level: 0 | 1 | 2 | 3 | 4;
  future: boolean;
}

/** `weeks` columns of seven days (Monday on top), ending with the current week. */
export function heatmap(log: ActivityLog, now: Date, weeks = 16): HeatCell[][] {
  const first = weekStart(now);
  const start = new Date(first.getFullYear(), first.getMonth(), first.getDate() - 7 * (weeks - 1));
  const cols: HeatCell[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: HeatCell[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + i);
      const key = dayKey(d);
      const total = dayTotal(log.days[key]);
      const level = total === 0 ? 0 : total < 3 ? 1 : total < 6 ? 2 : total < 10 ? 3 : 4;
      col.push({ key, total, level, future: d > now });
    }
    cols.push(col);
  }
  return cols;
}

export interface LabMastery {
  labId: string;
  done: number;
  total: number;
  /** Share of questions answered right the first time, when any were answered. */
  accuracy?: number;
}

export function mastery(entries: LessonEntry[], progress: LessonProgress[]): LabMastery[] {
  const byId = new Map(progress.map((p) => [p.lessonId, p]));
  const labs = [...new Set(entries.map((e) => e.labId))];
  return labs.map((labId) => {
    const mine = entries.filter((e) => e.labId === labId);
    let right = 0;
    let missed = 0;
    for (const e of mine) {
      const p = byId.get(e.lesson.id);
      if (!p) continue;
      const answered = Object.values(p.answers ?? {}).flat();
      const misses = new Set(Object.values(p.misses ?? {}).flat());
      right += answered.filter((q) => !misses.has(q)).length;
      missed += misses.size;
    }
    return { labId, done: mine.filter((e) => byId.get(e.lesson.id)?.completedAt).length, total: mine.length, accuracy: right + missed > 0 ? right / (right + missed) : undefined };
  });
}

export const GOAL_KEY = "inside-tech:goal";
export const GOALS = [3, 5, 7] as const;
export function loadGoal(): number {
  try {
    const n = Number(localStorage.getItem(GOAL_KEY));
    return (GOALS as readonly number[]).includes(n) ? n : 3;
  } catch {
    return 3;
  }
}
export function saveGoal(n: number) {
  try {
    localStorage.setItem(GOAL_KEY, String(n));
  } catch {
    /* storage unavailable */
  }
}

export function greeting(now: Date): string {
  const h = now.getHours();
  return h < 5 ? "Түн жарымы, бірақ ой сергек" : h < 12 ? "Қайырлы таң" : h < 18 ? "Қайырлы күн" : "Қайырлы кеш";
}
