"use client";

import Link from "next/link";
import { MATH_COURSE } from "@inside-tech/lab-math";
import styles from "./film.module.css";

/**
 * The first year of the mathematics degree as a map: five subjects in the
 * order they are taught, every topic listed, the ones built here linked.
 */
export function MathCourseMap({ done }: { done: Record<string, boolean> }) {
  let n = 0;
  return (
    <nav className={styles.mathMap} aria-label="1-курс картасы">
      <p className={styles.mathMapKicker}>1-КЕЗЕҢ · УНИВЕРСИТЕТТІҢ 1-КУРСЫ · 5 ПӘН · 36 ТАҚЫРЫП</p>
      <ol className={styles.mathSubjects}>
        {MATH_COURSE.map((s) => (
          <li key={s.slug} className={styles.mathSubject} style={{ ["--accent" as string]: s.color }}>
            <span className={styles.mathGlyph} aria-hidden>
              {s.glyph}
            </span>
            <div>
              <h3>{s.title}</h3>
              <p className={styles.mathTerm}>
                {s.term} · {s.lessons.length} тақырып
              </p>
              <ol className={styles.mathTopics}>
                {s.lessons.map((l) => {
                  n += 1;
                  return (
                    <li key={l.title} data-open={!!l.id} data-done={(l.id && done[l.id]) || undefined}>
                      <span className={styles.mathTopicNum}>{n}</span>
                      {l.id ? <Link href={`/labs/math/${l.id}`}>{l.title}</Link> : <span>{l.title}</span>}
                      {!l.id && <em>жақында</em>}
                    </li>
                  );
                })}
              </ol>
            </div>
          </li>
        ))}
      </ol>
    </nav>
  );
}
