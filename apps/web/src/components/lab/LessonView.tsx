"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { compileLesson, type LessonDefinition, type LessonSpec } from "@inside-tech/lesson-engine";
import type { AiLabAction, AiLabState, LangLabAction, LangLabState } from "@inside-tech/lab-ai";
import type { WebLabAction, WebLabState } from "@inside-tech/lab-web";
import type { GameLabAction, GameLabState, Tile } from "@inside-tech/lab-game";
import type { AlgoLabAction, AlgoLabState } from "@inside-tech/lab-algo";
import type { ArchLabAction, ArchLabState } from "@inside-tech/lab-arch";
import type { SecLabAction, SecLabState } from "@inside-tech/lab-sec";
import type { DbLabAction, DbLabState } from "@inside-tech/lab-db";
import type { NetLabAction, NetLabState } from "@inside-tech/lab-net";
import type { CloudLabAction, CloudLabState } from "@inside-tech/lab-cloud";
import type { IotLabAction, IotLabState } from "@inside-tech/lab-iot";
import { findLesson } from "@/lib/lessons";
import { useLabSession, type LabSession } from "@/lib/useAiLabSession";
import { useWebGL } from "@/lib/useWebGL";
import type { SceneFocus } from "../scene/AiScene";
import type { LangFocus } from "../scene/LangScene";
import type { WebFocus } from "../scene/WebScene";
import type { GameFocus } from "../scene/GameScene";
import type { AlgoFocus } from "../scene/AlgoScene";
import type { ArchFocus } from "../scene/ArchScene";
import type { SecFocus } from "../scene/SecScene";
import type { DbFocus } from "../scene/DbScene";
import type { NetFocus } from "../scene/NetScene";
import type { CloudFocus } from "../scene/CloudScene";
import type { IotFocus } from "../scene/IotScene";
import { ControlPanel, type Section, type Tool } from "./ControlPanel";
import { LabShell } from "./LabShell";
import { LangControlPanel, type LangSection } from "./LangControlPanel";
import { PointInspector } from "./PointInspector";
import { WebControlPanel, type WebSection } from "./WebControlPanel";
import { GameControlPanel, type GameSection } from "./GameControlPanel";
import { AlgoControlPanel, type AlgoSection } from "./AlgoControlPanel";
import { ArchControlPanel } from "./ArchControlPanel";
import { SecControlPanel } from "./SecControlPanel";
import { DbControlPanel } from "./DbControlPanel";
import { NetControlPanel } from "./NetControlPanel";
import { CloudControlPanel } from "./CloudControlPanel";
import { IotControlPanel } from "./IotControlPanel";
import styles from "./lab.module.css";

const sceneLoading = () => <div className={styles.sceneLoading}>3D сахна жүктелуде…</div>;
const AiScene = dynamic(() => import("../scene/AiScene"), { ssr: false, loading: sceneLoading });
const LangScene = dynamic(() => import("../scene/LangScene"), { ssr: false, loading: sceneLoading });
const WebScene = dynamic(() => import("../scene/WebScene"), { ssr: false, loading: sceneLoading });
const GameScene = dynamic(() => import("../scene/GameScene"), { ssr: false, loading: sceneLoading });
const AlgoScene = dynamic(() => import("../scene/AlgoScene"), { ssr: false, loading: sceneLoading });
const ArchScene = dynamic(() => import("../scene/ArchScene"), { ssr: false, loading: sceneLoading });
const SecScene = dynamic(() => import("../scene/SecScene"), { ssr: false, loading: sceneLoading });
const DbScene = dynamic(() => import("../scene/DbScene"), { ssr: false, loading: sceneLoading });
const NetScene = dynamic(() => import("../scene/NetScene"), { ssr: false, loading: sceneLoading });
const CloudScene = dynamic(() => import("../scene/CloudScene"), { ssr: false, loading: sceneLoading });
const IotScene = dynamic(() => import("../scene/IotScene"), { ssr: false, loading: sceneLoading });

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

