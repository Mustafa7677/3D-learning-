"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { LessonDefinition } from "@inside-tech/lesson-engine";
import type { LabSession } from "@/lib/useAiLabSession";
import { findLab } from "@/lib/catalog";
import { LessonPanel } from "./LessonPanel";
import styles from "./lab.module.css";

interface Props {
  labId: string;
  lesson: LessonDefinition<unknown, unknown>;
  nextLessonId?: string;
  session: LabSession<unknown, unknown>;
  stage: ReactNode;
  controls: ReactNode;
  /** A test run (e.g. from the Lesson Creator): no rewards. */
  preview?: boolean;
}

/** Shared lesson page frame: top bar, lesson steps on the left, stage, controls on the right. */
export function LabShell({ labId, lesson, nextLessonId, session, stage, controls, preview = false }: Props) {
  const { step } = session;
  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/" className={styles.brand}>
          INSIDE TECH
        </Link>
        <nav aria-label="Навигация">
          <Link href={`/labs/${labId}`}>{findLab(labId)?.title ?? labId}</Link>
          <span aria-hidden> / </span>
          <span aria-current="page">
            {lesson.order}. {lesson.title}
          </span>
        </nav>
        <span className={styles.progress} aria-label="Сабақ прогресі">
          <span style={{ width: `${Math.round(session.completion * 100)}%` }} />
        </span>
      </header>

      <main className={styles.layout}>
        <div className={styles.left}>
          {step ? (
            <LessonPanel
              lessonTitle={`${lesson.order}-сабақ · ${lesson.title}`}
              step={step}
              stepTitles={lesson.steps.map((s) => s.title)}
              onNext={session.next}
              onGoTo={session.goTo}
              onRestart={session.restartStep}
              onAnswer={session.answer}
              nextLessonHref={nextLessonId ? `/labs/${labId}/${nextLessonId}` : undefined}
              labHref={`/labs/${labId}`}
              labId={labId}
              celebrate={!preview}
            />
          ) : (
            <p className={styles.small}>Сабақ жүктелуде…</p>
          )}
        </div>
        <div className={styles.stage}>{stage}</div>
        <div className={styles.right}>{controls}</div>
      </main>
    </div>
  );
}
