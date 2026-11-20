"use client";

import type { AiLabAction, AiLabState, DatasetKind, HiddenActivation } from "@inside-tech/lab-ai";
import { MAX_HIDDEN_LAYERS, MAX_UNITS, parameterCount } from "@inside-tech/lab-ai";
import type { AssessmentResult } from "@inside-tech/sim-core";
import { LossChart } from "./LossChart";
import styles from "./lab.module.css";

export type Tool = "select" | "add0" | "add1" | "relabel" | "remove";
export type Section = "data" | "neuron" | "network" | "training";

interface Props {
  state: AiLabState;
  assessment: AssessmentResult;
  sections: Section[];
  tool: Tool;
  onTool(t: Tool): void;
  dispatch(a: AiLabAction): void;
  canUndo: boolean;
  onUndo(): void;
}

const DATASETS: { kind: DatasetKind; label: string }[] = [
  { kind: "blobs", label: "Екі топ" },
  { kind: "xor", label: "XOR" },
  { kind: "circles", label: "Шеңберлер" },
  { kind: "moons", label: "Айлар" },
  { kind: "spiral", label: "Спираль" },
];

function Slider(props: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
  onChange(v: number): void;
}) {
  return (
    <div className={styles.slider}>
      <label htmlFor={props.id}>{props.label}</label>
      <output htmlFor={props.id}>{props.format ? props.format(props.value) : props.value}</output>
      <input
        id={props.id}
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
    </div>
  );
}

/** Learning-rate slider works on a log scale: 0.001 … 3. */
const lrToSlider = (lr: number) => Math.log10(lr);
const sliderToLr = (v: number) => Number(Math.pow(10, v).toPrecision(2));

const pct = (v: number) => `${(v * 100).toFixed(0)}%`;

const NOTE_TEXT: Record<string, string> = {
  "few-points": "Деректер тым аз: модельге үйренетін ештеңе жоқ.",
  "class-imbalance": "Кластар теңгерімсіз: модель көп класты ғана болжауды үйренуі мүмкін.",
  overfitting: "Train мен test дәлдігінің айырмасы үлкен: модель деректі жаттап алған (overfitting).",
  diverged: "Training жарылды: loss өсіп кетті. Learning rate-ті азайтып, «Training-ті қайта бастау» бас.",
  underfitting: "Модель тым қарапайым немесе әлі үйренбеген (underfitting).",
};

