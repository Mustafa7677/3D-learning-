/**
 * Every comic on the site in one shelf: lesson comics (the math course and the IT labs), the
 * opening comics of the IT labs, and the episodes of «Қалай оқу керек?».
 */
import type { Comic } from "@inside-tech/lesson-engine";
import { LAB_COMICS } from "./comics";
import { EPISODES } from "./learnHow";
import { lessonEntries } from "./lessons";

export interface ShelfComic {
  id: string;
  comic: Comic;
  /** Lab id, or "learn" for the learning course. */
  shelf: string;
  /** Where the comic lives. */
  href: string;
  where: string;
}

let cache: ShelfComic[] | null = null;

export function comicShelf(): ShelfComic[] {
  if (cache) return cache;
  const out: ShelfComic[] = [];
  for (const e of lessonEntries) {
    e.lesson.steps.forEach((s, i) => {
      if (s.comic) out.push({ id: `${e.lesson.id}:${s.id}`, comic: s.comic, shelf: e.labId, href: `/labs/${e.labId}/${e.lesson.id}`, where: `${e.lesson.order}-сабақ, ${i + 1}-кезең: ${e.lesson.title}` });
    });
    const extra = LAB_COMICS[e.lesson.id];
    if (extra && !e.lesson.steps.find((s) => s.id === extra.step)?.comic) out.push({ id: `${e.lesson.id}:${extra.step}`, comic: extra.comic, shelf: e.labId, href: `/labs/${e.labId}/${e.lesson.id}`, where: `${e.lesson.order}-сабақ: ${e.lesson.title}` });
  }
  for (const ep of EPISODES) out.push({ id: `learn:${ep.id}`, comic: ep.comic, shelf: "learn", href: `/learn?e=${ep.id}`, where: `Қалай оқу керек? · «${ep.claim}»` });
  cache = out;
  return out;
}

/** The opening comic of a lesson step, when the lesson has none of its own there. */
export function extraComic(lessonId: string, stepId: string, own?: Comic): Comic | undefined {
  if (own) return undefined;
  const c = LAB_COMICS[lessonId];
  return c && c.step === stepId ? c.comic : undefined;
}

const READ = "inside-tech:comics-read";
export function loadRead(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(READ) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
export function markRead(id: string): string[] {
  const all = [...new Set([...loadRead(), id])];
  try {
    localStorage.setItem(READ, JSON.stringify(all));
  } catch {
    /* storage unavailable */
  }
  return all;
}
