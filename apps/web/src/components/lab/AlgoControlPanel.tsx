"use client";

import { useState } from "react";
import {
  BENCH_N,
  GRAPHS,
  SEARCH_N,
  SORT_N,
  pathCost,
  pathTo,
  type AlgoLabAction,
  type AlgoLabState,
  type ArrayPreset,
  type GraphAlg,
  type SortAlg,
} from "@inside-tech/lab-algo";
import styles from "./lab.module.css";
import { DpSection, HashSection, HeapSection, UfSection } from "./AlgoDsSections";

export type AlgoSection = "sort" | "search" | "graph" | "bench" | "hash" | "heap" | "dp" | "uf";
type D = (a: AlgoLabAction) => void;

export const SORT_NAMES: Record<SortAlg, string> = {
  bubble: "Bubble",
  selection: "Selection",
  insertion: "Insertion",
  merge: "Merge",
  quick: "Quick",
};
const PRESETS: [ArrayPreset, string][] = [
  ["random", "Кездейсоқ"],
  ["sorted", "Сұрыпталған"],
  ["reversed", "Кері"],
  ["nearly", "Дерлік сұрыпталған"],
  ["few", "Қайталанатын"],
];
const GRAPH_NAMES: Record<GraphAlg, string> = { bfs: "BFS (кезек)", dfs: "DFS (стек)", dijkstra: "Дейкстра" };
const BENCH_COLORS: Record<SortAlg, string> = { bubble: "#c23b3b", selection: "#ee9a22", insertion: "#7c4ddb", merge: "#2f5bea", quick: "#17895c" };

function Range(props: { id: string; label: string; value: number; min: number; max: number; step: number; onChange(v: number): void }) {
  return (
    <div className={styles.slider}>
      <label htmlFor={props.id}>{props.label}</label>
      <output htmlFor={props.id}>{props.value}</output>
      <input id={props.id} type="range" min={props.min} max={props.max} step={props.step} value={props.value} onChange={(e) => props.onChange(Number(e.target.value))} />
    </div>
  );
}

function Choice<T extends string>({ label, value, options, onPick }: { label: string; value: T; options: [T, string][]; onPick(v: T): void }) {
  return (
    <div className={styles.row} role="group" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} type="button" className="btn" aria-pressed={value === v} onClick={() => onPick(v)}>
          {text}
        </button>
      ))}
    </div>
  );
}

function Player({ playing, done, onStep, onPlay, onPause, onFinish, onReset }: { playing: boolean; done: boolean; onStep(): void; onPlay(): void; onPause(): void; onFinish(): void; onReset(): void }) {
  return (
    <div className={styles.row}>
      <button type="button" className="btn btn-primary" disabled={done} onClick={onStep}>
        Қадам
      </button>
      {playing ? (
        <button type="button" className="btn" onClick={onPause}>
          Кідірту
        </button>
      ) : (
        <button type="button" className="btn" disabled={done} onClick={onPlay}>
          Ойнату
        </button>
      )}
      <button type="button" className="btn" disabled={done} onClick={onFinish}>
        Соңына дейін
      </button>
      <button type="button" className="btn" onClick={onReset}>
        Басынан
      </button>
    </div>
  );
}

function describeOp(state: AlgoLabState): string {
  const v = state.sort;
  const op = v.last;
  if (v.cursor >= v.total) return "Сұрыпталды.";
  if (!op) return "Бастау үшін «Қадам» не «Ойнату» бас.";
  const a = v.arr;
  switch (op.k) {
    case "cmp":
      return v.alg === "merge" ? `Біріктіру: сол жақ бөліктің элементі мен оң жақ бөліктің элементі салыстырылды.` : `a[${op.i}] = ${a[op.i]} мен a[${op.j}] = ${a[op.j]} салыстырылды.`;
    case "swap":
      return `a[${op.i}] мен a[${op.j}] орын ауыстырды.`;
    case "set":
      return `a[${op.i}] ← ${op.v} (біріктірілген массивке жазылды).`;
    case "done":
      return `a[${op.i}] = ${a[op.i]} өз орнына біржола түсті.`;
    case "range":
      return `Енді a[${op.lo}..${op.hi}] бөлігімен жұмыс.`;
    case "pivot":
      return `Pivot: a[${op.i}] = ${a[op.i]}.`;
  }
}

