/**
 * Black box: a device with two switches and a lamp whose wiring is hidden.
 * The learner experiments, then builds a circuit from AND, OR and NOT that
 * must behave the same on all four inputs. Pure logic, no UI.
 */
import { gate } from "./logic";

export type BoxId = "pair" | "alarm" | "corridor";
export type PartType = "AND" | "OR" | "NOT";
export const PART_TYPES: PartType[] = ["AND", "OR", "NOT"];

/** A gate the learner placed. Inputs are "A", "B" or the id of an earlier part. */
export interface Part {
  id: string;
  type: PartType;
  in: [string, string];
}

/** The learner's circuit: parts in order, and what drives the lamp. */
export interface Build {
  parts: Part[];
  /** "A", "B" or a part id. */
  out: string;
}

export interface BoxSpec {
  id: BoxId;
  title: string;
  /** What the learner sees: the story of the device. */
  story: string;
  /** What the switches mean in this story. */
  labels: { A: string; B: string; lamp: string };
  /** The hidden rule. */
  rule: (a: number, b: number) => number;
  /** The wiring inside, revealed when solved. */
  inside: Build;
  /** The formula, shown only after the box is opened. */
  formula: string;
  /** One concrete conclusion, shown next to both circuits. */
  conclusion: string;
  /** Two-step help: a useful experiment, then the pattern in the table. */
  hints: [string, string];
}

export const TASK = "Шам қай кезде жанатынын анықта. Содан кейін дәл солай жұмыс істейтін сұлба құрастыр.";

export const BOXES: BoxSpec[] = [
  {
    id: "pair",
    title: "Қос кілт",
    story: "Сейфтің екі операторы бар, әрқайсысында бір қосқыш. Құлып қашан ашылады?",
    labels: { A: "1-оператор", B: "2-оператор", lamp: "Құлып ашық" },
    rule: (a, b) => a & b,
    inside: { parts: [{ id: "g1", type: "AND", in: ["A", "B"] }], out: "g1" },
    formula: "Шам = A AND B",
    conclusion: "Құлып екі оператор да кілтін бұрғанда ғана ашылады. Бұл AND: екі кіріс те 1 болса ғана шығыс 1.",
    hints: ["Тек бір қосқышты қосып көр: құлып ашыла ма?", "Кестеде шам жанған жолдарды қара: олардың бәрінде A мен B қандай?"],
  },
  {
    id: "alarm",
    title: "Күзет сигналы",
    story: "A: қозғалыс датчигі. B: күзетті уақытша өшіретін қызметтік режим. Дабыл қашан іске қосылады?",
    labels: { A: "Қозғалыс", B: "Қызметтік режим", lamp: "Дабыл" },
    rule: (a, b) => a & (1 - b),
    inside: {
      parts: [
        { id: "g1", type: "NOT", in: ["B", "B"] },
        { id: "g2", type: "AND", in: ["A", "g1"] },
      ],
      out: "g2",
    },
    formula: "Шам = A AND NOT B",
    conclusion: "Дабыл қозғалыс бар және қызметтік режим өшік кезде ғана іске қосылады. NOT режимді керісінше айналдырады, AND оны қозғалыспен біріктіреді.",
    hints: ["Қозғалысты қосып, сосын қызметтік режимді қосып көр: дабыл не істейді?", "Шам жанған жалғыз жолда B қандай? NOT элементі 0-ді 1-ге айналдырады."],
  },
  {
    id: "corridor",
    title: "Дәліз шамы",
    story: "Дәліздің екі шетінде бір-бір қосқыш бар. Кез келген бір қосқышты ауыстырсаң, шам күйін өзгертеді.",
    labels: { A: "Сол жақ қосқыш", B: "Оң жақ қосқыш", lamp: "Дәліз шамы" },
    rule: (a, b) => a ^ b,
    inside: {
      parts: [
        { id: "g1", type: "OR", in: ["A", "B"] },
        { id: "g2", type: "AND", in: ["A", "B"] },
        { id: "g3", type: "NOT", in: ["g2", "g2"] },
        { id: "g4", type: "AND", in: ["g1", "g3"] },
      ],
      out: "g4",
    },
    formula: "Шам = A XOR B = (A OR B) AND NOT (A AND B)",
    conclusion: "Сен жасаған сұлба да екі қосқыштың дәл біреуі қосылғанда шамды жағады. Бұл әрекет XOR деп аталады.",
    hints: ["Екі қосқышты да қосып көр. Сосын біреуін ғана өшір.", "Кестеде шам «біреуі қосулы» жолдарда жанады, ал «екеуі де» жолда сөнеді. Мұны OR, AND және NOT арқылы жаз."],
  },
];

export const findBox = (id: string) => BOXES.find((b) => b.id === id);

