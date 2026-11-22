"use client";

import { useEffect, useState } from "react";
import {
  CACHE_LINES,
  CIRCUITS,
  GATE_TYPES,
  LINE_SIZES,
  PROGRAMS,
  cacheTrace,
  hex,
  toBits,
  toSigned,
  truthTable,
  type ArchLabAction,
  type ArchLabState,
  type CircuitId,
  type GateType,
} from "@inside-tech/lab-arch";
import styles from "./lab.module.css";
import { AssocSection, BranchSection, FloatSection, PipeSection, TlbSection } from "./ArchMiddleSections";

export type ArchSection = "bits" | "gates" | "cpu" | "cache" | "pipe" | "branch" | "assoc" | "tlb" | "float";
type D = (a: ArchLabAction) => void;
const WEIGHTS = [128, 64, 32, 16, 8, 4, 2, 1];

function BitsSection({ state, dispatch }: { state: ArchLabState; dispatch: D }) {
  const { value, signed } = state.bits;
  const [a, setA] = useState("7");
  const [b, setB] = useState("1");
  return (
    <fieldset className={styles.group}>
      <legend>Биттер</legend>
      <div className={styles.row} role="group" aria-label="8 бит">
        {toBits(value).map((bit, i) => (
          <button
            key={i}
            type="button"
            className="btn"
            aria-pressed={bit === 1}
            aria-label={`Салмағы ${i === 0 && signed ? -128 : WEIGHTS[i]} бит`}
            onClick={() => dispatch({ type: "bits/toggle", bit: i })}
          >
            {bit}
          </button>
        ))}
      </div>
      <div className={styles.metrics} role="status">
        <div>
          <span>Ондық</span>
          <strong>{value}</strong>
        </div>
        <div>
          <span>Таңбалы</span>
          <strong>{toSigned(value)}</strong>
        </div>
        <div>
          <span>Hex</span>
          <strong>0x{hex(value)}</strong>
        </div>
      </div>
      <div className={styles.row}>
        <button type="button" className="btn" aria-pressed={signed} onClick={() => dispatch({ type: "bits/signed", on: !signed })}>
          Таңбалы көрініс (two's complement)
        </button>
        <button type="button" className="btn" onClick={() => dispatch({ type: "bits/set", value: 0 })}>
          Нөлдеу
        </button>
      </div>
      <form
        className={styles.row}
        onSubmit={(e) => {
          e.preventDefault();
          dispatch({ type: "bits/add", a: Number(a) || 0, b: Number(b) || 0 });
        }}
      >
        <label htmlFor="add-a">A</label>
        <input id="add-a" className={styles.numInput} type="number" min={0} max={255} value={a} onChange={(e) => setA(e.target.value)} />
        <label htmlFor="add-b">B</label>
        <input id="add-b" className={styles.numInput} type="number" min={0} max={255} value={b} onChange={(e) => setB(e.target.value)} />
        <button type="submit" className="btn btn-primary">
          Қосу
        </button>
      </form>
      {state.bits.add && (
        <p className={styles.small} role="status">
          {state.bits.add.a} + {state.bits.add.b} = {state.bits.add.result} · тасымалдар: {state.bits.add.carries.slice(1).filter((c) => c === 1).length}
          {state.bits.add.carryOut ? " · C = 1 (толып кетті)" : ""}
          {state.bits.add.overflow ? " · таңбалы толып кету" : ""}
        </p>
      )}
    </fieldset>
  );
}

function GatesSection({ state, dispatch }: { state: ArchLabState; dispatch: D }) {
  const g = state.gates;
  const c = CIRCUITS[g.circuit];
  const table = truthTable(c, g.types);
  const outs = Object.keys(c.outputs);
  return (
    <fieldset className={styles.group}>
      <legend>Логикалық схема</legend>
      <div className={styles.row} role="group" aria-label="Схема">
        {(Object.keys(CIRCUITS) as CircuitId[]).map((id) => (
          <button key={id} type="button" className="btn" aria-pressed={g.circuit === id} onClick={() => dispatch({ type: "gates/circuit", circuit: id })}>
            {CIRCUITS[id].title}
          </button>
        ))}
      </div>
      <div className={styles.row} role="group" aria-label="Кірістер">
        {c.inputs.map((name) => (
          <button key={name} type="button" className="btn" aria-pressed={g.inputs[name] === 1} onClick={() => dispatch({ type: "gates/input", name })}>
            {name} = {g.inputs[name] ?? 0}
          </button>
        ))}
      </div>
      {c.editable.map((id) => (
        <div key={id} className={styles.row}>
          <label htmlFor={`gate-${id}`}>Элемент {id}</label>
          <select id={`gate-${id}`} value={g.types[id] ?? c.gates.find((x) => x.id === id)!.type} onChange={(e) => dispatch({ type: "gates/type", gate: id, gateType: e.target.value as GateType })}>
            {GATE_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
      ))}
      <table className={styles.benchTable} aria-label="Ақиқат кестесі">
        <thead>
          <tr>
            {c.inputs.map((n) => (
              <th key={n} scope="col">
                {n}
              </th>
            ))}
            {outs.map((n) => (
              <th key={n} scope="col">
                {n}
              </th>
            ))}
            {c.spec && <th scope="col">Спец.</th>}
          </tr>
        </thead>
        <tbody>
          {table.map((r, i) => (
            <tr key={i}>
              {c.inputs.map((n) => (
                <td key={n}>{r.inputs[n]}</td>
              ))}
              {outs.map((n) => (
                <td key={n}>{r.outputs[n]}</td>
              ))}
              {c.spec && <td style={{ color: r.ok ? "#17895c" : "#c23b3b" }}>{r.ok ? "✓" : `✗ (${outs.map((n) => r.expected?.[n]).join("")})`}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      {c.spec && <p className={styles.small}>{table.every((r) => r.ok) ? "Барлық жол спецификацияға сай ✓" : `${table.filter((r) => !r.ok).length} жол сәйкес емес`}</p>}
    </fieldset>
  );
}

function CpuSection({ state, dispatch }: { state: ArchLabState; dispatch: D }) {
  const cpu = state.cpu;
  const st = cpu.state;
  const [text, setText] = useState(cpu.source);
  const [memText, setMemText] = useState(cpu.initialMem.slice(0, 8).join(", "));
  // Follow programs loaded by the lesson (onEnter).
  useEffect(() => setText(cpu.source), [cpu.source]);
  useEffect(() => setMemText(cpu.initialMem.slice(0, 8).join(", ")), [cpu.initialMem]);
  const dirty = text !== cpu.source;
  const current = st.ir !== null ? cpu.program[st.ir] : cpu.program[st.pc];
  const blocked = cpu.errors.length > 0 || dirty;
  return (
    <fieldset className={styles.group}>
      <legend>Процессор</legend>
      <div className={styles.row}>
        <label htmlFor="cpu-preset">Мысал</label>
        <select id="cpu-preset" value="" onChange={(e) => e.target.value && dispatch({ type: "cpu/source", source: PROGRAMS[e.target.value]!.source })}>
          <option value="">- таңда -</option>
          {Object.entries(PROGRAMS).map(([id, p]) => (
            <option key={id} value={id}>
              {p.title}
            </option>
          ))}
        </select>
      </div>
      <label className={styles.slider} htmlFor="cpu-src">
        <span>Ассемблер (жол {current?.line ?? "-"} орындалуда)</span>
      </label>
      <textarea id="cpu-src" className={styles.code} spellCheck={false} rows={Math.min(16, Math.max(6, text.split("\n").length + 1))} value={text} onChange={(e) => setText(e.target.value)} />
      <div className={styles.row}>
        <button type="button" className="btn btn-primary" disabled={!dirty} onClick={() => dispatch({ type: "cpu/source", source: text })}>
          Жинау (assemble)
        </button>
        {dirty && <span className={styles.small}>Өзгерістер әлі жиналмаған</span>}
      </div>
      {cpu.errors.length > 0 && (
        <ul className={styles.notes} role="alert">
          {cpu.errors.slice(0, 5).map((e, i) => (
            <li key={i}>
              {e.line}-жол: {e.message}
            </li>
          ))}
        </ul>
      )}
      <form
        className={styles.row}
        onSubmit={(e) => {
          e.preventDefault();
          dispatch({ type: "cpu/memory", mem: memText.split(/[\s,]+/).filter(Boolean).map(Number) });
        }}
      >
        <label htmlFor="cpu-mem">Жад [0..]</label>
        <input id="cpu-mem" className={styles.textInput} value={memText} onChange={(e) => setMemText(e.target.value)} />
        <button type="submit" className="btn">
          Жүктеу
        </button>
      </form>
      <div className={styles.metrics} role="status">
        <div>
          <span>Нұсқау</span>
          <strong>{st.instructions}</strong>
        </div>
        <div>
          <span>Такт</span>
          <strong>{st.cycles}</strong>
        </div>
        <div>
          <span>PC</span>
          <strong>{st.pc}</strong>
        </div>
        <div>
          <span>Шығыс</span>
          <strong>{st.out.join(",") || "-"}</strong>
        </div>
      </div>
      <p className={styles.small}>
        R0={st.regs[0]} R1={st.regs[1]} R2={st.regs[2]} R3={st.regs[3]} · Z={st.z ? 1 : 0} C={st.c ? 1 : 0}
        {st.error ? ` · ${st.error}` : st.halted ? " · HALT" : ` · келесі: ${st.stage}`}
      </p>
      <div className={styles.row}>
        <button type="button" className="btn btn-primary" disabled={blocked || st.halted} onClick={() => dispatch({ type: "cpu/tick" })}>
          Кезең
        </button>
        <button type="button" className="btn" disabled={blocked || st.halted} onClick={() => dispatch({ type: "cpu/step" })}>
          Нұсқау
        </button>
        {cpu.running ? (
          <button type="button" className="btn" onClick={() => dispatch({ type: "cpu/pause" })}>
            Кідірту
          </button>
        ) : (
          <button type="button" className="btn" disabled={blocked || st.halted} onClick={() => dispatch({ type: "cpu/play" })}>
            Ойнату
          </button>
        )}
        <button type="button" className="btn" disabled={blocked || st.halted} onClick={() => dispatch({ type: "cpu/finish" })}>
          Соңына дейін
        </button>
        <button type="button" className="btn" onClick={() => dispatch({ type: "cpu/reset" })}>
          Басынан
        </button>
      </div>
    </fieldset>
  );
}

function CacheSection({ state, dispatch }: { state: ArchLabState; dispatch: D }) {
  const c = state.cache;
  const trace = cacheTrace(c).slice(0, c.cursor);
  const hits = trace.filter((a) => a.hit).length;
  const done = c.cursor >= 64;
  return (
    <fieldset className={styles.group}>
      <legend>Кэш</legend>
      <div className={styles.row} role="group" aria-label="Оқу реті">
        {(
          [
            ["row", "Жол бойымен"],
            ["column", "Баған бойымен"],
          ] as const
        ).map(([p, label]) => (
          <button key={p} type="button" className="btn" aria-pressed={c.pattern === p} onClick={() => dispatch({ type: "cache/config", pattern: p })}>
            {label}
          </button>
        ))}
      </div>
      <div className={styles.row} role="group" aria-label="Жол саны">
        <span className={styles.small}>Жолдар:</span>
        {CACHE_LINES.map((n) => (
          <button key={n} type="button" className="btn" aria-pressed={c.lines === n} onClick={() => dispatch({ type: "cache/config", lines: n })}>
            {n}
          </button>
        ))}
      </div>
      <div className={styles.row} role="group" aria-label="Жол өлшемі">
        <span className={styles.small}>Жол өлшемі (байт):</span>
        {LINE_SIZES.map((n) => (
          <button key={n} type="button" className="btn" aria-pressed={c.lineSize === n} onClick={() => dispatch({ type: "cache/config", lineSize: n })}>
            {n}
          </button>
        ))}
      </div>
      <div className={styles.metrics} role="status">
        <div>
          <span>Кэш</span>
          <strong>{c.lines * c.lineSize} Б</strong>
        </div>
        <div>
          <span>Hit</span>
          <strong>{hits}</strong>
        </div>
        <div>
          <span>Miss</span>
          <strong>{trace.length - hits}</strong>
        </div>
        <div>
          <span>Такт</span>
          <strong>{hits + (trace.length - hits) * 100}</strong>
        </div>
      </div>
      <div className={styles.row}>
        <button type="button" className="btn btn-primary" disabled={done} onClick={() => dispatch({ type: "cache/step" })}>
          Қадам
        </button>
        {c.running ? (
          <button type="button" className="btn" onClick={() => dispatch({ type: "cache/pause" })}>
            Кідірту
          </button>
        ) : (
          <button type="button" className="btn" disabled={done} onClick={() => dispatch({ type: "cache/play" })}>
            Ойнату
          </button>
        )}
        <button type="button" className="btn" disabled={done} onClick={() => dispatch({ type: "cache/finish" })}>
          Соңына дейін
        </button>
        <button type="button" className="btn" onClick={() => dispatch({ type: "cache/reset" })}>
          Басынан
        </button>
      </div>
      <p className={styles.small}>Hit = 1 такт, miss = 100 такт. Жасыл: hit, қызыл: miss.</p>
    </fieldset>
  );
}

export function ArchControlPanel({ state, sections, dispatch, canUndo, onUndo }: { state: ArchLabState; sections: ArchSection[]; dispatch: D; canUndo: boolean; onUndo(): void }) {
  const has = (s: ArchSection) => sections.includes(s);
  return (
    <aside className={styles.controls} aria-label="Басқару панелі">
      {has("bits") && <BitsSection state={state} dispatch={dispatch} />}
      {has("gates") && <GatesSection state={state} dispatch={dispatch} />}
      {has("cpu") && <CpuSection state={state} dispatch={dispatch} />}
      {has("cache") && <CacheSection state={state} dispatch={dispatch} />}
      {has("pipe") && <PipeSection state={state} dispatch={dispatch} />}
      {has("branch") && <BranchSection state={state} dispatch={dispatch} />}
      {has("assoc") && <AssocSection state={state} dispatch={dispatch} />}
      {has("tlb") && <TlbSection state={state} dispatch={dispatch} />}
      {has("float") && <FloatSection state={state} dispatch={dispatch} />}
      {(has("cpu") || has("cache")) && (
        <label className={styles.slider}>
          <span>Ойнату жылдамдығы</span>
          <input type="range" min={1} max={30} step={1} value={Math.min(30, state.speed)} onChange={(e) => dispatch({ type: "speed/set", speed: Number(e.target.value) })} aria-label="Ойнату жылдамдығы" />
        </label>
      )}
      <div className={styles.row}>
        <button type="button" className="btn" disabled={!canUndo} onClick={onUndo}>
          Соңғы әрекетті болдырмау
        </button>
      </div>
    </aside>
  );
}
