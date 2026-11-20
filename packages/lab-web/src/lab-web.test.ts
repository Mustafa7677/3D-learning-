import { describe, expect, it } from "vitest";
import { SimulationRuntime, replay } from "@inside-tech/sim-core";
import { LessonEngine } from "@inside-tech/lesson-engine";
import {
  PROGRAMS,
  baseDb,
  bindParams,
  boxSizes,
  execute,
  finalOutput,
  matchRoute,
  parseHtml,
  resolveRequest,
  runEventLoop,
  scenario,
  webLabPlugin,
  webLessons,
  type WebLabAction,
  type WebLabState,
} from "./index";

describe("SQL engine", () => {
  const db = baseDb();
  it("selects with where, order and limit", () => {
    const { result } = execute(db, "SELECT name, city FROM users WHERE id >= 3 AND id < 6 ORDER BY id DESC LIMIT 2");
    expect(result.ok).toBe(true);
    expect(result.rows.map((r) => r.name)).toEqual(["Әсел", "Ерлан"]); // ids 5, 4
    expect(result.columns).toEqual(["name", "city"]);
  });
  it("insert/update/delete return a new db and leave the input untouched", () => {
    const a = execute(db, "INSERT INTO users (name, city) VALUES ('Арман', 'Тараз')");
    expect(a.result.affected).toBe(1);
    expect(a.db.users!.rows.at(-1)).toMatchObject({ id: 9, name: "Арман" });
    expect(db.users!.rows).toHaveLength(8);
    const b = execute(a.db, "UPDATE users SET city = 'Астана', name = 'Арман2' WHERE id = 9");
    expect(b.db.users!.rows.at(-1)).toMatchObject({ city: "Астана", name: "Арман2" });
    const c = execute(b.db, "DELETE FROM users WHERE city = 'Астана'");
    expect(c.result.affected).toBe(2); // Нұрлан (id 2) and Арман2
  });
  it("an index turns a full scan into a lookup", () => {
    const before = execute(db, "SELECT * FROM orders WHERE user_id = 7").result;
    expect(before.scanned).toBe(2000);
    expect(before.usedIndex).toBeNull();
    const { db: indexed } = execute(db, "CREATE INDEX ON orders (user_id)");
    const after = execute(indexed, "SELECT * FROM orders WHERE user_id = 7").result;
    expect(after.usedIndex).toBe("user_id");
    expect(after.rows).toEqual(before.rows);
    expect(after.scanned).toBeLessThan(before.scanned / 5);
  });
  it("reports helpful errors", () => {
    for (const bad of ["SELEC * FROM users", "SELECT * FROM nope", "SELECT * FROM users WHERE city = Алматы", "SELECT x FROM users", "INSERT INTO users (name) VALUES (1, 2)"]) {
      const r = execute(db, bad).result;
      expect(r.ok, bad).toBe(false);
      expect(r.error, bad).toBeTruthy();
    }
  });
  it("binds parameters safely", () => {
    expect(bindParams("SELECT * FROM users WHERE name = :n AND id = :id", { n: "O'Neil", id: "4" })).toBe("SELECT * FROM users WHERE name = 'O''Neil' AND id = 4");
    const injected = bindParams("SELECT * FROM users WHERE name = :n", { n: "x' OR '1'='1" });
    expect(execute(db, injected).result.rows).toHaveLength(0);
  });
});

describe("HTML parser", () => {
  it("builds a tree and reports unclosed and stray tags", () => {
    const ok = parseHtml("<ul><li>a</li><li>b</li></ul><img src=x alt='y'>");
    expect(ok.issues).toEqual([]);
    expect(ok.root.children[0]!.children).toHaveLength(2);
    expect(ok.root.children[1]!.attrs).toEqual({ src: "x", alt: "y" });
    const bad = parseHtml("<div><p>text</div></span>");
    expect(bad.issues.map((i) => i.message)).toEqual(["<p> жабылмаған", "</span> артық: мұндай ашық тег жоқ"]);
  });
});

