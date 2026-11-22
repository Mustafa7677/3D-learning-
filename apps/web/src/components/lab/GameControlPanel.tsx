"use client";

import {
  EFFECT_TEXT,
  GRID,
  TRIGGER_TEXT,
  worldTransform,
  type Effect,
  type GameLabAction,
  type GameLabState,
  type Tile,
  type Trigger,
} from "@inside-tech/lab-game";
import { useState } from "react";
import styles from "./lab.module.css";
import { BroadSection, FsmSection, PathSection, PoolSection } from "./GameMiddleSections";
import web from "./web.module.css";

export type GameSection = "scene" | "camera" | "loop" | "physics" | "graphics" | "rules" | "ai" | "play" | "editor" | "path" | "fsm" | "broad" | "pool";

interface Props {
  state: GameLabState;
  sections: GameSection[];
  brush: Tile;
  onBrush(t: Tile): void;
  dispatch(a: GameLabAction): void;
  canUndo: boolean;
  onUndo(): void;
}
type D = (a: GameLabAction) => void;

function Range(props: { id: string; label: string; value: number; min: number; max: number; step: number; fmt?: (v: number) => string; onChange(v: number): void }) {
  return (
    <div className={styles.slider}>
      <label htmlFor={props.id}>{props.label}</label>
      <output htmlFor={props.id}>{props.fmt ? props.fmt(props.value) : props.value}</output>
      <input id={props.id} type="range" min={props.min} max={props.max} step={props.step} value={props.value} onChange={(e) => props.onChange(Number(e.target.value))} />
    </div>
  );
}

