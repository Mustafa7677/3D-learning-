import type { Db, Row } from "./sql";
import type { Route, World } from "./net";

const CITIES = ["Алматы", "Астана", "Шымкент", "Қарағанды", "Ақтөбе", "Тараз", "Павлодар", "Өскемен"];
const NAMES = ["Айгерім", "Нұрлан", "Дана", "Ерлан", "Әсел", "Тимур", "Жанар", "Мирас"];
const ITEMS = ["кітап", "ноутбук", "құлаққап", "телефон", "рюкзак", "қалам", "монитор", "тышқан"];

/** Deterministic pseudo-random integers (LCG) so datasets are identical everywhere. */
function lcg(seed: number) {
  let s = seed >>> 0;
  return (n: number) => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    // High bits: an LCG’s low bits repeat with a short period.
    return (s >>> 16) % n;
  };
}

export const ORDER_ROWS = 2000;

export function baseDb(): Db {
  const users: Row[] = NAMES.map((name, i) => ({ id: i + 1, name, city: CITIES[i]! }));
  const r = lcg(7);
  const orders: Row[] = Array.from({ length: ORDER_ROWS }, (_, i) => ({
    id: i + 1,
    user_id: 1 + r(NAMES.length),
    item: ITEMS[r(ITEMS.length)]!,
    price: 500 + r(200) * 250,
  }));
  return {
    users: { name: "users", columns: ["id", "name", "city"], rows: users, indexed: ["id"] },
    orders: { name: "orders", columns: ["id", "user_id", "item", "price"], rows: orders, indexed: ["id"] },
  };
}

let routeId = 100;
const route = (r: Omit<Route, "id" | "requiresAuth"> & { requiresAuth?: boolean }): Route => ({ requiresAuth: false, ...r, id: routeId++ });

const SITE_HOME = `<h1>INSIDE TECH</h1>
<p>Технологияның ішіне кір.</p>`;

export type ScenarioId = "internet" | "api" | "debug" | "deploy";

export function scenario(id: ScenarioId): World {
  routeId = 100;
  const site = {
    host: "inside.kz",
    ip: "93.184.10.1",
    up: true,
    https: true,
    latency: 40,
    maxAge: 0,
    token: "",
    routes: [route({ method: "GET", path: "/", kind: "html", body: SITE_HOME }), route({ method: "GET", path: "/about", kind: "html", body: "<h1>Біз туралы</h1><p>3D IT оқу платформасы.</p>" })],
  };
  const api = {
    host: "api.inside.kz",
    ip: "93.184.10.2",
    up: true,
    https: true,
    latency: 40,
    maxAge: 0,
    token: "secret-123",
    adminToken: "admin-777",
    routes: [
      route({ method: "GET", path: "/api/hello", kind: "json", body: '{"message":"Сәлем!"}' }),
      route({ method: "GET", path: "/api/users", kind: "sql", body: "SELECT * FROM users" }),
      route({ method: "GET", path: "/api/users/:id", kind: "sql", body: "SELECT * FROM users WHERE id = :id" }),
      route({ method: "POST", path: "/api/users", kind: "sql", body: "INSERT INTO users (name, city) VALUES (:body_name, :body_city)" }),
      route({ method: "GET", path: "/api/secret", kind: "json", body: '{"plan":"premium"}', requiresAuth: true }),
      route({ method: "GET", path: "/api/admin/stats", kind: "json", body: '{"report":"weekly","signups":42}', requiresAuth: true, adminOnly: true }),
    ],
  };
  const world: World = {
    dns: [
      { name: "inside.kz", ip: site.ip },
      { name: "api.inside.kz", ip: api.ip },
    ],
    servers: [site, api],
    db: baseDb(),
    cache: [],
    dnsCache: {},
    clock: 0,
    deployVersion: 0,
  };

  if (id === "debug") {
    const shop = {
      host: "shop.kz",
      ip: "93.184.10.5",
      up: true,
      https: true,
      latency: 40,
      maxAge: 0,
      token: "",
      routes: [
        route({ method: "GET", path: "/home", kind: "html", body: "<h1>Дүкен</h1><p>Жаңа тауарлар</p>" }),
        route({ method: "GET", path: "/api/products", kind: "crash", body: '[{"id":1,"item":"кітап"}]' }),
        route({ method: "GET", path: "/api/orders/:user", kind: "sql", body: "SELECT * FROM orders WHERE user_id = :user" }),
      ],
    };
    return { ...world, dns: [...world.dns, { name: "shpo.kz", ip: shop.ip }], servers: [...world.servers, shop] };
  }

  if (id === "deploy") {
    const mine = { host: "mysite.kz", ip: "93.184.10.9", up: true, https: true, latency: 40, maxAge: 60, token: "", routes: [] as Route[] };
    return { ...world, servers: [...world.servers, mine] };
  }

  return world;
}

export const STARTER_HTML = `<h1>Менің бетім</h1>
<p>Сәлем! Бұл: <b>HTML</b>.</p>
<ul>
  <li>Бірінші</li>
</ul>`;

export const BROKEN_HTML = `<h1>Жаңалықтар</h1>
<div>
  <p>Бүгін <b>маңызды күн</p>
  <ul>
    <li>Бірінші жаңалық
    <li>Екінші жаңалық</li>
  </ul>
</span>`;

export const DEPLOY_HTML = `<h1>Менің сайтым</h1>
<p>Бұл сайтты мен өзім жасадым.</p>`;