function SortSection({ state, dispatch }: { state: AlgoLabState; dispatch: D }) {
  const v = state.sort;
  return (
    <fieldset className={styles.group}>
      <legend>Сұрыптау</legend>
      <Choice label="Алгоритм" value={v.alg} options={Object.entries(SORT_NAMES) as [SortAlg, string][]} onPick={(alg) => dispatch({ type: "sort/config", alg })} />
      {v.alg === "quick" && (
        <Choice
          label="Pivot"
          value={v.pivot}
          options={[
            ["last", "Pivot: соңғы"],
            ["middle", "Pivot: ортаңғы"],
          ]}
          onPick={(pivot) => dispatch({ type: "sort/config", pivot })}
        />
      )}
      <Choice label="Деректер" value={v.preset} options={PRESETS} onPick={(preset) => dispatch({ type: "sort/config", preset })} />
      <Range id="sort-n" label="Элемент саны (n)" value={v.n} min={SORT_N.min} max={SORT_N.max} step={1} onChange={(n) => dispatch({ type: "sort/config", n })} />
      <div className={styles.metrics} role="status" aria-live="off">
        <div>
          <span>Салыстыру</span>
          <strong>{v.comparisons}</strong>
        </div>
        <div>
          <span>Ауыстыру</span>
          <strong>{v.swaps}</strong>
        </div>
        <div>
          <span>Жазу</span>
          <strong>{v.writes}</strong>
        </div>
        <div>
          <span>Қадам</span>
          <strong>
            {v.cursor}/{v.total}
          </strong>
        </div>
      </div>
      <p className={styles.small} aria-live="polite">
        {describeOp(state)}
      </p>
      <Player
        playing={v.playing}
        done={v.cursor >= v.total}
        onStep={() => dispatch({ type: "sort/step" })}
        onPlay={() => dispatch({ type: "sort/play" })}
        onPause={() => dispatch({ type: "sort/pause" })}
        onFinish={() => dispatch({ type: "sort/finish" })}
        onReset={() => dispatch({ type: "sort/reset" })}
      />
      <div className={styles.row}>
        <button type="button" className="btn" onClick={() => dispatch({ type: "sort/shuffle" })}>
          Жаңа деректер
        </button>
      </div>
      <p className={styles.small}>
        Сарғыш: салыстыру, қызыл: ауыстыру, күлгін: pivot, жасыл: орнында. n(n−1)/2 = {(v.n * (v.n - 1)) / 2}, n·log₂n ≈ {Math.round(v.n * Math.log2(v.n))}
      </p>
    </fieldset>
  );
}

function SearchSection({ state, dispatch }: { state: AlgoLabState; dispatch: D }) {
  const v = state.search;
  const [target, setTarget] = useState(String(v.target));
  const done = v.cursor >= v.total;
  return (
    <fieldset className={styles.group}>
      <legend>Іздеу</legend>
      <Choice
        label="Алгоритм"
        value={v.kind}
        options={[
          ["linear", "Сызықтық"],
          ["binary", "Екілік"],
        ]}
        onPick={(kind) => dispatch({ type: "search/config", kind })}
      />
      <Choice
        label="Массив"
        value={v.sorted ? "sorted" : "shuffled"}
        options={[
          ["sorted", "Сұрыпталған"],
          ["shuffled", "Араластырылған"],
        ]}
        onPick={(x) => dispatch({ type: "search/config", sorted: x === "sorted" })}
      />
      <Range id="search-n" label="Элемент саны (n)" value={v.n} min={SEARCH_N.min} max={SEARCH_N.max} step={8} onChange={(n) => dispatch({ type: "search/config", n })} />
      <form
        className={styles.row}
        onSubmit={(e) => {
          e.preventDefault();
          dispatch({ type: "search/config", target: Number(target) || 0 });
        }}
      >
        <label htmlFor="search-target">Мақсат</label>
        <input id="search-target" type="number" className={styles.numInput} value={target} onChange={(e) => setTarget(e.target.value)} />
        <button type="submit" className="btn">
          Орнату
        </button>
      </form>
      <div className={styles.metrics} role="status" aria-live="off">
        <div>
          <span>Қаралған</span>
          <strong>{v.probes.length}</strong>
        </div>
        <div>
          <span>Нәтиже</span>
          <strong>{v.found === null ? "…" : v.found >= 0 ? `[${v.found}]` : "жоқ"}</strong>
        </div>
        <div>
          <span>⌊log₂n⌋+1</span>
          <strong>{Math.floor(Math.log2(v.n)) + 1}</strong>
        </div>
      </div>
      <Player
        playing={v.playing}
        done={done}
        onStep={() => dispatch({ type: "search/step" })}
        onPlay={() => dispatch({ type: "search/play" })}
        onPause={() => dispatch({ type: "search/pause" })}
        onFinish={() => dispatch({ type: "search/finish" })}
        onReset={() => dispatch({ type: "search/reset" })}
      />
    </fieldset>
  );
}