function Toggle({ on, onClick, children, disabled }: { on: boolean; onClick(): void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button type="button" className="btn" aria-pressed={on} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

const f1 = (v: number) => v.toFixed(1);

function SceneSection({ state, dispatch }: { state: GameLabState; dispatch: D }) {
  const { entities, selected } = state.scene;
  const e = entities.find((x) => x.id === selected);
  const w = e ? worldTransform(entities, e.id) : undefined;
  const depth = (id: number): number => {
    const p = entities.find((x) => x.id === id)?.parent;
    return p == null ? 0 : 1 + depth(p);
  };
  const order = (parent: number | null): typeof entities => entities.filter((x) => x.parent === parent && x.id !== 1).flatMap((x) => [x, ...order(x.id)]);
  return (
    <fieldset className={styles.group}>
      <legend>Сахна ағашы</legend>
      <ul className={web.list} aria-label="Объектілер">
        {order(null).map((x) => (
          <li key={x.id} style={{ paddingLeft: depth(x.id) * 18 }}>
            <button type="button" className="btn" aria-pressed={x.id === selected} onClick={() => dispatch({ type: "scene/select", id: x.id })}>
              {x.name}
            </button>
          </li>
        ))}
      </ul>
      {e && w && (
        <>
          <p className={styles.small}>
            Local: ({e.pos.map(f1).join(", ")}) · World: ({w.pos.map(f1).join(", ")}) · scale {f1(w.scale)}
          </p>
          {(["x", "y", "z"] as const).map((axis, k) => (
            <Range
              key={axis}
              id={`pos-${axis}`}
              label={`position.${axis} (local)`}
              value={e.pos[k]!}
              min={-6}
              max={6}
              step={0.1}
              fmt={f1}
              onChange={(v) => dispatch({ type: "scene/set", id: e.id, patch: { pos: e.pos.map((p, i) => (i === k ? v : p)) as [number, number, number] } })}
            />
          ))}
          <Range id="rot" label="rotation.y" value={e.rotY} min={-180} max={180} step={5} fmt={(v) => `${v}°`} onChange={(v) => dispatch({ type: "scene/set", id: e.id, patch: { rotY: v } })} />
          <Range id="scale" label="scale" value={e.scale} min={0.2} max={3} step={0.1} fmt={f1} onChange={(v) => dispatch({ type: "scene/set", id: e.id, patch: { scale: v } })} />
          <label className={styles.small} htmlFor="parent">
            Ата-анасы (attach)
          </label>
          <select id="parent" className={web.select} value={e.parent ?? ""} onChange={(ev) => dispatch({ type: "scene/reparent", id: e.id, parent: ev.target.value === "" ? null : Number(ev.target.value) })}>
            <option value="">- жоқ (әлем) -</option>
            {entities
              .filter((x) => x.id !== e.id && x.id !== 1)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
          </select>
        </>
      )}
    </fieldset>
  );
}

function CameraSection({ state, dispatch }: { state: GameLabState; dispatch: D }) {
  const c = state.camera;
  const set = (patch: Partial<typeof c>) => dispatch({ type: "camera/set", patch });
  return (
    <fieldset className={styles.group}>
      <legend>Камера</legend>
      <div className={styles.row}>
        <Toggle on={c.view === "editor"} onClick={() => set({ view: "editor" })}>
          Редактор
        </Toggle>
        <Toggle on={c.view === "game"} onClick={() => set({ view: "game" })}>
          Ойын камерасы
        </Toggle>
      </div>
      <div className={styles.row}>
        <Toggle on={c.projection === "perspective"} onClick={() => set({ projection: "perspective" })}>
          Perspective
        </Toggle>
        <Toggle on={c.projection === "orthographic"} onClick={() => set({ projection: "orthographic" })}>
          Orthographic
        </Toggle>
      </div>
      {c.projection === "perspective" ? (
        <Range id="fov" label="FOV (көру бұрышы)" value={c.fov} min={15} max={120} step={1} fmt={(v) => `${v}°`} onChange={(v) => set({ fov: v })} />
      ) : (
        <Range id="ortho" label="Ortho өлшемі" value={c.orthoSize} min={1} max={15} step={0.5} fmt={f1} onChange={(v) => set({ orthoSize: v })} />
      )}
      <div className={styles.row}>
        <Toggle on={c.follow} onClick={() => set({ follow: !c.follow })}>
          Машинаның соңынан еру
        </Toggle>
      </div>
      <Range id="dist" label="Қашықтық" value={c.distance} min={2} max={15} step={0.5} fmt={f1} onChange={(v) => set({ distance: v })} />
      <Range id="height" label="Биіктік" value={c.height} min={0.5} max={10} step={0.5} fmt={f1} onChange={(v) => set({ height: v })} />
    </fieldset>
  );
}

function LoopSection({ state, dispatch }: { state: GameLabState; dispatch: D }) {
  const l = state.loop;
  return (
    <fieldset className={styles.group}>
      <legend>Game loop</legend>
      <pre className={web.pre}>{l.useDeltaTime ? `// әр кадрда\nx += speed * dt;   // ${l.speed} м/с` : `// әр кадрда\nx += ${l.perFrame.toFixed(3)};   // тұрақты қадам`}</pre>
      <div className={styles.row}>
        <Toggle on={l.useDeltaTime} onClick={() => dispatch({ type: "loop/set", patch: { useDeltaTime: !l.useDeltaTime } })}>
          Delta time қолдану
        </Toggle>
        <button type="button" className="btn btn-primary" disabled={l.running} onClick={() => dispatch({ type: "loop/run" })}>
          3 секунд жүгірту
        </button>
      </div>
      <table className={web.table}>
        <thead>
          <tr>
            <th>FPS</th>
            <th>Кадр</th>
            <th>Орны</th>
          </tr>
        </thead>
        <tbody>
          {l.fps.map((f, i) => (
            <tr key={f}>
              <td>{f}</td>
              <td>{l.frames[i]}</td>
              <td>{l.positions[i]!.toFixed(2)} м</td>
            </tr>
          ))}
        </tbody>
      </table>
    </fieldset>
  );
}

function PhysicsSection({ state, dispatch }: { state: GameLabState; dispatch: D }) {
  const p = state.physics;
  const set = (patch: Partial<typeof p.params>) => dispatch({ type: "physics/set", patch });
  const [speed, setSpeed] = useState(75);
  return (
    <fieldset className={styles.group}>
      <legend>Физика</legend>
      <p className={styles.small}>Жерді бас: сол жерге доп түседі.</p>
      <div className={styles.row}>
        <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "physics/drop" })}>
          Доп тастау
        </button>
        <button type="button" className="btn" onClick={() => dispatch({ type: "physics/clear" })}>
          Тазалау
        </button>
      </div>
      <Range id="g" label="Гравитация (м/с²)" value={p.params.gravity} min={0} max={30} step={0.2} fmt={f1} onChange={(v) => set({ gravity: v })} />
      <div className={styles.row}>
        {[
          ["Ай", 1.6],
          ["Жер", 9.8],
          ["Юпитер", 24.8],
        ].map(([n, g]) => (
          <button key={n} type="button" className="btn" onClick={() => set({ gravity: g as number })}>
            {n}
          </button>
        ))}
      </div>
      <Range id="e" label="Серпімділік (restitution)" value={p.params.restitution} min={0} max={1} step={0.05} fmt={(v) => v.toFixed(2)} onChange={(v) => set({ restitution: v })} />
      <Range id="sub" label="Substeps (бір кадрдағы физика қадамы)" value={p.params.substeps} min={1} max={16} step={1} onChange={(v) => set({ substeps: v })} />
      <div className={styles.row}>
        <Toggle on={p.walls.length > 0} onClick={() => dispatch({ type: "physics/wall", on: p.walls.length === 0 })}>
          Жұқа қабырға
        </Toggle>
      </div>
      <Range id="throw" label="Лақтыру жылдамдығы (м/с)" value={speed} min={5} max={80} step={5} onChange={setSpeed} />
      <button type="button" className="btn" onClick={() => dispatch({ type: "physics/throw", speed })}>
        Жылдам доп лақтыру
      </button>
      <p className={styles.small}>
        Доптар: {p.balls.length} · соқтығысулар: {state.stats.collisions}
        {state.stats.tunneled ? " · доп қабырғадан өтіп кетті!" : ""}
      </p>
    </fieldset>
  );
}