export const INPUTS: [number, number][] = [
  [0, 0],
  [0, 1],
  [1, 0],
  [1, 1],
];

/** Every node's value (A, B and each part) for one input. */
export function nodeValues(build: Build, a: number, b: number): Record<string, number> {
  const v: Record<string, number> = { A: a, B: b };
  for (const p of build.parts) {
    const x = v[p.in[0]] ?? 0;
    const y = v[p.in[1]] ?? 0;
    v[p.id] = gate(p.type, x, y);
  }
  return v;
}

/** The lamp of a build for one input. */
export const lampOf = (build: Build, a: number, b: number) => nodeValues(build, a, b)[build.out] ?? 0;

export interface Counter {
  a: number;
  b: number;
  mine: number;
  box: number;
}

export type Verdict = { ok: true } | { ok: false; counter: Counter };

/** Compare the learner's build with the box on all four inputs; the first difference is the counterexample. */
export function check(build: Build, box: BoxSpec): Verdict {
  for (const [a, b] of INPUTS) {
    const mine = lampOf(build, a, b);
    const want = box.rule(a, b);
    if (mine !== want) return { ok: false, counter: { a, b, mine, box: want } };
  }
  return { ok: true };
}

/** "A=1, B=1 кезінде сенің шамың жанды, жәшіктің шамы сөнді." */
export function describeCounter(c: Counter): string {
  const s = (v: number) => (v ? "жанды" : "сөнді");
  return `A=${c.a}, B=${c.b} кезінде сенің шамың ${s(c.mine)}, жәшіктің шамы ${s(c.box)}.`;
}

/** The expression a build computes, e.g. "(A OR B) AND NOT (A AND B)". */
export function expression(build: Build, node = build.out): string {
  const byId = new Map(build.parts.map((p) => [p.id, p]));
  const walk = (id: string, top: boolean): string => {
    const p = byId.get(id);
    if (!p) return id;
    if (p.type === "NOT") {
      const inner = walk(p.in[0], false);
      return `NOT ${inner}`;
    }
    const e = `${walk(p.in[0], false)} ${p.type} ${walk(p.in[1], false)}`;
    return top ? e : `(${e})`;
  };
  return walk(node, true);
}

/** Inputs a part may use: A, B and the parts before it (so the circuit has no loops). */
export function sourcesFor(build: Build, index: number): string[] {
  return ["A", "B", ...build.parts.slice(0, index).map((p) => p.id)];
}

/** A fresh part id that is not taken yet. */
export function nextId(build: Build): string {
  let n = build.parts.length + 1;
  while (build.parts.some((p) => p.id === `g${n}`)) n++;
  return `g${n}`;
}

/** Add a part fed by the newest signal; the lamp moves to it. */
export function addPart(build: Build, type: PartType): Build {
  const id = nextId(build);
  const last = build.parts.at(-1)?.id;
  const part: Part = { id, type, in: type === "NOT" ? [last ?? "A", last ?? "A"] : [last ?? "A", last ? "A" : "B"] };
  return { parts: [...build.parts, part], out: id };
}

/** Remove a part; anything that used it falls back to A. */
export function removePart(build: Build, id: string): Build {
  const parts = build.parts
    .filter((p) => p.id !== id)
    .map((p) => ({ ...p, in: p.in.map((s) => (s === id ? "A" : s)) as [string, string] }));
  const out = build.out === id ? (parts.at(-1)?.id ?? "A") : build.out;
  return { parts, out };
}

/** Keep only what is valid: known types, inputs that point backwards, a lamp on a real node. */
export function sanitize(raw: unknown): Build {
  const empty: Build = { parts: [], out: "A" };
  if (!raw || typeof raw !== "object") return empty;
  const r = raw as { parts?: unknown; out?: unknown };
  const parts: Part[] = [];
  if (Array.isArray(r.parts)) {
    for (const p of r.parts.slice(0, 12)) {
      if (!p || typeof p !== "object") continue;
      const q = p as { id?: unknown; type?: unknown; in?: unknown };
      if (typeof q.id !== "string" || !/^g\d{1,3}$/.test(q.id) || parts.some((x) => x.id === q.id)) continue;
      if (!PART_TYPES.includes(q.type as PartType)) continue;
      const ok = ["A", "B", ...parts.map((x) => x.id)];
      const ins = Array.isArray(q.in) ? q.in : [];
      const pick = (s: unknown) => (typeof s === "string" && ok.includes(s) ? s : "A");
      parts.push({ id: q.id, type: q.type as PartType, in: [pick(ins[0]), pick(ins[1])] });
    }
  }
  const nodes = ["A", "B", ...parts.map((p) => p.id)];
  const out = typeof r.out === "string" && nodes.includes(r.out) ? r.out : (parts.at(-1)?.id ?? "A");
  return { parts, out };
}
