"use client";

import { useEffect, useRef, useState } from "react";
import {
  PROGRAMS,
  STATUS_TEXT,
  boxCss,
  boxSizes,
  finalOutput,
  flexCss,
  flexPreviewHtml,
  parseHtml,
  runEventLoop,
  traceProgress,
  type FlexModel,
  type Method,
  type Route,
  type WebLabAction,
  type WebLabState,
} from "@inside-tech/lab-web";
import type { WebFocus } from "../scene/WebScene";
import styles from "./lab.module.css";
import lang from "./lang.module.css";
import web from "./web.module.css";

export type WebSection = "request" | "server" | "dns" | "routes" | "cache" | "html" | "deploy" | "box" | "flex" | "loop" | "sql";

interface Props {
  state: WebLabState;
  sections: WebSection[];
  focus: WebFocus;
  dispatch(a: WebLabAction): void;
  canUndo: boolean;
  onUndo(): void;
}

type D = (a: WebLabAction) => void;

/** Text field that commits after a typing pause (and on blur), not on every key. */
function Debounced({ id, value, onCommit, label, multiline, rows, mono }: { id: string; value: string; onCommit(v: string): void; label: string; multiline?: boolean; rows?: number; mono?: boolean }) {
  const [draft, setDraft] = useState(value);
  const commit = useRef(onCommit);
  commit.current = onCommit;
  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    if (draft === value) return;
    const t = setTimeout(() => commit.current(draft), 400);
    return () => clearTimeout(t);
  }, [draft, value]);
  const flush = () => draft !== value && commit.current(draft);
  return (
    <>
      <label htmlFor={id} className={styles.small}>
        {label}
      </label>
      {multiline ? (
        <textarea id={id} className={mono ? lang.code : lang.textInput} rows={rows ?? 6} value={draft} spellCheck={false} onChange={(e) => setDraft(e.target.value)} onBlur={flush} />
      ) : (
        <input id={id} className={lang.textInput} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={flush} onKeyDown={(e) => e.key === "Enter" && flush()} />
      )}
    </>
  );
}

function Range(props: { id: string; label: string; value: number; min: number; max: number; step: number; fmt?: (v: number) => string; onChange(v: number): void }) {
  return (
    <div className={styles.slider}>
      <label htmlFor={props.id}>{props.label}</label>
      <output htmlFor={props.id}>{props.fmt ? props.fmt(props.value) : props.value}</output>
      <input id={props.id} type="range" min={props.min} max={props.max} step={props.step} value={props.value} onChange={(e) => props.onChange(Number(e.target.value))} />
    </div>
  );
}

function Toggle({ on, onClick, children }: { on: boolean; onClick(): void; children: React.ReactNode }) {
  return (
    <button type="button" className="btn" aria-pressed={on} onClick={onClick}>
      {children}
    </button>
  );
}

const statusClass = (code: number) => (code === 0 ? web.bad : code < 300 ? web.good : code < 400 ? web.warn : web.bad);

// ---------------- request ----------------