function GraphicsSection({ state, dispatch }: { state: GameLabState; dispatch: D }) {
  const g = state.graphics;
  const set = (patch: Partial<typeof g>) => dispatch({ type: "graphics/set", patch });
  return (
    <fieldset className={styles.group}>
      <legend>Жарық</legend>
      <Range id="amb" label="Ambient" value={g.ambient} min={0} max={2} step={0.05} fmt={(v) => v.toFixed(2)} onChange={(v) => set({ ambient: v })} />
      <Range id="dir" label="Directional (күн)" value={g.directional} min={0} max={3} step={0.1} fmt={f1} onChange={(v) => set({ directional: v })} />
      <Range id="pt" label="Point (шам)" value={g.point} min={0} max={40} step={1} onChange={(v) => set({ point: v })} />
      <legend className={styles.small}>Материал</legend>
      <div className={styles.row}>
        <label className={styles.small} htmlFor="mat-color">
          Түсі
        </label>
        <input id="mat-color" type="color" value={g.color} onChange={(e) => set({ color: e.target.value })} />
      </div>
      <Range id="rough" label="Roughness" value={g.roughness} min={0} max={1} step={0.05} fmt={(v) => v.toFixed(2)} onChange={(v) => set({ roughness: v })} />
      <Range id="metal" label="Metalness" value={g.metalness} min={0} max={1} step={0.05} fmt={(v) => v.toFixed(2)} onChange={(v) => set({ metalness: v })} />
      <Range id="emis" label="Emissive" value={g.emissive} min={0} max={2} step={0.05} fmt={(v) => v.toFixed(2)} onChange={(v) => set({ emissive: v })} />
      <Toggle on={g.flatShading} onClick={() => set({ flatShading: !g.flatShading })}>
        Flat shading
      </Toggle>
    </fieldset>
  );
}

