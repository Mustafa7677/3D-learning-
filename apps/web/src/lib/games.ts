/**
 * The action games of the arcade: their rules, numbers and content, apart from any screen.
 *   Пакет-серфер            an endless run down a fibre cable
 *   Баг аулау               squash bugs crawling along code before they reach production
 *   Брандмауэр қорғанысы    tower defence: firewalls, antivirus and scanners against malware
 */

// ---------------------------------------------------------------- shared geometry

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Does a circle touch an axis-aligned rectangle? */
export function circleHitsRect(cx: number, cy: number, r: number, x: number, y: number, w: number, h: number): boolean {
  const nx = clamp(cx, x, x + w);
  const ny = clamp(cy, y, y + h);
  return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
}

export const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

// ---------------------------------------------------------------- Пакет-серфер

export const RUN_W = 800;
export const RUN_H = 450;

export function runSpeed(t: number) {
  return Math.min(560, 260 + t * 7);
}
/** The gap in a firewall closes as the run goes on, but never below a fair size. */
export function wallGap(t: number) {
  return Math.max(118, 190 - t * 1.6);
}
export const RUN_LABELS = ["FIREWALL", "DDoS", "ТРОЯН", "СПАМ", "ҚҰРТ"];

// ---------------------------------------------------------------- Баг аулау

export const CODE_LINES = [
  "function pay(cart) {",
  "  let total = 0;",
  "  for (const item of cart) {",
  "    total += item.price * item.qty;",
  "  }",
  "  if (total > limit) return error();",
  "  await bank.charge(user, total);",
  "  return receipt(total);",
];

export type BugKind = "bug" | "leak" | "race" | "feature" | "boss";

export const BUGS: Record<BugKind, { name: string; hp: number; speed: number; points: number; note: string }> = {
  bug: { name: "Баг", hp: 1, speed: 46, points: 10, note: "Кәдімгі қате: бір рет бас." },
  leak: { name: "Жад ағуы", hp: 3, speed: 30, points: 30, note: "Бронды: үш рет басу керек. Жад ағуы бірден жоғалмайды." },
  race: { name: "Жарыс күйі", hp: 1, speed: 95, points: 25, note: "Өте жылдам және ирелеңдейді: race condition ұстатпайды." },
  feature: { name: "Фича", hp: 1, speed: 40, points: -40, note: "Бұл баг емес, фича! Баспа, өзі өтіп кетеді." },
  boss: { name: "Prod бағы", hp: 14, speed: 16, points: 200, note: "Продакшендегі үлкен баг: көп рет бас!" },
};

/** What to spawn next, given the time played. */
export function bugKindAt(t: number, r: number): BugKind {
  if (t > 12 && r < 0.12) return "feature";
  if (t > 20 && r < 0.27) return "race";
  if (t > 8 && r < 0.42) return "leak";
  return "bug";
}
export const bugEvery = (t: number) => Math.max(0.55, 1.6 - t * 0.022);
export const BUG_LIVES = 5;
export const BOSS_EVERY = 35;

// ---------------------------------------------------------------- Брандмауэр қорғанысы

export const TD_COLS = 14;
export const TD_ROWS = 8;
/** The road malware takes from the Internet (left) to the server (right), as grid corners. */
export const TD_WAYPOINTS: [number, number][] = [
  [0, 1],
  [4, 1],
  [4, 5],
  [8, 5],
  [8, 2],
  [11, 2],
  [11, 6],
  [13, 6],
];

/** Every grid cell the road covers, in order. */
export function pathCells(points = TD_WAYPOINTS): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i]!;
    const [x1, y1] = points[i + 1]!;
    const steps = Math.abs(x1 - x0) + Math.abs(y1 - y0);
    for (let s = 0; s < steps; s++) out.push([x0 + Math.sign(x1 - x0) * s, y0 + Math.sign(y1 - y0) * s]);
  }
  out.push(points[points.length - 1]!);
  return out;
}

export const PATH_LENGTH = pathCells().length - 1;

/** Where a walker stands after `d` cells along the road (cell centres). */
export function pointAlong(d: number, points = TD_WAYPOINTS): [number, number] {
  let left = Math.max(0, d);
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i]!;
    const [x1, y1] = points[i + 1]!;
    const len = Math.abs(x1 - x0) + Math.abs(y1 - y0);
    if (left <= len) {
      const k = len ? left / len : 0;
      return [x0 + (x1 - x0) * k + 0.5, y0 + (y1 - y0) * k + 0.5];
    }
    left -= len;
  }
  const [x, y] = points[points.length - 1]!;
  return [x + 0.5, y + 0.5];
}