function GraphSection({ state, dispatch }: { state: AlgoLabState; dispatch: D }) {
  const v = state.graph;
  const g = GRAPHS[v.preset];
  const done = v.cursor >= v.total;
  const path = done ? pathTo(v.prev, v.goal) : [];
  return (
    <fieldset className={styles.group}>
      <legend>Граф</legend>
      <Choice
        label="Граф"
        value={v.preset}
        options={[
          ["roads", "Жолдар картасы"],
          ["grid", "4×4 тор"],
        ]}
        onPick={(preset) => dispatch({ type: "graph/config", preset })}
      />
      <Choice label="Алгоритм" value={v.alg} options={Object.entries(GRAPH_NAMES) as [GraphAlg, string][]} onPick={(alg) => dispatch({ type: "graph/config", alg })} />
      <div className={styles.row}>
        <label htmlFor="g-start">Старт</label>
        <select id="g-start" value={v.start} onChange={(e) => dispatch({ type: "graph/config", start: e.target.value })}>
          {g.nodes.map((n) => (
            <option key={n.id}>{n.id}</option>
          ))}
        </select>
        <label htmlFor="g-goal">Мақсат</label>
        <select id="g-goal" value={v.goal} onChange={(e) => dispatch({ type: "graph/config", goal: e.target.value })}>
          {g.nodes.map((n) => (
            <option key={n.id}>{n.id}</option>
          ))}
        </select>
      </div>
      <p className={styles.small}>
        Бекітілген ретпен: {v.visited.join(" → ") || "-"}
      </p>
      {done && (
        <p className={styles.small} role="status">
          {path.length ? `Жол: ${path.join(" → ")} · қабырға: ${path.length - 1}${g.weighted ? ` · құны: ${pathCost(g, path)}` : ""}` : "Мақсатқа жол жоқ."}
        </p>
      )}
      <Player
        playing={v.playing}
        done={done}
        onStep={() => dispatch({ type: "graph/step" })}
        onPlay={() => dispatch({ type: "graph/play" })}
        onPause={() => dispatch({ type: "graph/pause" })}
        onFinish={() => dispatch({ type: "graph/finish" })}
        onReset={() => dispatch({ type: "graph/reset" })}
      />
      <p className={styles.small}>Жасыл: бекітілген, сарғыш: кезекте (frontier), көк: табылған жол. Сан: қашықтық.</p>
    </fieldset>
  );
}

