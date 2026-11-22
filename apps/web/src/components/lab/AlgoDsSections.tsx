"use client";

import { useState } from "react";
import {
  DP_ITEMS,
  HASH_CAPACITIES,
  averageProbes,
  dpCells,
  knapsackChoice,
  knapsackTable,
  loadFactor,
  longestChain,
  type AlgoLabAction,
  type AlgoLabState,
  type DpPreset,
} from "@inside-tech/lab-algo";
import { TOPO_NODES, type UfVariant } from "@inside-tech/lab-algo";
import styles from "./lab.module.css";

type D = (a: AlgoLabAction) => void;
const fmt = (x: number) => x.toFixed(2).replace(".", ",");

export function HashSection({ state, dispatch }: { state: AlgoLabState; dispatch: D }) {
  const h = state.ds.hash;
  const [key, setKey] = useState("");
  const [find, setFind] = useState("");
  return (
    <fieldset className={styles.group}>
      <legend>Хэш-кесте</legend>
      <div className={styles.row} role="group" aria-label="Хэш функция">
        <button type="button" className="btn" aria-pressed={h.fn === "sum"} onClick={() => dispatch({ type: "hash/config", fn: "sum" })}>
          Қосынды
        </button>
        <button type="button" className="btn" aria-pressed={h.fn === "poly"} onClick={() => dispatch({ type: "hash/config", fn: "poly" })}>
          Полиномдық
        </button>
      </div>
      <div className={styles.row} role="group" aria-label="Шелек саны">
        {HASH_CAPACITIES.map((c) => (
          <button key={c} type="button" className="btn" aria-pressed={!h.resize && h.capacity === c} onClick={() => dispatch({ type: "hash/config", capacity: c })}>
            {c} шелек
          </button>
        ))}
      </div>
      <label className={styles.row}>
        <input type="checkbox" checked={h.resize} onChange={(e) => dispatch({ type: "hash/config", resize: e.target.checked })} /> Толғанда кеңейту (α &gt; 0,75)
      </label>
      <div className={styles.row}>
        <button type="button" className="btn" onClick={() => dispatch({ type: "hash/fill", set: "anagrams" })}>
          Анаграммаларды қосу
        </button>
        <button type="button" className="btn" onClick={() => dispatch({ type: "hash/fill", set: "cities" })}>
          24 қаланы қосу
        </button>
      </div>
      <form
        className={styles.row}
        onSubmit={(e) => {
          e.preventDefault();
          dispatch({ type: "hash/insert", key });
          setKey("");
        }}
      >
        <label>
          <span className="visually-hidden">Жаңа кілт</span>
          <input className={styles.textInput} value={key} onChange={(e) => setKey(e.target.value)} placeholder="кілт" maxLength={24} />
        </label>
        <button type="submit" className="btn">
          Қосу
        </button>
      </form>
      <form
        className={styles.row}
        onSubmit={(e) => {
          e.preventDefault();
          dispatch({ type: "hash/lookup", key: find });
        }}
      >
        <label>
          <span className="visually-hidden">Іздейтін кілт</span>
          <input className={styles.textInput} value={find} onChange={(e) => setFind(e.target.value)} placeholder="іздеу" maxLength={24} />
        </label>
        <button type="submit" className="btn">
          Іздеу
        </button>
      </form>
      {state.ds.lookup && (
        <p className={styles.small} role="status">
          «{state.ds.lookup.key}»: {state.ds.lookup.found ? "табылды" : "жоқ"}, {state.ds.lookup.probes} салыстыру
        </p>
      )}
      <div className={styles.metrics}>
        <div>
          <span>Кілт / шелек</span>
          <strong>
            {h.keys.length} / {h.capacity}
          </strong>
        </div>
        <div>
          <span>Жүктеме коэффициенті α</span>
          <strong>{fmt(loadFactor(h))}</strong>
        </div>
        <div>
          <span>Ең ұзын тізбек</span>
          <strong>{longestChain(h)}</strong>
        </div>
        <div>
          <span>Орташа салыстыру</span>
          <strong>{fmt(averageProbes(h))}</strong>
        </div>
        <div>
          <span>Кеңею саны</span>
          <strong>{h.resizes}</strong>
        </div>
      </div>
      <button type="button" className="btn" onClick={() => dispatch({ type: "hash/clear" })}>
        Кестені тазалау
      </button>
    </fieldset>
  );
}

export function HeapSection({ state, dispatch }: { state: AlgoLabState; dispatch: D }) {
  const h = state.ds.heap;
  const last = h.log.at(-1);
  const popped = h.log.filter((o) => o.kind === "pop").map((o) => o.value);
  return (
    <fieldset className={styles.group}>
      <legend>Үйме: жедел жәрдем кезегі</legend>
      <p className={styles.small}>1: ең шұғыл шақыру. Түбірде әрдайым ең шұғылы тұрады.</p>
      <div className={styles.row}>
        <button type="button" className="btn" onClick={() => dispatch({ type: "heap/push" })}>
          Келесі шақыруды қосу
        </button>
        <button type="button" className="btn btn-primary" disabled={!h.arr.length} onClick={() => dispatch({ type: "heap/pop" })}>
          Ең шұғылын алу
        </button>
      </div>
      <p className={styles.small} aria-live="polite">
        Массив: [{h.arr.join(", ")}]
      </p>
      {last && (
        <p className={styles.small}>
          Соңғы амал: {last.kind === "push" ? `${last.value} қосылды` : `${last.value} алынды`}, {last.swaps} ауысу
        </p>
      )}
      {popped.length > 0 && <p className={styles.small}>Алынғандар: {popped.join(", ")}</p>}
      <button type="button" className="btn" onClick={() => dispatch({ type: "heap/clear" })}>
        Кезекті тазалау
      </button>
    </fieldset>
  );
}

