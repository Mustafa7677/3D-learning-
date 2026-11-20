"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RemoteRuntime, type AssessmentResult, type MessagePortLike } from "@inside-tech/sim-core";
import { LessonEngine, type LessonDefinition, type StepView } from "@inside-tech/lesson-engine";
import type { AiLabAction, AiLabState } from "@inside-tech/lab-ai";
import { progressStore } from "./progress";

export interface AiLabSession {
  ready: boolean;
  state?: AiLabState;
  assessment?: AssessmentResult;
  canUndo: boolean;
  step?: StepView;
  completion: number;
  dispatch(a: AiLabAction): void;
  undo(): void;
  next(): void;
  goTo(index: number): void;
  restartStep(): void;
}

/**
 * Wires one lesson to a simulation runtime living in a Web Worker.
 * The worker owns all compute (training included); the main thread only
 * renders snapshots and grades objectives with the LessonEngine.
 */
export function useAiLabSession(lesson: LessonDefinition<AiLabState, AiLabAction>): AiLabSession {
  const remote = useRef<RemoteRuntime<AiLabState, AiLabAction> | null>(null);
  const engine = useRef<LessonEngine<AiLabState, AiLabAction> | null>(null);
  const [snap, setSnap] = useState<{ state: AiLabState; assessment: AssessmentResult; canUndo: boolean }>();
  const [step, setStep] = useState<StepView>();
  const [completion, setCompletion] = useState(0);
  const gate = useRef(Number.POSITIVE_INFINITY);

  useEffect(() => {
    let disposed = false;
    const worker = new Worker(new URL("../workers/ai-lab.worker.ts", import.meta.url), { type: "module" });
    const rt = new RemoteRuntime<AiLabState, AiLabAction>(worker as unknown as MessagePortLike);
    remote.current = rt;
    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    // Objectives are graded only on states that already include the step's setup actions.
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
        // Build the step's world, then start the fixed-step loop.
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
      clearTimeout(saveTimer);
      if (engine.current) void progressStore().save(engine.current.getProgress());
      rt.dispose();
      worker.terminate();
      remote.current = null;
      engine.current = null;
    };
  }, [lesson]);

  const dispatch = useCallback((a: AiLabAction) => remote.current?.dispatch(a), []);
  const undo = useCallback(() => remote.current?.undo(), []);

  const enter = useCallback(() => {
    const eng = engine.current;
    if (!eng) return;
    const rt = remote.current;
    if (!rt) return;
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
