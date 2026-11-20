import type { LessonDefinition } from "@inside-tech/lesson-engine";
import { aiLessons, languageLessons } from "@inside-tech/lab-ai";
import { webLessons } from "@inside-tech/lab-web";
import { gameLessons } from "@inside-tech/lab-game";
import { algoLessons } from "@inside-tech/lab-algo";
import { archLessons } from "@inside-tech/lab-arch";
import { secLessons } from "@inside-tech/lab-sec";
import { dbLessons } from "@inside-tech/lab-db";
import { netLessons } from "@inside-tech/lab-net";
import { cloudLessons } from "@inside-tech/lab-cloud";
import type { LabKind } from "./labPort";

export interface LessonEntry {
  labId: string;
  kind: LabKind;
  // Each kind has its own state type; views narrow by `kind`.
  lesson: LessonDefinition<any, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

const byOrder = (a: LessonEntry, b: LessonEntry) => a.lesson.order - b.lesson.order;

/** Every lesson, grouped by lab and in course order, whichever simulation it runs on. */
export const lessonEntries: LessonEntry[] = [
  ...[
    ...aiLessons.map((lesson) => ({ labId: "ai", kind: "classifier" as const, lesson })),
    ...languageLessons.map((lesson) => ({ labId: "ai", kind: "language" as const, lesson })),
  ].sort(byOrder),
  ...webLessons.map((lesson) => ({ labId: "web", kind: "web" as const, lesson })).sort(byOrder),
  ...gameLessons.map((lesson) => ({ labId: "game", kind: "game" as const, lesson })).sort(byOrder),
  ...algoLessons.map((lesson) => ({ labId: "algo", kind: "algo" as const, lesson })).sort(byOrder),
  ...archLessons.map((lesson) => ({ labId: "arch", kind: "arch" as const, lesson })).sort(byOrder),
  ...secLessons.map((lesson) => ({ labId: "sec", kind: "sec" as const, lesson })).sort(byOrder),
  ...dbLessons.map((lesson) => ({ labId: "db", kind: "db" as const, lesson })).sort(byOrder),
  ...netLessons.map((lesson) => ({ labId: "net", kind: "net" as const, lesson })).sort(byOrder),
  ...cloudLessons.map((lesson) => ({ labId: "cloud", kind: "cloud" as const, lesson })).sort(byOrder),
];

export const lessonsForLab = (labId: string) => lessonEntries.filter((e) => e.labId === labId);

export function findLesson(id: string): { entry: LessonEntry; next?: LessonEntry } | undefined {
  const entry = lessonEntries.find((e) => e.lesson.id === id);
  if (!entry) return undefined;
  const inLab = lessonsForLab(entry.labId);
  return { entry, next: inLab[inLab.indexOf(entry) + 1] };
}
