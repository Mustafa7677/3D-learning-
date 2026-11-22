import type { AssessmentResult, SimulationPlugin } from "@inside-tech/sim-core";
import { PROGRAMS, finalOutput, runEventLoop } from "./eventloop";
import { parseHtml } from "./html";
import { parseUrl, resolveRequest, type Method, type RequestSpec, type Response, type Route, type Server, type Stage, type World } from "./net";
import { STARTER_HTML, scenario, type ScenarioId } from "./scenarios";
import { execute, type QueryResult } from "./sql";

/** Pages that can send scripted requests in the lab. */
export const ORIGINS = ["https://inside.kz", "https://shop.kz", "https://evil.kz"];

export interface BoxModel {
  width: number;
  padding: number;
  border: number;
  margin: number;
  boxSizing: "content-box" | "border-box";
}

export interface FlexModel {
  direction: "row" | "column";
  justify: "flex-start" | "center" | "flex-end" | "space-between" | "space-around";
  align: "stretch" | "flex-start" | "center" | "flex-end";
  wrap: boolean;
  gap: number;
  containerWidth: number;
  items: number;
}

export interface Trace {
  id: number;
  spec: RequestSpec;
  stages: Stage[];
  /** Display timeline (long stages compressed so playback stays watchable). */
  display: { start: number; dur: number }[];
  displayTotal: number;
  /** Display-ms elapsed. */
  t: number;
  done: boolean;
  response: Response;
  query?: QueryResult;
  /** World to commit when playback finishes. */
  nextWorld: World;
}

export interface HistoryItem {
  id: number;
  method: Method;
  url: string;
  host: string;
  path: string;
  status: number;
  ms: number;
  fromCache: boolean;
  error?: string;
  body: string;
  /** Deploy version of the content served (for cache lessons). */
  stale: boolean;
}

export interface WebStats {
  requests: number;
  statuses: Record<number, number>;
  stageKinds: string[];
  httpsRequests: number;
  httpRequests: number;
  cacheHits: number;
  dnsCacheHits: number;
  domSelected: number;
  htmlEdits: number;
  loopCompleted: string[];
  predictedCorrect: string[];
  predictionsWrong: number;
  sqlKinds: string[];
  sqlWhere: boolean;
  sqlErrors: number;
  /** Tables on which a full scan and later an index lookup were both seen. */
  fullScan: string[];
  indexScan: string[];
  deploys: number;
  exports: number;
  staleSeen: boolean;
  freshAfterStale: boolean;
  latencyChanged: boolean;
  /** Finished requests by "METHOD status", e.g. "PUT 200": what idempotency is about. */
  calls: Record<string, number>;
  /** Requests sent by a page's script: from which origin, and what the browser let it read. */
  corsRuns?: { origin: string; method: string; status: number; blocked: boolean; preflight: boolean }[];
}

export interface WebLabState {
  scenario: ScenarioId;
  world: World;
  request: RequestSpec;
  trace: Trace | null;
  nextTraceId: number;
  history: HistoryItem[];
  /** Playback speed: display-ms per real second. */
  speed: number;
  html: string;
  selectedDomId: number | null;
  box: BoxModel;
  flex: FlexModel;
  loop: { programId: string; frame: number; prediction: string[] };
  sql: { text: string; last: QueryResult | null; lastTable: string | null };
  stats: WebStats;
}

