/**
 * The learner's activity by day: what kind of work, how much. It feeds the "Бүгін" page
 * (today's plan, the weekly goal, the heatmap). Kept in this browser.
 */
import { dayKey } from "./problems";

export type ActivityKind = "lesson" | "review" | "problem";
export type DayActivity = Partial<Record<ActivityKind, number>>;
export interface ActivityLog {
  days: Record<string, DayActivity>;
}

const KEY = "inside-tech:activity";
export const ACTIVITY_EVENT = "inside-tech:activity";
const KINDS: ActivityKind[] = ["lesson", "review", "problem"];

export function sanitizeActivity(raw: unknown): ActivityLog {
  const days: Record<string, DayActivity> = {};
  const src = raw && typeof raw === "object" && "days" in raw ? (raw as { days: unknown }).days : null;
  if (src && typeof src === "object") {
    for (const [k, v] of Object.entries(src as Record<string, unknown>)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !v || typeof v !== "object") continue;
      const d: DayActivity = {};
      for (const kind of KINDS) {
        const n = (v as Record<string, unknown>)[kind];
        if (typeof n === "number" && Number.isFinite(n) && n > 0) d[kind] = Math.min(9999, Math.floor(n));
      }
      if (Object.keys(d).length) days[k] = d;
    }
  }
  return { days };
}

export function addActivity(log: ActivityLog, kind: ActivityKind, at: Date): ActivityLog {
  const k = dayKey(at);
  const day = { ...(log.days[k] ?? {}) };
  day[kind] = (day[kind] ?? 0) + 1;
  // Keep a little over a year.
  const keys = Object.keys(log.days).sort().slice(-400);
  const days: Record<string, DayActivity> = {};
  for (const x of keys) days[x] = log.days[x]!;
  days[k] = day;
  return { days };
}

export function loadActivity(): ActivityLog {
  try {
    return sanitizeActivity(JSON.parse(localStorage.getItem(KEY) ?? "null"));
  } catch {
    return { days: {} };
  }
}

/** Note one piece of work done now. Safe to call anywhere in the browser. */
export function recordActivity(kind: ActivityKind) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(addActivity(loadActivity(), kind, new Date())));
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event(ACTIVITY_EVENT));
}

export const dayTotal = (d: DayActivity | undefined) => (d ? (d.lesson ?? 0) + (d.review ?? 0) + (d.problem ?? 0) : 0);
