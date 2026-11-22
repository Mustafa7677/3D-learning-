"use client";

import { SUM_N, type Precision, WALK_CYCLES, splitAddress, type TlbPattern, MISS_PENALTY, PIPE_PROGRAM, canSwap, type ArchLabAction, type ArchLabState, type AssocPattern, type BranchPattern, type PipeMode, type Predictor } from "@inside-tech/lab-arch";
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

const TLB_PATTERNS: [TlbPattern, string][] = [
  ["sequential", "Тізбекті (32 КБ)"],
  ["random-few", "Төрт бетпен"],
  ["stride", "Сегіз бетті кезектесіп"],
];

export function TlbSection({ state, dispatch }: { state: ArchLabState; dispatch: D }) {
  const t = state.tlb ?? { pattern: "sequential" as TlbPattern, huge: false, last: null };
  const first = t.last?.trace[0];
  return (
    <fieldset className={styles.group}>
      <legend>TLB · 4 жазба, miss = {WALK_CYCLES} такт</legend>
      <div className={styles.row} role="group" aria-label="Оқу реті">
        {TLB_PATTERNS.map(([p, label]) => (
          <button key={p} type="button" className="btn" aria-pressed={t.pattern === p} onClick={() => dispatch({ type: "tlb/set", pattern: p })}>
            {label}
          </button>
        ))}
      </div>
      <label className={styles.row}>
        <input type="checkbox" checked={t.huge} onChange={(e) => dispatch({ type: "tlb/set", huge: e.target.checked })} /> Үлкен беттер (2 МБ)
      </label>
      <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "tlb/run" })}>
        64 рет оқу
      </button>
      {t.last && (
        <div role="status" aria-label="TLB нәтижесі">
          <div className={styles.metrics}>
            <div>
              <span>Hit</span>
              <strong>{t.last.hits}</strong>
            </div>
            <div>
              <span>Miss</span>
              <strong>{t.last.misses}</strong>
            </div>
            <div>
              <span>Такт</span>
              <strong>{t.last.cycles}</strong>
            </div>
          </div>
          {first && (
            <p className={styles.small}>
              Бірінші адрес 0x{first.addr.toString(16)}: бет {first.vpn} · ығысу {first.offset}
            </p>
          )}
        </div>
      )}
      <p className={styles.small}>Мысал: 0x12345 → бет {splitAddress(0x12345).vpn}, ығысу {splitAddress(0x12345).offset}.</p>
    </fieldset>
  );
}

export function FloatSection({ state, dispatch }: { state: ArchLabState; dispatch: D }) {
  const f = state.float ?? { precision: 64 as Precision, kahan: false, last: null };
  return (
    <fieldset className={styles.group}>
      <legend>IEEE 754 · жылжымалы нүкте</legend>
      <div className={styles.row} role="group" aria-label="Дәлдік">
        {([64, 32] as const).map((p) => (
          <button key={p} type="button" className="btn" aria-pressed={f.precision === p} onClick={() => dispatch({ type: "float/set", precision: p })}>
            float{p}
          </button>
        ))}
      </div>
      <label className={styles.row}>
        <input type="checkbox" checked={f.kahan} onChange={(e) => dispatch({ type: "float/set", kahan: e.target.checked })} /> Kahan қосындысы
      </label>
      <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "float/run" })}>
        Есептеу
      </button>
      {f.last && (
        <dl className={styles.kv} role="status" aria-label="Есеп нәтижесі">
          <dt>0.1 + 0.2</dt>
          <dd>
            {f.last.text} {f.last.equals ? "(= 0.3)" : "(≠ 0.3)"}
          </dd>
          <dt>16 777 216 + 1</dt>
          <dd>{f.last.plusOne === 0 ? "16 777 216: бірлік жоғалды" : "16 777 217"}</dd>
          <dt>0.1 × {SUM_N.toLocaleString("ru-RU")} рет</dt>
          <dd>
            {f.last.sum} (қате {f.last.error < 1e-6 ? f.last.error.toExponential(1) : f.last.error.toFixed(3)})
          </dd>
        </dl>
      )}
    </fieldset>
  );
}
