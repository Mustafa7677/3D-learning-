import type { LessonDefinition, Objective, QuizQuestion } from "./lesson";

/**
 * Declarative lessons: everything a lesson needs, as plain JSON. Objectives
 * are conditions on the simulation state (`path`) or the assessment metrics
 * (`metric`), so authors create lessons without touching engine code.
 */
export type Op = "==" | "!=" | ">=" | "<=" | ">" | "<" | "includes" | "lengthAtLeast";

export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { path: string; op: Op; value: unknown }
  | { metric: string; op: Exclude<Op, "includes" | "lengthAtLeast">; value: number };

export interface ObjectiveSpec {
  id: string;
  text: string;
  when: Condition;
  sticky?: boolean;
}

export interface StepSpec {
  id: string;
  title: string;
  body: string;
  focus?: string;
  hints?: string[];
  /** Simulation actions dispatched when the step starts (lab-specific JSON). */
  onEnter?: unknown[];
  objectives: ObjectiveSpec[];
  /** Concept checks the learner must answer to finish the step. */
  quiz?: QuizQuestion[];
}

export interface LessonSpec {
  format: "inside-tech/lesson@1";
  id: string;
  labId: string;
  /** Which simulation runs the lesson (e.g. classifier, language, web, game). */
  kind: string;
  title: string;
  summary: string;
  estimatedMinutes: number;
  steps: StepSpec[];
}

const ID = /^[a-z0-9-]{1,64}$/;
const OPS: Op[] = ["==", "!=", ">=", "<=", ">", "<", "includes", "lengthAtLeast"];
const FORBIDDEN_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);