function RulesSection({ state, dispatch }: { state: GameLabState; dispatch: D }) {
  const [when, setWhen] = useState<Trigger>("keys");
  const [then, setThen] = useState<Effect>("movePlayer");
  return (
    <fieldset className={styles.group}>
      <legend>Ережелер (скрипт)</legend>
      {state.game.rules.length === 0 ? (
        <p className={styles.small}>Ереже жоқ: ойында ештеңе болмайды.</p>
      ) : (
        <ul className={web.list}>
          {state.game.rules.map((r) => (
            <li key={r.id}>
              <span className={web.grow}>
                ҚАШАН <b>{TRIGGER_TEXT[r.when]}</b> → <b>{EFFECT_TEXT[r.then]}</b>
              </span>
              <button type="button" className="btn" onClick={() => dispatch({ type: "game/rule/remove", id: r.id })}>
                Өшіру
              </button>
            </li>
          ))}
        </ul>
      )}
      <label className={styles.small} htmlFor="rule-when">
        ҚАШАН
      </label>
      <select id="rule-when" className={web.select} value={when} onChange={(e) => setWhen(e.target.value as Trigger)}>
        {(Object.keys(TRIGGER_TEXT) as Trigger[]).map((t) => (
          <option key={t} value={t}>
            {TRIGGER_TEXT[t]}
          </option>
        ))}
      </select>
      <label className={styles.small} htmlFor="rule-then">
        ОНДА
      </label>
      <select id="rule-then" className={web.select} value={then} onChange={(e) => setThen(e.target.value as Effect)}>
        {(Object.keys(EFFECT_TEXT) as Effect[]).map((t) => (
          <option key={t} value={t}>
            {EFFECT_TEXT[t]}
          </option>
        ))}
      </select>
      <button type="button" className="btn" onClick={() => dispatch({ type: "game/rule/add", when, then })}>
        Ереже қосу
      </button>
    </fieldset>
  );
}

function AiSection({ state, dispatch }: { state: GameLabState; dispatch: D }) {
  const ai = state.game.ai;
  const set = (patch: Partial<typeof ai>) => dispatch({ type: "game/ai", patch });
  return (
    <fieldset className={styles.group}>
      <legend>Жаудың «миы»</legend>
      <pre className={web.pre}>{`күзет  → қуу     егер қашықтық < ${ai.chaseRadius.toFixed(1)}\nқуу    → оралу   егер қашықтық > ${ai.giveUpRadius.toFixed(1)}\nоралу  → күзет   үйіне жеткенде`}</pre>
      <Range id="chase" label="Қуу радиусы" value={ai.chaseRadius} min={0} max={10} step={0.5} fmt={f1} onChange={(v) => set({ chaseRadius: v })} />
      <Range id="giveup" label="Бас тарту радиусы" value={ai.giveUpRadius} min={0} max={12} step={0.5} fmt={f1} onChange={(v) => set({ giveUpRadius: v })} />
      <Range id="espeed" label="Жау жылдамдығы" value={ai.enemySpeed} min={0} max={5} step={0.1} fmt={f1} onChange={(v) => set({ enemySpeed: v })} />
      <Range id="pspeed" label="Ойыншы жылдамдығы" value={state.game.playerSpeed} min={0.5} max={6} step={0.1} fmt={f1} onChange={(v) => dispatch({ type: "game/speed", player: v })} />
      <p className={styles.small}>Көрген күйлер: {state.stats.enemyStates.join(", ") || "-"}</p>
    </fieldset>
  );
}