export type WebLabAction =
  | { type: "scenario/load"; id: ScenarioId }
  | { type: "req/set"; params: Partial<RequestSpec> }
  | { type: "req/send" }
  | { type: "req/skip" }
  | { type: "speed/set"; speed: number }
  | { type: "dns/set"; name: string; ip: string }
  | { type: "dns/remove"; name: string }
  | { type: "server/set"; ip: string; patch: Partial<Pick<Server, "up" | "https" | "latency" | "maxAge" | "etag" | "corsOrigins">> }
  | { type: "route/add"; ip: string; route: Omit<Route, "id"> }
  | { type: "route/update"; ip: string; id: number; patch: Partial<Omit<Route, "id">> }
  | { type: "route/remove"; ip: string; id: number }
  | { type: "cache/clear" }
  | { type: "dnsCache/clear" }
  | { type: "clock/advance"; ms: number }
  | { type: "html/set"; html: string }
  | { type: "dom/select"; id: number | null }
  | { type: "site/deploy"; ip: string }
  | { type: "site/export" }
  | { type: "box/set"; patch: Partial<BoxModel> }
  | { type: "flex/set"; patch: Partial<FlexModel> }
  | { type: "loop/select"; programId: string }
  | { type: "loop/step" }
  | { type: "loop/reset" }
  | { type: "loop/predict"; token: string }
  | { type: "loop/clearPrediction" }
  | { type: "sql/set"; text: string }
  | { type: "sql/run" };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo));
const uniq = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs : [...xs, x]);
const MAX_HTML = 4000;
const MAX_ROUTES = 20;

const emptyStats = (): WebStats => ({
  requests: 0,
  statuses: {},
  stageKinds: [],
  httpsRequests: 0,
  httpRequests: 0,
  cacheHits: 0,
  dnsCacheHits: 0,
  domSelected: 0,
  htmlEdits: 0,
  loopCompleted: [],
  predictedCorrect: [],
  predictionsWrong: 0,
  sqlKinds: [],
  sqlWhere: false,
  sqlErrors: 0,
  fullScan: [],
  indexScan: [],
  deploys: 0,
  exports: 0,
  staleSeen: false,
  freshAfterStale: false,
  latencyChanged: false,
  calls: {},
  corsRuns: [],
});

export function initialWebState(_seed: number): WebLabState {
  return {
    scenario: "internet",
    world: scenario("internet"),
    request: { method: "GET", url: "https://inside.kz/" },
    trace: null,
    nextTraceId: 1,
    history: [],
    speed: 400,
    html: STARTER_HTML,
    selectedDomId: null,
    box: { width: 200, padding: 20, border: 4, margin: 16, boxSizing: "content-box" },
    flex: { direction: "row", justify: "flex-start", align: "stretch", wrap: false, gap: 8, containerWidth: 560, items: 4 },
    loop: { programId: PROGRAMS[0]!.id, frame: 0, prediction: [] },
    sql: { text: "SELECT * FROM users", last: null, lastTable: null },
    stats: emptyStats(),
  };
}

/** Compress long stages so playback stays watchable (a 3 s timeout shows as 0.6 s). */
export function displayTimeline(stages: Stage[]): { display: { start: number; dur: number }[]; total: number } {
  let t = 0;
  const display = stages.map((s) => {
    const dur = clamp(s.dur, 30, 600);
    const d = { start: t, dur };
    t += dur;
    return d;
  });
  return { display, total: t };
}

/** Rendered content width of the box model, as the browser computes it. */
export function boxSizes(b: BoxModel) {
  const content = b.boxSizing === "content-box" ? b.width : Math.max(0, b.width - 2 * b.padding - 2 * b.border);
  const borderBox = content + 2 * b.padding + 2 * b.border;
  return { content, borderBox, total: borderBox + 2 * b.margin };
}

export function boxCss(b: BoxModel): string {
  return `.box {\n  box-sizing: ${b.boxSizing};\n  width: ${b.width}px;\n  padding: ${b.padding}px;\n  border: ${b.border}px solid;\n  margin: ${b.margin}px;\n}`;
}

export function flexCss(f: FlexModel): string {
  return `.container {\n  display: flex;\n  flex-direction: ${f.direction};\n  justify-content: ${f.justify};\n  align-items: ${f.align};\n  flex-wrap: ${f.wrap ? "wrap" : "nowrap"};\n  gap: ${f.gap}px;\n  width: ${f.containerWidth}px;\n}\n.item {\n  width: 120px;\n}`;
}