const DP_NAMES: [DpPreset, string][] = [
  ["trip", "Жорық (8 кг)"],
  ["trap", "Ашкөздің тұзағы (10 кг)"],
];

export function DpSection({ state, dispatch }: { state: AlgoLabState; dispatch: D }) {
  const d = state.ds.dp;
  const p = DP_ITEMS[d.preset];
  const total = dpCells(d.preset);
  const done = d.filled >= total;
  const table = knapsackTable(p.items, p.capacity);
  return (
    <fieldset className={styles.group}>
      <legend>Рюкзак: динамикалық программалау</legend>
      <div className={styles.row} role="group" aria-label="Есеп">
        {DP_NAMES.map(([id, name]) => (
          <button key={id} type="button" className="btn" aria-pressed={d.preset === id} onClick={() => dispatch({ type: "dp/config", preset: id })}>
            {name}
          </button>
        ))}
      </div>
      <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 2, fontSize: 14, lineHeight: 1.45 }}>
        {p.items.map((it) => (
          <li key={it.name}>
            {it.name}: {it.w} кг, құны {it.v}
          </li>
        ))}
      </ul>
      <div className={styles.row}>
        <button type="button" className="btn" disabled={done} onClick={() => dispatch({ type: "dp/step" })}>
          Келесі ұяшық
        </button>
        <button type="button" className="btn btn-primary" disabled={done} onClick={() => dispatch({ type: "dp/finish" })}>
          Кестені толтыру
        </button>
        <button type="button" className="btn" onClick={() => dispatch({ type: "dp/greedy" })}>
          Ашкөз тәсілмен шешу
        </button>
      </div>
      <div className={styles.metrics}>
        <div>
          <span>Толтырылған ұяшық</span>
          <strong>
            {d.filled} / {total}
          </strong>
        </div>
        <div>
          <span>Кесте (DP)</span>
          <strong>{done ? table.at(-1)!.at(-1) : "толтырылуда"}</strong>
        </div>
        <div>
          <span>Ашкөз тәсіл</span>
          <strong>{d.greedy ? d.greedy.value : "іске қосылған жоқ"}</strong>
        </div>
      </div>
      {done && <p className={styles.small}>Кесте таңдағаны: {knapsackChoice(p.items, table).join(", ")}</p>}
      {d.greedy && <p className={styles.small}>Ашкөз тәсіл алғаны: {d.greedy.taken.join(", ")}</p>}
      <button type="button" className="btn" onClick={() => dispatch({ type: "dp/reset" })}>
        Қайта бастау
      </button>
    </fieldset>
  );
}

const UF_VARIANTS: [UfVariant, string][] = [
  ["naive", "Аңғал біріктіру"],
  ["compress", "Жолды сығымдау"],
  ["rank", "Union by rank"],
];

export function UfSection({ state, dispatch }: { state: AlgoLabState; dispatch: D }) {
  const u = state.uf ?? { variant: "naive" as UfVariant, last: null };
  return (
    <fieldset className={styles.group}>
      <legend>Union-Find · 16 түйін, union(0,1), union(1,2), ... union(14,15)</legend>
      <div className={styles.row} role="group" aria-label="Нұсқа">
        {UF_VARIANTS.map(([v, label]) => (
          <button key={v} type="button" className="btn" aria-pressed={u.variant === v} onClick={() => dispatch({ type: "uf/set", variant: v })}>
            {label}
          </button>
        ))}
      </div>
      <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "uf/run" })}>
        Біріктіріп, бәрін екі рет іздеу
      </button>
      {u.last && (
        <div className={styles.metrics} role="status" aria-label="Union-Find нәтижесі">
          <div>
            <span>Биіктік</span>
            <strong>{u.last.height}</strong>
          </div>
          <div>
            <span>1-айналым</span>
            <strong>{u.last.firstPass}</strong>
          </div>
          <div>
            <span>2-айналым</span>
            <strong>{u.last.secondPass}</strong>
          </div>
        </div>
      )}
    </fieldset>
  );
}

export function TopoSection({ state, dispatch }: { state: AlgoLabState; dispatch: D }) {
  const t = state.topo ?? { cycle: false, last: null };
  return (
    <fieldset className={styles.group}>
      <legend>Курстардың алғышарттары · 7 курс</legend>
      <label className={styles.row}>
        <input type="checkbox" checked={t.cycle} onChange={(e) => dispatch({ type: "topo/cycle", on: e.target.checked })} /> Жаңа ереже: «Құрылымдар» үшін «Бұлт» керек
      </label>
      <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "topo/run" })}>
        Оқу жоспарын құру
      </button>
      {t.last && (
        <div role="status" aria-label="Жоспар">
          <p className={styles.small}>
            <strong>{t.last.stuck.length ? `Цикл: ${t.last.stuck.map((i) => TOPO_NODES[i]).join(", ")} ешқашан ашылмайды` : `${t.last.semesters} семестр`}</strong>
          </p>
          <ol className={styles.notes}>
            {t.last.order.map((i) => (
              <li key={i}>
                {TOPO_NODES[i]} · {t.last!.semester[i]}-семестр
              </li>
            ))}
          </ol>
        </div>
      )}
    </fieldset>
  );
}