export function ControlPanel({ state, assessment, sections, tool, onTool, dispatch, canUndo, onUndo }: Props) {
  const m = assessment.metrics;
  const has = (s: Section) => sections.includes(s);

  return (
    <aside className={styles.controls} aria-label="Басқару панелі">
      <div className={styles.metrics} role="status" aria-live="off">
        <div>
          <span>Train</span>
          <strong>{pct(m.trainAcc ?? 0)}</strong>
        </div>
        <div>
          <span>Test</span>
          <strong>{pct(m.testAcc ?? 0)}</strong>
        </div>
        <div>
          <span>Loss</span>
          <strong>{(m.trainLoss ?? 0).toFixed(3)}</strong>
        </div>
        <div>
          <span>Epoch</span>
          <strong>{state.training.epoch}</strong>
        </div>
      </div>

      {assessment.notes.filter((n) => NOTE_TEXT[n]).length > 0 && (
        <ul className={styles.notes}>
          {assessment.notes.map((n) => NOTE_TEXT[n] && <li key={n}>{NOTE_TEXT[n]}</li>)}
        </ul>
      )}

      {has("data") && (
        <fieldset className={styles.group}>
          <legend>Деректер</legend>
          <div className={styles.row} role="group" aria-label="Құрал">
            {(
              [
                ["select", "Таңдау"],
                ["add0", "Қосу: 0"],
                ["add1", "Қосу: 1"],
                ["relabel", "Класты ауыстыру"],
                ["remove", "Өшіру"],
              ] as [Tool, string][]
            ).map(([t, label]) => (
              <button key={t} type="button" className="btn" aria-pressed={tool === t} onClick={() => onTool(t)}>
                {t === "add0" && <span className="dot dot-0" />}
                {t === "add1" && <span className="dot dot-1" />}
                {label}
              </button>
            ))}
          </div>
          <div className={styles.row}>
            {DATASETS.map((d) => (
              <button
                key={d.kind}
                type="button"
                className="btn"
                aria-pressed={state.datasetKind === d.kind}
                onClick={() => dispatch({ type: "dataset/generate", kind: d.kind })}
              >
                {d.label}
              </button>
            ))}
          </div>
          <Slider
            id="noise"
            label="Шу (noise)"
            value={state.noise}
            min={0}
            max={1}
            step={0.05}
            format={(v) => v.toFixed(2)}
            onChange={(v) => dispatch({ type: "dataset/generate", kind: state.datasetKind === "custom" ? "blobs" : state.datasetKind, noise: v })}
          />
          <Slider
            id="split"
            label="Train үлесі"
            value={state.trainRatio}
            min={0.1}
            max={0.95}
            step={0.05}
            format={pct}
            onChange={(v) => dispatch({ type: "split/setRatio", ratio: v })}
          />
          <p className={styles.small}>
            <span className="dot dot-0" /> {m.class0 ?? 0} &nbsp; <span className="dot dot-1" /> {m.class1 ?? 0} &nbsp;·&nbsp; train {m.trainCount ?? 0} / test{" "}
            {m.testCount ?? 0}
          </p>
          <div className={styles.row}>
            <button type="button" className="btn" onClick={() => dispatch({ type: "split/reshuffle" })}>
              Қайта араластыру
            </button>
            <button type="button" className="btn" onClick={() => dispatch({ type: "dataset/clear" })}>
              Бәрін тазалау
            </button>
          </div>
        </fieldset>
      )}

      {has("neuron") && (
        <fieldset className={styles.group}>
          <legend>Нейрон</legend>
          <div className={styles.row}>
            <button type="button" className="btn" aria-pressed={state.model === "neuron"} onClick={() => dispatch({ type: "model/select", model: "neuron" })}>
              Бір нейрон
            </button>
            <button type="button" className="btn" aria-pressed={state.model === "network"} onClick={() => dispatch({ type: "model/select", model: "network" })}>
              Нейрондық желі
            </button>
          </div>
          <Slider id="w1" label="w₁" value={state.neuron.w1} min={-6} max={6} step={0.1} format={(v) => v.toFixed(1)} onChange={(v) => dispatch({ type: "neuron/set", params: { w1: v } })} />
          <Slider id="w2" label="w₂" value={state.neuron.w2} min={-6} max={6} step={0.1} format={(v) => v.toFixed(1)} onChange={(v) => dispatch({ type: "neuron/set", params: { w2: v } })} />
          <Slider id="b" label="Bias (b)" value={state.neuron.b} min={-4} max={4} step={0.05} format={(v) => v.toFixed(2)} onChange={(v) => dispatch({ type: "neuron/set", params: { b: v } })} />
          <div className={styles.row} role="group" aria-label="Activation">
            {(["step", "sigmoid"] as const).map((a) => (
              <button key={a} type="button" className="btn" aria-pressed={state.neuron.activation === a} onClick={() => dispatch({ type: "neuron/set", params: { activation: a } })}>
                {a}
              </button>
            ))}
          </div>
          <p className={styles.formula}>
            z = {state.neuron.w1.toFixed(1)}·x₁ {state.neuron.w2 >= 0 ? "+" : "−"} {Math.abs(state.neuron.w2).toFixed(1)}·x₂ {state.neuron.b >= 0 ? "+" : "−"}{" "}
            {Math.abs(state.neuron.b).toFixed(2)}
          </p>
        </fieldset>
      )}

      {has("network") && (
        <fieldset className={styles.group}>
          <legend>Желі архитектурасы</legend>
          <div className={styles.layers}>
            {state.hidden.map((u, i) => (
              <div key={i} className={styles.layer}>
                <span>{i + 1}-қабат</span>
                <button type="button" className="btn" aria-label={`${i + 1}-қабаттан нейрон азайту`} disabled={u <= 1} onClick={() => dispatch({ type: "network/setHidden", hidden: state.hidden.map((v, j) => (j === i ? v - 1 : v)) })}>
                  −
                </button>
                <strong>{u}</strong>
                <button type="button" className="btn" aria-label={`${i + 1}-қабатқа нейрон қосу`} disabled={u >= MAX_UNITS} onClick={() => dispatch({ type: "network/setHidden", hidden: state.hidden.map((v, j) => (j === i ? v + 1 : v)) })}>
                  +
                </button>
              </div>
            ))}
            {state.hidden.length === 0 && <p className={styles.small}>Жасырын қабат жоқ: желі бір нейронға тең.</p>}
          </div>
          <div className={styles.row}>
            <button type="button" className="btn" disabled={state.hidden.length >= MAX_HIDDEN_LAYERS} onClick={() => dispatch({ type: "network/setHidden", hidden: [...state.hidden, 4] })}>
              Қабат қосу
            </button>
            <button type="button" className="btn" disabled={state.hidden.length === 0} onClick={() => dispatch({ type: "network/setHidden", hidden: state.hidden.slice(0, -1) })}>
              Қабатты алып тастау
            </button>
          </div>
          <div className={styles.row} role="group" aria-label="Activation">
            {(["relu", "tanh", "sigmoid"] as HiddenActivation[]).map((a) => (
              <button key={a} type="button" className="btn" aria-pressed={state.hiddenActivation === a} onClick={() => dispatch({ type: "network/setActivation", activation: a })}>
                {a}
              </button>
            ))}
          </div>
          <p className={styles.small}>Параметрлер саны: {parameterCount(state.network)}</p>
        </fieldset>
      )}

      {has("training") && (
        <fieldset className={styles.group}>
          <legend>Training</legend>
          <Slider
            id="lr"
            label="Learning rate"
            value={lrToSlider(state.hyper.learningRate)}
            min={-3}
            max={0.5}
            step={0.05}
            format={(v) => String(sliderToLr(v))}
            onChange={(v) => dispatch({ type: "hyper/set", params: { learningRate: sliderToLr(v) } })}
          />
          <div className={styles.row} role="group" aria-label="Batch size">
            <span className={styles.small}>Batch:</span>
            {[1, 4, 16, 32, 64].map((b) => (
              <button key={b} type="button" className="btn" aria-pressed={state.hyper.batchSize === b} onClick={() => dispatch({ type: "hyper/set", params: { batchSize: b } })}>
                {b}
              </button>
            ))}
          </div>
          <Slider id="epochs" label="Epoch шегі" value={state.hyper.epochLimit} min={10} max={1000} step={10} onChange={(v) => dispatch({ type: "hyper/set", params: { epochLimit: v } })} />
          <Slider id="l2" label="L2 регуляризация" value={state.hyper.l2} min={0} max={0.01} step={0.0005} format={(v) => v.toFixed(4)} onChange={(v) => dispatch({ type: "hyper/set", params: { l2: v } })} />
          <div className={styles.row}>
            {state.training.running ? (
              <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "train/pause" })}>
                Тоқтату
              </button>
            ) : (
              <button type="button" className="btn btn-primary" disabled={state.model !== "network"} onClick={() => dispatch({ type: "train/start" })}>
                Training бастау
              </button>
            )}
            <button type="button" className="btn" disabled={state.training.running || state.model !== "network"} onClick={() => dispatch({ type: "train/epoch" })}>
              +1 epoch
            </button>
            <button type="button" className="btn" onClick={() => dispatch({ type: "train/reset" })}>
              Training-ті қайта бастау
            </button>
          </div>
          <LossChart history={state.training.history} />
        </fieldset>
      )}

      <div className={styles.row}>
        <button type="button" className="btn" disabled={!canUndo} onClick={onUndo}>
          Соңғы әрекетті болдырмау
        </button>
      </div>
    </aside>
  );
}
