"use client";

import { LB_SERVERS, type CloudLabAction, type CloudLabState, type LbAlgo, type CacheStrategy, type ProbeScenario, type RetryPolicy, type StopPolicy } from "@inside-tech/lab-cloud";
import styles from "./lab.module.css";

type D = (a: CloudLabAction) => void;

export function ProbesSection({ state, dispatch }: { state: CloudLabState; dispatch: D }) {
  const p = state.probes;
  const last = p.last;
  const scenarios: [ProbeScenario, string][] = [
    ["rollout", "Rolling update"],
    ["deadlock", "B поды қатады (22 с)"],
  ];
  return (
    <fieldset className={styles.group}>
      <legend>Денсаулық тексерістері · 3 под, 100 сұраныс/с, 90 с</legend>
      <div className={styles.row} role="group" aria-label="Сценарий">
        {scenarios.map(([v, label]) => (
          <button key={v} type="button" className="btn" aria-pressed={p.scenario === v} onClick={() => dispatch({ type: "probes/set", scenario: v })}>
            {label}
          </button>
        ))}
      </div>
      <label className={styles.row}>
        <input type="checkbox" checked={p.readiness} onChange={(e) => dispatch({ type: "probes/set", readiness: e.target.checked })} /> Readiness тексерісі (әр 5 с)
      </label>
      <label className={styles.row}>
        <input type="checkbox" checked={p.liveness} onChange={(e) => dispatch({ type: "probes/set", liveness: e.target.checked })} /> Liveness тексерісі (3 сәтсіздік = қайта іске қосу)
      </label>
      <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "probes/run" })}>
        90 секундты ойнату
      </button>
      {last && (
        <div className={styles.metrics} role="status" aria-label="Тексеріс нәтижесі">
          <div>
            <span>Қате сұраныс</span>
            <strong>{last.errors}</strong>
          </div>
          <div>
            <span>Қайта іске қосу</span>
            <strong>{last.restarts}</strong>
          </div>
          <div>
            <span>Соңында B</span>
            <strong>{last.timeline.at(-1)![1]!.phase === "dead" ? "қатып тұр" : "сау"}</strong>
          </div>
        </div>
      )}
    </fieldset>
  );
}

export function QueueSection({ state, dispatch }: { state: CloudLabState; dispatch: D }) {
  const q = state.queue;
  const last = q.last;
  return (
    <fieldset className={styles.group}>
      <legend>Кезек · 30 с бойы 150/с, сосын 50/с</legend>
      <div className={styles.row} role="group" aria-label="Өңдеушілер">
        {[1, 2].map((n) => (
          <button key={n} type="button" className="btn" aria-pressed={q.consumers === n} onClick={() => dispatch({ type: "queue/set", consumers: n })}>
            {n} өңдеуші ({n * 100}/с)
          </button>
        ))}
      </div>
      <div className={styles.row} role="group" aria-label="Кезек шегі">
        <button type="button" className="btn" aria-pressed={q.limit === null} onClick={() => dispatch({ type: "queue/set", limit: null })}>
          Шексіз кезек
        </button>
        <button type="button" className="btn" aria-pressed={q.limit === 500} onClick={() => dispatch({ type: "queue/set", limit: 500 })}>
          Шегі 500, артығы 429
        </button>
      </div>
      <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "queue/run" })}>
        Толқынды жіберу
      </button>
      {last && (
        <div className={styles.metrics} role="status" aria-label="Кезек нәтижесі">
          <div>
            <span>Ең ұзын кезек</span>
            <strong>{last.maxLength}</strong>
          </div>
          <div>
            <span>Ең ұзақ күту</span>
            <strong>{last.maxWait} с</strong>
          </div>
          <div>
            <span>429 алды</span>
            <strong>{last.dropped}</strong>
          </div>
        </div>
      )}
    </fieldset>
  );
}

const ALGOS: [LbAlgo, string][] = [
  ["round-robin", "Round robin"],
  ["random", "Кездейсоқ"],
  ["least-conn", "Least connections"],
];

export function LbSection({ state, dispatch }: { state: CloudLabState; dispatch: D }) {
  const l = state.lb;
  const last = l.last;
  return (
    <fieldset className={styles.group}>
      <legend>Жүктемені тарату · 300 сұраныс, әр 12 мс</legend>
      <p className={styles.small}>{LB_SERVERS.map((s) => `${s.id}: ${s.ms} мс`).join(" · ")}</p>
      <div className={styles.row} role="group" aria-label="Алгоритм">
        {ALGOS.map(([v, label]) => (
          <button key={v} type="button" className="btn" aria-pressed={l.algo === v} onClick={() => dispatch({ type: "lb/set", algo: v })}>
            {label}
          </button>
        ))}
      </div>
      <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "lb/run" })}>
        Сұраныстарды жіберу
      </button>
      {last && (
        <div className={styles.metrics} role="status" aria-label="Тарату нәтижесі">
          <div>
            <span>A / B / C</span>
            <strong>{last.counts.join(" / ")}</strong>
          </div>
          <div>
            <span>Медиана</span>
            <strong>{last.p50} мс</strong>
          </div>
          <div>
            <span>p95</span>
            <strong>{last.p95} мс</strong>
          </div>
        </div>
      )}
    </fieldset>
  );
}

