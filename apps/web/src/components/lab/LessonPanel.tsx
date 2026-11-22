"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { optionOrder } from "@/lib/shuffle";
import type { AnswerResult, QuizView, StepView } from "@inside-tech/lesson-engine";
import { Prose } from "./Prose";
import { LectureCinema } from "../film/LectureCinema";
import { Reward } from "../film/Game";
import { XP_LESSON, announceXp } from "@/lib/xp";
import styles from "./lab.module.css";
import { OyuRule } from "./Oyu";
import { ComicStrip, ErrorHuntBoard, WorkedBoard } from "./StepMedia";
import { SolutionFilmPlayer } from "./SolutionFilm";

interface Props {
  lessonTitle: string;
  step: StepView;
  stepTitles: string[];
  onNext(): void;
  onGoTo(i: number): void;
  onRestart(): void;
  onAnswer(questionId: string, option: number): AnswerResult;
  onPredict?(option: number): void;
  /** Save the learner's own explanation; false if too short. */
  onExplain?(text: string): boolean;
  /** Lets a solution film move the 3D scene (display only). */
  onFilmScene?(patch: Record<string, unknown> | null): void;
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
  // Content lists the right option first; the screen must not.
  const order = useMemo(() => optionOrder(q.question, q.options.length), [q.question, q.options.length]);
  return (
    <fieldset className={styles.quiz} data-done={done}>
      <legend>{q.question}</legend>
      <div className={styles.quizOptions}>
        {order.map((i) => [q.options[i]!, i] as const).map(([o, i]) => (
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
        {done ? `✓ ${q.explain ?? ""}` : result ? (result.correct ? `✓ ${result.feedback}` : `✗ ${result.feedback} Сұрақ қателер дәптеріне жазылды.`) : ""}
      </p>
    </fieldset>
  );
}

/** Self-explanation: after the experiment, say why in your own words, then compare with an expert. */
function SelfExplainBox({ se, onExplain }: { se: NonNullable<StepView["selfExplain"]>; onExplain?(t: string): boolean }) {
  const [text, setText] = useState(se.written ?? "");
  const [short, setShort] = useState(false);
  if (!se.open) return null;
  return (
    <section className={styles.explainSelf} aria-labelledby="explain-title">
      <p id="explain-title" className={styles.explainKicker}>
        Өз сөзіңмен түсіндір
      </p>
      <p className={styles.predictQ}>{se.prompt}</p>
      {se.written === undefined ? (
        <>
          <label className="visually-hidden" htmlFor="explain-text">
            Түсіндірмең
          </label>
          <textarea
            id="explain-text"
            className={styles.explainText}
            rows={3}
            maxLength={2000}
            value={text}
            placeholder="Досыңа айтып тұрғандай жаз: не болды және неге?"
            onChange={(e) => {
              setText(e.target.value);
              setShort(false);
            }}
          />
          <button type="button" className="btn btn-primary" onClick={() => setShort(!(onExplain?.(text) ?? false))}>
            Маманның түсіндірмесімен салыстыру
          </button>
          {short && <p className={styles.predictNote}>Кемінде бір толық сөйлем жаз: өз сөзіңмен айтудың өзі түсінуді бекітеді.</p>}
        </>
      ) : (
        <div role="status" aria-label="Түсіндірме салыстыруы">
          <blockquote className={styles.explainMine}>{se.written}</blockquote>
          <ul className={styles.explainIdeas}>
            {se.coverage!.found.map((c) => (
              <li key={c} data-found="true">
                ✓ {c}
              </li>
            ))}
            {se.coverage!.missing.map((c) => (
              <li key={c} data-found="false">
                ○ {c}
              </li>
            ))}
          </ul>
          <p className={styles.explainModel}>
            <strong>Маман былай түсіндірер еді.</strong> {se.model}
          </p>
          <p className={styles.predictNote}>{se.coverage!.missing.length === 0 ? "Негізгі ойлардың бәрі сенің сөзіңде бар." : "Бос дөңгелектер: сенің мәтініңде табылмаған ойлар. Оларды маманның мәтінінен тауып, өзіңе қайта айтып көр."}</p>
        </div>
      )}
    </section>
  );
}

/** Predict, observe, explain: commit to a guess, run the experiment, then see how the guess fared. */
function Predict({ p, onPredict }: { p: NonNullable<StepView["predict"]>; onPredict?(o: number): void }) {
  const revealed = p.answer !== undefined;
  const right = revealed && p.chosen === p.answer;
  const order = useMemo(() => optionOrder(p.question, p.options.length), [p.question, p.options.length]);
  return (
    <section className={styles.predict} aria-labelledby="predict-title" data-state={revealed ? (right ? "right" : "wrong") : p.chosen !== undefined ? "waiting" : "open"}>
      <p id="predict-title" className={styles.predictKicker}>
        Алдымен болжа
      </p>
      <p className={styles.predictQ}>{p.question}</p>
      <div className={styles.predictOptions} role="group" aria-label="Болжам">
        {order.map((i) => [p.options[i]!, i] as const).map(([o, i]) => (
          <button
            key={o}
            type="button"
            aria-pressed={p.chosen === i}
            disabled={p.chosen !== undefined}
            data-answer={revealed && i === p.answer ? "true" : undefined}
            onClick={() => onPredict?.(i)}
          >
            {o}
          </button>
        ))}
      </div>
      <p className={styles.predictNote} role="status">
        {p.chosen === undefined
          ? "Тәжірибеге дейін таңда. Баға қойылмайды: мақсат сенің ойыңды тексеру."
          : !revealed
            ? "Болжамың жазылды. Енді тапсырманы орында да, не болатынын өз көзіңмен көр."
            : right
              ? `Болжамың расталды. ${p.explain}`
              : `Тәжірибе басқаша көрсетті. ${p.explain}`}
      </p>
    </section>
  );
}

export function LessonPanel({ lessonTitle, step, stepTitles, onNext, onGoTo, onRestart, onAnswer, onPredict, onExplain, onFilmScene, nextLessonHref, labHref = "/", labId = "ai", celebrate = true }: Props) {
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
    <section className={styles.lesson} aria-labelledby="lesson-step-title" data-lab={labId}>
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
      {step.predict && <Predict key={step.id} p={step.predict} onPredict={onPredict} />}
      {step.comic && <ComicStrip comic={step.comic} />}
      <Prose text={step.body} />
      {step.film && <SolutionFilmPlayer key={`${step.id}-film`} film={step.film} onScene={onFilmScene} />}
      {step.worked && <WorkedBoard key={`${step.id}-worked`} w={step.worked} />}
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

      {step.hunt && <ErrorHuntBoard key={`${step.id}-hunt`} h={step.hunt} />}
      {step.selfExplain && <SelfExplainBox key={`${step.id}-${step.selfExplain.written ?? ""}`} se={step.selfExplain} onExplain={onExplain} />}

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