function finishTrace(s: WebLabState): WebLabState {
  const tr = s.trace;
  if (!tr || tr.done) return s;
  const url = parseUrl(tr.spec.url);
  const res = tr.response;
  // Commit only what the request itself changed (caches, and the database for writes).
  // Everything else comes from the current world, so edits made during playback survive.
  const wrote = !!tr.query?.ok && tr.query.kind !== "select";
  const world: World = {
    ...s.world,
    cache: tr.nextWorld.cache,
    dnsCache: { ...s.world.dnsCache, ...tr.nextWorld.dnsCache },
    db: wrote ? tr.nextWorld.db : s.world.db,
    clock: s.world.clock + res.ms,
  };
  const serving = world.servers.find((sv) => sv.host === url?.host);
  const deployedRoute = serving?.routes.find((r) => r.method === "GET" && r.path === (url?.path ?? "/"));
  const stale = res.fromCache && !!deployedRoute && deployedRoute.body !== res.body;
  const item: HistoryItem = {
    id: tr.id,
    method: tr.spec.method,
    url: tr.spec.url,
    host: url?.host ?? "",
    path: url?.path ?? "",
    status: res.status,
    ms: Math.round(res.ms),
    fromCache: res.fromCache,
    error: res.error,
    body: res.body.slice(0, 2000),
    stale,
  };
  const st = { ...s.stats };
  st.requests++;
  st.statuses = { ...st.statuses, [res.status]: (st.statuses[res.status] ?? 0) + 1 };
  const call = `${tr.spec.method} ${res.status}`;
  st.calls = { ...(st.calls ?? {}), [call]: ((st.calls ?? {})[call] ?? 0) + 1 };
  st.stageKinds = [...new Set([...st.stageKinds, ...tr.stages.filter((x) => x.ok).map((x) => x.kind)])];
  if (url?.protocol === "https" && !res.fromCache && res.status > 0) st.httpsRequests++;
  if (url?.protocol === "http" && !res.fromCache && res.status > 0) st.httpRequests++;
  if (tr.spec.origin) st.corsRuns = [...(st.corsRuns ?? []), { origin: tr.spec.origin, method: tr.spec.method, status: res.status, blocked: !!res.corsBlocked, preflight: !!res.preflight }].slice(-40);
  if (res.fromCache) st.cacheHits++;
  if (tr.stages.some((x) => x.title === "DNS (кэш)")) st.dnsCacheHits++;
  if (stale) st.staleSeen = true;
  if (st.staleSeen && !res.fromCache && res.status === 200 && deployedRoute && res.body === deployedRoute.body && s.stats.staleSeen) st.freshAfterStale = true;
  if (tr.query?.ok && tr.query.kind === "select") {
    const table = /FROM\s+(\w+)/i.exec(tr.stages.find((x) => x.kind === "db")?.detail ?? "")?.[1]?.toLowerCase();
    if (table) {
      if (tr.query.usedIndex && tr.query.usedIndex !== "id") st.indexScan = uniq(st.indexScan, table);
      else if (!tr.query.usedIndex) st.fullScan = uniq(st.fullScan, table);
    }
  }
  return {
    ...s,
    world,
    trace: { ...tr, t: tr.displayTotal, done: true },
    history: [item, ...s.history].slice(0, 30),
    stats: st,
  };
}

function patchServer(s: WebLabState, ip: string, fn: (sv: Server) => Server): WebLabState {
  if (!s.world.servers.some((sv) => sv.ip === ip)) return s;
  return { ...s, world: { ...s.world, servers: s.world.servers.map((sv) => (sv.ip === ip ? fn(sv) : sv)) } };
}

