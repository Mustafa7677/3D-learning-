import { bindParams, execute, type Db, type QueryResult } from "./sql";

/**
 * The network world for the Web lab: a browser, a DNS resolver, web servers
 * and a database. Sending a request resolves it into timed stages: the same
 * ones a real browser goes through: which the simulation then plays back.
 */
export type NodeId = "browser" | "dns" | "server" | "db";
export type Method = "GET" | "POST" | "PUT" | "DELETE";

export interface Route {
  id: number;
  method: Method;
  /** Path pattern; `:name` segments are parameters, e.g. /api/users/:id */
  path: string;
  kind: "html" | "json" | "sql" | "crash";
  /** html / json body, or SQL text for kind = "sql" (may use :params and :body_* fields). */
  body: string;
  requiresAuth: boolean;
}

export interface Server {
  host: string;
  ip: string;
  up: boolean;
  https: boolean;
  /** One-way network latency between browser and server, ms. */
  latency: number;
  /** Cache-Control max-age for successful GET responses, seconds of simulated time. */
  maxAge: number;
  routes: Route[];
  /** Valid bearer token for routes that require auth. */
  token: string;
}

export interface DnsRecord {
  name: string;
  ip: string;
}

export interface RequestSpec {
  method: Method;
  url: string;
  token?: string;
  /** Form-like body for POST/PUT: key=value pairs. */
  body?: Record<string, string>;
}

export interface Stage {
  kind: "url" | "cache" | "dns" | "tcp" | "tls" | "http" | "route" | "db" | "response" | "render" | "error";
  from: NodeId;
  to: NodeId;
  start: number;
  dur: number;
  title: string;
  detail: string;
  ok: boolean;
}

export interface Response {
  status: number;
  body: string;
  contentType: "html" | "json" | "text";
  fromCache: boolean;
  ms: number;
  error?: string;
}

export interface CacheEntry {
  url: string;
  body: string;
  status: number;
  contentType: Response["contentType"];
  expiresAt: number;
  version: number;
}

export interface World {
  dns: DnsRecord[];
  servers: Server[];
  db: Db;
  /** Browser HTTP cache. */
  cache: CacheEntry[];
  /** Browser DNS cache: host → ip. */
  dnsCache: Record<string, string>;
  /** Simulated wall clock, ms. */
  clock: number;
  /** Incremented on every deploy so stale cache entries are detectable. */
  deployVersion: number;
}

export interface Resolution {
  stages: Stage[];
  response: Response;
  /** World after the request (cache, dnsCache, db updated). */
  world: World;
  query?: QueryResult;
}

export const STATUS_TEXT: Record<number, string> = {
  200: "OK",
  201: "Created",
  304: "Not Modified",
  400: "Bad Request",
  401: "Unauthorized",
  404: "Not Found",
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
};

interface ParsedUrl {
  protocol: "http" | "https";
  host: string;
  path: string;
}

