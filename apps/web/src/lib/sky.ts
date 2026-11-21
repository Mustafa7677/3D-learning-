import type { LessonProgress } from "@inside-tech/lesson-engine";
import { openLabs } from "./catalog";
import { lessonEntries, lessonsForLab } from "./lessons";

/**
 * Білім аспаны: every lesson a star, every lab a constellation, and in the
 * middle Темірқазық, the star that shows the way: your next lesson.
 */

export type StarState = "done" | "started" | "dark";

export interface Star {
  id: string;
  lab: string;
  title: string;
  order: number;
  pos: [number, number, number];
  state: StarState;
}

export interface Constellation {
  lab: string;
  title: string;
  center: [number, number, number];
  stars: Star[];
  done: number;
}

/** One idea that lives in two labs: a faint bridge across the sky. */
export interface Bridge {
  idea: string;
  a: string;
  b: string;
}

export const BRIDGES: Bridge[] = [
  { idea: "Дейкстра", a: "net-3-routing", b: "algo-8-dijkstra" },
  { idea: "Графтар", a: "algo-7-graphs", b: "net-4-dv" },
  { idea: "TCP", a: "web-1-internet", b: "net-5-reliable" },
  { idea: "Пакеттер", a: "web-1-internet", b: "net-1-packets" },
  { idea: "Индекс", a: "web-6-db", b: "db-4-index" },
  { idea: "Кэш", a: "arch-8-cache", b: "web-8-deploy" },
  { idea: "Ашық кілт", a: "web-1-internet", b: "sec-7-rsa" },
  { idea: "Жүктеме мен кезек", a: "cloud-3-scaling", b: "net-7-congestion" },
  { idea: "XOR", a: "arch-3-gates", b: "sec-3-xor" },
  { idea: "Оқиғалар циклі", a: "game-3-loop", b: "web-4-js" },
  { idea: "SQL injection", a: "sec-8-injection", b: "web-5-backend" },
  { idea: "Деректер", a: "ai-1-data", b: "db-1-select" },
];

/** A small deterministic generator, so the sky is the same on every visit. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const seedOf = (text: string) => [...text].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);

export const SKY_RADIUS = 16;

/** Where lab i of n hangs: a ring around the North Star, gently waving up and down. */
export function labCenter(i: number, n: number): [number, number, number] {
  const a = (i / n) * Math.PI * 2;
  return [Math.cos(a) * SKY_RADIUS, Math.sin(i * 1.7) * 3, Math.sin(a) * SKY_RADIUS];
}

export function buildSky(progress: LessonProgress[]): { constellations: Constellation[]; north?: Star; bridges: (Bridge & { from: Star; to: Star })[] } {
  const prog = new Map(progress.map((p) => [p.lessonId, p]));
  const stateOf = (id: string): StarState => (prog.get(id)?.completedAt ? "done" : prog.has(id) ? "started" : "dark");
  const all = new Map<string, Star>();
  const constellations = openLabs.map((lab, i) => {
    const center = labCenter(i, openLabs.length);
    const r = rng(seedOf(lab.id));
    // A wandering chain: each lesson a step from the last, so the lab reads as one figure.
    let x = -3.6;
    const stars = lessonsForLab(lab.id).map((e, k) => {
      x += 0.8 + r() * 0.25;
      const y = Math.sin(k * 1.3 + r() * 2) * 2.1;
      const z = (r() - 0.5) * 2.2;
      // Turn the figure to face the middle of the sky.
      const a = (i / openLabs.length) * Math.PI * 2 + Math.PI / 2;
      const pos: [number, number, number] = [center[0] + Math.cos(a) * x + Math.cos(a - Math.PI / 2) * z * 0.4, center[1] + y, center[2] + Math.sin(a) * x + Math.sin(a - Math.PI / 2) * z * 0.4];
      const star: Star = { id: e.lesson.id, lab: lab.id, title: e.lesson.title, order: e.lesson.order, pos, state: stateOf(e.lesson.id) };
      all.set(star.id, star);
      return star;
    });
    return { lab: lab.id, title: lab.title, center, stars, done: stars.filter((s) => s.state === "done").length };
  });

  // Темірқазық: the lesson you left most recently, else the first unfinished lesson of a lab you began, else the very first.
  const open = progress
    .filter((p) => !p.completedAt && all.has(p.lessonId))
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
  const begun = constellations.find((c) => c.done > 0 && c.stars.some((s) => s.state !== "done"));
  const north = open ? all.get(open.lessonId) : (begun?.stars.find((s) => s.state !== "done") ?? constellations.flatMap((c) => c.stars).find((s) => s.state !== "done"));

  const bridges = BRIDGES.filter((b) => all.has(b.a) && all.has(b.b)).map((b) => ({ ...b, from: all.get(b.a)!, to: all.get(b.b)! }));
  return { constellations, north, bridges };
}

/** Every bridge must join two real lessons in two different labs. */
export function checkBridges(): string[] {
  const ids = new Map(lessonEntries.map((e) => [e.lesson.id, e.labId]));
  return BRIDGES.flatMap((b) => {
    const errs: string[] = [];
    if (!ids.has(b.a)) errs.push(`${b.idea}: no lesson ${b.a}`);
    if (!ids.has(b.b)) errs.push(`${b.idea}: no lesson ${b.b}`);
    if (ids.has(b.a) && ids.get(b.a) === ids.get(b.b)) errs.push(`${b.idea}: both ends in one lab`);
    return errs;
  });
}
