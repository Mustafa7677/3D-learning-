"use client";

import { useEffect, useRef, useState } from "react";
import { canRun, assign, loads, type ClientId, type DbLabAction, type DbLabState, type Op } from "@inside-tech/lab-db";
import type { DbFocus } from "../scene/DbScene";
import styles from "./lab.module.css";

type D = (a: DbLabAction) => void;

function SqlSection({ state, dispatch }: { state: DbLabState; dispatch: D }) {
  const [text, setText] = useState(state.sql.text);
  // The runtime echoes back what we sent a moment later; only adopt text that came from elsewhere
  // (a step's setup, a reset), so a slow echo never overwrites what the learner is typing.
  const sent = useRef<string | null>(null);
  useEffect(() => {
    if (state.sql.text !== sent.current) setText(state.sql.text);
  }, [state.sql.text]);
  const run = () => {
    sent.current = text;
    dispatch({ type: "sql/text", text });
    dispatch({ type: "sql/run" });
  };
  const r = state.sql.last;
  return (
    <fieldset className={styles.group}>
      <legend>SQL</legend>
      <label className={styles.small} htmlFor="sql-src">
        Сұраныс (бірнешеуін «;» арқылы)
      </label>
      <textarea
        id="sql-src"
        className={styles.code}
        rows={5}
        spellCheck={false}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") run();
        }}
      />
      <div className={styles.row}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={run}
        >
          Орындау
        </button>
        <button type="button" className="btn" onClick={() => dispatch({ type: "sql/reset" })}>
          Дерекқорды қалпына келтіру
        </button>
        <button type="button" className="btn" onClick={() => dispatch({ type: "sql/crash" })}>
          Сервер құлады
        </button>
      </div>
      {state.sql.session.snapshot && <p className={styles.small}>Транзакция ашық: COMMIT не ROLLBACK күтуде.</p>}
      {r && !r.ok && (
        <p className={styles.small} role="alert">
          Қате: {r.error}
        </p>
      )}
      {r?.ok && (
        <div role="status">
          <p className={styles.small}>
            {r.kind === "select" || r.kind === "explain" ? `${r.rows.length} жол` : r.kind === "insert" || r.kind === "update" || r.kind === "delete" ? `${r.affected} жол өзгерді` : r.kind?.toUpperCase()} · {r.examined} жол қаралды
            {r.plan.length > 0 && ` · жоспар: ${r.plan.map((p) => `${p.table} ${p.access === "index" ? `индекс(${p.column})` : "сканерлеу"}`).join(" → ")}`}
          </p>
          {r.rows.length > 0 && (
            <div className={styles.tableScroll}>
              <table className={styles.benchTable}>
                <thead>
                  <tr>
                    {r.columns.map((c) => (
                      <th key={c} scope="col">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {r.rows.slice(0, 20).map((row, i) => (
                    <tr key={i}>
                      {r.columns.map((c) => (
                        <td key={c}>{row[c] === null ? "NULL" : String(row[c])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {r.rows.length > 20 && <p className={styles.small}>… тағы {r.rows.length - 20} жол</p>}
            </div>
          )}
        </div>
      )}
      <p className={styles.small}>Кестелер: students(id, name, city, year), courses(id, title, credits), enrollments(student_id, course_id, grade), accounts(id, owner, balance), events(id, user_id, kind, amount).</p>
    </fieldset>
  );
}

function RaceSection({ state, dispatch }: { state: DbLabState; dispatch: D }) {
  const r = state.race;
  const ops: [ClientId, Op, string][] = [
    ["A", "read", "A оқиды"],
    ["A", "write", "A жазады (+100)"],
    ["B", "read", "B оқиды"],
    ["B", "write", "B жазады (+100)"],
  ];
  return (
    <fieldset className={styles.group}>
      <legend>Екі клиент, бір шот</legend>
      <button type="button" className="btn" aria-pressed={r.locking} onClick={() => dispatch({ type: "race/locking", on: !r.locking })}>
        SELECT … FOR UPDATE (құлып)
      </button>
      <div className={styles.row}>
        {ops.map(([client, op, label]) => (
          <button key={label} type="button" className="btn" disabled={r.done[client] || (op === "read" && r.seen[client] !== null) || (op === "write" && r.seen[client] === null)} onClick={() => dispatch({ type: "race/op", client, op })} title={canRun(r, client, op) ?? undefined}>
            {label}
          </button>
        ))}
      </div>
      <div className={styles.metrics} role="status">
        <div>
          <span>Баланс</span>
          <strong>{r.balance}</strong>
        </div>
        <div>
          <span>Күтілетін</span>
          <strong>{r.initial + 200}</strong>
        </div>
      </div>
      <ul className={styles.notes}>
        {r.log.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
      <button type="button" className="btn" onClick={() => dispatch({ type: "race/reset" })}>
        Басынан
      </button>
    </fieldset>
  );
}

function ShardSection({ state, dispatch }: { state: DbLabState; dispatch: D }) {
  const { method, n } = state.shard;
  const l = loads(assign(method, n), n);
  const last = state.stats.shardMoves.at(-1);
  return (
    <fieldset className={styles.group}>
      <legend>Шардинг (1000 пайдаланушы)</legend>
      <div className={styles.row} role="group" aria-label="Әдіс">
        {(
          [
            ["mod", "hash mod N"],
            ["consistent", "Consistent hashing"],
          ] as const
        ).map(([m, label]) => (
          <button key={m} type="button" className="btn" aria-pressed={method === m} onClick={() => dispatch({ type: "shard/method", method: m })}>
            {label}
          </button>
        ))}
      </div>
      <div className={styles.slider}>
        <label htmlFor="shards">Шард саны</label>
        <output htmlFor="shards">{n}</output>
        <input id="shards" type="range" min={2} max={8} value={n} onChange={(e) => dispatch({ type: "shard/n", n: Number(e.target.value) })} />
      </div>
      <p className={styles.small}>Жүктеме: {l.join(" · ")}</p>
      {last && (
        <p className={styles.small} role="status">
          {last.method === "mod" ? "mod N" : "consistent"}: {last.from} → {last.to} шард: {Math.round(last.moved * 100)}% кілт көшті
        </p>
      )}
    </fieldset>
  );
}

export function DbControlPanel({ state, focus, dispatch, canUndo, onUndo }: { state: DbLabState; focus: DbFocus; dispatch: D; canUndo: boolean; onUndo(): void }) {
  return (
    <aside className={styles.controls} aria-label="Басқару панелі">
      {focus === "sql" && <SqlSection state={state} dispatch={dispatch} />}
      {focus === "race" && <RaceSection state={state} dispatch={dispatch} />}
      {focus === "shard" && <ShardSection state={state} dispatch={dispatch} />}
      <div className={styles.row}>
        <button type="button" className="btn" disabled={!canUndo} onClick={onUndo}>
          Соңғы әрекетті болдырмау
        </button>
      </div>
    </aside>
  );
}
