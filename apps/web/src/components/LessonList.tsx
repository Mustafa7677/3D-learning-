"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { LessonDefinition, LessonProgress } from "@inside-tech/lesson-engine";
import { lessonsForLab } from "@/lib/lessons";
import { progressStore } from "@/lib/progress";
import styles from "./home.module.css";

function completion(lesson: LessonDefinition<unknown, unknown>, p?: LessonProgress): number {
  if (!p) return 0;
  let total = 0;
  let done = 0;
  for (const s of lesson.steps) {
    total += s.objectives.length;
    done += p.completed[s.id]?.length ?? 0;
  }
  return total ? done / total : 0;
}

export function LessonList({ labId }: { labId: string }) {
  const [progress, setProgress] = useState<Record<string, LessonProgress>>({});

  useEffect(() => {
    void progressStore()
      .list()
      .then((all) => setProgress(Object.fromEntries(all.map((p) => [p.lessonId, p]))));
  }, []);

  return (
    <ol className={styles.lessonList}>
      {lessonsForLab(labId).map(({ lesson: l }) => {
        const p = progress[l.id];
        const c = completion(l, p);
        return (
          <li key={l.id}>
            <Link href={`/labs/${labId}/${l.id}`} className={styles.lessonItem}>
              <span className={styles.lessonNum} aria-hidden>
                {l.order}
              </span>
              <div>
                <h2>{l.title}</h2>
                <p>{l.summary}</p>
              </div>
              <div className={styles.lessonMeta}>
                {p?.completedAt ? <strong>Аяқталды</strong> : c > 0 ? `${Math.round(c * 100)}% орындалды` : `${l.estimatedMinutes} мин`}
                <span className={styles.bar} aria-hidden>
                  <span style={{ width: `${Math.round(c * 100)}%` }} />
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
