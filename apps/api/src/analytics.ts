import type { SessionEvent } from "./store";

export interface SessionSummary {
  /** Time from the first to the last event, ms. */
  totalMs: number;
  /** Time spent in each step (from entering it until it was done or left), ms. */
  stepMs: Record<string, number>;
  /** Wrong answers per "step/question". */
  wrong: Record<string, number>;
  undos: number;
  restarts: number;
  stepsDone: string[];
}

/** Turn a session's event log into the numbers a teacher reads. */
export function summarize(events: SessionEvent[]): SessionSummary {
  const ev = [...events].sort((a, b) => a.t - b.t);
  const stepMs: Record<string, number> = {};
  const wrong: Record<string, number> = {};
  const stepsDone: string[] = [];
  let undos = 0;
  let restarts = 0;
  let cur: { step: string; since: number } | null = null;
  const close = (t: number) => {
    if (cur) stepMs[cur.step] = (stepMs[cur.step] ?? 0) + Math.max(0, t - cur.since);
    cur = null;
  };
  for (const e of ev) {
    if (e.type === "enter") {
      close(e.t);
      cur = { step: e.step, since: e.t };
    } else if (e.type === "done") {
      if (cur?.step === e.step) close(e.t);
      if (!stepsDone.includes(e.step)) stepsDone.push(e.step);
    } else if (e.type === "wrong") {
      const k = `${e.step}/${e.q ?? "?"}`;
      wrong[k] = (wrong[k] ?? 0) + 1;
    } else if (e.type === "undo") undos++;
    else if (e.type === "restart") restarts++;
  }
  const last = ev.at(-1)?.t ?? 0;
  close(last);
  return { totalMs: ev.length ? last - ev[0]!.t : 0, stepMs, wrong, undos, restarts, stepsDone };
}

/** Questions the class got wrong most often, worst first. */
export function hardest(summaries: SessionSummary[], top = 5): { key: string; wrong: number; learners: number }[] {
  const agg = new Map<string, { wrong: number; learners: number }>();
  for (const s of summaries)
    for (const [k, n] of Object.entries(s.wrong)) {
      const a = agg.get(k) ?? { wrong: 0, learners: 0 };
      a.wrong += n;
      a.learners += 1;
      agg.set(k, a);
    }
  return [...agg].map(([key, v]) => ({ key, ...v })).sort((a, b) => b.wrong - a.wrong || b.learners - a.learners).slice(0, top);
}