/** Read `a.b.0.c` from an object; undefined when any segment is missing. */
export function getPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const seg of path.split(".")) {
    if (FORBIDDEN_SEGMENTS.has(seg) || cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

function compare(actual: unknown, op: Op, expected: unknown): boolean {
  switch (op) {
    case "==":
      return JSON.stringify(actual) === JSON.stringify(expected);
    case "!=":
      return JSON.stringify(actual) !== JSON.stringify(expected);
    case ">=":
      return typeof actual === "number" && typeof expected === "number" && actual >= expected;
    case "<=":
      return typeof actual === "number" && typeof expected === "number" && actual <= expected;
    case ">":
      return typeof actual === "number" && typeof expected === "number" && actual > expected;
    case "<":
      return typeof actual === "number" && typeof expected === "number" && actual < expected;
    case "includes":
      return Array.isArray(actual) ? actual.some((x) => JSON.stringify(x) === JSON.stringify(expected)) : typeof actual === "string" && typeof expected === "string" && actual.includes(expected);
    case "lengthAtLeast":
      return (Array.isArray(actual) || typeof actual === "string") && typeof expected === "number" && actual.length >= expected;
  }
}

export function evaluateCondition(c: Condition, state: unknown, metrics: Record<string, number>): boolean {
  if ("all" in c) return c.all.every((x) => evaluateCondition(x, state, metrics));
  if ("any" in c) return c.any.some((x) => evaluateCondition(x, state, metrics));
  if ("metric" in c) return compare(metrics[c.metric], c.op, c.value);
  return compare(getPath(state, c.path), c.op, c.value);
}

export interface SpecIssue {
  where: string;
  message: string;
}

function checkCondition(c: unknown, where: string, out: SpecIssue[], depth = 0): void {
  if (depth > 6) return void out.push({ where, message: "Шарттар тым терең кірістірілген" });
  if (!c || typeof c !== "object") return void out.push({ where, message: "Шарт объект болуы керек" });
  const o = c as Record<string, unknown>;
  if ("all" in o || "any" in o) {
    const list = (o.all ?? o.any) as unknown;
    if (!Array.isArray(list) || list.length === 0) return void out.push({ where, message: "all/any бос емес тізім болуы керек" });
    list.forEach((x, i) => checkCondition(x, `${where}[${i}]`, out, depth + 1));
    return;
  }
  if (!OPS.includes(o.op as Op)) out.push({ where, message: `Белгісіз оператор: ${String(o.op)}` });
  if ("metric" in o) {
    if (typeof o.metric !== "string" || !o.metric) out.push({ where, message: "metric атауы керек" });
    if (typeof o.value !== "number") out.push({ where, message: "metric мәні сан болуы керек" });
  } else if (typeof o.path !== "string" || !/^[A-Za-z0-9_.]+$/.test(o.path) || o.path.split(".").some((s) => FORBIDDEN_SEGMENTS.has(s))) {
    out.push({ where, message: "path дұрыс емес (мысалы stats.drops)" });
  }
}

/** Validate an untrusted spec (from a file or the editor). Returns human-readable issues. */
export function validateLessonSpec(spec: unknown, knownKinds?: string[]): SpecIssue[] {
  const out: SpecIssue[] = [];
  if (!spec || typeof spec !== "object") return [{ where: "", message: "Сабақ JSON объекті болуы керек" }];
  const s = spec as Partial<LessonSpec>;
  if (s.format !== "inside-tech/lesson@1") out.push({ where: "format", message: "format: inside-tech/lesson@1 болуы керек" });
  if (typeof s.id !== "string" || !ID.test(s.id)) out.push({ where: "id", message: "id: кіші латын әріптері, сандар және сызықша" });
  if (typeof s.title !== "string" || !s.title.trim() || s.title.length > 80) out.push({ where: "title", message: "Тақырып керек (80 таңбаға дейін)" });
  if (typeof s.kind !== "string" || (knownKinds && !knownKinds.includes(s.kind))) out.push({ where: "kind", message: `Симуляция түрі: ${knownKinds?.join(", ") ?? "?"}` });
  if (typeof s.labId !== "string" || !ID.test(s.labId)) out.push({ where: "labId", message: "labId керек" });
  if (!Array.isArray(s.steps) || s.steps.length === 0 || s.steps.length > 12) out.push({ where: "steps", message: "1–12 кезең болуы керек" });
  const stepIds = new Set<string>();
  (Array.isArray(s.steps) ? s.steps : []).forEach((st, i) => {
    const w = `steps[${i}]`;
    if (!st || typeof st !== "object") return void out.push({ where: w, message: "Кезең объект болуы керек" });
    if (typeof st.id !== "string" || !ID.test(st.id)) out.push({ where: `${w}.id`, message: "Кезең id дұрыс емес" });
    else if (stepIds.has(st.id)) out.push({ where: `${w}.id`, message: `Қайталанған кезең id: ${st.id}` });
    else stepIds.add(st.id);
    if (typeof st.title !== "string" || !st.title.trim()) out.push({ where: `${w}.title`, message: "Кезең тақырыбы керек" });
    if (typeof st.body !== "string" || st.body.length > 4000) out.push({ where: `${w}.body`, message: "Мәтін керек (4000 таңбаға дейін)" });
    if (st.onEnter !== undefined && (!Array.isArray(st.onEnter) || st.onEnter.length > 20 || st.onEnter.some((a) => !a || typeof a !== "object" || typeof (a as { type?: unknown }).type !== "string")))
      out.push({ where: `${w}.onEnter`, message: "onEnter: { type: ... } әрекеттерінің тізімі" });
    if (!Array.isArray(st.objectives) || st.objectives.length === 0 || st.objectives.length > 8) out.push({ where: `${w}.objectives`, message: "1–8 тапсырма болуы керек" });
    if (st.quiz !== undefined) {
      if (!Array.isArray(st.quiz) || st.quiz.length > 6) out.push({ where: `${w}.quiz`, message: "Сұрақтар тізімі (6-ға дейін)" });
      const qIds = new Set<string>();
      (Array.isArray(st.quiz) ? st.quiz : []).forEach((q, k) => {
        const qw = `${w}.quiz[${k}]`;
        if (typeof q?.id !== "string" || !ID.test(q.id) || qIds.has(q.id)) out.push({ where: `${qw}.id`, message: "Сұрақ id дұрыс емес не қайталанған" });
        else qIds.add(q.id);
        if (typeof q?.question !== "string" || !q.question.trim() || q.question.length > 300) out.push({ where: `${qw}.question`, message: "Сұрақ мәтіні керек (300 таңбаға дейін)" });
        const opts = q?.options as unknown;
        if (!Array.isArray(opts) || opts.length < 2 || opts.length > 6 || opts.some((o) => typeof o !== "string" || !o.trim()))
          out.push({ where: `${qw}.options`, message: "2–6 бос емес жауап нұсқасы керек" });
        else if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= opts.length) out.push({ where: `${qw}.answer`, message: "Дұрыс жауап нұсқалардың бірі болуы керек" });
        if (typeof q?.explain !== "string" || !q.explain.trim()) out.push({ where: `${qw}.explain`, message: "Түсіндірме керек: неге бұл жауап дұрыс" });
      });
    }
    const objIds = new Set<string>();
    (Array.isArray(st.objectives) ? st.objectives : []).forEach((o, j) => {
      const ow = `${w}.objectives[${j}]`;
      if (typeof o?.id !== "string" || !ID.test(o.id) || objIds.has(o.id)) out.push({ where: `${ow}.id`, message: "Тапсырма id дұрыс емес не қайталанған" });
      else objIds.add(o.id);
      if (typeof o?.text !== "string" || !o.text.trim()) out.push({ where: `${ow}.text`, message: "Тапсырма мәтіні керек" });
      checkCondition(o?.when, `${ow}.when`, out);
    });
  });
  return out;
}

/** Turn a validated spec into a runnable lesson. */
export function compileLesson<S, A>(spec: LessonSpec, order = 100): LessonDefinition<S, A> {
  return {
    id: spec.id,
    labId: spec.labId,
    order,
    title: spec.title,
    summary: spec.summary,
    estimatedMinutes: spec.estimatedMinutes,
    steps: spec.steps.map((st) => ({
      id: st.id,
      title: st.title,
      body: st.body,
      focus: st.focus,
      hints: st.hints,
      quiz: st.quiz?.map((q) => ({ id: q.id, question: q.question, options: [...q.options], answer: q.answer, explain: q.explain, wrongHint: q.wrongHint })),
      onEnter: st.onEnter as A[] | undefined,
      objectives: st.objectives.map(
        (o): Objective<S> => ({
          id: o.id,
          text: o.text,
          sticky: o.sticky,
          check: (state, ctx) => evaluateCondition(o.when, state, ctx.assessment.metrics),
        }),
      ),
    })),
  };
}

/**
 * Pack a spec into a URL-safe string (UTF-8 → base64url) so a lesson can be
 * shared as a link without a server. Decoding never trusts the input: callers
 * must still run validateLessonSpec on the result.
 */
export function encodeLessonSpec(spec: LessonSpec): string {
  const bytes = new TextEncoder().encode(JSON.stringify(spec));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeLessonSpec(text: string): unknown {
  try {
    const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return undefined;
  }
}