export type TowerKind = "firewall" | "antivirus" | "scanner";
export const TOWERS: Record<TowerKind, { name: string; cost: number; range: number; rate: number; damage: number; splash?: number; slow?: number; glyph: string; color: string; note: string }> = {
  firewall: { name: "Брандмауэр", cost: 50, range: 2.3, rate: 1.7, damage: 1, glyph: "▥", color: "#ff7a3d", note: "Пакеттерді ереже бойынша сүзеді: жылдам, бір нысанаға атады." },
  antivirus: { name: "Антивирус", cost: 90, range: 1.9, rate: 0.6, damage: 2, splash: 1, glyph: "✚", color: "#3dd6ff", note: "Белгілі қолтаңбаларды табады: баяу, бірақ топқа бірден соғады." },
  scanner: { name: "Сканер", cost: 70, range: 2.6, rate: 2, damage: 0.25, slow: 0.45, glyph: "◉", color: "#b6ff3d", note: "Мінез-құлықты талдайды: жасырын трояндарды көрсетеді және бәрін баяулатады." },
};

export type ThreatKind = "spam" | "worm" | "ddos" | "trojan" | "ransom";
export const THREATS: Record<ThreatKind, { name: string; hp: number; speed: number; reward: number; harm: number; hidden?: boolean; color: string; note: string }> = {
  spam: { name: "Спам", hp: 3, speed: 1, reward: 8, harm: 1, color: "#ffd23d", note: "Көп, баяу, әлсіз. Брандмауэр оңай тоқтатады." },
  worm: { name: "Құрт", hp: 2.5, speed: 2.1, reward: 10, harm: 1, color: "#ff3d7f", note: "Өзін-өзі көшіреді және жылдам жылжиды." },
  ddos: { name: "DDoS", hp: 1, speed: 1.5, reward: 3, harm: 1, color: "#c08bff", note: "Мыңдаған әлсіз сұраныс бірден: антивирустың шашыраңқы соққысы көмектеседі." },
  trojan: { name: "Троян", hp: 7, speed: 0.9, reward: 22, harm: 2, hidden: true, color: "#9aa3b5", note: "Жасырын! Тек сканердің аймағында көрінеді, сонда ғана оған атуға болады." },
  ransom: { name: "Ransomware", hp: 55, speed: 0.55, reward: 120, harm: 8, color: "#ff3b30", note: "Босс: деректерді шифрлайды. Серверге жетсе, 8 өмір алады." },
};

/** Each wave: groups of threats with the gap between them, in seconds. */
export const WAVES: { kind: ThreatKind; count: number; gap: number }[][] = [
  [{ kind: "spam", count: 8, gap: 1.1 }],
  [{ kind: "spam", count: 8, gap: 0.8 }, { kind: "worm", count: 4, gap: 1 }],
  [{ kind: "ddos", count: 22, gap: 0.22 }],
  [{ kind: "worm", count: 10, gap: 0.6 }, { kind: "spam", count: 6, gap: 0.7 }],
  [{ kind: "trojan", count: 4, gap: 2 }, { kind: "spam", count: 8, gap: 0.6 }],
  [{ kind: "ddos", count: 34, gap: 0.16 }, { kind: "worm", count: 6, gap: 0.5 }],
  [{ kind: "trojan", count: 7, gap: 1.3 }, { kind: "worm", count: 10, gap: 0.45 }],
  [{ kind: "spam", count: 14, gap: 0.4 }, { kind: "ddos", count: 30, gap: 0.14 }, { kind: "trojan", count: 6, gap: 1 }],
  [{ kind: "worm", count: 18, gap: 0.35 }, { kind: "trojan", count: 8, gap: 0.9 }],
  [{ kind: "ransom", count: 1, gap: 1 }, { kind: "ddos", count: 30, gap: 0.15 }, { kind: "trojan", count: 6, gap: 1 }],
];

/** Threats grow a little tougher every wave, so early towers do not carry the whole game. */
export const waveHp = (wave: number) => 1 + wave * 0.12;
export const TD_MONEY = 160;
export const TD_LIVES = 20;
export const sellBack = (cost: number) => Math.floor(cost * 0.6);
