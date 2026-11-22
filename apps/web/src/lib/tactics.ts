/**
 * Тактика алаңы: two planning games built on the first-year mathematics.
 *
 * Векторлық навигатор: a ship starts at the origin and may only step by ±u or ±v. The learner
 * plans a route to a target past asteroids, or proves that no route exists: the target is off
 * the line the vectors span (det = 0), it is not on their lattice (|det| > 1 and the
 * coefficients are not whole), or the asteroids wall it in.
 *
 * Функция мергені: a graph is moved by transformation cards. The learner writes the whole
 * programme of cards first and only then runs it, so the order of operations has to be
 * reasoned about, not discovered by trial.
 */

// ---------------------------------------------------------------- vector navigator

export type P2 = readonly [number, number];
export type Reason = "line" | "lattice" | "walls";

export const REASONS: Record<Reason, string> = {
  line: "Векторлар бір түзуде жатыр (det = 0): тек сол түзудің нүктелеріне жетесің",
  lattice: "det ≠ 0, бірақ коэффициенттер бүтін емес: нүкте тордың түйіні емес",
  walls: "Нүкте торда, бірақ оған апаратын жолдың бәрін астероидтар жауып тұр",
};

export interface NavLevel {
  id: string;
  title: string;
  brief: string;
  u: P2;
  v: P2;
  target: P2;
  rocks: P2[];
}

export const NAV_BOUND = 6;

export const NAV_LEVELS: NavLevel[] = [
  { id: "n1", title: "Алғашқы ұшу", brief: "Стандарт базис: u оңға, v жоғары.", u: [1, 0], v: [0, 1], target: [3, 2], rocks: [] },
  { id: "n2", title: "Қисық базис", brief: "Векторлар енді осьтер бойымен емес. Астероид бірінші жүрісті шектейді.", u: [2, 1], v: [1, 2], target: [4, 5], rocks: [[2, 1]] },
  { id: "n3", title: "Жұп қадамдар", brief: "Екі вектор да ұзын, бір-біріне перпендикуляр.", u: [2, 0], v: [0, 2], target: [3, 4], rocks: [] },
  { id: "n4", title: "Жалғыз бағыт", brief: "Екі қозғалтқыш, бірақ екеуі бір жаққа ұқсайды.", u: [1, 2], v: [2, 4], target: [3, 1], rocks: [] },
  { id: "n5", title: "Кері жүріс", brief: "Мақсат төменде. Кейде вектордан шегіну керек.", u: [2, 1], v: [1, 1], target: [1, -1], rocks: [[1, 0], [0, -1]] },
  { id: "n6", title: "Сирек тор", brief: "det = 5. Тор сирек, бірақ бұл нүктеге жетуге бола ма?", u: [3, 1], v: [1, 2], target: [5, 0], rocks: [] },
  { id: "n7", title: "Көрші нүкте", brief: "Сол тор, басқа мақсат.", u: [3, 1], v: [1, 2], target: [2, 2], rocks: [] },
  { id: "n8", title: "Қамал", brief: "Стандарт базис, бірақ мақсаттың айналасы тас.", u: [1, 0], v: [0, 1], target: [4, 4], rocks: [[3, 4], [5, 4], [4, 3], [4, 5]] },
];

export const det2 = (u: P2, v: P2) => u[0] * v[1] - u[1] * v[0];
const key = (p: P2) => `${p[0]},${p[1]}`;
export const inBounds = (p: P2) => Math.abs(p[0]) <= NAV_BOUND && Math.abs(p[1]) <= NAV_BOUND;

export function navMoves(l: NavLevel): { label: string; d: P2 }[] {
  return [
    { label: "+u", d: l.u },
    { label: "−u", d: [-l.u[0], -l.u[1]] },
    { label: "+v", d: l.v },
    { label: "−v", d: [-l.v[0], -l.v[1]] },
  ];
}

export function blocked(l: NavLevel, p: P2): boolean {
  return !inBounds(p) || l.rocks.some((r) => r[0] === p[0] && r[1] === p[1]);
}

/** Fewest moves from the origin to the target inside the field, or null when there is no route. */
export function navPar(l: NavLevel): number | null {
  const seen = new Map<string, number>([["0,0", 0]]);
  let frontier: P2[] = [[0, 0]];
  for (let d = 0; frontier.length; d++) {
    const next: P2[] = [];
    for (const p of frontier) {
      if (p[0] === l.target[0] && p[1] === l.target[1]) return d;
      for (const m of navMoves(l)) {
        const q: P2 = [p[0] + m.d[0], p[1] + m.d[1]];
        if (blocked(l, q) || seen.has(key(q))) continue;
        seen.set(key(q), d + 1);
        next.push(q);
      }
    }
    frontier = next;
  }
  return null;
}

/** Coefficients a, b with a·u + b·v = target (Cramer), or null when det = 0. */
export function coefficients(l: NavLevel): [number, number] | null {
  const d = det2(l.u, l.v);
  if (d === 0) return null;
  return [det2(l.target, l.v) / d, det2(l.u, l.target) / d];
}

/** Why the target cannot be reached, or null when it can. */
export function whyUnreachable(l: NavLevel): Reason | null {
  if (navPar(l) !== null) return null;
  const c = coefficients(l);
  if (c === null) return "line";
  if (!Number.isInteger(c[0]) || !Number.isInteger(c[1])) return "lattice";
  return "walls";
}

/** 3 stars on the shortest route, 2 within two extra moves, 1 otherwise. */
export function navStars(moves: number, par: number): number {
  return moves <= par ? 3 : moves <= par + 2 ? 2 : 1;
}