function BenchChart({ state }: { state: AlgoLabState }) {
  const pts = state.stats.bench.filter((p) => p.preset === "random");
  if (pts.length === 0) return <p className={styles.small}>Әзірге өлшем жоқ.</p>;
  const W = 300;
  const H = 170;
  const maxN = Math.max(...pts.map((p) => p.n));
  const maxC = Math.max(...pts.map((p) => p.comparisons));
  const x = (n: number) => 30 + (n / maxN) * (W - 40);
  const y = (c: number) => H - 20 - (c / maxC) * (H - 30);
  const algs = [...new Set(pts.map((p) => p.alg))];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Салыстыру саны мен n графигі">
      <line x1={30} y1={H - 20} x2={W - 5} y2={H - 20} stroke="currentColor" opacity={0.4} />
      <line x1={30} y1={H - 20} x2={30} y2={5} stroke="currentColor" opacity={0.4} />
      <text x={W - 5} y={H - 5} fontSize={10} textAnchor="end" fill="currentColor">
        n = {maxN}
      </text>
      <text x={34} y={12} fontSize={10} fill="currentColor">
        {maxC.toLocaleString("ru-RU")} салыстыру
      </text>
      {algs.map((alg) => {
        const line = pts.filter((p) => p.alg === alg).sort((a, b) => a.n - b.n);
        return (
          <g key={alg}>
            <polyline fill="none" stroke={BENCH_COLORS[alg]} strokeWidth={2} points={line.map((p) => `${x(p.n)},${y(p.comparisons)}`).join(" ")} />
            {line.map((p) => (
              <circle key={p.n} cx={x(p.n)} cy={y(p.comparisons)} r={3} fill={BENCH_COLORS[alg]} />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

function BenchSection({ state, dispatch }: { state: AlgoLabState; dispatch: D }) {
  const [alg, setAlg] = useState<SortAlg>("selection");
  const [n, setN] = useState(256);
  const pts = state.stats.bench.filter((p) => p.preset === "random").sort((a, b) => (a.alg === b.alg ? a.n - b.n : a.alg < b.alg ? -1 : 1));
  return (
    <fieldset className={styles.group}>
      <legend>Тәжірибе: n өскенде</legend>
      <Choice<SortAlg> label="Алгоритм" value={alg} options={Object.entries(SORT_NAMES) as [SortAlg, string][]} onPick={(v) => setAlg(v)} />
      <div className={styles.row} role="group" aria-label="n">
        {[64, 128, 256, 512, 1024, 2048, 4096].map((k) => (
          <button key={k} type="button" className="btn" aria-pressed={n === k} onClick={() => setN(k)}>
            {k}
          </button>
        ))}
      </div>
      <div className={styles.row}>
        <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "bench/run", alg, n: Math.min(BENCH_N.max, n) })}>
          Өлшеу
        </button>
        <button type="button" className="btn" onClick={() => dispatch({ type: "bench/clear" })}>
          Тазалау
        </button>
      </div>
      <BenchChart state={state} />
      {pts.length > 0 && (
        <table className={styles.benchTable}>
          <thead>
            <tr>
              <th scope="col">Алгоритм</th>
              <th scope="col">n</th>
              <th scope="col">Салыстыру</th>
              <th scope="col">÷ алдыңғы</th>
            </tr>
          </thead>
          <tbody>
            {pts.map((p, i) => {
              const prev = pts[i - 1];
              const ratio = prev && prev.alg === p.alg ? (p.comparisons / prev.comparisons).toFixed(2) : "";
              return (
                <tr key={`${p.alg}-${p.n}`}>
                  <td style={{ color: BENCH_COLORS[p.alg] }}>{SORT_NAMES[p.alg]}</td>
                  <td>{p.n}</td>
                  <td>{p.comparisons.toLocaleString("ru-RU")}</td>
                  <td>{ratio && `×${ratio}`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </fieldset>
  );
}

export function AlgoControlPanel({ state, sections, dispatch, canUndo, onUndo }: { state: AlgoLabState; sections: AlgoSection[]; dispatch: D; canUndo: boolean; onUndo(): void }) {
  const has = (s: AlgoSection) => sections.includes(s);
  return (
    <aside className={styles.controls} aria-label="Басқару панелі">
      {has("sort") && <SortSection state={state} dispatch={dispatch} />}
      {has("search") && <SearchSection key={`${state.search.n}-${state.search.target}`} state={state} dispatch={dispatch} />}
      {has("graph") && <GraphSection state={state} dispatch={dispatch} />}
      {has("bench") && <BenchSection state={state} dispatch={dispatch} />}
      {has("hash") && <HashSection state={state} dispatch={dispatch} />}
      {has("heap") && <HeapSection state={state} dispatch={dispatch} />}
      {has("dp") && <DpSection state={state} dispatch={dispatch} />}
      {has("uf") && <UfSection state={state} dispatch={dispatch} />}
      <label className={styles.slider}>
        <span>Ойнату жылдамдығы</span>
        <input type="range" min={1} max={60} step={1} value={Math.min(60, state.speed)} onChange={(e) => dispatch({ type: "speed/set", speed: Number(e.target.value) })} aria-label="Ойнату жылдамдығы (қадам/с)" />
      </label>
      <div className={styles.row}>
        <button type="button" className="btn" disabled={!canUndo} onClick={onUndo}>
          Соңғы әрекетті болдырмау
        </button>
      </div>
    </aside>
  );
}