export function parseUrl(url: string): ParsedUrl | undefined {
  const m = /^(https?):\/\/([a-z0-9.-]+)(\/[^\s?#]*)?$/i.exec(url.trim());
  if (!m) return undefined;
  return { protocol: m[1]!.toLowerCase() as "http" | "https", host: m[2]!.toLowerCase(), path: m[3] || "/" };
}

export function matchRoute(routes: Route[], method: Method, path: string): { route: Route; params: Record<string, string> } | undefined {
  const parts = path.split("/").filter(Boolean);
  for (const r of routes) {
    if (r.method !== method) continue;
    const rp = r.path.split("/").filter(Boolean);
    if (rp.length !== parts.length) continue;
    const params: Record<string, string> = {};
    let ok = true;
    for (let i = 0; i < rp.length; i++) {
      const seg = rp[i]!;
      if (seg.startsWith(":")) params[seg.slice(1)] = decodeURIComponent(parts[i]!);
      else if (seg !== parts[i]) ok = false;
    }
    if (ok) return { route: r, params };
  }
  return undefined;
}

/** Work out everything a request does, with timings. Pure: returns a new world. */
export function resolveRequest(world: World, req: RequestSpec): Resolution {
  const stages: Stage[] = [];
  let t = 0;
  const add = (s: Omit<Stage, "start">) => {
    stages.push({ ...s, start: t });
    t += s.dur;
  };
  const finish = (status: number, body: string, contentType: Response["contentType"], w: World, extra: Partial<Response> = {}, query?: QueryResult): Resolution => ({
    stages,
    response: { status, body, contentType, fromCache: false, ms: t, ...extra },
    world: w,
    query,
  });

  const url = parseUrl(req.url);
  add({ kind: "url", from: "browser", to: "browser", dur: 2, title: "URL талдау", detail: url ? `${url.protocol}://${url.host} + ${url.path}` : "URL дұрыс емес", ok: !!url });
  if (!url) return finish(0, "", "text", world, { error: "URL дұрыс емес. Мысал: https://inside.kz/" });

  // Browser cache (GET only)
  if (req.method === "GET") {
    const hit = world.cache.find((c) => c.url === req.url && c.expiresAt > world.clock);
    if (hit) {
      add({ kind: "cache", from: "browser", to: "browser", dur: 1, title: "Браузер кэші", detail: `Кэште бар (тағы ${Math.round((hit.expiresAt - world.clock) / 1000)} с жарамды): серверге бармаймыз`, ok: true });
      add({ kind: "render", from: "browser", to: "browser", dur: 8, title: "Көрсету", detail: "Кэштегі нұсқа көрсетілді", ok: true });
      return { stages, response: { status: hit.status, body: hit.body, contentType: hit.contentType, fromCache: true, ms: t }, world };
    }
  }

  // DNS
  let ip = world.dnsCache[url.host];
  let w = world;
  if (ip) {
    add({ kind: "dns", from: "browser", to: "browser", dur: 1, title: "DNS (кэш)", detail: `${url.host} → ${ip} (браузер есінде)`, ok: true });
  } else {
    const rec = world.dns.find((r) => r.name === url.host);
    if (!rec) {
      add({ kind: "dns", from: "browser", to: "dns", dur: 24, title: "DNS сұрауы", detail: `${url.host}: мұндай домен жоқ (NXDOMAIN)`, ok: false });
      add({ kind: "error", from: "dns", to: "browser", dur: 24, title: "DNS қатесі", detail: "Браузер серверді таба алмады", ok: false });
      return finish(0, "", "text", world, { error: `DNS_PROBE_FINISHED_NXDOMAIN: «${url.host}» табылмады` });
    }
    ip = rec.ip;
    add({ kind: "dns", from: "browser", to: "dns", dur: 24, title: "DNS сұрауы", detail: `${url.host} қай IP-де?`, ok: true });
    add({ kind: "dns", from: "dns", to: "browser", dur: 24, title: "DNS жауабы", detail: `${url.host} → ${ip}`, ok: true });
    w = { ...w, dnsCache: { ...w.dnsCache, [url.host]: ip } };
  }

  const server = world.servers.find((s) => s.ip === ip);
  const lat = server?.latency ?? 40;
  if (!server || !server.up) {
    add({ kind: "tcp", from: "browser", to: "server", dur: lat, title: "TCP: SYN", detail: `${ip}:${url.protocol === "https" ? 443 : 80} адресіне қосылу`, ok: true });
    add({ kind: "error", from: "browser", to: "browser", dur: 3000, title: "Жауап жоқ", detail: "Сервер өшірулі немесе бұл IP-де сервер жоқ", ok: false });
    return finish(0, "", "text", w, { error: "ERR_CONNECTION_TIMED_OUT: сервер жауап бермеді" });
  }

  // TCP three-way handshake
  add({ kind: "tcp", from: "browser", to: "server", dur: lat, title: "TCP: SYN", detail: "«Сөйлесейік?»", ok: true });
  add({ kind: "tcp", from: "server", to: "browser", dur: lat, title: "TCP: SYN-ACK", detail: "«Жарайды, дайынмын»", ok: true });
  add({ kind: "tcp", from: "browser", to: "server", dur: lat, title: "TCP: ACK", detail: "Байланыс орнады", ok: true });

  if (url.protocol === "https") {
    if (!server.https) {
      add({ kind: "error", from: "server", to: "browser", dur: lat, title: "TLS қатесі", detail: "Серверде HTTPS сертификаты жоқ", ok: false });
      return finish(0, "", "text", w, { error: "ERR_SSL_PROTOCOL_ERROR: серверде HTTPS қосылмаған" });
    }
    add({ kind: "tls", from: "browser", to: "server", dur: lat, title: "TLS: ClientHello", detail: "Шифрлау әдістері ұсынылды", ok: true });
    add({ kind: "tls", from: "server", to: "browser", dur: lat, title: "TLS: сертификат", detail: `${url.host} сертификаты тексерілді, кілттер келісілді`, ok: true });
  }

  const bodyText = req.body ? Object.entries(req.body).map(([k, v]) => `${k}=${v}`).join("&") : "";
  add({
    kind: "http",
    from: "browser",
    to: "server",
    dur: lat,
    title: `HTTP ${req.method}`,
    detail: `${req.method} ${url.path}${req.token ? " + Authorization" : ""}${bodyText ? ` (${bodyText})` : ""}`,
    ok: true,
  });

  const respond = (status: number, body: string, contentType: Response["contentType"], detail: string, query?: QueryResult): Resolution => {
    add({ kind: "response", from: "server", to: "browser", dur: lat, title: `${status} ${STATUS_TEXT[status] ?? ""}`.trim(), detail, ok: status < 400 });
    if (status === 200 && contentType === "html") add({ kind: "render", from: "browser", to: "browser", dur: 16, title: "Көрсету", detail: "HTML → DOM → бет", ok: true });
    let next = w;
    if (req.method === "GET" && status === 200 && server.maxAge > 0) {
      const entry: CacheEntry = { url: req.url, body, status, contentType, expiresAt: world.clock + t + server.maxAge * 1000, version: world.deployVersion };
      next = { ...next, cache: [...next.cache.filter((c) => c.url !== req.url), entry] };
    }
    return finish(status, body, contentType, next, {}, query);
  };

  const match = matchRoute(server.routes, req.method, url.path);
  if (!match) {
    add({ kind: "route", from: "server", to: "server", dur: 2, title: "Маршрут", detail: `${req.method} ${url.path}: мұндай маршрут жоқ`, ok: false });
    return respond(404, "Not Found", "text", "Бет табылмады");
  }
  const { route, params } = match;
  add({ kind: "route", from: "server", to: "server", dur: 2, title: "Маршрут", detail: `${route.method} ${route.path} табылды${Object.keys(params).length ? ` (${Object.entries(params).map(([k, v]) => `${k}=${v}`).join(", ")})` : ""}`, ok: true });

  if (route.requiresAuth && req.token !== server.token) {
    return respond(401, '{"error":"unauthorized"}', "json", req.token ? "Token дұрыс емес" : "Authorization жоқ");
  }
  if (route.kind === "crash") {
    add({ kind: "route", from: "server", to: "server", dur: 3, title: "Код қатесі", detail: "TypeError: Cannot read properties of undefined", ok: false });
    return respond(500, "Internal Server Error", "text", "Сервер кодында қате");
  }
  if (route.kind === "html") return respond(200, route.body, "html", `HTML (${route.body.length} байт)`);
  if (route.kind === "json") return respond(200, route.body, "json", "JSON жауап");

  // SQL route: bind URL params and body fields, run against the database.
  const bodyParams = Object.fromEntries(Object.entries(req.body ?? {}).map(([k, v]) => [`body_${k}`, v]));
  const sql = bindParams(route.body, { ...params, ...bodyParams });
  const { db, result } = execute(w.db, sql);
  const dbMs = 2 + result.scanned * 0.6;
  add({ kind: "db", from: "server", to: "db", dur: 4, title: "SQL сұрау", detail: sql, ok: true });
  add({
    kind: "db",
    from: "db",
    to: "server",
    dur: dbMs,
    title: result.ok ? "Дерекқор жауабы" : "SQL қатесі",
    detail: result.ok ? `${result.scanned} жол қаралды${result.usedIndex ? ` (индекс: ${result.usedIndex})` : " (толық сканерлеу)"}` : result.error ?? "",
    ok: result.ok,
  });
  w = { ...w, db };
  if (!result.ok) return respond(500, JSON.stringify({ error: result.error }), "json", "SQL қатесі", result);
  const body = result.kind === "select" ? JSON.stringify(result.rows) : JSON.stringify({ affected: result.affected });
  return respond(result.kind === "insert" ? 201 : 200, body, "json", result.kind === "select" ? `${result.rows.length} жазба` : `${result.affected} жол өзгерді`, result);
}

export function totalDuration(stages: Stage[]): number {
  const last = stages[stages.length - 1];
  return last ? last.start + last.dur : 0;
}

/** Stage active at simulated time `t` (ms since send), and progress 0..1 within it. */
export function stageAt(stages: Stage[], t: number): { index: number; progress: number } {
  for (let i = 0; i < stages.length; i++) {
    const s = stages[i]!;
    if (t < s.start + s.dur) return { index: i, progress: Math.max(0, (t - s.start) / Math.max(1, s.dur)) };
  }
  return { index: stages.length - 1, progress: 1 };
}
