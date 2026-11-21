"use client";

import { LRS, OPT_STEPS, type KernelPreset, type Optimizer, type OptimLabAction, type OptimLabState } from "@inside-tech/lab-ai";
import styles from "./lab.module.css";

type D = (a: OptimLabAction) => void;
export type OptimFocus = "optim" | "metrics" | "conv";
const pct = (x: number) => `${Math.round(x * 100)}%`;

function OptimSection({ state, dispatch }: { state: OptimLabState; dispatch: D }) {
  const o = state.optim;
  const opts: [Optimizer, string][] = [
    ["sgd", "SGD"],
    ["momentum", "Momentum"],
    ["adam", "Adam"],
  ];
  return (
    <fieldset className={styles.group}>
      <legend>Оптимизатор · L = 0.1x² + 2y², бастау (−9, 2)</legend>
      <div className={styles.row} role="group" aria-label="Оптимизатор">
        {opts.map(([v, label]) => (
          <button key={v} type="button" className="btn" aria-pressed={o.opt === v} onClick={() => dispatch({ type: "optim/set", opt: v })}>
            {label}
          </button>
        ))}
      </div>
      <div className={styles.row} role="group" aria-label="Қадам өлшемі (lr)">
        {LRS.map((lr) => (
          <button key={lr} type="button" className="btn" aria-pressed={o.lr === lr} onClick={() => dispatch({ type: "optim/set", lr })}>
            lr {lr}
          </button>
        ))}
      </div>
      <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "optim/run" })}>
        Түсуді бастау
      </button>
      {o.last && (
        <div className={styles.metrics} role="status" aria-label="Оптимизация нәтижесі">
          <div>
            <span>Нәтиже</span>
            <strong>{o.last.diverged ? "жарылды" : o.last.steps !== null ? `${o.last.steps} қадам` : `${OPT_STEPS} қадамда жетпеді`}</strong>
          </div>
          <div>
            <span>Соңғы шығын</span>
            <strong>{o.last.diverged ? "∞" : o.last.final.toPrecision(2)}</strong>
          </div>
        </div>
      )}
    </fieldset>
  );
}

function MetricsSection({ state, dispatch }: { state: OptimLabState; dispatch: D }) {
  const m = state.metrics;
  const c = m.last;
  return (
    <fieldset className={styles.group}>
      <legend>Бағалау · 200 адам, 10 науқас</legend>
      <div className={styles.row} role="group" aria-label="Модель">
        <button type="button" className="btn" aria-pressed={m.trivial} onClick={() => dispatch({ type: "metrics/set", trivial: true })}>
          «Бәрі сау» моделі
        </button>
        <button type="button" className="btn" aria-pressed={!m.trivial} onClick={() => dispatch({ type: "metrics/set", trivial: false })}>
          Нақты модель
        </button>
      </div>
      {!m.trivial && (
        <div className={styles.slider}>
          <label htmlFor="thr">Шек</label>
          <output htmlFor="thr">{m.threshold.toFixed(2)}</output>
          <input id="thr" type="range" min={0.3} max={0.9} step={0.05} value={m.threshold} onChange={(e) => dispatch({ type: "metrics/set", threshold: Number(e.target.value) })} />
        </div>
      )}
      <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "metrics/evaluate" })}>
        Бағалау
      </button>
      {c && (
        <div role="status" aria-label="Метрикалар">
          <div className={styles.metrics}>
            <div>
              <span>Accuracy</span>
              <strong>{pct(c.accuracy)}</strong>
            </div>
            <div>
              <span>Precision</span>
              <strong>{c.precision.toFixed(2)}</strong>
            </div>
            <div>
              <span>Recall</span>
              <strong>{c.recall.toFixed(2)}</strong>
            </div>
          </div>
          <p className={styles.small}>
            TP {c.tp} · FP {c.fp} · FN {c.fn} · TN {c.tn} · F1 {c.f1.toFixed(2)}
          </p>
        </div>
      )}
    </fieldset>
  );
}

const PRESETS: [KernelPreset, string][] = [
  ["identity", "Identity"],
  ["blur", "Blur"],
  ["sobel-x", "Sobel-x"],
  ["sobel-y", "Sobel-y"],
  ["sharpen", "Sharpen"],
];
const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2));

function ConvSection({ state, dispatch }: { state: OptimLabState; dispatch: D }) {
  const c = state.conv;
  return (
    <fieldset className={styles.group}>
      <legend>Свёртка · 8×8 сурет, 3×3 ядро</legend>
      <div className={styles.row} role="group" aria-label="Дайын ядро">
        {PRESETS.map(([v, label]) => (
          <button key={v} type="button" className="btn" aria-pressed={c.preset === v} onClick={() => dispatch({ type: "conv/preset", preset: v })}>
            {label}
          </button>
        ))}
      </div>
      <div role="group" aria-label="Ядро" style={{ display: "grid", gridTemplateColumns: "repeat(3, 4rem)", gap: "0.3rem" }}>
        {c.kernel.map((v, i) => (
          <button
            key={i}
            type="button"
            className="btn"
            aria-label={`Ядро ұяшығы ${Math.floor(i / 3) + 1}-${(i % 3) + 1}: ${fmt(v)}`}
            onClick={() => dispatch({ type: "conv/cell", index: i, value: Number.isInteger(v) ? (v >= 4 ? -4 : v + 1) : 0 })}
          >
            {fmt(v)}
          </button>
        ))}
      </div>
      <p className={styles.small}>Ұяшықты басу мәнін 1-ге арттырады (4-тен кейін −4).</p>
      <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "conv/apply" })}>
        Ядроны қолдану
      </button>
      {c.output && state.stats.convRuns.length > 0 && (
        <dl className={styles.kv} role="status" aria-label="Шекара сынағы">
          <dt>Тік шекара</dt>
          <dd>{fmt(state.stats.convRuns.at(-1)!.vertical)}</dd>
          <dt>Көлденең шекара</dt>
          <dd>{fmt(state.stats.convRuns.at(-1)!.horizontal)}</dd>
          <dt>Тегіс аймақ</dt>
          <dd>{fmt(state.stats.convRuns.at(-1)!.flat)}</dd>
        </dl>
      )}
    </fieldset>
  );
}

export function OptimControlPanel({ state, focus, dispatch, canUndo, onUndo }: { state: OptimLabState; focus: OptimFocus; dispatch: D; canUndo: boolean; onUndo(): void }) {
  return (
    <aside className={styles.controls} aria-label="Басқару панелі">
      {focus === "optim" && <OptimSection state={state} dispatch={dispatch} />}
      {focus === "metrics" && <MetricsSection state={state} dispatch={dispatch} />}
      {focus === "conv" && <ConvSection state={state} dispatch={dispatch} />}
      <div className={styles.row}>
        <button type="button" className="btn" disabled={!canUndo} onClick={onUndo}>
          Соңғы әрекетті болдырмау
        </button>
      </div>
    </aside>
  );
}
