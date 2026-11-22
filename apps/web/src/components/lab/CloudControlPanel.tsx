"use client";

import {
  BUG_RATE,
  SERVICES,
  STEPS,
  USERS,
  availability,
  downtimeMinutes,
  incidentMetrics,
  latencyMs,
  pipeline,
  simulateDay,
  survivors,
  type CloudLabAction,
  type CloudLabState,
  type Strategy,
} from "@inside-tech/lab-cloud";
import type { CloudFocus } from "../scene/CloudScene";
import styles from "./lab.module.css";
import { LbSection, ProbesSection, QueueSection, RetriesSection, ShutdownSection, StampedeSection } from "./CloudMiddleSections";

type D = (a: CloudLabAction) => void;
const fmtMs = (v: number) => (Number.isFinite(v) ? `${v.toFixed(1)} мс` : "∞ (шамадан тыс)");

function ImageSection({ state, dispatch }: { state: CloudLabState; dispatch: D }) {
  const order = state.image.order;
  const last = state.image.last;
  return (
    <fieldset className={styles.group}>
      <legend>Dockerfile</legend>
      <ol className={styles.dockerfile}>
        {order.map((id, i) => (
          <li key={id}>
            <code>{STEPS[id].text}</code>
            <button type="button" className="btn" aria-label={`${STEPS[id].text} жоғары`} disabled={i === 0} onClick={() => dispatch({ type: "image/move", step: id, delta: -1 })}>
              ↑
            </button>
            <button type="button" className="btn" aria-label={`${STEPS[id].text} төмен`} disabled={i === order.length - 1} onClick={() => dispatch({ type: "image/move", step: id, delta: 1 })}>
              ↓
            </button>
          </li>
        ))}
      </ol>
      <div className={styles.row}>
        <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "image/build", change: "src" })}>
          Код өзгерді → жинау
        </button>
        <button type="button" className="btn" onClick={() => dispatch({ type: "image/build", change: "package" })}>
          package.json өзгерді → жинау
        </button>
      </div>
      {last && (
        <div className={styles.metrics} role="status">
          {last.error ? (
            <div>
              <span>Қате</span>
              <strong>{last.error}</strong>
            </div>
          ) : (
            <>
              <div>
                <span>Жинау уақыты</span>
                <strong>{last.seconds.toFixed(1)} с</strong>
              </div>
              <div>
                <span>Қайта жиналды</span>
                <strong>{last.rebuilt.length} қабат</strong>
              </div>
            </>
          )}
        </div>
      )}
    </fieldset>
  );
}

function ClusterSection({ state, dispatch }: { state: CloudLabState; dispatch: D }) {
  const c = state.cluster;
  const running = c.pods.filter((p) => p.status === "running").length;
  return (
    <fieldset className={styles.group}>
      <legend>Кластер</legend>
      <div className={styles.slider}>
        <label htmlFor="desired">Қалаған реплика саны</label>
        <output htmlFor="desired">{c.desired}</output>
        <input id="desired" type="range" min={0} max={10} value={c.desired} onChange={(e) => dispatch({ type: "cluster/desired", n: Number(e.target.value) })} />
      </div>
      <div className={styles.row} role="group" aria-label="Pod-тар">
        {c.pods.map((p) => (
          <button key={p.id} type="button" className="btn" onClick={() => dispatch({ type: "cluster/kill", id: p.id })}>
            pod {p.id} құлату {p.status === "pending" ? "(күтуде)" : ""}
          </button>
        ))}
      </div>
      <div className={styles.metrics} role="status">
        <div>
          <span>Жұмыс істейді</span>
          <strong>
            {running} / {c.desired}
          </strong>
        </div>
        <div>
          <span>Контроллер жасады</span>
          <strong>{state.stats.podsCreated}</strong>
        </div>
      </div>
      <p className={styles.small}>Контроллер секундына екі рет нақты күйді қалағанмен салыстырады.</p>
    </fieldset>
  );
}

function ScaleSection({ state, dispatch }: { state: CloudLabState; dispatch: D }) {
  const { lambda, instances } = state.scale;
  const lat = latencyMs(lambda, instances);
  return (
    <fieldset className={styles.group}>
      <legend>Жүктеме мен кешігу</legend>
      <div className={styles.slider}>
        <label htmlFor="lambda">Сұраныс/с (λ)</label>
        <output htmlFor="lambda">{lambda}</output>
        <input id="lambda" type="range" min={100} max={1500} step={50} value={lambda} onChange={(e) => dispatch({ type: "scale/set", lambda: Number(e.target.value) })} />
      </div>
      <div className={styles.slider}>
        <label htmlFor="instances">Серверлер (n)</label>
        <output htmlFor="instances">{instances}</output>
        <input id="instances" type="range" min={1} max={30} value={instances} onChange={(e) => dispatch({ type: "scale/set", instances: Number(e.target.value) })} />
      </div>
      <div className={styles.metrics} role="status">
        <div>
          <span>Жүктеме</span>
          <strong>{((lambda / instances / 100) * 100).toFixed(0)}%</strong>
        </div>
        <div>
          <span>Кешігу</span>
          <strong>{fmtMs(lat)}</strong>
        </div>
      </div>
      <p className={styles.small}>W = 1 / (μ − λ/n), μ = 100 сұраныс/с. SLO: ≤ 50 мс.</p>
    </fieldset>
  );
}