describe("event loop", () => {
  it("runs microtasks before tasks and timers by deadline", () => {
    expect(finalOutput(PROGRAMS.find((p) => p.id === "basic")!)).toEqual(["A", "D", "C", "B"]);
    expect(finalOutput(PROGRAMS.find((p) => p.id === "timers")!)).toEqual(["3", "2", "1"]);
    expect(finalOutput(PROGRAMS.find((p) => p.id === "fetch")!)).toEqual(["бастау", "соңы", "таймер", "жауап келді", "өңделді"]);
  });
  it("frames start and end with an empty stack", () => {
    const f = runEventLoop(PROGRAMS[0]!);
    expect(f.at(-1)!.stack).toEqual([]);
    expect(f.at(-1)!.tasks).toEqual([]);
  });
});

describe("network", () => {
  it("resolves an https request through dns, tcp, tls, http", () => {
    const w = scenario("internet");
    const r = resolveRequest(w, { method: "GET", url: "https://inside.kz/" });
    expect(r.response.status).toBe(200);
    expect(r.stages.map((s) => s.kind)).toEqual(["url", "dns", "dns", "tcp", "tcp", "tcp", "tls", "tls", "http", "route", "response", "render"]);
    const again = resolveRequest(r.world, { method: "GET", url: "http://inside.kz/" });
    expect(again.stages.some((s) => s.kind === "tls")).toBe(false);
    expect(again.response.ms).toBeLessThan(r.response.ms);
  });
  it("produces realistic failures", () => {
    const w = scenario("debug");
    expect(resolveRequest(w, { method: "GET", url: "https://shop.kz/" }).response.error).toMatch(/NXDOMAIN/);
    expect(resolveRequest(w, { method: "GET", url: "not a url" }).response.status).toBe(0);
    const api = scenario("api");
    expect(resolveRequest(api, { method: "GET", url: "https://api.inside.kz/api/secret" }).response.status).toBe(401);
    expect(resolveRequest(api, { method: "GET", url: "https://api.inside.kz/api/secret", token: "secret-123" }).response.status).toBe(200);
    expect(resolveRequest(api, { method: "GET", url: "https://api.inside.kz/api/users/3" }).response.body).toContain("Дана");
  });
  it("matches route params", () => {
    const routes = scenario("api").servers[1]!.routes;
    expect(matchRoute(routes, "GET", "/api/users/42")?.params).toEqual({ id: "42" });
    expect(matchRoute(routes, "DELETE", "/api/users/42")).toBeUndefined();
  });
  it("box model maths matches CSS", () => {
    expect(boxSizes({ width: 200, padding: 20, border: 5, margin: 10, boxSizing: "content-box" })).toEqual({ content: 200, borderBox: 250, total: 270 });
    expect(boxSizes({ width: 200, padding: 20, border: 5, margin: 10, boxSizing: "border-box" })).toEqual({ content: 150, borderBox: 200, total: 220 });
  });
});

describe("web-lab plugin", () => {
  it("keeps edits made while a request is still playing", () => {
    const rt = new SimulationRuntime(webLabPlugin, 1);
    rt.dispatch({ type: "scenario/load", id: "debug" });
    rt.dispatch({ type: "req/set", params: { url: "https://shop.kz/" } });
    rt.dispatch({ type: "req/send" });
    rt.stepTicks(2);
    rt.dispatch({ type: "dns/set", name: "shop.kz", ip: "93.184.10.5" });
    rt.dispatch({ type: "req/send" }); // finishes the first trace, starts the second
    rt.stepTicks(400);
    const s = rt.getState();
    expect(s.world.dns.some((r) => r.name === "shop.kz")).toBe(true);
    expect(s.history[0]!.status).toBe(404);
  });

  it("plays requests back over fixed steps and replays deterministically", () => {
    const rt = new SimulationRuntime(webLabPlugin, 1);
    rt.dispatch({ type: "req/send" });
    expect(rt.getState().trace?.done).toBe(false);
    rt.stepTicks(400);
    const s = rt.getState();
    expect(s.trace?.done).toBe(true);
    expect(s.history[0]?.status).toBe(200);
    expect(replay(webLabPlugin, rt.record())).toEqual(s);
  });
});

type D = (a: WebLabAction) => void;
const send = (d: D, tick: (n: number) => void, params?: Parameters<D>[0] extends infer _ ? Partial<WebLabState["request"]> : never) => {
  if (params) d({ type: "req/set", params });
  d({ type: "req/send" });
  tick(600);
};
const SITE = "93.184.10.1";
const API = "93.184.10.2";
const SHOP = "93.184.10.5";
const MINE = "93.184.10.9";

