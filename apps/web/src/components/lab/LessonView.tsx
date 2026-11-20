"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { LessonDefinition } from "@inside-tech/lesson-engine";
import type { AiLabAction, AiLabState, LangLabAction, LangLabState } from "@inside-tech/lab-ai";
import type { WebLabAction, WebLabState } from "@inside-tech/lab-web";
import type { GameLabAction, GameLabState, Tile } from "@inside-tech/lab-game";
import { findLesson } from "@/lib/lessons";
import { useLabSession, type LabSession } from "@/lib/useAiLabSession";
import { useWebGL } from "@/lib/useWebGL";
import type { SceneFocus } from "../scene/AiScene";
import type { LangFocus } from "../scene/LangScene";
import type { WebFocus } from "../scene/WebScene";
import type { GameFocus } from "../scene/GameScene";
import { ControlPanel, type Section, type Tool } from "./ControlPanel";
import { LabShell } from "./LabShell";
import { LangControlPanel, type LangSection } from "./LangControlPanel";
import { PointInspector } from "./PointInspector";
import { WebControlPanel, type WebSection } from "./WebControlPanel";
import { GameControlPanel, type GameSection } from "./GameControlPanel";
import styles from "./lab.module.css";

const sceneLoading = () => <div className={styles.sceneLoading}>3D сахна жүктелуде…</div>;
const AiScene = dynamic(() => import("../scene/AiScene"), { ssr: false, loading: sceneLoading });
const LangScene = dynamic(() => import("../scene/LangScene"), { ssr: false, loading: sceneLoading });
const WebScene = dynamic(() => import("../scene/WebScene"), { ssr: false, loading: sceneLoading });
const GameScene = dynamic(() => import("../scene/GameScene"), { ssr: false, loading: sceneLoading });

/** Which control groups each lesson exposes. Keeps the UI focused on what the lesson teaches. */
const SECTIONS: Record<string, Section[]> = {
  "ai-1-data": ["data"],
  "ai-2-neuron": ["neuron", "data"],
  "ai-3-network": ["network", "data"],
  "ai-4-training": ["training", "network", "data"],
  "ai-5-overfitting": ["training", "network", "data"],
  "ai-8-build": ["training", "network", "data", "export"],
  "ai-9-pset": ["training", "network"],
};
const LANG_SECTIONS: Record<string, LangSection[]> = {
  "ai-6-transformers": ["tokens", "embedding", "attention"],
  "ai-7-llm": ["llm"],
};
const WEB_SECTIONS: Record<string, WebSection[]> = {
  "web-1-internet": ["request", "server"],
  "web-2-html": ["html"],
  "web-3-css": ["box", "flex"],
  "web-4-js": ["loop"],
  "web-5-backend": ["request", "routes"],
  "web-6-db": ["sql", "request"],
  "web-7-debug": ["request", "dns", "routes", "sql"],
  "web-8-deploy": ["html", "deploy", "request", "dns", "cache"],
  "web-9-pset": ["sql", "request", "routes", "loop"],
};

const GAME_SECTIONS: Record<string, GameSection[]> = {
  "game-1-objects": ["scene"],
  "game-2-camera": ["camera", "scene"],
  "game-3-loop": ["loop"],
  "game-4-physics": ["physics"],
  "game-5-graphics": ["graphics"],
  "game-6-scripting": ["play", "rules"],
  "game-7-logic": ["play", "ai", "rules"],
  "game-8-create": ["editor", "play", "rules", "ai"],
  "game-9-pset": ["physics", "editor", "play", "rules", "ai"],
};

const KEYS: Record<string, "up" | "down" | "left" | "right"> = {
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
};

function Unsupported() {
  return (
    <div className={styles.sceneLoading}>
      Құрылғыңыз WebGL-ді қолдамайды. Сабақты басқару панелі арқылы жалғастыра аласың.
    </div>
  );
}

interface LessonProps<S, A> {
  labId: string;
  lesson: LessonDefinition<S, A>;
  nextLessonId?: string;
}

