import type { LessonProgress } from "@inside-tech/lesson-engine";
import { openLabs } from "./catalog";
import { lessonEntries, lessonsForLab } from "./lessons";

export interface PassportLesson {
  id: string;
  labId: string;
  title: string;
  href: string;
}

/** The lab's stamp: the first lesson finished there, and when. */
export interface Stamp {
  lesson: PassportLesson;
  at: number;
}

export interface PassportLab {
  id: string;
  title: string;
  href: string;
  done: number;
  total: number;
  stamp?: Stamp;
  /** The next lesson to open in this lab (absent when every lesson is done). */
  next?: PassportLesson & { started: boolean };
}

export interface Resume {
  lesson: PassportLesson;
  /** The step the learner is on (1-based) and how many there are. */
  step: number;
  steps: number;
  at: number;
}

export interface Passport {
  /** True when there is no progress on any known lesson. */
  empty: boolean;
  /** Where to continue: the most recent unfinished lesson. */
  resume?: Resume;
  /** The first lesson of the platform, for an empty passport. */
  first: PassportLesson;
  labs: PassportLab[];
  /** Finished lessons, newest first. */
  finished: (PassportLesson & { at: number })[];
  lessonsDone: number;
  lessonsTotal: number;
  stamps: number;
}

const toLesson = (labId: string, id: string, title: string): PassportLesson => ({ id, labId, title, href: `/labs/${labId}/${id}` });

/**
 * Build the passport from saved progress only. Progress on lessons this site
 * does not know (removed or authored elsewhere) is ignored, never guessed.
 */
export function buildPassport(progress: LessonProgress[]): Passport {
  const byId = new Map(lessonEntries.map((e) => [e.lesson.id, e]));
  const known = progress.filter((p) => byId.has(p.lessonId));
  const prog = new Map(known.map((p) => [p.lessonId, p]));

  const finished = known
    .filter((p) => typeof p.completedAt === "number")
    .map((p) => {
      const e = byId.get(p.lessonId)!;
      return { ...toLesson(e.labId, e.lesson.id, e.lesson.title), at: p.completedAt! };
    })
    .sort((a, b) => b.at - a.at);

  const labs: PassportLab[] = openLabs.map((lab) => {
    const lessons = lessonsForLab(lab.id);
    const doneHere = finished.filter((f) => f.labId === lab.id);
    const first = doneHere.reduce<(typeof doneHere)[number] | undefined>((m, f) => (!m || f.at < m.at ? f : m), undefined);
    const nextEntry = lessons.find((e) => !prog.get(e.lesson.id)?.completedAt);
    return {
      id: lab.id,
      title: lab.title,
      href: lab.href ?? `/labs/${lab.id}`,
      done: doneHere.length,
      total: lessons.length,
      stamp: first && { lesson: { id: first.id, labId: first.labId, title: first.title, href: first.href }, at: first.at },
      next: nextEntry && { ...toLesson(lab.id, nextEntry.lesson.id, nextEntry.lesson.title), started: prog.has(nextEntry.lesson.id) },
    };
  });

  const open = known.filter((p) => !p.completedAt).sort((a, b) => b.updatedAt - a.updatedAt)[0];
  let resume: Resume | undefined;
  if (open) {
    const e = byId.get(open.lessonId)!;
    const steps = e.lesson.steps.length;
    resume = { lesson: toLesson(e.labId, e.lesson.id, e.lesson.title), step: Math.min(steps, Math.max(1, open.stepIndex + 1)), steps, at: open.updatedAt };
  }

  const firstEntry = lessonsForLab(openLabs[0]!.id)[0]!;
  return {
    empty: known.length === 0,
    resume,
    first: toLesson(firstEntry.labId, firstEntry.lesson.id, firstEntry.lesson.title),
    labs,
    finished,
    lessonsDone: finished.length,
    lessonsTotal: labs.reduce((n, l) => n + l.total, 0),
    stamps: labs.filter((l) => l.stamp).length,
  };
}

/** 21.11.2026: the same on every machine, no locale data needed. */
export function stampDate(at: number): string {
  const d = new Date(at);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${two(d.getDate())}.${two(d.getMonth() + 1)}.${d.getFullYear()}`;
}