const scripts: Record<string, Record<string, (d: D, s: () => WebLabState, tick: (n: number) => void) => void>> = {
  "web-1-internet": {
    journey: (d, _s, t) => send(d, t),
    "dns-cache": (d, _s, t) => send(d, t),
    https: (d, _s, t) => send(d, t, { url: "http://inside.kz/" }),
    latency: (d, _s, t) => {
      d({ type: "server/set", ip: SITE, patch: { latency: 200 } });
      d({ type: "dnsCache/clear" });
      send(d, t, { url: "https://inside.kz/" });
    },
  },
  "web-2-html": {
    tree: (d) => d({ type: "dom/select", id: 1 }),
    build: (d, s) => d({ type: "html/set", html: s().html.replace("</ul>", "  <li>Екінші</li>\n  <li>Үшінші</li>\n</ul>") }),
    fix: (d) => d({ type: "html/set", html: "<h1>Жаңалықтар</h1><div><p>Бүгін <b>маңызды</b> күн</p><ul><li>Бірінші</li><li>Екінші</li></ul></div>" }),
    attrs: (d, s) => d({ type: "html/set", html: s().html + '<a href="https://inside.kz">Сілтеме</a><img src="cat.png" alt="Мысық">' }),
  },
  "web-3-css": {
    box: (d) => d({ type: "box/set", patch: { width: 220, padding: 10, border: 2, margin: 28 } }),
    "border-box": (d) => d({ type: "box/set", patch: { boxSizing: "border-box", width: 300, padding: 24 } }),
    flex: (d) => d({ type: "flex/set", patch: { justify: "space-between", align: "center" } }),
    responsive: (d) => d({ type: "flex/set", patch: { containerWidth: 300, wrap: true } }),
  },
  "web-4-js": {
    stack: (d) => {
      for (let i = 0; i < 40; i++) d({ type: "loop/step" });
    },
    predict: (d) => ["A", "D", "C", "B"].forEach((token) => d({ type: "loop/predict", token })),
    timers: (d) => ["3", "2", "1"].forEach((token) => d({ type: "loop/predict", token })),
    fetch: (d) => {
      for (let i = 0; i < 40; i++) d({ type: "loop/step" });
      ["бастау", "соңы", "таймер", "жауап келді", "өңделді"].forEach((token) => d({ type: "loop/predict", token }));
    },
  },
  "web-9-pset": {
    sql: (d) => {
      for (const text of [
        "SELECT * FROM users WHERE city != 'Алматы' AND city != 'Астана' ORDER BY name",
        "SELECT item, price FROM orders WHERE user_id = 3 ORDER BY price DESC LIMIT 5",
        "CREATE INDEX ON orders (user_id)",
        "SELECT * FROM orders WHERE user_id = 5",
      ]) {
        d({ type: "sql/set", text });
        d({ type: "sql/run" });
      }
    },
    api: (d, _s, t) => {
      d({ type: "route/add", ip: API, route: { method: "GET", path: "/api/users/:id/orders", kind: "sql", body: "SELECT * FROM orders WHERE user_id = :id ORDER BY price DESC LIMIT 5", requiresAuth: false } });
      send(d, t);
      const route = _s().world.servers.find((x) => x.ip === API)!.routes.find((r) => r.path === "/api/users/:id/orders")!;
      d({ type: "route/update", ip: API, id: route.id, patch: { requiresAuth: true } });
      send(d, t);
      send(d, t, { token: "secret-123" });
    },
    loop: (d) => {
      ["1", "6", "4", "2", "3", "5"].forEach((token) => d({ type: "loop/predict", token }));
      d({ type: "loop/select", programId: "race" });
      ["E", "D", "C", "B", "A"].forEach((token) => d({ type: "loop/predict", token }));
    },
  },
  "web-5-backend": {
    routes: (d, _s, t) => {
      send(d, t);
      send(d, t, { url: "https://api.inside.kz/api/nothing" });
    },
    "new-route": (d, _s, t) => {
      d({ type: "route/add", ip: API, route: { method: "GET", path: "/api/time", kind: "json", body: '{"time":"12:00"}', requiresAuth: false } });
      send(d, t, { url: "https://api.inside.kz/api/time" });
    },
    auth: (d, _s, t) => {
      send(d, t);
      send(d, t, { token: "secret-123" });
    },
    post: (d, _s, t) => {
      send(d, t, { body: { name: "Арман", city: "Тараз" } });
      send(d, t, { method: "GET", url: "https://api.inside.kz/api/users" });
    },
  },
  "web-6-db": {
    select: (d) => {
      d({ type: "sql/set", text: "SELECT name FROM users WHERE city = 'Алматы'" });
      d({ type: "sql/run" });
    },
    crud: (d) => {
      for (const text of ["INSERT INTO users (name, city) VALUES ('Арман', 'Тараз')", "UPDATE users SET city = 'Астана' WHERE id = 2", "DELETE FROM users WHERE id = 3"]) {
        d({ type: "sql/set", text });
        d({ type: "sql/run" });
      }
    },
    index: (d) => {
      d({ type: "sql/run" });
      d({ type: "sql/set", text: "CREATE INDEX ON orders (user_id)" });
      d({ type: "sql/run" });
      d({ type: "sql/set", text: "SELECT * FROM orders WHERE user_id = 7" });
      d({ type: "sql/run" });
    },
  },
  "web-7-debug": {
    dns: (d, _s, t) => {
      send(d, t);
      d({ type: "dns/set", name: "shop.kz", ip: SHOP });
      send(d, t);
    },
    "404": (d, s, t) => {
      const home = s().world.servers.find((x) => x.ip === SHOP)!.routes.find((r) => r.path === "/home")!;
      d({ type: "route/update", ip: SHOP, id: home.id, patch: { path: "/" } });
      send(d, t);
    },
    "500": (d, s, t) => {
      send(d, t);
      const r = s().world.servers.find((x) => x.ip === SHOP)!.routes.find((x) => x.kind === "crash")!;
      d({ type: "route/update", ip: SHOP, id: r.id, patch: { kind: "json" } });
      send(d, t);
    },
    slow: (d, _s, t) => {
      send(d, t);
      d({ type: "sql/set", text: "CREATE INDEX ON orders (user_id)" });
      d({ type: "sql/run" });
      send(d, t);
    },
  },
  "web-8-deploy": {
    write: (d) => d({ type: "html/set", html: "<h1>Айгерімнің сайты</h1><p>Мен бағдарламалауды үйреніп жүрмін.</p>" }),
    publish: (d, _s, t) => {
      d({ type: "dns/set", name: "mysite.kz", ip: MINE });
      d({ type: "site/deploy", ip: MINE });
      send(d, t);
    },
    cache: (d, s, t) => {
      d({ type: "html/set", html: s().html.replace("сайты", "жаңа сайты") });
      d({ type: "site/deploy", ip: MINE });
      send(d, t);
      d({ type: "cache/clear" });
      send(d, t);
    },
    export: (d) => d({ type: "site/export" }),
  },
};