function ClassifierLesson({ labId, lesson, nextLessonId }: LessonProps<AiLabState, AiLabAction>) {
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
      labId={labId}
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

function LanguageLesson({ labId, lesson, nextLessonId }: LessonProps<LangLabState, LangLabAction>) {
  const session = useLabSession(lesson, "language");
  const webgl = useWebGL();
  const { state, assessment, step } = session;
  const focus = (step?.focus ?? "embedding") as LangFocus;
  return (
    <LabShell
      labId={labId}
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

function WebLesson({ labId, lesson, nextLessonId }: LessonProps<WebLabState, WebLabAction>) {
  const session = useLabSession(lesson, "web");
  const webgl = useWebGL();
  const { state, step } = session;
  const focus = (step?.focus ?? "network") as WebFocus;
  return (
    <LabShell
      labId={labId}
      lesson={lesson as LessonDefinition<unknown, unknown>}
      nextLessonId={nextLessonId}
      session={session as LabSession<unknown, unknown>}
      stage={
        <div className={styles.stageInner}>
          {state && webgl !== false ? (
            <WebScene state={state} focus={focus} onDomPick={(id) => session.dispatch({ type: "dom/select", id })} />
          ) : webgl === false ? (
            <Unsupported />
          ) : (
            <div className={styles.sceneLoading}>Симуляция іске қосылуда…</div>
          )}
        </div>
      }
      controls={
        state && (
          <WebControlPanel
            state={state}
            sections={WEB_SECTIONS[lesson.id] ?? ["request"]}
            focus={focus}
            dispatch={session.dispatch}
            canUndo={session.canUndo}
            onUndo={session.undo}
          />
        )
      }
    />
  );
}

function GameLesson({ labId, lesson, nextLessonId }: LessonProps<GameLabState, GameLabAction>) {
  const session = useLabSession(lesson, "game");
  const webgl = useWebGL();
  const [brush, setBrush] = useState<Tile>("#");
  const { state, step, dispatch } = session;
  const focus = (step?.focus ?? "scene") as GameFocus;
  const playing = state?.game.status === "playing";

  // Arrow keys / WASD drive the player while a game is running (ignored while typing in a field).
  useEffect(() => {
    if (!playing) return;
    const handler = (down: boolean) => (e: KeyboardEvent) => {
      const key = KEYS[e.code];
      const t = e.target as HTMLElement | null;
      if (!key || (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT"))) return;
      e.preventDefault();
      if (!e.repeat) dispatch({ type: "game/input", key, down });
    };
    const kd = handler(true);
    const ku = handler(false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
  }, [playing, dispatch]);

  return (
    <LabShell
      labId={labId}
      lesson={lesson as LessonDefinition<unknown, unknown>}
      nextLessonId={nextLessonId}
      session={session as LabSession<unknown, unknown>}
      stage={
        <div className={styles.stageInner}>
          {state && webgl !== false ? (
            <GameScene
              state={state}
              focus={focus}
              brush={brush}
              onSelect={(id) => dispatch({ type: "scene/select", id })}
              onTile={(i, j) => dispatch({ type: "game/tile", i, j, tile: brush })}
              onDrop={(x, z) => dispatch({ type: "physics/drop", x, z })}
            />
          ) : webgl === false ? (
            <Unsupported />
          ) : (
            <div className={styles.sceneLoading}>Ойын қозғалтқышы іске қосылуда…</div>
          )}
        </div>
      }
      controls={
        state && (
          <GameControlPanel
            state={state}
            sections={GAME_SECTIONS[lesson.id] ?? ["scene"]}
            brush={brush}
            onBrush={setBrush}
            dispatch={dispatch}
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
  const props = { labId: entry.labId, lesson: entry.lesson, nextLessonId: next?.lesson.id };
  if (entry.kind === "classifier") return <ClassifierLesson {...props} />;
  if (entry.kind === "language") return <LanguageLesson {...props} />;
  if (entry.kind === "web") return <WebLesson {...props} />;
  return <GameLesson {...props} />;
}