function RequestSection({ state, dispatch }: { state: WebLabState; dispatch: D }) {
  const r = state.request;
  const tr = state.trace;
  const at = tr ? traceProgress(tr) : undefined;
  const last = state.history[0];
  return (
    <fieldset className={styles.group}>
      <legend>Сұрау</legend>
      <div className={web.urlRow}>
        <label className="visually-hidden" htmlFor="req-method">
          Әдіс
        </label>
        <select id="req-method" className={web.select} value={r.method} onChange={(e) => dispatch({ type: "req/set", params: { method: e.target.value as Method } })}>
          {["GET", "POST", "PUT", "DELETE"].map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <div className={web.grow}>
          <Debounced id="req-url" label="URL" value={r.url} onCommit={(url) => dispatch({ type: "req/set", params: { url } })} />
        </div>
      </div>
      <Debounced id="req-token" label="Authorization: Bearer (token)" value={r.token ?? ""} onCommit={(token) => dispatch({ type: "req/set", params: { token } })} />
      {(r.method === "POST" || r.method === "PUT") && (
        <div className={web.twoCol}>
          {["name", "city"].map((k) => (
            <div key={k}>
              <Debounced id={`req-body-${k}`} label={`body: ${k}`} value={r.body?.[k] ?? ""} onCommit={(v) => dispatch({ type: "req/set", params: { body: { ...(r.body ?? {}), [k]: v } } })} />
            </div>
          ))}
        </div>
      )}
      <div className={styles.row}>
        <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "req/send" })}>
          Жіберу
        </button>
        {tr && !tr.done && (
          <button type="button" className="btn" onClick={() => dispatch({ type: "req/skip" })}>
            Соңына өту
          </button>
        )}
      </div>
      <Range id="speed" label="Анимация жылдамдығы" value={state.speed} min={100} max={2000} step={50} fmt={(v) => `${(v / 1000).toFixed(2)}×`} onChange={(v) => dispatch({ type: "speed/set", speed: v })} />

      {tr && (
        <ol className={web.timeline} aria-label="Сұрау кезеңдері">
          {tr.stages.map((s, i) => {
            const state_ = tr.done || i < at!.index ? "done" : i === at!.index ? "active" : "todo";
            return (
              <li key={i} data-state={state_} data-ok={s.ok}>
                <span className={web.stageTitle}>{s.title}</span>
                <span className={web.stageMs}>{Math.round(s.dur)} мс</span>
                <span className={web.stageDetail}>{s.detail}</span>
              </li>
            );
          })}
        </ol>
      )}

      {last && (!tr || tr.done) && (
        <div className={web.response} aria-live="polite">
          <div className={web.respHead}>
            <span className={`${web.status} ${statusClass(last.status)}`}>{last.status ? `${last.status} ${STATUS_TEXT[last.status] ?? ""}` : "Қате"}</span>
            <span>{last.ms} мс</span>
            {last.fromCache && <span className={web.badge}>кэштен</span>}
            {last.stale && <span className={`${web.badge} ${web.bad}`}>ескі нұсқа</span>}
          </div>
          {last.error ? (
            <p className={web.err}>{last.error}</p>
          ) : last.body.trim().startsWith("<") ? (
            <iframe className={web.preview} sandbox="" srcDoc={last.body} title="Жауаптың көрінісі" />
          ) : (
            <pre className={web.pre}>{last.body.slice(0, 600)}</pre>
          )}
        </div>
      )}

      {state.history.length > 1 && (
        <details>
          <summary className={styles.small}>Тарих ({state.history.length})</summary>
          <ul className={web.history}>
            {state.history.slice(0, 10).map((h) => (
              <li key={h.id}>
                <span className={`${web.status} ${statusClass(h.status)}`}>{h.status || "ERR"}</span>
                <span className={web.grow}>
                  {h.method} {h.host}
                  {h.path}
                </span>
                <span>{h.fromCache ? "кэш" : `${h.ms} мс`}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </fieldset>
  );
}

// ---------------- server / dns / routes / cache ----------------

function ServerSection({ state, dispatch }: { state: WebLabState; dispatch: D }) {
  return (
    <fieldset className={styles.group}>
      <legend>Серверлер</legend>
      {state.world.servers.map((s) => (
        <div key={s.ip} className={web.card}>
          <p className={web.cardHead}>
            <strong>{s.host}</strong> <span className={styles.small}>{s.ip}</span>
          </p>
          <div className={styles.row}>
            <Toggle on={s.up} onClick={() => dispatch({ type: "server/set", ip: s.ip, patch: { up: !s.up } })}>
              {s.up ? "Қосулы" : "Өшірулі"}
            </Toggle>
            <Toggle on={s.https} onClick={() => dispatch({ type: "server/set", ip: s.ip, patch: { https: !s.https } })}>
              HTTPS
            </Toggle>
          </div>
          <Range id={`lat-${s.ip}`} label="Кідіріс (бір жаққа)" value={s.latency} min={5} max={400} step={5} fmt={(v) => `${v} мс`} onChange={(v) => dispatch({ type: "server/set", ip: s.ip, patch: { latency: v } })} />
        </div>
      ))}
    </fieldset>
  );
}

function DnsSection({ state, dispatch }: { state: WebLabState; dispatch: D }) {
  const [name, setName] = useState("");
  const [ip, setIp] = useState("");
  const ips = state.world.servers.map((s) => s.ip);
  return (
    <fieldset className={styles.group}>
      <legend>DNS жазбалары</legend>
      <ul className={web.list}>
        {state.world.dns.map((r) => (
          <li key={r.name}>
            <span className={web.grow}>
              {r.name} → {r.ip}
            </span>
            <button type="button" className="btn" onClick={() => dispatch({ type: "dns/remove", name: r.name })} aria-label={`${r.name} жазбасын өшіру`}>
              Өшіру
            </button>
          </li>
        ))}
      </ul>
      <div className={web.twoCol}>
        <div>
          <label className={styles.small} htmlFor="dns-name">
            Домен
          </label>
          <input id="dns-name" className={lang.textInput} placeholder="shop.kz" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className={styles.small} htmlFor="dns-ip">
            IP адрес
          </label>
          <input id="dns-ip" className={lang.textInput} list="known-ips" placeholder="93.184.10.5" value={ip} onChange={(e) => setIp(e.target.value)} />
          <datalist id="known-ips">
            {ips.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
        </div>
      </div>
      <div className={styles.row}>
        <button
          type="button"
          className="btn"
          onClick={() => {
            dispatch({ type: "dns/set", name, ip });
            setName("");
            setIp("");
          }}
        >
          Жазба қосу
        </button>
        <button type="button" className="btn" onClick={() => dispatch({ type: "dnsCache/clear" })}>
          DNS кэшін тазалау
        </button>
      </div>
      <p className={styles.small}>Серверлер: {state.world.servers.map((s) => `${s.host} (${s.ip})`).join(", ")}</p>
    </fieldset>
  );
}

function RouteRow({ ip, r, dispatch }: { ip: string; r: Route; dispatch: D }) {
  const set = (patch: Partial<Omit<Route, "id">>) => dispatch({ type: "route/update", ip, id: r.id, patch });
  return (
    <li className={web.route}>
      <div className={web.routeHead}>
        <select aria-label="Әдіс" className={web.select} value={r.method} onChange={(e) => set({ method: e.target.value as Method })}>
          {["GET", "POST", "PUT", "DELETE"].map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <div className={web.grow}>
          <Debounced id={`route-path-${ip}-${r.id}`} label="Жол" value={r.path} onCommit={(path) => set({ path })} />
        </div>
        <select aria-label="Түрі" className={web.select} value={r.kind} onChange={(e) => set({ kind: e.target.value as Route["kind"] })}>
          <option value="html">HTML</option>
          <option value="json">JSON</option>
          <option value="sql">SQL</option>
          <option value="crash">crash</option>
        </select>
      </div>
      <details>
        <summary className={styles.small}>{r.kind === "sql" ? "SQL сұрауы" : "Жауап денесі"}</summary>
        <Debounced id={`route-body-${ip}-${r.id}`} label="" value={r.body} multiline mono rows={3} onCommit={(body) => set({ body })} />
      </details>
      <div className={styles.row}>
        <Toggle on={r.requiresAuth} onClick={() => set({ requiresAuth: !r.requiresAuth })}>
          Token керек
        </Toggle>
        <button type="button" className="btn" onClick={() => dispatch({ type: "route/remove", ip, id: r.id })}>
          Өшіру
        </button>
      </div>
    </li>
  );
}

function RoutesSection({ state, dispatch }: { state: WebLabState; dispatch: D }) {
  const servers = state.world.servers;
  const preferred = servers.find((s) => s.host === "shop.kz") ?? servers.find((s) => s.host === "api.inside.kz") ?? servers[0]!;
  const [ip, setIp] = useState(preferred.ip);
  const server = servers.find((s) => s.ip === ip) ?? preferred;
  return (
    <fieldset className={styles.group}>
      <legend>Маршруттар</legend>
      <label className={styles.small} htmlFor="route-server">
        Сервер
      </label>
      <select id="route-server" className={web.select} value={server.ip} onChange={(e) => setIp(e.target.value)}>
        {servers.map((s) => (
          <option key={s.ip} value={s.ip}>
            {s.host}
          </option>
        ))}
      </select>
      <ul className={web.list}>
        {server.routes.map((r) => (
          <RouteRow key={r.id} ip={server.ip} r={r} dispatch={dispatch} />
        ))}
      </ul>
      <button type="button" className="btn" onClick={() => dispatch({ type: "route/add", ip: server.ip, route: { method: "GET", path: "/api/new", kind: "json", body: '{"ok":true}', requiresAuth: false } })}>
        Маршрут қосу
      </button>
      {server.token && <p className={styles.small}>Бұл сервердің token-і: {server.token}</p>}
    </fieldset>
  );
}

function CacheSection({ state, dispatch }: { state: WebLabState; dispatch: D }) {
  const mine = state.world.servers.find((s) => s.host === "mysite.kz") ?? state.world.servers[0]!;
  return (
    <fieldset className={styles.group}>
      <legend>Браузер кэші</legend>
      {state.world.cache.length === 0 ? (
        <p className={styles.small}>Кэш бос.</p>
      ) : (
        <ul className={web.list}>
          {state.world.cache.map((c) => (
            <li key={c.url}>
              <span className={web.grow}>{c.url}</span>
              <span className={styles.small}>{Math.max(0, Math.round((c.expiresAt - state.world.clock) / 1000))} с қалды</span>
            </li>
          ))}
        </ul>
      )}
      <Range id="max-age" label={`${mine.host}: Cache-Control max-age`} value={mine.maxAge} min={0} max={300} step={10} fmt={(v) => `${v} с`} onChange={(v) => dispatch({ type: "server/set", ip: mine.ip, patch: { maxAge: v } })} />
      <div className={styles.row}>
        <button type="button" className="btn" onClick={() => dispatch({ type: "cache/clear" })}>
          Кэшті тазалау
        </button>
        <button type="button" className="btn" onClick={() => dispatch({ type: "clock/advance", ms: 60_000 })}>
          Уақыт +60 с
        </button>
      </div>
    </fieldset>
  );
}

// ---------------- html / deploy ----------------

function HtmlSection({ state, dispatch }: { state: WebLabState; dispatch: D }) {
  const parsed = parseHtml(state.html);
  let selected: string | undefined;
  const find = (n: typeof parsed.root): void => {
    if (n.id === state.selectedDomId) selected = n.type === "text" ? `Мәтін: «${n.text}»` : `<${n.tag}> · ${n.children.length} бала${Object.keys(n.attrs).length ? ` · ${Object.entries(n.attrs).map(([k, v]) => `${k}="${v}"`).join(" ")}` : ""}`;
    n.children.forEach(find);
  };
  find(parsed.root);
  return (
    <fieldset className={styles.group}>
      <legend>HTML</legend>
      <Debounced id="html-code" label="Код" value={state.html} multiline mono rows={10} onCommit={(html) => dispatch({ type: "html/set", html })} />
      {parsed.issues.length > 0 ? (
        <ul className={web.issues}>
          {parsed.issues.map((i, k) => (
            <li key={k}>
              {i.line}-жол: {i.message}
            </li>
          ))}
        </ul>
      ) : (
        <p className={`${styles.small} ${web.goodText}`}>Қате жоқ · {parsed.count} түйін</p>
      )}
      {selected && <p className={styles.small}>Таңдалған: {selected}</p>}
      <iframe className={web.preview} sandbox="" srcDoc={state.html} title="Беттің көрінісі" />
    </fieldset>
  );
}

function DeploySection({ state, dispatch }: { state: WebLabState; dispatch: D }) {
  const mine = state.world.servers.find((s) => s.host === "mysite.kz");
  const exportFile = () => {
    const doc = `<!doctype html>\n<html lang="kk">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>Менің сайтым</title>\n</head>\n<body>\n${state.html}\n</body>\n</html>\n`;
    const url = URL.createObjectURL(new Blob([doc], { type: "text/html" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "index.html";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    dispatch({ type: "site/export" });
  };
  return (
    <fieldset className={styles.group}>
      <legend>Deploy</legend>
      {mine && (
        <p className={styles.small}>
          Сервер: {mine.host} ({mine.ip}) · deploy саны: {state.stats.deploys}
        </p>
      )}
      <div className={styles.row}>
        <button type="button" className="btn btn-primary" disabled={!mine} onClick={() => mine && dispatch({ type: "site/deploy", ip: mine.ip })}>
          Deploy
        </button>
        <button type="button" className="btn" onClick={exportFile}>
          index.html жүктеу
        </button>
      </div>
    </fieldset>
  );
}

// ---------------- css ----------------

function BoxSection({ state, dispatch }: { state: WebLabState; dispatch: D }) {
  const b = state.box;
  const sz = boxSizes(b);
  const set = (patch: Partial<typeof b>) => dispatch({ type: "box/set", patch });
  const preview = `<!doctype html><style>body{margin:12px;font:13px system-ui;background:#f4f6f9}.wrap{display:inline-block;background:#fdeed6}${boxCss(b).replace(/\n/g, "")}.box{background:#7fd3a8;border-color:#18203a}.inner{background:#2f5bea;color:#fff;height:40px}</style><div class="wrap"><div class="box"><div class="inner">content</div></div></div>`;
  return (
    <fieldset className={styles.group}>
      <legend>Box model</legend>
      <div className={styles.row}>
        <Toggle on={b.boxSizing === "content-box"} onClick={() => set({ boxSizing: "content-box" })}>
          content-box
        </Toggle>
        <Toggle on={b.boxSizing === "border-box"} onClick={() => set({ boxSizing: "border-box" })}>
          border-box
        </Toggle>
      </div>
      <Range id="box-w" label="width" value={b.width} min={0} max={600} step={2} fmt={(v) => `${v}px`} onChange={(v) => set({ width: v })} />
      <Range id="box-p" label="padding" value={b.padding} min={0} max={100} step={1} fmt={(v) => `${v}px`} onChange={(v) => set({ padding: v })} />
      <Range id="box-b" label="border" value={b.border} min={0} max={40} step={1} fmt={(v) => `${v}px`} onChange={(v) => set({ border: v })} />
      <Range id="box-m" label="margin" value={b.margin} min={0} max={100} step={1} fmt={(v) => `${v}px`} onChange={(v) => set({ margin: v })} />
      <p className={styles.formula}>
        Мазмұн {Math.round(sz.content)} · жиекке дейін {sz.borderBox} · толық {sz.total} px
      </p>
      <pre className={web.pre}>{boxCss(b)}</pre>
      <iframe className={web.previewSmall} sandbox="" srcDoc={preview} title="Box model көрінісі" />
    </fieldset>
  );
}

function FlexSection({ state, dispatch }: { state: WebLabState; dispatch: D }) {
  const f = state.flex;
  const set = (patch: Partial<FlexModel>) => dispatch({ type: "flex/set", patch });
  const pick = <K extends keyof FlexModel>(key: K, values: FlexModel[K][]) => (
    <div className={styles.row} role="group" aria-label={key}>
      <span className={styles.small}>{key}:</span>
      {values.map((v) => (
        <Toggle key={String(v)} on={f[key] === v} onClick={() => set({ [key]: v } as Partial<FlexModel>)}>
          {String(v)}
        </Toggle>
      ))}
    </div>
  );
  return (
    <fieldset className={styles.group}>
      <legend>Flexbox</legend>
      {pick("direction", ["row", "column"])}
      {pick("justify", ["flex-start", "center", "flex-end", "space-between", "space-around"])}
      {pick("align", ["stretch", "flex-start", "center", "flex-end"])}
      <div className={styles.row}>
        <Toggle on={f.wrap} onClick={() => set({ wrap: !f.wrap })}>
          flex-wrap: wrap
        </Toggle>
      </div>
      <Range id="flex-w" label="Контейнер ені" value={f.containerWidth} min={160} max={720} step={10} fmt={(v) => `${v}px`} onChange={(v) => set({ containerWidth: v })} />
      <Range id="flex-gap" label="gap" value={f.gap} min={0} max={48} step={2} fmt={(v) => `${v}px`} onChange={(v) => set({ gap: v })} />
      <Range id="flex-n" label="Элементтер саны" value={f.items} min={1} max={8} step={1} onChange={(v) => set({ items: v })} />
      <pre className={web.pre}>{flexCss(f)}</pre>
      <div className={web.previewScroll}>
        <iframe className={web.previewFlex} style={{ width: f.containerWidth + 40 }} sandbox="" srcDoc={flexPreviewHtml(f)} title="Flexbox көрінісі" />
      </div>
    </fieldset>
  );
}

// ---------------- event loop ----------------

function LoopSection({ state, dispatch }: { state: WebLabState; dispatch: D }) {
  const program = PROGRAMS.find((p) => p.id === state.loop.programId) ?? PROGRAMS[0]!;
  const frames = runEventLoop(program);
  const frame = frames[Math.min(state.loop.frame, frames.length - 1)]!;
  const expected = finalOutput(program);
  const options = [...new Set(expected)].sort();
  const pred = state.loop.prediction;
  const complete = pred.length === expected.length;
  const right = complete && pred.every((x, i) => x === expected[i]);
  return (
    <fieldset className={styles.group}>
      <legend>Event loop</legend>
      <div className={styles.row}>
        {PROGRAMS.map((p) => (
          <Toggle key={p.id} on={p.id === program.id} onClick={() => dispatch({ type: "loop/select", programId: p.id })}>
            {p.title}
          </Toggle>
        ))}
      </div>
      <pre className={web.pre}>{program.source}</pre>
      <p className={styles.small} aria-live="polite">
        {state.loop.frame + 1} / {frames.length}: {frame.note}
      </p>
      <div className={styles.row}>
        <button type="button" className="btn btn-primary" disabled={state.loop.frame >= frames.length - 1} onClick={() => dispatch({ type: "loop/step" })}>
          Келесі қадам
        </button>
        <button type="button" className="btn" onClick={() => dispatch({ type: "loop/reset" })}>
          Басынан
        </button>
      </div>
      <p className={styles.small}>Консольге қандай ретпен шығады? Басу арқылы ретті құрастыр:</p>
      <div className={styles.row}>
        {options.map((o) => (
          <button key={o} type="button" className="btn" disabled={complete || pred.filter((x) => x === o).length >= expected.filter((x) => x === o).length} onClick={() => dispatch({ type: "loop/predict", token: o })}>
            {o}
          </button>
        ))}
      </div>
      <p className={styles.formula}>Сенің болжамың: {pred.join(" → ") || "—"}</p>
      {complete && <p className={right ? web.goodText : web.err}>{right ? "Дұрыс!" : `Қате. Дұрыс рет: ${expected.join(" → ")}. Қадамдап орындап көр.`}</p>}
      {pred.length > 0 && (
        <button type="button" className="btn" onClick={() => dispatch({ type: "loop/clearPrediction" })}>
          Болжамды тазалау
        </button>
      )}
    </fieldset>
  );
}

// ---------------- sql ----------------

const SAMPLES = ["SELECT * FROM users", "SELECT name, city FROM users WHERE city = 'Алматы'", "SELECT * FROM orders WHERE user_id = 7", "CREATE INDEX ON orders (user_id)"];

function SqlSection({ state, dispatch }: { state: WebLabState; dispatch: D }) {
  const last = state.sql.last;
  return (
    <fieldset className={styles.group}>
      <legend>SQL консолі</legend>
      <Debounced id="sql-text" label="Сұрау" value={state.sql.text} multiline mono rows={3} onCommit={(text) => dispatch({ type: "sql/set", text })} />
      <div className={styles.row}>
        <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "sql/run" })}>
          Орындау
        </button>
      </div>
      <div className={styles.row}>
        {SAMPLES.map((q) => (
          <button key={q} type="button" className={`btn ${web.sample}`} onClick={() => dispatch({ type: "sql/set", text: q })}>
            {q}
          </button>
        ))}
      </div>
      {last &&
        (last.ok ? (
          <>
            <p className={styles.small}>
              {last.kind === "select" ? `${last.rows.length} жол` : last.kind === "index" ? "Индекс жасалды" : `${last.affected} жол өзгерді`} · {last.scanned} жол қаралды{last.usedIndex ? ` · индекс: ${last.usedIndex}` : " · толық сканерлеу"}
            </p>
            {last.kind === "select" && last.rows.length > 0 && (
              <div className={lang.heatWrap}>
                <table className={web.table}>
                  <thead>
                    <tr>
                      {last.columns.map((c) => (
                        <th key={c}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {last.rows.slice(0, 15).map((r, i) => (
                      <tr key={i}>
                        {last.columns.map((c) => (
                          <td key={c}>{String(r[c] ?? "NULL")}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {last.rows.length > 15 && <p className={styles.small}>… тағы {last.rows.length - 15} жол</p>}
              </div>
            )}
          </>
        ) : (
          <p className={web.err}>{last.error}</p>
        ))}
      <p className={styles.small}>
        Кестелер: {Object.values(state.world.db).map((t) => `${t.name}(${t.columns.join(", ")}) — ${t.rows.length} жол`).join("; ")}
      </p>
    </fieldset>
  );
}

export function WebControlPanel({ state, sections, focus, dispatch, canUndo, onUndo }: Props) {
  const has = (s: WebSection) => sections.includes(s);
  // CSS lesson shows the section matching the current step's 3D focus first.
  const cssFirst = focus === "flex" ? ["flex", "box"] : ["box", "flex"];
  return (
    <aside className={styles.controls} aria-label="Басқару панелі">
      {has("html") && <HtmlSection state={state} dispatch={dispatch} />}
      {has("deploy") && <DeploySection state={state} dispatch={dispatch} />}
      {cssFirst.map((k) => (k === "box" ? has("box") && <BoxSection key="box" state={state} dispatch={dispatch} /> : has("flex") && <FlexSection key="flex" state={state} dispatch={dispatch} />))}
      {has("loop") && <LoopSection state={state} dispatch={dispatch} />}
      {has("sql") && <SqlSection state={state} dispatch={dispatch} />}
      {has("request") && <RequestSection state={state} dispatch={dispatch} />}
      {has("dns") && <DnsSection state={state} dispatch={dispatch} />}
      {has("routes") && <RoutesSection state={state} dispatch={dispatch} />}
      {has("server") && <ServerSection state={state} dispatch={dispatch} />}
      {has("cache") && <CacheSection state={state} dispatch={dispatch} />}
      <div className={styles.row}>
        <button type="button" className="btn" disabled={!canUndo} onClick={onUndo}>
          Соңғы әрекетті болдырмау
        </button>
      </div>
    </aside>
  );
}
