"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { aiLessons } from "@inside-tech/lab-ai";
import { useAiLabSession } from "@/lib/useAiLabSession";
import { useWebGL } from "@/lib/useWebGL";
import type { SceneFocus } from "../scene/AiScene";
import { ControlPanel, type Section, type Tool } from "./ControlPanel";
import { LessonPanel } from "./LessonPanel";
import { PointInspector } from "./PointInspector";
import styles from "./lab.module.css";

const AiScene = dynamic(() => import("../scene/AiScene"), {
  ssr: false,
  loading: () => <div className={styles.sceneLoading}>3D сахна жүктелуде…</div>,
});

/** Which control groups each lesson exposes. Keeps the UI focused on what the lesson teaches. */
const SECTIONS: Record<string, Section[]> = {
  "ai-1-data": ["data"],
  "ai-2-neuron": ["neuron", "data"],
  "ai-3-network": ["network", "data"],
  "ai-4-training": ["training", "network", "data"],
};

export function LessonView({ lessonId }: { lessonId: string }) {
  const index = aiLessons.findIndex((l) => l.id === lessonId);
  const lesson = aiLessons[index]!;
  const next = aiLessons[index + 1];
  const session = useAiLabSession(lesson);
  const [tool, setTool] = useState<Tool>("select");
  const webgl = useWebGL();

  const { state, assessment, step } = session;
  const focus = (step?.focus ?? "overview") as SceneFocus;

  const onPointPick = (id: number) => {
    if (tool === "remove") session.dispatch({ type: "point/remove", id });
    else if (tool === "relabel") session.dispatch({ type: "point/relabel", id });
    else session.dispatch({ type: "point/select", id });
  };
  const onFloorPick = (x: number, y: number) => {
    if (tool === "add0" || tool === "add1") session.dispatch({ type: "point/add", x, y, label: tool === "add0" ? 0 : 1 });
  };

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/" className={styles.brand}>
          INSIDE TECH
        </Link>
        <nav aria-label="Навигация">
          <Link href="/labs/ai">AI LAB</Link>
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
              nextLessonHref={next ? `/labs/ai/${next.id}` : undefined}
            />
          ) : (
            <p className={styles.small}>Сабақ жүктелуде…</p>
          )}
        </div>

        <div className={styles.stage} data-tool={tool}>
          {state && webgl !== false ? (
            <AiScene state={state} focus={focus} onPointPick={onPointPick} onFloorPick={onFloorPick} />
          ) : webgl === false ? (
            <div className={styles.sceneLoading}>
              Құрылғыңыз WebGL-ді қолдамайды. Сабақты басқару панелі мен графиктер арқылы жалғастыра аласың.
            </div>
          ) : (
            <div className={styles.sceneLoading}>Симуляция іске қосылуда…</div>
          )}
          {state && <PointInspector state={state} onClose={() => session.dispatch({ type: "point/select", id: null })} />}
          {(tool === "add0" || tool === "add1") && <p className={styles.stageTip}>Нүкте қосу үшін еденге бас.</p>}
        </div>

        <div className={styles.right}>
          {state && assessment && (
            <ControlPanel
              state={state}
              assessment={assessment}
              sections={SECTIONS[lesson.id] ?? ["data"]}
              tool={tool}
              onTool={setTool}
              dispatch={session.dispatch}
              canUndo={session.canUndo}
              onUndo={session.undo}
            />
          )}
        </div>
      </main>
    </div>
  );
}
