import type { LessonDefinition } from "@inside-tech/lesson-engine";
import { aiLessons, languageLessons } from "@inside-tech/lab-ai";
import type { LabKind } from "./labPort";

export interface LessonEntry {
  kind: LabKind;
  // Each kind has its own state type; views narrow by `kind`.
  lesson: LessonDefinition<any, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/** Every AI LAB lesson in course order, whichever simulation it runs on. */
export const lessonEntries: LessonEntry[] = [
  ...aiLessons.map((lesson) => ({ kind: "classifier" as const, lesson })),
  ...languageLessons.map((lesson) => ({ kind: "language" as const, lesson })),
].sort((a, b) => a.lesson.order - b.lesson.order);

export function findLesson(id: string): { entry: LessonEntry; next?: LessonEntry } | undefined {
  const i = lessonEntries.findIndex((e) => e.lesson.id === id);
  if (i < 0) return undefined;
  return { entry: lessonEntries[i]!, next: lessonEntries[i + 1] };
}