const POLICIES: [RetryPolicy, string][] = [
  ["none", "Қайталаусыз"],
  ["immediate", "Бірден 3 рет"],
  ["backoff", "Экспоненциалды кідіріс"],
  ["breaker", "Circuit breaker"],
];

export function RetriesSection({ state, dispatch }: { state: CloudLabState; dispatch: D }) {
  const r = state.retries ?? { policy: "none" as RetryPolicy, last: null };
  return (
    <fieldset className={styles.group}>
      <legend>Қызмет 10-30 с құлаған · сыйымдылығы 150/с</legend>
      <div className={styles.row} role="group" aria-label="Қайталау саясаты">
        {POLICIES.map(([p, label]) => (
          <button key={p} type="button" className="btn" aria-pressed={r.policy === p} onClick={() => dispatch({ type: "retries/set", policy: p })}>
            {label}
          </button>
        ))}
      </div>
      <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "retries/run" })}>
        60 секундты ойнату
      </button>
      {r.last && (
        <div className={styles.metrics} role="status" aria-label="Қайталау нәтижесі">
          <div>
            <span>Қате</span>
            <strong>{r.last.errors}</strong>
          </div>
          <div>
            <span>Ең көп жүктеме</span>
            <strong>{r.last.peakLoad}/с</strong>
          </div>
          <div>
            <span>Оралды</span>
            <strong>{r.last.recoveredAt === null ? "ешқашан" : `${r.last.recoveredAt} с`}</strong>
          </div>
        </div>
      )}
    </fieldset>
  );
}

const STRATEGIES: [CacheStrategy, string][] = [
  ["none", "Кэшсіз"],
  ["ttl", "TTL кэш"],
  ["coalesce", "Single-flight"],
  ["early", "Алдын ала жаңарту"],
];

export function StampedeSection({ state, dispatch }: { state: CloudLabState; dispatch: D }) {
  const c = state.stampede ?? { strategy: "ttl" as CacheStrategy, last: null };
  return (
    <fieldset className={styles.group}>
      <legend>Ыстық кілт 500/с · дерекқор 50/с · TTL 20 с</legend>
      <div className={styles.row} role="group" aria-label="Кэш стратегиясы">
        {STRATEGIES.map(([k, label]) => (
          <button key={k} type="button" className="btn" aria-pressed={c.strategy === k} onClick={() => dispatch({ type: "stampede/set", strategy: k })}>
            {label}
          </button>
        ))}
      </div>
      <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "stampede/run" })}>
        60 секундты ойнату
      </button>
      {c.last && (
        <div className={styles.metrics} role="status" aria-label="Кэш нәтижесі">
          <div>
            <span>Кэштен</span>
            <strong>{Math.round(c.last.hitRate * 100)}%</strong>
          </div>
          <div>
            <span>Дерекқор шыңы</span>
            <strong>{c.last.dbPeak}/с</strong>
          </div>
          <div>
            <span>Шамадан тыс</span>
            <strong>{c.last.overload} с</strong>
          </div>
          <div>
            <span>Күтті</span>
            <strong>{c.last.slow} с</strong>
          </div>
        </div>
      )}
    </fieldset>
  );
}

const STOP_WORD: [StopPolicy, string][] = [
  ["kill", "Бірден өлтіру"],
  ["close", "SIGTERM: портты жабу"],
  ["drain", "preStop + draining"],
];

export function ShutdownSection({ state, dispatch }: { state: CloudLabState; dispatch: D }) {
  const c = state.shutdown ?? { policy: "kill" as StopPolicy, last: null };
  return (
    <fieldset className={styles.group}>
      <legend>Rolling deploy · 4 под · 100 сұраныс/с · әр сұраныс 2 с</legend>
      <div className={styles.row} role="group" aria-label="Под қалай тоқтайды">
        {STOP_WORD.map(([k, label]) => (
          <button key={k} type="button" className="btn" aria-pressed={c.policy === k} onClick={() => dispatch({ type: "shutdown/set", policy: k })}>
            {label}
          </button>
        ))}
      </div>
      <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "shutdown/run" })}>
        Deploy жасау
      </button>
      {c.last && (
        <div className={styles.metrics} role="status" aria-label="Deploy нәтижесі">
          <div>
            <span>Қате</span>
            <strong>{c.last.total}</strong>
          </div>
          <div>
            <span>Под тоқтауы</span>
            <strong>{c.last.stopSeconds} с</strong>
          </div>
        </div>
      )}
      <p className={styles.small}>Жүктеме балансы тоқтап жатқан подты 5 секундтан кейін ғана тізімнен шығарады.</p>
    </fieldset>
  );
}