describe("web lessons are completable", () => {
  for (const lesson of webLessons) {
    it(lesson.id, () => {
      const rt = new SimulationRuntime(webLabPlugin, 1);
      const engine = new LessonEngine(lesson);
      const sync = () => engine.update(rt.getState(), rt.evaluate());
      const enter = () => engine.step.onEnter?.forEach((a) => rt.dispatch(a));
      const d: D = (a) => {
        rt.dispatch(a);
        sync();
      };
      const tick = (n: number) => {
        for (let i = 0; i < n; i += 10) {
          rt.stepTicks(10);
          sync();
        }
      };
      enter();
      sync();
      for (const step of lesson.steps) {
        const script = scripts[lesson.id]?.[step.id];
        expect(script, `script for ${step.id}`).toBeDefined();
        script!(d, () => rt.getState(), tick);
        sync();
        const view = engine.view();
        expect(view.objectives.filter((o) => !o.done).map((o) => o.text), `${lesson.id}/${step.id}`).toEqual([]);
        for (const q of step.quiz ?? []) expect(engine.answer(q.id, q.answer).correct).toBe(true);
        if (!engine.isLastStep()) {
          engine.advance();
          enter();
          sync();
        }
      }
      expect(engine.isLessonComplete()).toBe(true);
    });
  }
});
