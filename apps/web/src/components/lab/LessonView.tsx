"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { LessonDefinition } from "@inside-tech/lesson-engine";
import type { AiLabAction, AiLabState, LangLabAction, LangLabState } from "@inside-tech/lab-ai";
import { findLesson } from "@/lib/lessons";
import { useLabSession, type LabSession } from "@/lib/useAiLabSession";
import { useWebGL } from "@/lib/useWebGL";
import type { SceneFocus } from "../scene/AiScene";
import type { LangFocus } from "../scene/LangScene";
import { ControlPanel, type Section, type Tool } from "./ControlPanel";
import { LabShell } from "./LabShell";
import { LangControlPanel, type LangSection } from "./LangControlPanel";
import { PointInspector } from "./PointInspector";
import styles from "./lab.module.css";

const sceneLoading = () => <div className={styles.sceneLoading}>3D сахна жүктелуде…</div>;
const AiScene = dynamic(() => import("../scene/AiScene"), { ssr: false, loading: sceneLoading });
const LangScene = dynamic(() => import("../scene/LangScene"), { ssr: false, loading: sceneLoading });

/** Which control groups each lesson exposes. Keeps the UI focused on what the lesson teaches. */
const SECTIONS: Record<string, Section[]> = {
  "ai-1-data": ["data"],
  "ai-2-neuron": ["neuron", "data"],
  "ai-3-network": ["network", "data"],
  "ai-4-training": ["training", "network", "data"],
  "ai-5-overfitting": ["training", "network", "data"],
  "ai-8-build": ["training", "network", "data", "export"],
};
const LANG_SECTIONS: Record<string, LangSection[]> = {
  "ai-6-transformers": ["tokens", "embedding", "attention"],
  "ai-7-llm": ["llm"],
};

function Unsupported() {
  return (
    <div className={styles.sceneLoading}>
      Құрылғыңыз WebGL-ді қолдамайды. Сабақты басқару панелі мен графиктер арқылы жалғастыра аласың.
    </div>
  );
}

function ClassifierLesson({ lesson, nextLessonId }: { lesson: LessonDefinition<AiLabState, AiLabAction>; nextLessonId?: string }) {
  const session = useLabSession(lesson, "classifier");
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
    <LabShell
      lesson={lesson as LessonDefinition<unknown, unknown>}
      nextLessonId={nextLessonId}
      session={session as LabSession<unknown, unknown>}
      stage={
        <div className={styles.stageInner} data-tool={tool}>
          {state && webgl !== false ? (
            <AiScene state={state} focus={focus} onPointPick={onPointPick} onFloorPick={onFloorPick} />
          ) : webgl === false ? (
            <Unsupported />
          ) : (
            <div className={styles.sceneLoading}>Симуляция іске қосылуда…</div>
          )}
          {state && <PointInspector state={state} onClose={() => session.dispatch({ type: "point/select", id: null })} />}
          {(tool === "add0" || tool === "add1") && <p className={styles.stageTip}>Нүкте қосу үшін еденге бас.</p>}
        </div>
      }
      controls={
        state &&
        assessment && (
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
        )
      }
    />
  );
}

function LanguageLesson({ lesson, nextLessonId }: { lesson: LessonDefinition<LangLabState, LangLabAction>; nextLessonId?: string }) {
  const session = useLabSession(lesson, "language");
  const webgl = useWebGL();
  const { state, assessment, step } = session;
  const focus = (step?.focus ?? "embedding") as LangFocus;
  return (
    <LabShell
      lesson={lesson as LessonDefinition<unknown, unknown>}
      nextLessonId={nextLessonId}
      session={session as LabSession<unknown, unknown>}
      stage={
        <div className={styles.stageInner}>
          {state && webgl !== false ? (
            <LangScene state={state} focus={focus} onWordPick={(w) => session.dispatch({ type: "word/select", word: w })} />
          ) : webgl === false ? (
            <Unsupported />
          ) : (
            <div className={styles.sceneLoading}>Модельдер жүктелуде…</div>
          )}
        </div>
      }
      controls={
        state &&
        assessment && (
          <LangControlPanel
            state={state}
            assessment={assessment}
            sections={LANG_SECTIONS[lesson.id] ?? ["tokens"]}
            dispatch={session.dispatch}
            canUndo={session.canUndo}
            onUndo={session.undo}
          />
        )
      }
    />
  );
}

export function LessonView({ lessonId }: { lessonId: string }) {
  const found = findLesson(lessonId);
  if (!found) return null;
  const { entry, next } = found;
  return entry.kind === "classifier" ? (
    <ClassifierLesson lesson={entry.lesson} nextLessonId={next?.lesson.id} />
  ) : (
    <LanguageLesson lesson={entry.lesson} nextLessonId={next?.lesson.id} />
  );
}
