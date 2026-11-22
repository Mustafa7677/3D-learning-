"use client";

import type { GameLabAction, GameLabState, PathAlgo, Stepper } from "@inside-tech/lab-game";
import styles from "./lab.module.css";

type D = (a: GameLabAction) => void;

const ALGOS: [PathAlgo, string][] = [
  ["bfs", "BFS"],
  ["dijkstra", "Dijkstra"],
  ["astar", "A*"],
  ["greedy", "Greedy"],
];

export function PathSection({ state, dispatch }: { state: GameLabState; dispatch: D }) {
  const m = state.mid;
  return (
    <fieldset className={styles.group}>
      <legend>Жол табу · батпақ = 5, еден = 1</legend>
      <div className={styles.row} role="group" aria-label="Алгоритм">
        {ALGOS.map(([a, label]) => (
          <button key={a} type="button" className="btn" aria-pressed={m.algo === a} onClick={() => dispatch({ type: "path/set", algo: a })}>
            {label}
          </button>
        ))}
      </div>
      {m.algo === "astar" && (
        <div className={styles.row} role="group" aria-label="Эвристика салмағы">
          {[1, 3].map((w) => (
            <button key={w} type="button" className="btn" aria-pressed={m.weight === w} onClick={() => dispatch({ type: "path/set", weight: w })}>
              h × {w}
            </button>
          ))}
        </div>
      )}
      <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "path/run" })}>
        Жолды іздеу
      </button>
      {m.path && (
        <div className={styles.metrics} role="status" aria-label="Іздеу нәтижесі">
          <div>
            <span>Жол бағасы</span>
            <strong>{m.path.cost}</strong>
          </div>
          <div>
            <span>Ашылған ұяшық</span>
            <strong>{m.path.expanded.length}</strong>
          </div>
          <div>
            <span>Жол ұзындығы</span>
            <strong>{m.path.path.length}</strong>
          </div>
        </div>
      )}
    </fieldset>
  );
}

const NAME = { patrol: "патруль", chase: "қуу", attack: "шабуыл" } as const;

export function FsmSection({ state, dispatch }: { state: GameLabState; dispatch: D }) {
  const m = state.mid;
  return (
    <fieldset className={styles.group}>
      <legend>Күзетшінің күйлер машинасы · 32 секунд</legend>
      <div className={styles.slider}>
        <label htmlFor="fsm-see">Көру радиусы</label>
        <output htmlFor="fsm-see">{m.see} м</output>
        <input id="fsm-see" type="range" min={2} max={9} value={m.see} onChange={(e) => dispatch({ type: "fsm/set", see: Number(e.target.value) })} />
      </div>
      <div className={styles.slider}>
        <label htmlFor="fsm-lose">Жоғалту радиусы</label>
        <output htmlFor="fsm-lose">{m.lose} м</output>
        <input id="fsm-lose" type="range" min={2} max={10} value={m.lose} onChange={(e) => dispatch({ type: "fsm/set", lose: Number(e.target.value) })} />
      </div>
      <p className={styles.small}>Шабуыл: 1 м-ден жақын. Жоғалту радиусы көру радиусынан кіші бола алмайды.</p>
      <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "fsm/run" })}>
        Күзетшіні іске қосу
      </button>
      {m.guard && (
        <div role="status" aria-label="Күзетші нәтижесі">
          <div className={styles.metrics}>
            <div>
              <span>Күй ауысуы</span>
              <strong>{m.guard.switches}</strong>
            </div>
            <div>
              <span>Шабуыл болды ма</span>
              <strong>{m.guard.states.includes("attack") ? "иә" : "жоқ"}</strong>
            </div>
          </div>
          <p className={styles.small}>{m.guard.states.map((s) => NAME[s]).filter((s, i, a) => i === 0 || s !== a[i - 1]).join(" → ")}</p>
        </div>
      )}
    </fieldset>
  );
}