function AutoscaleSection({ state, dispatch }: { state: CloudLabState; dispatch: D }) {
  const p = state.autoscale;
  const day = simulateDay(p);
  return (
    <fieldset className={styles.group}>
      <legend>Автомасштабтау</legend>
      <div className={styles.slider}>
        <label htmlFor="as-min">Ең аз (min)</label>
        <output htmlFor="as-min">{p.min}</output>
        <input id="as-min" type="range" min={1} max={20} value={p.min} onChange={(e) => dispatch({ type: "autoscale/set", min: Number(e.target.value) })} />
      </div>
      <div className={styles.slider}>
        <label htmlFor="as-max">Ең көп (max)</label>
        <output htmlFor="as-max">{p.max}</output>
        <input id="as-max" type="range" min={1} max={30} value={p.max} onChange={(e) => dispatch({ type: "autoscale/set", max: Number(e.target.value) })} />
      </div>
      <div className={styles.slider}>
        <label htmlFor="as-target">Мақсатты жүктеме (target)</label>
        <output htmlFor="as-target">{Math.round(p.target * 100)}%</output>
        <input id="as-target" type="range" min={30} max={100} step={5} value={Math.round(p.target * 100)} onChange={(e) => dispatch({ type: "autoscale/set", target: Number(e.target.value) / 100 })} />
      </div>
      <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "autoscale/run" })}>
        Тәулікті жүргізу
      </button>
      {p.ran && (
        <div className={styles.metrics} role="status">
          <div>
            <span>SLO бұзылуы</span>
            <strong>{day.violations} сағат</strong>
          </div>
          <div>
            <span>Шығын</span>
            <strong>{day.instanceHours} сервер·сағат</strong>
          </div>
        </div>
      )}
      <p className={styles.small}>Керек = ⌈λ / (100 · target)⌉, min…max аралығында; шешім бір сағат кешігеді.</p>
    </fieldset>
  );
}

function PipelineSection({ state, dispatch }: { state: CloudLabState; dispatch: D }) {
  const c = state.pipeline;
  const r = pipeline(c);
  const toggles: [keyof typeof c & ("parallel" | "cache" | "failingTest"), string][] = [
    ["failingTest", "Құлаған тест бар"],
    ["parallel", "Тексерулер параллель"],
    ["cache", "Жинау кэші"],
  ];
  return (
    <fieldset className={styles.group}>
      <legend>CI/CD конвейері</legend>
      <div className={styles.row} role="group" aria-label="Конвейер баптаулары">
        {toggles.map(([k, label]) => (
          <button key={k} type="button" className="btn" aria-pressed={c[k]} onClick={() => dispatch({ type: "pipeline/set", [k]: !c[k] })}>
            {label}
          </button>
        ))}
      </div>
      <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "pipeline/run" })}>
        Конвейерді іске қосу
      </button>
      {c.ran && (
        <div className={styles.metrics} role="status">
          <div>
            <span>Уақыт</span>
            <strong>{r.minutes} мин</strong>
          </div>
          <div>
            <span>Deploy</span>
            <strong>{r.deployed ? "шықты" : "болмады"}</strong>
          </div>
        </div>
      )}
    </fieldset>
  );
}

const STRATEGIES: [Strategy, string][] = [
  ["all", "Бәріне бірден"],
  ["bluegreen", "Blue-green"],
  ["rolling", "Rolling"],
  ["canary", "Canary"],
];

function ReleaseSection({ state, dispatch }: { state: CloudLabState; dispatch: D }) {
  const r = state.release;
  return (
    <fieldset className={styles.group}>
      <legend>Релиз v2 (ішінде қате бар)</legend>
      <div className={styles.row} role="group" aria-label="Стратегия">
        {STRATEGIES.map(([s, label]) => (
          <button key={s} type="button" className="btn" aria-pressed={r.strategy === s} onClick={() => dispatch({ type: "release/strategy", strategy: s })}>
            {label}
          </button>
        ))}
      </div>
      <div className={styles.row}>
        <button type="button" className="btn btn-primary" disabled={r.done} onClick={() => dispatch({ type: "release/step" })}>
          Келесі кезең
        </button>
        <button type="button" className="btn" disabled={r.share === 0} onClick={() => dispatch({ type: "release/rollback" })}>
          Кері қайтару
        </button>
      </div>
      <div className={styles.metrics} role="status">
        <div>
          <span>v2 трафикте</span>
          <strong>{(r.share * 100).toFixed(0)}%</strong>
        </div>
        <div>
          <span>Қате үлесі</span>
          <strong>{(r.share * BUG_RATE * 100).toFixed(1)}%</strong>
        </div>
        <div>
          <span>Ең көп экспозиция</span>
          <strong>{Math.round(r.maxShare * USERS).toLocaleString("ru-RU")} адам</strong>
        </div>
      </div>
      {r.rolledBack && <p className={styles.small}>Кері қайтарылды: трафик тек v1-де.</p>}
    </fieldset>
  );
}