function sanitizeRoute(r: Partial<Omit<Route, "id">>): Partial<Omit<Route, "id">> {
  const out: Partial<Omit<Route, "id">> = {};
  if (r.method && ["GET", "POST", "PUT", "DELETE"].includes(r.method)) out.method = r.method;
  if (typeof r.path === "string") out.path = ("/" + r.path.trim().replace(/^\/+/, "")).slice(0, 80);
  if (r.kind && ["html", "json", "sql", "crash"].includes(r.kind)) out.kind = r.kind;
  if (typeof r.body === "string") out.body = r.body.slice(0, MAX_HTML);
  if (typeof r.requiresAuth === "boolean") out.requiresAuth = r.requiresAuth;
  if (typeof r.adminOnly === "boolean") out.adminOnly = r.adminOnly;
  return out;
}

function runSql(s: WebLabState): WebLabState {
  const { db, result } = execute(s.world.db, s.sql.text);
  const st = { ...s.stats };
  const table = /(?:FROM|INTO|UPDATE|ON)\s+(\w+)/i.exec(s.sql.text)?.[1]?.toLowerCase() ?? null;
  if (result.ok && result.kind) {
    st.sqlKinds = uniq(st.sqlKinds, result.kind);
    if (result.kind === "select" && /\bWHERE\b/i.test(s.sql.text)) st.sqlWhere = true;
    if (result.kind === "select" && table) {
      if (result.usedIndex && result.usedIndex !== "id") st.indexScan = uniq(st.indexScan, table);
      else if (!result.usedIndex) st.fullScan = uniq(st.fullScan, table);
    }
  } else st.sqlErrors++;
  return { ...s, world: { ...s.world, db }, sql: { ...s.sql, last: result, lastTable: table }, stats: st };
}

