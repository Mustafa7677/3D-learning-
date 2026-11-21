"use client";

import { MISS_PENALTY, PIPE_PROGRAM, canSwap, type ArchLabAction, type ArchLabState, type AssocPattern, type BranchPattern, type PipeMode, type Predictor } from "@inside-tech/lab-arch";
import styles from "./lab.module.css";

type D = (a: ArchLabAction) => void;
const instr = (id: string) => PIPE_PROGRAM.find((p) => p.id === id)!;

const PIPE_MODES: [PipeMode, string][] = [
  ["off", "Конвейерсіз"],
  ["stall", "Конвейер, forwarding-сіз"],
  ["forward", "Конвейер + forwarding"],
];

export function PipeSection({ state, dispatch }: { state: ArchLabState; dispatch: D }) {
  const p = state.pipe;
  const last = p.last;
  return (
    <fieldset className={styles.group}>
      <legend>5 сатылы конвейер</legend>
      <div className={styles.row} role="group" aria-label="Конвейер режимі">
        {PIPE_MODES.map(([m, label]) => (
          <button key={m} type="button" className="btn" aria-pressed={p.mode === m} onClick={() => dispatch({ type: "pipe/mode", mode: m })}>
            {label}
          </button>
        ))}
      </div>
      <ol className={styles.notes} aria-label="Бағдарлама">
        {p.order.map((id, i) => {
          const up = i > 0 && canSwap(instr(p.order[i - 1]!), instr(id));
          return (
            <li key={id}>
              <code>{instr(id).text}</code>{" "}
              <button type="button" className="btn" disabled={!up} aria-label={`${instr(id).text}: жоғары жылжыту`} onClick={() => dispatch({ type: "pipe/swap", index: i - 1 })}>
                ↑
              </button>
            </li>
          );
        })}
      </ol>
      <p className={styles.small}>↑ тек тәуелсіз көршілер үшін ғана ашық: нәтиже өзгермеуі керек.</p>
      <div className={styles.row}>
        <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "pipe/run" })}>
          Бағдарламаны орындау
        </button>
        <button type="button" className="btn" onClick={() => dispatch({ type: "pipe/restore" })}>
          Бастапқы рет
        </button>
      </div>
      {last && (
        <div className={styles.metrics} role="status" aria-label="Конвейер нәтижесі">
          <div>
            <span>Такт</span>
            <strong>{last.cycles}</strong>
          </div>
          <div>
            <span>Кідіріс</span>
            <strong>{last.stalls}</strong>
          </div>
          <div>
            <span>Идеал</span>
            <strong>{p.mode === "off" ? 25 : 9}</strong>
          </div>
        </div>
      )}
    </fieldset>
  );
}

const PREDICTORS: [Predictor, string][] = [
  ["taken", "Әрқашан «өтеді»"],
  ["1bit", "1 биттік"],
  ["2bit", "2 биттік"],
];
const PATTERNS: [BranchPattern, string][] = [
  ["loop", "Цикл (4 × 10)"],
  ["random", "Кездейсоқ байттар"],
  ["sorted", "Сұрыпталған байттар"],
];

export function BranchSection({ state, dispatch }: { state: ArchLabState; dispatch: D }) {
  const b = state.branch;
  const last = b.last;
  return (
    <fieldset className={styles.group}>
      <legend>Тармақты болжау · қате = {MISS_PENALTY} такт</legend>
      <div className={styles.row} role="group" aria-label="Деректер">
        {PATTERNS.map(([v, label]) => (
          <button key={v} type="button" className="btn" aria-pressed={b.pattern === v} onClick={() => dispatch({ type: "branch/set", pattern: v })}>
            {label}
          </button>
        ))}
      </div>
      <div className={styles.row} role="group" aria-label="Болжағыш">
        {PREDICTORS.map(([v, label]) => (
          <button key={v} type="button" className="btn" aria-pressed={b.predictor === v} onClick={() => dispatch({ type: "branch/set", predictor: v })}>
            {label}
          </button>
        ))}
      </div>
      <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "branch/run" })}>
        Болжап көру
      </button>
      {last && (
        <div className={styles.metrics} role="status" aria-label="Болжау нәтижесі">
          <div>
            <span>Қате</span>
            <strong>
              {last.misses} / {last.outcomes.length}
            </strong>
          </div>
          <div>
            <span>Дәлдік</span>
            <strong>{Math.round((1 - last.misses / last.outcomes.length) * 100)}%</strong>
          </div>
          <div>
            <span>Жоғалған такт</span>
            <strong>{last.lost}</strong>
          </div>
        </div>
      )}
    </fieldset>
  );
}

const ASSOC_PATTERNS: [AssocPattern, string][] = [
  ["two", "a[i], b[i] (128 Б арақашықтық)"],
  ["three", "a[i], b[i], c[i]"],
  ["sequential", "Тізбекті оқу"],
];

export function AssocSection({ state, dispatch }: { state: ArchLabState; dispatch: D }) {
  const c = state.assoc;
  const last = c.last;
  return (
    <fieldset className={styles.group}>
      <legend>Кэш: 8 жол × 16 байт, LRU</legend>
      <div className={styles.row} role="group" aria-label="Оқу реті">
        {ASSOC_PATTERNS.map(([v, label]) => (
          <button key={v} type="button" className="btn" aria-pressed={c.pattern === v} onClick={() => dispatch({ type: "assoc/set", pattern: v })}>
            {label}
          </button>
        ))}
      </div>
      <div className={styles.row} role="group" aria-label="Ассоциативтілік">
        {[1, 2, 4].map((w) => (
          <button key={w} type="button" className="btn" aria-pressed={c.ways === w} onClick={() => dispatch({ type: "assoc/set", ways: w })}>
            {w === 1 ? "Тікелей (1 жолды)" : `${w} жолды`}
          </button>
        ))}
      </div>
      <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "assoc/run" })}>
        Оқуды бастау
      </button>
      {last && (
        <div className={styles.metrics} role="status" aria-label="Кэш нәтижесі">
          <div>
            <span>Hit</span>
            <strong>{last.hits}</strong>
          </div>
          <div>
            <span>Miss</span>
            <strong>{last.misses}</strong>
          </div>
          <div>
            <span>Такт (1 / 100)</span>
            <strong>{(last.hits + last.misses * 100).toLocaleString("ru-RU")}</strong>
          </div>
        </div>
      )}
    </fieldset>
  );
}