function AvailabilitySection({ state, dispatch }: { state: CloudLabState; dispatch: D }) {
  const { replicas, zones, zoneDown } = state.availability;
  const a = availability(replicas);
  return (
    <fieldset className={styles.group}>
      <legend>Қолжетімділік</legend>
      <div className={styles.slider}>
        <label htmlFor="replicas">Репликалар</label>
        <output htmlFor="replicas">{replicas}</output>
        <input id="replicas" type="range" min={1} max={6} value={replicas} onChange={(e) => dispatch({ type: "availability/set", replicas: Number(e.target.value) })} />
      </div>
      <div className={styles.slider}>
        <label htmlFor="zones">Зоналар</label>
        <output htmlFor="zones">{zones}</output>
        <input id="zones" type="range" min={1} max={3} value={zones} onChange={(e) => dispatch({ type: "availability/set", zones: Number(e.target.value) })} />
      </div>
      <div className={styles.row}>
        <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "availability/zoneDown", down: !zoneDown })}>
          {zoneDown ? "Зонаны қалпына келтіру" : "Зона «a» құлады"}
        </button>
      </div>
      <div className={styles.metrics} role="status">
        <div>
          <span>Қолжетімділік</span>
          <strong>{(a * 100).toFixed(a >= 0.9999 ? 4 : 2)}%</strong>
        </div>
        <div>
          <span>Жылына тоқтау</span>
          <strong>{downtimeMinutes(a) >= 120 ? `${(downtimeMinutes(a) / 60).toFixed(1)} сағ` : `${downtimeMinutes(a).toFixed(1)} мин`}</strong>
        </div>
        {zoneDown && (
          <div>
            <span>Зона құлағанда</span>
            <strong>{survivors(replicas, zones) > 0 ? `тірі (${survivors(replicas, zones)} реплика)` : "сервис құлады"}</strong>
          </div>
        )}
      </div>
    </fieldset>
  );
}

function IncidentSection({ state, dispatch }: { state: CloudLabState; dispatch: D }) {
  const m = incidentMetrics();
  return (
    <fieldset className={styles.group}>
      <legend>Метрикалар (инцидент)</legend>
      <div className={styles.tableScroll}>
        <table className={styles.benchTable}>
          <thead>
            <tr>
              <th>Сервис</th>
              <th>шақырады</th>
              <th>p50, мс</th>
              <th>p99, мс</th>
              <th>қате</th>
              <th>CPU</th>
              <th>ДҚ, мс</th>
            </tr>
          </thead>
          <tbody>
            {SERVICES.map((s) => (
              <tr key={s.id}>
                <td>{s.id}</td>
                <td>{s.calls.join(" ") || "-"}</td>
                <td>{m[s.id].p50}</td>
                <td>{m[s.id].p99}</td>
                <td>{(m[s.id].errors * 100).toFixed(1)}%</td>
                <td>{(m[s.id].cpu * 100).toFixed(0)}%</td>
                <td>{m[s.id].dbMs || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.row} role="group" aria-label="Түпкі себеп">
        {SERVICES.map((s) => (
          <button key={s.id} type="button" className="btn" aria-pressed={state.incident.selected === s.id} onClick={() => dispatch({ type: "incident/select", service: s.id })}>
            Себеп: {s.id}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function CloudControlPanel({ state, focus, dispatch, canUndo, onUndo }: { state: CloudLabState; focus: CloudFocus; dispatch: D; canUndo: boolean; onUndo(): void }) {
  return (
    <aside className={styles.controls} aria-label="Басқару панелі">
      {focus === "image" && <ImageSection state={state} dispatch={dispatch} />}
      {focus === "cluster" && <ClusterSection state={state} dispatch={dispatch} />}
      {focus === "scale" && <ScaleSection state={state} dispatch={dispatch} />}
      {focus === "autoscale" && <AutoscaleSection state={state} dispatch={dispatch} />}
      {focus === "pipeline" && <PipelineSection state={state} dispatch={dispatch} />}
      {focus === "release" && <ReleaseSection state={state} dispatch={dispatch} />}
      {focus === "availability" && <AvailabilitySection state={state} dispatch={dispatch} />}
      {focus === "incident" && <IncidentSection state={state} dispatch={dispatch} />}
      {focus === "probes" && <ProbesSection state={state} dispatch={dispatch} />}
      {focus === "queue" && <QueueSection state={state} dispatch={dispatch} />}
      {focus === "lb" && <LbSection state={state} dispatch={dispatch} />}
      {focus === "retries" && <RetriesSection state={state} dispatch={dispatch} />}
      {focus === "stampede" && <StampedeSection state={state} dispatch={dispatch} />}
      {focus === "shutdown" && <ShutdownSection state={state} dispatch={dispatch} />}
      <div className={styles.row}>
        <button type="button" className="btn" disabled={!canUndo} onClick={onUndo}>
          Соңғы әрекетті болдырмау
        </button>
      </div>
    </aside>
  );
}