function reduce(s: WebLabState, a: WebLabAction): WebLabState {
  switch (a.type) {
    case "scenario/load":
      return { ...s, scenario: a.id, world: scenario(a.id), trace: null, history: [] };

    case "req/set": {
      const r = { ...s.request };
      if (a.params.method && ["GET", "POST", "PUT", "DELETE"].includes(a.params.method)) r.method = a.params.method;
      if (typeof a.params.url === "string") r.url = a.params.url.slice(0, 200);
      if (a.params.token !== undefined) r.token = a.params.token.slice(0, 100) || undefined;
      if (a.params.origin !== undefined) r.origin = ORIGINS.includes(a.params.origin) ? a.params.origin : undefined;
      if (a.params.body !== undefined) r.body = Object.fromEntries(Object.entries(a.params.body).slice(0, 8).map(([k, v]) => [k.slice(0, 30), String(v).slice(0, 100)]));
      return { ...s, request: r };
    }

    case "req/send": {
      const base = s.trace && !s.trace.done ? finishTrace(s) : s;
      const res = resolveRequest(base.world, base.request);
      const { display, total } = displayTimeline(res.stages);
      return {
        ...base,
        nextTraceId: base.nextTraceId + 1,
        trace: { id: base.nextTraceId, spec: { ...base.request }, stages: res.stages, display, displayTotal: total, t: 0, done: false, response: res.response, query: res.query, nextWorld: res.world },
      };
    }

    case "req/skip":
      return finishTrace(s);

    case "speed/set":
      return { ...s, speed: clamp(a.speed, 50, 4000) };

    case "dns/set": {
      const name = a.name.trim().toLowerCase().slice(0, 60);
      const ip = a.ip.trim().slice(0, 20);
      if (!/^[a-z0-9.-]+$/.test(name) || !/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return s;
      const dns = s.world.dns.some((r) => r.name === name) ? s.world.dns.map((r) => (r.name === name ? { name, ip } : r)) : [...s.world.dns, { name, ip }];
      return { ...s, world: { ...s.world, dns } };
    }
    case "dns/remove":
      return { ...s, world: { ...s.world, dns: s.world.dns.filter((r) => r.name !== a.name) } };

    case "server/set":
      return {
        ...patchServer(s, a.ip, (sv) => ({
          ...sv,
          ...(a.patch.up !== undefined ? { up: a.patch.up } : {}),
          ...(a.patch.https !== undefined ? { https: a.patch.https } : {}),
          ...(a.patch.latency !== undefined ? { latency: clamp(a.patch.latency, 1, 1000) } : {}),
          ...(a.patch.maxAge !== undefined ? { maxAge: clamp(a.patch.maxAge, 0, 3600) } : {}),
          ...(a.patch.etag !== undefined ? { etag: !!a.patch.etag } : {}),
          ...(a.patch.corsOrigins !== undefined ? { corsOrigins: a.patch.corsOrigins.filter((o) => o === "*" || ORIGINS.includes(o)).slice(0, 5) } : {}),
        })),
        stats: { ...s.stats, latencyChanged: s.stats.latencyChanged || a.patch.latency !== undefined },
      };

    case "route/add":
      return patchServer(s, a.ip, (sv) => {
        if (sv.routes.length >= MAX_ROUTES) return sv;
        const id = Math.max(0, ...sv.routes.map((r) => r.id)) + 1;
        const r = { method: "GET" as Method, path: "/", kind: "json" as const, body: "{}", requiresAuth: false, ...sanitizeRoute(a.route) };
        return { ...sv, routes: [...sv.routes, { ...r, id }] };
      });
    case "route/update":
      return patchServer(s, a.ip, (sv) => ({ ...sv, routes: sv.routes.map((r) => (r.id === a.id ? { ...r, ...sanitizeRoute(a.patch) } : r)) }));
    case "route/remove":
      return patchServer(s, a.ip, (sv) => ({ ...sv, routes: sv.routes.filter((r) => r.id !== a.id) }));

    case "cache/clear":
      return { ...s, world: { ...s.world, cache: [] } };
    case "dnsCache/clear":
      return { ...s, world: { ...s.world, dnsCache: {} } };
    case "clock/advance":
      return { ...s, world: { ...s.world, clock: s.world.clock + clamp(a.ms, 0, 3_600_000) } };

    case "html/set": {
      const html = a.html.slice(0, MAX_HTML);
      if (html === s.html) return s;
      return { ...s, html, selectedDomId: null, stats: { ...s.stats, htmlEdits: s.stats.htmlEdits + 1 } };
    }
    case "dom/select":
      return { ...s, selectedDomId: a.id, stats: { ...s.stats, domSelected: s.stats.domSelected + (a.id !== null ? 1 : 0) } };

    case "site/deploy": {
      const next = patchServer(s, a.ip, (sv) => {
        const existing = sv.routes.find((r) => r.method === "GET" && r.path === "/");
        const routes = existing
          ? sv.routes.map((r) => (r === existing ? { ...r, kind: "html" as const, body: s.html } : r))
          : [...sv.routes, { id: Math.max(0, ...sv.routes.map((r) => r.id)) + 1, method: "GET" as Method, path: "/", kind: "html" as const, body: s.html, requiresAuth: false }];
        return { ...sv, routes };
      });
      if (next === s) return s;
      return { ...next, world: { ...next.world, deployVersion: next.world.deployVersion + 1 }, stats: { ...next.stats, deploys: next.stats.deploys + 1 } };
    }
    case "site/export":
      return { ...s, stats: { ...s.stats, exports: s.stats.exports + 1 } };

    case "box/set": {
      const b = { ...s.box };
      const p = a.patch;
      if (p.width !== undefined) b.width = Math.round(clamp(p.width, 0, 600));
      if (p.padding !== undefined) b.padding = Math.round(clamp(p.padding, 0, 100));
      if (p.border !== undefined) b.border = Math.round(clamp(p.border, 0, 40));
      if (p.margin !== undefined) b.margin = Math.round(clamp(p.margin, 0, 100));
      if (p.boxSizing) b.boxSizing = p.boxSizing === "border-box" ? "border-box" : "content-box";
      return { ...s, box: b };
    }
    case "flex/set": {
      const f = { ...s.flex };
      const p = a.patch;
      if (p.direction) f.direction = p.direction === "column" ? "column" : "row";
      if (p.justify && ["flex-start", "center", "flex-end", "space-between", "space-around"].includes(p.justify)) f.justify = p.justify;
      if (p.align && ["stretch", "flex-start", "center", "flex-end"].includes(p.align)) f.align = p.align;
      if (p.wrap !== undefined) f.wrap = !!p.wrap;
      if (p.gap !== undefined) f.gap = Math.round(clamp(p.gap, 0, 48));
      if (p.containerWidth !== undefined) f.containerWidth = Math.round(clamp(p.containerWidth, 160, 720));
      if (p.items !== undefined) f.items = Math.round(clamp(p.items, 1, 8));
      return { ...s, flex: f };
    }

    case "loop/select":
      if (!PROGRAMS.some((p) => p.id === a.programId)) return s;
      return { ...s, loop: { programId: a.programId, frame: 0, prediction: [] } };
    case "loop/step": {
      const program = PROGRAMS.find((p) => p.id === s.loop.programId)!;
      const frames = runEventLoop(program);
      const frame = Math.min(frames.length - 1, s.loop.frame + 1);
      const done = frame === frames.length - 1;
      return { ...s, loop: { ...s.loop, frame }, stats: done ? { ...s.stats, loopCompleted: uniq(s.stats.loopCompleted, program.id) } : s.stats };
    }
    case "loop/reset":
      return { ...s, loop: { ...s.loop, frame: 0 } };
    case "loop/predict": {
      const program = PROGRAMS.find((p) => p.id === s.loop.programId)!;
      const expected = finalOutput(program);
      if (s.loop.prediction.length >= expected.length || !expected.includes(a.token)) return s;
      const prediction = [...s.loop.prediction, a.token];
      let stats = s.stats;
      if (prediction.length === expected.length) {
        const right = prediction.every((x, i) => x === expected[i]);
        stats = right ? { ...stats, predictedCorrect: uniq(stats.predictedCorrect, program.id) } : { ...stats, predictionsWrong: stats.predictionsWrong + 1 };
      }
      return { ...s, loop: { ...s.loop, prediction }, stats };
    }
    case "loop/clearPrediction":
      return { ...s, loop: { ...s.loop, prediction: [] } };

    case "sql/set":
      return { ...s, sql: { ...s.sql, text: a.text.slice(0, 500) } };
    case "sql/run":
      return runSql(s);
  }
}

export function evaluateWeb(s: WebLabState): AssessmentResult {
  const dom = parseHtml(s.html);
  const last = s.history[0];
  return {
    score: 0,
    metrics: {
      requests: s.stats.requests,
      lastStatus: last?.status ?? -1,
      lastMs: last?.ms ?? 0,
      domNodes: dom.count,
      domIssues: dom.issues.length,
      boxTotal: boxSizes(s.box).total,
      boxRendered: boxSizes(s.box).borderBox,
    },
    notes: dom.issues.length ? ["html-issues"] : [],
  };
}

export const webLabPlugin: SimulationPlugin<WebLabState, WebLabAction> = {
  id: "web-lab",
  version: "1.0.0",
  initialize: initialWebState,
  dispatch: reduce,
  step(s, dt) {
    const tr = s.trace;
    if (!tr || tr.done) return s;
    const t = tr.t + dt * s.speed;
    if (t >= tr.displayTotal) return finishTrace(s);
    return { ...s, trace: { ...tr, t } };
  },
  snapshot: (s) => structuredClone(s),
  restore: (snap) => structuredClone(snap as WebLabState),
  evaluate: evaluateWeb,
};

/** Current stage index and progress for the playing trace. */
export function traceProgress(tr: Trace): { index: number; progress: number } {
  for (let i = 0; i < tr.display.length; i++) {
    const d = tr.display[i]!;
    if (tr.t < d.start + d.dur) return { index: i, progress: Math.max(0, (tr.t - d.start) / d.dur) };
  }
  return { index: tr.display.length - 1, progress: 1 };
}
