"use client";

import { LRS, OPT_STEPS, type KernelPreset, type Optimizer, type OptimLabAction, type OptimLabState } from "@inside-tech/lab-ai";
import styles from "./lab.module.css";

type D = (a: OptimLabAction) => void;
export type OptimFocus = "optim" | "metrics" | "conv" | "drift" | "leak";
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

function DriftSection({ state, dispatch }: { state: OptimLabState; dispatch: D }) {
  const d = state.drift ?? { week: 0, threshold: 93, trainedWeek: 0 };
  const last = state.stats.driftRuns?.at(-1);
  return (
    <fieldset className={styles.group}>
      <legend>Алаяқтық модельі · шек {d.threshold} мың ₸ ({d.trainedWeek}-аптада үйретілген)</legend>
      <div className={styles.row} role="group" aria-label="Апта">
        {[0, 4, 8, 12].map((w) => (
          <button key={w} type="button" className="btn" aria-pressed={d.week === w} onClick={() => dispatch({ type: "drift/week", week: w })}>
            {w}-апта
          </button>
        ))}
      </div>
      <div className={styles.row}>
        <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "drift/evaluate" })}>
          Осы аптада бағалау
        </button>
        <button type="button" className="btn" onClick={() => dispatch({ type: "drift/retrain" })}>
          Осы аптаның деректерімен қайта үйрету
        </button>
      </div>
      {last && (
        <div className={styles.metrics} role="status" aria-label="Апта нәтижесі">
          <div>
            <span>Дәлдік</span>
            <strong>{(last.accuracy * 100).toFixed(1)}%</strong>
          </div>
          <div>
            <span>Жалған дабыл</span>
            <strong>{last.falseAlarms}</strong>
          </div>
          <div>
            <span>Ығысу</span>
            <strong>{last.drift.toFixed(2)}</strong>
          </div>
        </div>
      )}
    </fieldset>
  );
}

function LeakSection({ state, dispatch }: { state: OptimLabState; dispatch: D }) {
  const l = state.leak ?? { useLeak: true, split: "rows" as const, feature: null, splitRun: null };
  return (
    <>
      <fieldset className={styles.group}>
        <legend>Тұмау моделі · бір ережелі классификатор</legend>
        <label className={styles.row}>
          <input type="checkbox" checked={l.useLeak} onChange={(e) => dispatch({ type: "leak/set", useLeak: e.target.checked })} /> «Антибиотик жазылды» белгісі қосулы
        </label>
        <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "leak/train" })}>
          Үйрету және тексеру
        </button>
        {l.feature && (
          <div className={styles.metrics} role="status" aria-label="Белгі нәтижесі">
            <div>
              <span>Ереже</span>
              <strong>{l.feature.stump.feature === "antibiotic" ? "антибиотик > 0" : `қызу > ${l.feature.stump.threshold}`}</strong>
            </div>
            <div>
              <span>Тест</span>
              <strong>{pct(l.feature.test)}</strong>
            </div>
            <div>
              <span>Өндіріс</span>
              <strong>{pct(l.feature.production)}</strong>
            </div>
          </div>
        )}
      </fieldset>
      <fieldset className={styles.group}>
        <legend>150 пациент × 3 келу · ең жақын көрші</legend>
        <div className={styles.row} role="group" aria-label="Тестке бөлу">
          {(
            [
              ["rows", "Жолдар бойынша"],
              ["patients", "Пациенттер бойынша"],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" className="btn" aria-pressed={l.split === k} onClick={() => dispatch({ type: "leak/set", split: k })}>
              {label}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "leak/split" })}>
          Бөліп, тексеру
        </button>
        {l.splitRun && (
          <div className={styles.metrics} role="status" aria-label="Бөлу нәтижесі">
            <div>
              <span>Тест</span>
              <strong>{pct(l.splitRun.test)}</strong>
            </div>
            <div>
              <span>Жаңа пациенттер</span>
              <strong>{pct(l.splitRun.fresh)}</strong>
            </div>
            <div>
              <span>Ортақ жазба</span>
              <strong>{l.splitRun.shared}</strong>
            </div>
          </div>
        )}
      </fieldset>
    </>
  );
}

export function OptimControlPanel({ state, focus, dispatch, canUndo, onUndo }: { state: OptimLabState; focus: OptimFocus; dispatch: D; canUndo: boolean; onUndo(): void }) {
  return (
    <aside className={styles.controls} aria-label="Басқару панелі">
      {focus === "optim" && <OptimSection state={state} dispatch={dispatch} />}
      {focus === "metrics" && <MetricsSection state={state} dispatch={dispatch} />}
      {focus === "conv" && <ConvSection state={state} dispatch={dispatch} />}
      {focus === "drift" && <DriftSection state={state} dispatch={dispatch} />}
      {focus === "leak" && <LeakSection state={state} dispatch={dispatch} />}
      <div className={styles.row}>
        <button type="button" className="btn" disabled={!canUndo} onClick={onUndo}>
          Соңғы әрекетті болдырмау
        </button>
      </div>
    </aside>
  );
}