/** Authored lessons have no hand-picked sections: show the controls that match the step's focus. */
const FOCUS_SECTIONS: Record<string, Section[]> = {
  dataset: ["data"],
  surface: ["training", "network", "data"],
  neuron: ["neuron", "data"],
  network: ["network", "training", "data"],
  charts: ["training", "network"],
};
const LANG_FOCUS_SECTIONS: Record<string, LangSection[]> = {
  tokens: ["tokens"],
  embedding: ["embedding", "tokens"],
  attention: ["attention", "tokens"],
  llm: ["llm"],
};
const WEB_FOCUS_SECTIONS: Record<string, WebSection[]> = {
  network: ["request", "server", "dns", "routes", "cache"],
  dom: ["html"],
  box: ["box", "flex"],
  flex: ["flex", "box"],
  loop: ["loop"],
  db: ["sql", "request"],
};
const GAME_FOCUS_SECTIONS: Record<string, GameSection[]> = {
  scene: ["scene"],
  camera: ["camera", "scene"],
  loop: ["loop"],
  physics: ["physics"],
  graphics: ["graphics"],
  game: ["play", "rules", "ai"],
  editor: ["editor", "play", "rules", "ai"],
};

/** Algorithms lessons show the controls of the step's mode; authored lessons do the same by focus. */
const ALGO_SECTIONS: Record<string, AlgoSection[]> = {
  sort: ["sort"],
  search: ["search"],
  graph: ["graph"],
  bench: ["bench"],
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
  /** False for previews: progress is neither loaded nor saved. */
  persist?: boolean;
}

function ClassifierLesson({ labId, lesson, nextLessonId, persist }: LessonProps<AiLabState, AiLabAction>) {
  const session = useLabSession(lesson, "classifier", { persist });
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
            sections={SECTIONS[lesson.id] ?? FOCUS_SECTIONS[focus] ?? ["data"]}
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

function LanguageLesson({ labId, lesson, nextLessonId, persist }: LessonProps<LangLabState, LangLabAction>) {
  const session = useLabSession(lesson, "language", { persist });
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
            sections={LANG_SECTIONS[lesson.id] ?? LANG_FOCUS_SECTIONS[focus] ?? ["tokens"]}
            dispatch={session.dispatch}
            canUndo={session.canUndo}
            onUndo={session.undo}
          />
        )
      }
    />
  );
}