// ---------------------------------------------------------------- function marksman

export type Base = "sq" | "abs" | "cube";
export type Card = "up" | "down" | "right" | "left" | "stretch" | "flipx" | "flipy";

/** y = a·f(x − h) + k. Every card keeps a function in this form. */
export interface Fn {
  base: Base;
  a: number;
  h: number;
  k: number;
}

export const CARDS: Record<Card, { label: string; rule: string }> = {
  up: { label: "1 жоғары", rule: "y → y + 1" },
  down: { label: "1 төмен", rule: "y → y − 1" },
  right: { label: "1 оңға", rule: "x → x − 1" },
  left: { label: "1 солға", rule: "x → x + 1" },
  stretch: { label: "Тігінен ×2", rule: "y → 2y" },
  flipx: { label: "Ox осіне шағылу", rule: "y → −y" },
  flipy: { label: "Oy осіне шағылу", rule: "x → −x" },
};

export function applyCard(f: Fn, c: Card): Fn {
  switch (c) {
    case "up":
      return { ...f, k: f.k + 1 };
    case "down":
      return { ...f, k: f.k - 1 };
    case "right":
      return { ...f, h: f.h + 1 };
    case "left":
      return { ...f, h: f.h - 1 };
    case "stretch":
      return { ...f, a: f.a * 2, k: f.k * 2 };
    case "flipx":
      return { ...f, a: -f.a, k: -f.k };
    case "flipy":
      // g(−x) = a·f(−(x + h)) + k; an even f ignores the sign, an odd one passes it out.
      return { ...f, h: -f.h, a: f.base === "cube" ? -f.a : f.a };
  }
}

export const run = (f: Fn, cards: readonly Card[]) => cards.reduce(applyCard, f);
export const start = (base: Base): Fn => ({ base, a: 1, h: 0, k: 0 });
export const same = (f: Fn, g: Fn) => f.base === g.base && f.a === g.a && f.h === g.h && f.k === g.k;

export function evalFn(f: Fn, x: number): number {
  const t = x - f.h;
  const y = f.base === "sq" ? t * t : f.base === "abs" ? Math.abs(t) : t * t * t;
  return f.a * y + f.k;
}

const M = "−";
export function formula(f: Fn): string {
  const inner = f.h === 0 ? "x" : f.h > 0 ? `x ${M} ${f.h}` : `x + ${-f.h}`;
  const core = f.base === "abs" ? `|${inner}|` : `${f.h === 0 ? "x" : `(${inner})`}${f.base === "sq" ? "²" : "³"}`;
  const a = f.a === 1 ? "" : f.a === -1 ? M : f.a < 0 ? `${M}${-f.a}` : `${f.a}`;
  const k = f.k === 0 ? "" : f.k > 0 ? ` + ${f.k}` : ` ${M} ${-f.k}`;
  return `y = ${a}${core}${k}`;
}

export interface FnLevel {
  id: string;
  title: string;
  brief: string;
  base: Base;
  cards: Card[];
  /** One programme that hits the target; the target is its result. */
  answer: Card[];
}

export const FN_LEVELS: FnLevel[] = [
  { id: "f1", title: "Параболаны жылжыт", brief: "Төбені нысанаға апар.", base: "sq", cards: ["up", "down", "right", "left"], answer: ["right", "right", "up"] },
  { id: "f2", title: "Төңкерілген бұрыш", brief: "Модуль графигі төменге қарауы керек.", base: "abs", cards: ["up", "down", "left", "right", "flipx"], answer: ["flipx", "up", "up"] },
  { id: "f3", title: "Рет маңызды", brief: "Екі карта ғана. Қайсысы бірінші?", base: "sq", cards: ["up", "flipx"], answer: ["up", "flipx"] },
  { id: "f4", title: "Созу мен көтеру", brief: "Созу бәрін созады, тіпті жылжуды да.", base: "sq", cards: ["up", "stretch"], answer: ["stretch", "up"] },
  { id: "f5", title: "Куб шағылуы", brief: "Тақ функцияда екі шағылу бір нәрсені істейді ме?", base: "cube", cards: ["right", "left", "up", "down", "flipx", "flipy"], answer: ["flipy", "right", "up"] },
  { id: "f6", title: "Толық бағдарлама", brief: "Бәрі бірге: жылжу, созу, шағылу.", base: "abs", cards: ["left", "right", "up", "down", "stretch", "flipx"], answer: ["left", "up", "stretch", "flipx", "up"] },
];

export const fnTarget = (l: FnLevel) => run(start(l.base), l.answer);

/** Shortest programme length, by breadth first search over (a, h, k). */
export function fnPar(l: FnLevel, maxDepth = 8): number {
  const target = fnTarget(l);
  const sig = (f: Fn) => `${f.a},${f.h},${f.k}`;
  const seen = new Set<string>();
  let frontier = [start(l.base)];
  for (let d = 0; d <= maxDepth; d++) {
    const next: Fn[] = [];
    for (const f of frontier) {
      if (same(f, target)) return d;
      for (const c of l.cards) {
        const g = applyCard(f, c);
        if (Math.abs(g.a) > 16 || Math.abs(g.h) > 8 || Math.abs(g.k) > 16 || seen.has(sig(g))) continue;
        seen.add(sig(g));
        next.push(g);
      }
    }
    frontier = next;
  }
  return l.answer.length;
}

/** 3 stars for a shortest programme without the live view; the live view or extra cards cost one. */
export function fnStars(length: number, par: number, peeked: boolean): number {
  return Math.max(1, (length <= par ? 3 : 2) - (peeked ? 1 : 0));
}
