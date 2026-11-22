"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RemoteRuntime, type AssessmentResult } from "@inside-tech/sim-core";
import { LessonEngine, type AnswerResult, type LessonDefinition, type StepView } from "@inside-tech/lesson-engine";
import { createLabPort, type LabKind } from "./labPort";
import { progressStore } from "./progress";
import { apiEnabled } from "./api";
import { SessionLog } from "./sessionLog";

export interface LabSession<S, A> {
  ready: boolean;
  state?: S;
  assessment?: AssessmentResult;
  canUndo: boolean;
  step?: StepView;
  completion: number;
  dispatch(a: A): void;
  undo(): void;
  next(): void;
  goTo(index: number): void;
  restartStep(): void;
  answer(questionId: string, option: number): AnswerResult;
  /** Commit to the step's prediction before the experiment. */
  predict(option: number): void;
  /** Save the learner's own explanation of the step; false if too short or too early. */
  explainSelf(text: string): boolean;
}

/**
 * Wires one lesson to its simulation runtime (Web Worker or main-thread
 * channel: same protocol). The main thread renders snapshots and grades
 * objectives with the LessonEngine, only on states that already include the
 * step's setup actions (`ack` ≥ the last setup command).
 */
/** `persist: false` runs a throwaway session (lesson previews): nothing is loaded or saved. */
export function useLabSession<S, A>(lesson: LessonDefinition<S, A>, kind: LabKind, opts: { persist?: boolean } = {}): LabSession<S, A> {
  const persist = opts.persist !== false;
  const remote = useRef<RemoteRuntime<S, A> | null>(null);
  const engine = useRef<LessonEngine<S, A> | null>(null);
  const [snap, setSnap] = useState<{ state: S; assessment: AssessmentResult; canUndo: boolean }>();
  const [step, setStep] = useState<StepView>();
  const [completion, setCompletion] = useState(0);
  const gate = useRef(Number.POSITIVE_INFINITY);
  const log = useRef<SessionLog | null>(null);

  useEffect(() => {
    let disposed = false;
    const lab = createLabPort(kind);
    const rt = new RemoteRuntime<S, A>(lab.port);
    remote.current = rt;
    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    let flush = () => {};
    // A reload or tab close skips React cleanup; pagehide still fires.
    const onHide = () => flush();
    window.addEventListener("pagehide", onHide);
    gate.current = Number.POSITIVE_INFINITY;

    (persist ? progressStore().load(lesson.id) : Promise.resolve(undefined))
      .then((saved) => {
        if (disposed) return;
        const eng = new LessonEngine(lesson, saved);
        engine.current = eng;
        eng.bus.on("progress", (p) => {
          clearTimeout(saveTimer);
          if (persist) saveTimer = setTimeout(() => void progressStore().save(p), 400);
        });
        // Milestones are saved at once; routine updates are debounced above.
        const saveNow = () => {
          clearTimeout(saveTimer);
          if (persist) void progressStore().save(eng.getProgress());
        };
        eng.bus.on("stepEntered", saveNow);
        eng.bus.on("stepCompleted", saveNow);
        eng.bus.on("lessonCompleted", saveNow);
        // Learning analytics for teachers (only with an API, only for saved sessions).
        const slog = persist && apiEnabled ? new SessionLog() : null;
        log.current = slog;
        if (slog) {
          slog.push("enter", eng.step.id);
          const send = () => void rt.record().then((rec) => slog.upload(lesson.id, kind, rec), () => slog.upload(lesson.id, kind));
          eng.bus.on("stepEntered", (e) => slog.push("enter", e.stepId));
          eng.bus.on("stepCompleted", (e) => {
            slog.push("done", e.stepId);
            send();
          });
        }
        flush = () => {
          saveNow();
          void slog?.upload(lesson.id, kind, undefined, true);
        };
        eng.step.onEnter?.forEach((a) => rt.dispatch(a));
        rt.play();
        gate.current = rt.lastSent;
        rt.subscribe((s) => {
          if (s.ack >= gate.current) eng.update(s.state, s.assessment);
          setSnap({ state: s.state, assessment: s.assessment, canUndo: s.canUndo });
          setStep(eng.view());
          setCompletion(eng.completion());
        });
      });

    return () => {
      disposed = true;
      window.removeEventListener("pagehide", onHide);
      clearTimeout(saveTimer);
      if (engine.current) void progressStore().save(engine.current.getProgress());
      void log.current?.upload(lesson.id, kind, undefined, true);
      log.current = null;
      rt.dispose();
      lab.dispose();
      remote.current = null;
      engine.current = null;
    };
  }, [lesson, kind]);

  const dispatch = useCallback((a: A) => remote.current?.dispatch(a), []);
  const undo = useCallback(() => {
    if (engine.current) log.current?.push("undo", engine.current.step.id);
    remote.current?.undo();
  }, []);

  const enter = useCallback(() => {
    const eng = engine.current;
    const rt = remote.current;
    if (!eng || !rt) return;
    eng.step.onEnter?.forEach((a) => rt.dispatch(a));
    gate.current = rt.lastSent;
    setStep(eng.view());
  }, []);

  const next = useCallback(() => {
    if (engine.current?.advance()) enter();
  }, [enter]);

  const goTo = useCallback(
    (i: number) => {
      if (engine.current?.goTo(i)) enter();
    },
    [enter],
  );

  const answer = useCallback((questionId: string, option: number): AnswerResult => {
    const eng = engine.current;
    if (!eng) return { correct: false, feedback: "Сабақ әлі жүктелуде." };
    const before = eng.view().quiz.find((q) => q.id === questionId)?.answered;
    const r = eng.answer(questionId, option);
    if (!before) log.current?.push(r.correct ? "right" : "wrong", eng.step.id, { q: questionId, o: option });
    setStep(eng.view());
    setCompletion(eng.completion());
    return r;
  }, []);

  const predict = useCallback((option: number) => {
    const eng = engine.current;
    // Saved with the lesson's progress; not sent to the session log, whose event types the API fixes.
    if (!eng || !eng.predict(option)) return;
    setStep(eng.view());
  }, []);

  const explainSelf = useCallback((text: string) => {
    const eng = engine.current;
    if (!eng || !eng.explainSelf(text)) return false;
    setStep(eng.view());
    return true;
  }, []);

  return {
    answer,
    predict,
    explainSelf,
    ready: !!snap && !!step,
    state: snap?.state,
    assessment: snap?.assessment,
    canUndo: snap?.canUndo ?? false,
    step,
    completion,
    dispatch,
    undo,
    next,
    goTo,
    restartStep: () => {
      if (engine.current) log.current?.push("restart", engine.current.step.id);
      enter();
    },
  };
}
