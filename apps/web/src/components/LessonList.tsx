"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { LessonProgress } from "@inside-tech/lesson-engine";
import { aiLessons } from "@inside-tech/lab-ai";
import { progressStore } from "@/lib/progress";
import styles from "./home.module.css";

function completion(lessonIndex: number, p?: LessonProgress): number {
  const lesson = aiLessons[lessonIndex]!;
  if (!p) return 0;
  let total = 0;
  let done = 0;
  for (const s of lesson.steps) {
    total += s.objectives.length;
    done += p.completed[s.id]?.length ?? 0;
  }
  return total ? done / total : 0;
}

export function LessonList() {
  const [progress, setProgress] = useState<Record<string, LessonProgress>>({});

  useEffect(() => {
    void progressStore()
      .list()
      .then((all) => setProgress(Object.fromEntries(all.map((p) => [p.lessonId, p]))));
  }, []);

  return (
    <ol className={styles.lessonList}>
      {aiLessons.map((l, i) => {
        const p = progress[l.id];
        const c = completion(i, p);
        return (
          <li key={l.id}>
            <Link href={`/labs/ai/${l.id}`} className={styles.lessonItem}>
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
