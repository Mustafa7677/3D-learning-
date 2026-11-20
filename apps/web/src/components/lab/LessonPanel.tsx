"use client";

import Link from "next/link";
import { useState } from "react";
import type { StepView } from "@inside-tech/lesson-engine";
import styles from "./lab.module.css";

interface Props {
  lessonTitle: string;
  step: StepView;
  stepTitles: string[];
  onNext(): void;
  onGoTo(i: number): void;
  onRestart(): void;
  nextLessonHref?: string;
}

export function LessonPanel({ lessonTitle, step, stepTitles, onNext, onGoTo, onRestart, nextLessonHref }: Props) {
  const [hintOpen, setHintOpen] = useState(false);

  return (
    <section className={styles.lesson} aria-labelledby="lesson-step-title">
      <p className={styles.lessonName}>{lessonTitle}</p>
      <ol className={styles.stepper} aria-label="Сабақ кезеңдері">
        {stepTitles.map((t, i) => (
          <li key={t}>
            <button
              type="button"
              className={styles.stepDot}
              aria-current={i === step.index ? "step" : undefined}
              data-state={i < step.index ? "done" : i === step.index ? "current" : "todo"}
              onClick={() => onGoTo(i)}
              title={t}
            >
              <span className="visually-hidden">
                {i + 1}-кезең: {t}
              </span>
            </button>
          </li>
        ))}
      </ol>

      <h1 id="lesson-step-title" className={styles.stepTitle}>
        {step.title}
      </h1>
      <div className={styles.body}>
        {step.body.split("\n\n").map((para) => (
          <p key={para}>{para}</p>
        ))}
      </div>

      <h2 className={styles.objHeading}>Тапсырма</h2>
      <ul className={styles.objectives}>
        {step.objectives.map((o) => (
          <li key={o.id} data-done={o.done}>
            <span className={styles.check} aria-hidden>
              {o.done ? "✓" : ""}
            </span>
            <span>
              {o.text}
              <span className="visually-hidden">{o.done ? " (орындалды)" : " (орындалмады)"}</span>
            </span>
          </li>
        ))}
      </ul>

      {step.hints.length > 0 && (
        <div className={styles.hint}>
          <button type="button" className={styles.linkBtn} aria-expanded={hintOpen} onClick={() => setHintOpen((v) => !v)}>
            {hintOpen ? "Кеңесті жасыру" : "Кеңес керек пе?"}
          </button>
          {hintOpen && step.hints.map((h) => <p key={h}>{h}</p>)}
        </div>
      )}

      <div className={styles.lessonActions} aria-live="polite">
        {step.lessonComplete && step.isLast ? (
          <>
            <p className={styles.done}>Сабақ аяқталды.</p>
            {nextLessonHref ? (
              <Link className="btn btn-primary" href={nextLessonHref}>
                Келесі сабаққа өту
              </Link>
            ) : (
              <Link className="btn btn-primary" href="/labs/ai">
                Зертханаға оралу
              </Link>
            )}
          </>
        ) : (
          <button type="button" className="btn btn-primary" disabled={!step.complete || step.isLast} onClick={onNext}>
            {step.complete ? "Келесі кезең" : `${step.objectives.filter((o) => o.done).length} / ${step.objectives.length} орындалды`}
          </button>
        )}
        <button type="button" className="btn" onClick={onRestart}>
          Кезеңді қайта бастау
        </button>
      </div>
    </section>
  );
}