export function BroadSection({ state, dispatch }: { state: GameLabState; dispatch: D }) {
  const m = state.mid;
  return (
    <fieldset className={styles.group}>
      <legend>Соқтығыс: broad phase · әлем 100 × 100</legend>
      <div className={styles.row} role="group" aria-label="Денелер саны">
        {[50, 200, 1000].map((n) => (
          <button key={n} type="button" className="btn" aria-pressed={m.n === n} onClick={() => dispatch({ type: "broad/set", n })}>
            {n} дене
          </button>
        ))}
      </div>
      <div className={styles.row} role="group" aria-label="Ұяшық өлшемі">
        {[50, 10, 2].map((c) => (
          <button key={c} type="button" className="btn" aria-pressed={m.cell === c} onClick={() => dispatch({ type: "broad/set", cell: c })}>
            ұяшық {c}
          </button>
        ))}
      </div>
      <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "broad/run" })}>
        Соқтығыстарды іздеу
      </button>
      {m.broad && (
        <div className={styles.metrics} role="status" aria-label="Соқтығыс нәтижесі">
          <div>
            <span>Әр жұп</span>
            <strong>{m.broad.brute.checks.toLocaleString("ru-RU")}</strong>
          </div>
          <div>
            <span>Тормен</span>
            <strong>{m.broad.grid.checks.toLocaleString("ru-RU")}</strong>
          </div>
          <div>
            <span>Соқтығыс</span>
            <strong>{m.broad.grid.hits}</strong>
          </div>
        </div>
      )}
    </fieldset>
  );
}

export function PoolSection({ state, dispatch }: { state: GameLabState; dispatch: D }) {
  const p = state.mid.pool ?? { perFrame: 40, pooled: false, last: null };
  return (
    <fieldset className={styles.group}>
      <legend>Шутер · 300 кадр, оқ 30 кадр өмір сүреді</legend>
      <div className={styles.row} role="group" aria-label="Кадрына оқ">
        {[10, 20, 40].map((n) => (
          <button key={n} type="button" className="btn" aria-pressed={p.perFrame === n} onClick={() => dispatch({ type: "pool/set", perFrame: n })}>
            кадрына {n} оқ
          </button>
        ))}
      </div>
      <label className={styles.row}>
        <input type="checkbox" checked={p.pooled} onChange={(e) => dispatch({ type: "pool/set", pooled: e.target.checked })} /> Объектілер пулы
      </label>
      <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "pool/run" })}>
        300 кадр ойнау
      </button>
      {p.last && (
        <div className={styles.metrics} role="status" aria-label="Пул нәтижесі">
          <div>
            <span>Қатқан кадр</span>
            <strong>{p.last.janky}</strong>
          </div>
          <div>
            <span>Ең баяу</span>
            <strong>{p.last.worst} мс</strong>
          </div>
          <div>
            <span>Жаңа объект</span>
            <strong>{p.last.allocations.toLocaleString("ru-RU")}</strong>
          </div>
        </div>
      )}
    </fieldset>
  );
}

export function TimestepSection({ state, dispatch }: { state: GameLabState; dispatch: D }) {
  const t = state.mid.timestep ?? { stepper: "frame-euler" as Stepper, fps: 60, last: null };
  const steppers: [Stepper, string][] = [
    ["frame-euler", "Кадр уақытымен (Euler)"],
    ["fixed-symplectic", "Тұрақты 1/240 с қадам"],
  ];
  return (
    <fieldset className={styles.group}>
      <legend>Серіппе · 3 секунд, бастапқы ауытқу 1</legend>
      <div className={styles.row} role="group" aria-label="Физика қадамы">
        {steppers.map(([v, label]) => (
          <button key={v} type="button" className="btn" aria-pressed={t.stepper === v} onClick={() => dispatch({ type: "timestep/set", stepper: v })}>
            {label}
          </button>
        ))}
      </div>
      <div className={styles.row} role="group" aria-label="Кадр жиілігі">
        {[30, 60, 144].map((f) => (
          <button key={f} type="button" className="btn" aria-pressed={t.fps === f} onClick={() => dispatch({ type: "timestep/set", fps: f })}>
            {f} FPS
          </button>
        ))}
      </div>
      <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "timestep/run" })}>
        3 секунд ойнау
      </button>
      {t.last && (
        <div className={styles.metrics} role="status" aria-label="Серіппе нәтижесі">
          <div>
            <span>Соңғы амплитуда</span>
            <strong>{t.last.amplitude >= 1000 ? Math.round(t.last.amplitude).toLocaleString("ru-RU") : t.last.amplitude}</strong>
          </div>
          <div>
            <span>Физика қадамы</span>
            <strong>{t.last.steps}</strong>
          </div>
        </div>
      )}
    </fieldset>
  );
}