function PlaySection({ state, dispatch }: { state: GameLabState; dispatch: D }) {
  const g = state.game;
  const hold = (key: "up" | "down" | "left" | "right") => ({
    onPointerDown: () => dispatch({ type: "game/input", key, down: true }),
    onPointerUp: () => dispatch({ type: "game/input", key, down: false }),
    onPointerLeave: () => dispatch({ type: "game/input", key, down: false }),
  });
  const statusText = { ready: "Дайын", playing: "Ойын жүріп жатыр", won: "Жеңіс!", lost: "Жеңіліс" }[g.status];
  return (
    <fieldset className={styles.group}>
      <legend>Ойын</legend>
      <div className={styles.metrics} role="status">
        <div>
          <span>Күй</span>
          <strong>{statusText}</strong>
        </div>
        <div>
          <span>Ұпай</span>
          <strong>{g.score}</strong>
        </div>
        <div>
          <span>Тиын</span>
          <strong>{g.coins.filter((c) => !c.taken).length}</strong>
        </div>
        <div>
          <span>Уақыт</span>
          <strong>{Math.floor(g.time)}</strong>
        </div>
      </div>
      <div className={styles.row}>
        <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "game/start" })}>
          {g.status === "playing" ? "Қайта бастау" : "Ойынды бастау"}
        </button>
        <button type="button" className="btn" onClick={() => dispatch({ type: "game/reset" })}>
          Тоқтату
        </button>
      </div>
      <p className={styles.small}>Пернелер: ↑ ↓ ← → немесе W A S D (сахнаны басып, фокус бер). Сенсорлы экранда:</p>
      <div className={web.pad}>
        <button type="button" className="btn" aria-label="Жоғары" {...hold("up")}>
          ↑
        </button>
        <button type="button" className="btn" aria-label="Солға" {...hold("left")}>
          ←
        </button>
        <button type="button" className="btn" aria-label="Төмен" {...hold("down")}>
          ↓
        </button>
        <button type="button" className="btn" aria-label="Оңға" {...hold("right")}>
          →
        </button>
      </div>
      {g.lastEvent && <p className={styles.small}>{g.lastEvent}</p>}
    </fieldset>
  );
}

const BRUSHES: [Tile, string][] = [
  [".", "Еден"],
  ["#", "Қабырға"],
  ["c", "Тиын"],
  ["e", "Жау"],
  ["p", "Ойыншы"],
];

function EditorSection({ state, brush, onBrush, dispatch }: { state: GameLabState; brush: Tile; onBrush(t: Tile): void; dispatch: D }) {
  const empty = Array.from({ length: GRID }, (_, j) => (j === 0 || j === GRID - 1 ? "#".repeat(GRID) : "#" + ".".repeat(GRID - 2) + "#"));
  const count = (t: string) => state.game.level.join("").split(t).length - 1;
  return (
    <fieldset className={styles.group}>
      <legend>Деңгей редакторы</legend>
      <p className={styles.small}>Қылқаламды таңда, сосын сахнадағы тор көзін бас.</p>
      <div className={styles.row}>
        {BRUSHES.map(([t, name]) => (
          <Toggle key={t} on={brush === t} onClick={() => onBrush(t)}>
            {name}
          </Toggle>
        ))}
      </div>
      <p className={styles.small}>
        Тиындар: {count("c")} · жаулар: {count("e")} · өзгерістер: {state.stats.levelEdits}
      </p>
      <button type="button" className="btn" onClick={() => dispatch({ type: "game/level", level: empty.map((r, j) => (j === 1 ? "#p" + r.slice(2) : r)) })}>
        Бос деңгейден бастау
      </button>
    </fieldset>
  );
}

export function GameControlPanel({ state, sections, brush, onBrush, dispatch, canUndo, onUndo }: Props) {
  const has = (s: GameSection) => sections.includes(s);
  return (
    <aside className={styles.controls} aria-label="Басқару панелі">
      {has("editor") && <EditorSection state={state} brush={brush} onBrush={onBrush} dispatch={dispatch} />}
      {has("play") && <PlaySection state={state} dispatch={dispatch} />}
      {has("rules") && <RulesSection state={state} dispatch={dispatch} />}
      {has("ai") && <AiSection state={state} dispatch={dispatch} />}
      {has("scene") && <SceneSection state={state} dispatch={dispatch} />}
      {has("camera") && <CameraSection state={state} dispatch={dispatch} />}
      {has("loop") && <LoopSection state={state} dispatch={dispatch} />}
      {has("physics") && <PhysicsSection state={state} dispatch={dispatch} />}
      {has("graphics") && <GraphicsSection state={state} dispatch={dispatch} />}
      {has("path") && <PathSection state={state} dispatch={dispatch} />}
      {has("fsm") && <FsmSection state={state} dispatch={dispatch} />}
      {has("broad") && <BroadSection state={state} dispatch={dispatch} />}
      {has("pool") && <PoolSection state={state} dispatch={dispatch} />}
      <div className={styles.row}>
        <button type="button" className="btn" disabled={!canUndo} onClick={onUndo}>
          Соңғы әрекетті болдырмау
        </button>
      </div>
    </aside>
  );
}
