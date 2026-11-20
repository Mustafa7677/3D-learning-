"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RemoteRuntime, type AssessmentResult } from "@inside-tech/sim-core";
import { LessonEngine, type LessonDefinition, type StepView } from "@inside-tech/lesson-engine";
import { createLabPort, type LabKind } from "./labPort";
import { progressStore } from "./progress";

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
}

/**
 * Wires one lesson to its simulation runtime (Web Worker or main-thread
 * channel — same protocol). The main thread renders snapshots and grades
 * objectives with the LessonEngine, only on states that already include the
 * step's setup actions (`ack` ≥ the last setup command).
 */
export function useLabSession<S, A>(lesson: LessonDefinition<S, A>, kind: LabKind): LabSession<S, A> {
  const remote = useRef<RemoteRuntime<S, A> | null>(null);
  const engine = useRef<LessonEngine<S, A> | null>(null);
  const [snap, setSnap] = useState<{ state: S; assessment: AssessmentResult; canUndo: boolean }>();
  const [step, setStep] = useState<StepView>();
  const [completion, setCompletion] = useState(0);
  const gate = useRef(Number.POSITIVE_INFINITY);

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

    progressStore()
      .load(lesson.id)
      .then((saved) => {
        if (disposed) return;
        const eng = new LessonEngine(lesson, saved);
        engine.current = eng;
        eng.bus.on("progress", (p) => {
          clearTimeout(saveTimer);
          saveTimer = setTimeout(() => void progressStore().save(p), 400);
        });
        // Milestones are saved at once; routine updates are debounced above.
        const saveNow = () => {
          clearTimeout(saveTimer);
          void progressStore().save(eng.getProgress());
        };
        eng.bus.on("stepEntered", saveNow);
        eng.bus.on("stepCompleted", saveNow);
        eng.bus.on("lessonCompleted", saveNow);
        flush = saveNow;
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
      rt.dispose();
      lab.dispose();
      remote.current = null;
      engine.current = null;
    };
  }, [lesson, kind]);

  const dispatch = useCallback((a: A) => remote.current?.dispatch(a), []);
  const undo = useCallback(() => remote.current?.undo(), []);

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

  return {
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
    restartStep: enter,
  };
}