function WebLesson({ labId, lesson, nextLessonId, persist }: LessonProps<WebLabState, WebLabAction>) {
  const session = useLabSession(lesson, "web", { persist });
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
            sections={WEB_SECTIONS[lesson.id] ?? WEB_FOCUS_SECTIONS[focus] ?? ["request"]}
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

function GameLesson({ labId, lesson, nextLessonId, persist }: LessonProps<GameLabState, GameLabAction>) {
  const session = useLabSession(lesson, "game", { persist });
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
            sections={GAME_SECTIONS[lesson.id] ?? GAME_FOCUS_SECTIONS[step?.focus ?? "scene"] ?? ["scene"]}
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
  if (entry.kind === "algo") return <AlgoLesson {...props} />;
  if (entry.kind === "arch") return <ArchLesson {...props} />;
  if (entry.kind === "sec") return <SecLesson {...props} />;
  if (entry.kind === "db") return <DbLesson {...props} />;
  if (entry.kind === "net") return <NetLesson {...props} />;
  if (entry.kind === "cloud") return <CloudLesson {...props} />;
  if (entry.kind === "iot") return <IotLesson {...props} />;
  return <GameLesson {...props} />;
}

/**
 * Runs an authored (inside-tech/lesson@1) lesson in its simulation. The spec
 * must already be validated; it is compiled once per spec object.
 */
export function SpecLessonView({ spec, preview = false }: { spec: LessonSpec; preview?: boolean }) {
  const lesson = useMemo(() => compileLesson<never, never>(spec), [spec]);
  const props = { labId: spec.labId, lesson: lesson as LessonDefinition<never, never>, persist: !preview };
  if (spec.kind === "classifier") return <ClassifierLesson {...(props as LessonProps<AiLabState, AiLabAction>)} />;
  if (spec.kind === "language") return <LanguageLesson {...(props as LessonProps<LangLabState, LangLabAction>)} />;
  if (spec.kind === "web") return <WebLesson {...(props as LessonProps<WebLabState, WebLabAction>)} />;
  if (spec.kind === "algo") return <AlgoLesson {...(props as LessonProps<AlgoLabState, AlgoLabAction>)} />;
  if (spec.kind === "arch") return <ArchLesson {...(props as LessonProps<ArchLabState, ArchLabAction>)} />;
  if (spec.kind === "sec") return <SecLesson {...(props as LessonProps<SecLabState, SecLabAction>)} />;
  if (spec.kind === "db") return <DbLesson {...(props as LessonProps<DbLabState, DbLabAction>)} />;
  if (spec.kind === "net") return <NetLesson {...(props as LessonProps<NetLabState, NetLabAction>)} />;
  if (spec.kind === "cloud") return <CloudLesson {...(props as LessonProps<CloudLabState, CloudLabAction>)} />;
  if (spec.kind === "iot") return <IotLesson {...(props as LessonProps<IotLabState, IotLabAction>)} />;
  return <GameLesson {...(props as LessonProps<GameLabState, GameLabAction>)} />;
}

function AlgoLesson({ labId, lesson, nextLessonId, persist }: LessonProps<AlgoLabState, AlgoLabAction>) {
  const session = useLabSession(lesson, "algo", { persist });
  const webgl = useWebGL();
  const { state, step } = session;
  const focus = (step?.focus ?? "sort") as AlgoFocus;
  return (
    <LabShell
      labId={labId}
      lesson={lesson}
      nextLessonId={nextLessonId}
      session={session as LabSession<unknown, unknown>}
      stage={
        <div className={styles.stageInner}>
          {state && webgl !== false ? <AlgoScene state={state} focus={focus} /> : webgl === false ? <Unsupported /> : <div className={styles.sceneLoading}>Симуляция іске қосылуда…</div>}
        </div>
      }
      controls={
        state && (
          <AlgoControlPanel
            state={state}
            sections={ALGO_SECTIONS[focus] ?? ["sort"]}
            dispatch={session.dispatch}
            canUndo={session.canUndo}
            onUndo={session.undo}
          />
        )
      }
    />
  );
}

function ArchLesson({ labId, lesson, nextLessonId, persist }: LessonProps<ArchLabState, ArchLabAction>) {
  const session = useLabSession(lesson, "arch", { persist });
  const webgl = useWebGL();
  const { state, step } = session;
  const focus = (["bits", "gates", "cpu", "cache"].includes(step?.focus ?? "") ? step!.focus : "bits") as ArchFocus;
  return (
    <LabShell
      labId={labId}
      lesson={lesson}
      nextLessonId={nextLessonId}
      session={session as LabSession<unknown, unknown>}
      stage={
        <div className={styles.stageInner}>
          {state && webgl !== false ? <ArchScene state={state} focus={focus} /> : webgl === false ? <Unsupported /> : <div className={styles.sceneLoading}>Симуляция іске қосылуда…</div>}
        </div>
      }
      controls={state && <ArchControlPanel state={state} sections={[focus]} dispatch={session.dispatch} canUndo={session.canUndo} onUndo={session.undo} />}
    />
  );
}

const SEC_FOCI: SecFocus[] = ["cipher", "xor", "hash", "passwords", "strength", "rsa", "attack"];

function SecLesson({ labId, lesson, nextLessonId, persist }: LessonProps<SecLabState, SecLabAction>) {
  const session = useLabSession(lesson, "sec", { persist });
  const webgl = useWebGL();
  const { state, step } = session;
  const focus = (SEC_FOCI.includes(step?.focus as SecFocus) ? step!.focus : "cipher") as SecFocus;
  return (
    <LabShell
      labId={labId}
      lesson={lesson}
      nextLessonId={nextLessonId}
      session={session as LabSession<unknown, unknown>}
      stage={
        <div className={styles.stageInner}>
          {state && webgl !== false ? <SecScene state={state} focus={focus} /> : webgl === false ? <Unsupported /> : <div className={styles.sceneLoading}>Симуляция іске қосылуда…</div>}
        </div>
      }
      controls={state && <SecControlPanel state={state} focus={focus} dispatch={session.dispatch} canUndo={session.canUndo} onUndo={session.undo} />}
    />
  );
}

function DbLesson({ labId, lesson, nextLessonId, persist }: LessonProps<DbLabState, DbLabAction>) {
  const session = useLabSession(lesson, "db", { persist });
  const webgl = useWebGL();
  const { state, step } = session;
  const focus = (["sql", "race", "shard"].includes(step?.focus ?? "") ? step!.focus : "sql") as DbFocus;
  return (
    <LabShell
      labId={labId}
      lesson={lesson}
      nextLessonId={nextLessonId}
      session={session as LabSession<unknown, unknown>}
      stage={
        <div className={styles.stageInner}>
          {state && webgl !== false ? <DbScene state={state} focus={focus} /> : webgl === false ? <Unsupported /> : <div className={styles.sceneLoading}>Симуляция іске қосылуда…</div>}
        </div>
      }
      controls={state && <DbControlPanel state={state} focus={focus} dispatch={session.dispatch} canUndo={session.canUndo} onUndo={session.undo} />}
    />
  );
}

const NET_FOCI: NetFocus[] = ["packets", "ip", "routing", "transport", "congestion", "nat"];

function NetLesson({ labId, lesson, nextLessonId, persist }: LessonProps<NetLabState, NetLabAction>) {
  const session = useLabSession(lesson, "net", { persist });
  const webgl = useWebGL();
  const { state, step } = session;
  const focus = (NET_FOCI.includes(step?.focus as NetFocus) ? step!.focus : "packets") as NetFocus;
  return (
    <LabShell
      labId={labId}
      lesson={lesson}
      nextLessonId={nextLessonId}
      session={session as LabSession<unknown, unknown>}
      stage={
        <div className={styles.stageInner}>
          {state && webgl !== false ? <NetScene state={state} focus={focus} /> : webgl === false ? <Unsupported /> : <div className={styles.sceneLoading}>Симуляция іске қосылуда…</div>}
        </div>
      }
      controls={state && <NetControlPanel state={state} focus={focus} dispatch={session.dispatch} canUndo={session.canUndo} onUndo={session.undo} />}
    />
  );
}

const CLOUD_FOCI: CloudFocus[] = ["image", "cluster", "scale", "autoscale", "pipeline", "release", "availability", "incident"];

function CloudLesson({ labId, lesson, nextLessonId, persist }: LessonProps<CloudLabState, CloudLabAction>) {
  const session = useLabSession(lesson, "cloud", { persist });
  const webgl = useWebGL();
  const { state, step } = session;
  const focus = (CLOUD_FOCI.includes(step?.focus as CloudFocus) ? step!.focus : "image") as CloudFocus;
  return (
    <LabShell
      labId={labId}
      lesson={lesson}
      nextLessonId={nextLessonId}
      session={session as LabSession<unknown, unknown>}
      stage={
        <div className={styles.stageInner}>
          {state && webgl !== false ? <CloudScene state={state} focus={focus} /> : webgl === false ? <Unsupported /> : <div className={styles.sceneLoading}>Симуляция іске қосылуда…</div>}
        </div>
      }
      controls={state && <CloudControlPanel state={state} focus={focus} dispatch={session.dispatch} canUndo={session.canUndo} onUndo={session.undo} />}
    />
  );
}

const IOT_FOCI: IotFocus[] = ["adc", "sampling", "filter", "thermo", "pid", "arm", "kalman", "mqtt", "power"];

function IotLesson({ labId, lesson, nextLessonId, persist }: LessonProps<IotLabState, IotLabAction>) {
  const session = useLabSession(lesson, "iot", { persist });
  const webgl = useWebGL();
  const { state, step } = session;
  const focus = (IOT_FOCI.includes(step?.focus as IotFocus) ? step!.focus : "adc") as IotFocus;
  return (
    <LabShell
      labId={labId}
      lesson={lesson}
      nextLessonId={nextLessonId}
      session={session as LabSession<unknown, unknown>}
      stage={
        <div className={styles.stageInner}>
          {state && webgl !== false ? <IotScene state={state} focus={focus} /> : webgl === false ? <Unsupported /> : <div className={styles.sceneLoading}>Симуляция іске қосылуда…</div>}
        </div>
      }
      controls={state && <IotControlPanel state={state} focus={focus} dispatch={session.dispatch} canUndo={session.canUndo} onUndo={session.undo} />}
    />
  );
}
