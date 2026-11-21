"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { AnswerResult, QuizView, StepView } from "@inside-tech/lesson-engine";
import { Prose } from "./Prose";
import { LectureCinema } from "../film/LectureCinema";
import { Reward } from "../film/Game";
import { XP_LESSON, announceXp } from "@/lib/xp";
import styles from "./lab.module.css";
import { OyuRule } from "./Oyu";

interface Props {
  lessonTitle: string;
  step: StepView;
  stepTitles: string[];
  onNext(): void;
  onGoTo(i: number): void;
  onRestart(): void;
  onAnswer(questionId: string, option: number): AnswerResult;
  nextLessonHref?: string;
  labHref?: string;
  /** Which lab this is, for the emblem behind the 3D lecture. */
  labId?: string;
  /** Show the XP reward when the lesson is finished. */
  celebrate?: boolean;
}

/** One concept-check question: pick an option, get feedback, retry until right. */
function Question({ q, onAnswer }: { q: QuizView; onAnswer: Props["onAnswer"] }) {
  const [picked, setPicked] = useState<number | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const done = q.answered;
  return (
    <fieldset className={styles.quiz} data-done={done}>
      <legend>{q.question}</legend>
      <div className={styles.quizOptions}>
        {q.options.map((o, i) => (
          <button
            key={i}
            type="button"
            className={styles.quizOption}
            aria-pressed={picked === i}
            data-state={picked === i && result ? (result.correct ? "right" : "wrong") : undefined}
            disabled={done}
            onClick={() => {
              setPicked(i);
              setResult(onAnswer(q.id, i));
            }}
          >
            {o}
          </button>
        ))}
      </div>
      <p className={styles.quizFeedback} aria-live="polite" data-correct={done || result?.correct ? "true" : result ? "false" : undefined}>
        {done ? `✓ ${q.explain ?? ""}` : result ? (result.correct ? `✓ ${result.feedback}` : `✗ ${result.feedback}`) : ""}
      </p>
    </fieldset>
  );
}

export function LessonPanel({ lessonTitle, step, stepTitles, onNext, onGoTo, onRestart, onAnswer, nextLessonHref, labHref = "/", labId = "ai", celebrate = true }: Props) {
  const [hintOpen, setHintOpen] = useState(false);
  const [cinema, setCinema] = useState(false);
  const [reward, setReward] = useState(false);
  // Celebrate only a finish that happens now, not a lesson that was already done on load.
  const finished = step.lessonComplete && step.isLast;
  const wasFinished = useRef<boolean | null>(null);
  useEffect(() => {
    if (celebrate && wasFinished.current === false && finished) {
      setReward(true);
      setTimeout(announceXp, 600);
    }
    wasFinished.current = finished;
  }, [finished, celebrate]);
  const total = step.objectives.length + step.quiz.length;
  const done = step.objectives.filter((o) => o.done).length + step.quiz.filter((q) => q.answered).length;

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
      <OyuRule className={styles.rule} />

      <h1 id="lesson-step-title" className={styles.stepTitle}>
        {step.title}
      </h1>
      <button type="button" className={styles.cinemaBtn} onClick={() => setCinema(true)}>
        Түсіндірмені 3D-де оқу
      </button>
      <Prose text={step.body} />
      {cinema && (
        <LectureCinema
          labId={labId}
          stepTitle={step.title}
          body={step.body}
          onClose={() => {
            setCinema(false);
            document.getElementById("lesson-task")?.scrollIntoView({ block: "start" });
          }}
        />
      )}

      <h2 id="lesson-task" className={styles.objHeading}>
        Тапсырма
      </h2>
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

      {step.quiz.length > 0 && (
        <>
          <h2 className={styles.objHeading}>Түсінігіңді тексер</h2>
          {step.quiz.map((q) => (
            <Question key={`${step.id}-${q.id}`} q={q} onAnswer={onAnswer} />
          ))}
        </>
      )}

      {reward && <Reward xp={XP_LESSON} nextHref={nextLessonHref} onClose={() => setReward(false)} />}
      <div className={styles.lessonActions} aria-live="polite">
        {step.lessonComplete && step.isLast ? (
          <>
            <p className={styles.done}>Сабақ аяқталды.</p>
            {nextLessonHref ? (
              <Link className="btn btn-primary" href={nextLessonHref}>
                Келесі сабаққа өту
              </Link>
            ) : (
              <Link className="btn btn-primary" href={labHref}>
                Зертханаға оралу
              </Link>
            )}
          </>
        ) : (
          <button type="button" className="btn btn-primary" disabled={!step.complete || step.isLast} onClick={onNext}>
            {step.complete ? "Келесі кезең" : `${done} / ${total} орындалды`}
          </button>
        )}
        <button type="button" className="btn" onClick={onRestart}>
          Кезеңді қайта бастау
        </button>
      </div>
    </section>
  );
}
