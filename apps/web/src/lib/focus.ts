/**
 * Фокус: a deep-work session with a timer. Before it, an intention; during it, a parking
 * place for stray thoughts; after it, one sentence of what was learned and a short break.
 * One session can be active at a time; it lives in the browser and survives navigation,
 * so a learner can start it here and study in a lesson while the header counts down.
 */
import { dayKey } from "./problems";

export interface FocusSession {
  id: string;
  intention: string;
  plannedMin: number;
  startedAt: number;
  /** Set while paused. */
  pausedAt?: number;
  /** Total paused time so far. */
  pausedMs: number;
  pauses: number;
  /** Times the learner left the tab during the session. */
  leaves: number;
  /** Thoughts parked during the session. */
  parked: string[];
  endedAt?: number;
  /** Minutes actually focused (planned length unless stopped early). */
  focusedMin?: number;
  learned?: string;
  rating?: number;
}

export const DURATIONS = [15, 25, 45] as const;
export const BREAK_MIN: Record<number, number> = { 15: 3, 25: 5, 45: 10 };

const ACTIVE = "inside-tech:focus-active";
const HISTORY = "inside-tech:focus";
export const FOCUS_EVENT = "inside-tech:focus";

export function newSession(intention: string, plannedMin: number, now: number): FocusSession {
  return { id: `f${now}`, intention: intention.trim().slice(0, 140), plannedMin, startedAt: now, pausedMs: 0, pauses: 0, leaves: 0, parked: [] };
}

/** Milliseconds of focus so far. */
export function elapsedMs(s: FocusSession, now: number): number {
  const end = s.endedAt ?? s.pausedAt ?? now;
  return Math.max(0, end - s.startedAt - s.pausedMs);
}

export function remainingMs(s: FocusSession, now: number): number {
  return Math.max(0, s.plannedMin * 60000 - elapsedMs(s, now));
}

export const isDone = (s: FocusSession, now: number) => remainingMs(s, now) === 0;

export function pause(s: FocusSession, now: number): FocusSession {
  return s.pausedAt ? s : { ...s, pausedAt: now, pauses: s.pauses + 1 };
}
export function resume(s: FocusSession, now: number): FocusSession {
  return s.pausedAt ? { ...s, pausedMs: s.pausedMs + (now - s.pausedAt), pausedAt: undefined } : s;
}

/** Close the session: the focused minutes are what was actually spent, rounded down. */
export function finish(s: FocusSession, now: number): FocusSession {
  const r = resume(s, now);
  return { ...r, endedAt: now, focusedMin: Math.min(s.plannedMin, Math.floor(elapsedMs({ ...r, endedAt: now }, now) / 60000)) };
}

export function clock(ms: number): string {
  const t = Math.ceil(ms / 1000);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/** Focused minutes per day key. */
export function minutesByDay(history: FocusSession[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of history) {
    if (!s.endedAt || !s.focusedMin) continue;
    const k = dayKey(new Date(s.startedAt));
    out[k] = (out[k] ?? 0) + s.focusedMin;
  }
  return out;
}

/** The last seven days, oldest first, with focused minutes. */
export function focusWeek(history: FocusSession[], now: Date): { key: string; min: number; today: boolean }[] {
  const by = minutesByDay(history);
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const k = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i));
    out.push({ key: k, min: by[k] ?? 0, today: i === 0 });
  }
  return out;
}

// ---------------------------------------------------------------- storage

function clean(v: unknown): FocusSession | null {
  if (!v || typeof v !== "object") return null;
  const s = v as Record<string, unknown>;
  const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : undefined);
  if (typeof s.id !== "string" || !num(s.startedAt) || !DURATIONS.includes(s.plannedMin as never)) return null;
  return {
    id: s.id,
    intention: typeof s.intention === "string" ? s.intention.slice(0, 140) : "",
    plannedMin: s.plannedMin as number,
    startedAt: s.startedAt as number,
    pausedAt: num(s.pausedAt),
    pausedMs: Math.max(0, num(s.pausedMs) ?? 0),
    pauses: Math.max(0, num(s.pauses) ?? 0),
    leaves: Math.max(0, num(s.leaves) ?? 0),
    parked: Array.isArray(s.parked) ? s.parked.filter((x): x is string => typeof x === "string").slice(0, 30).map((x) => x.slice(0, 200)) : [],
    endedAt: num(s.endedAt),
    focusedMin: num(s.focusedMin),
    learned: typeof s.learned === "string" ? s.learned.slice(0, 500) : undefined,
    rating: num(s.rating),
  };
}

export function loadActive(): FocusSession | null {
  try {
    return clean(JSON.parse(localStorage.getItem(ACTIVE) ?? "null"));
  } catch {
    return null;
  }
}

export function saveActive(s: FocusSession | null) {
  try {
    if (s) localStorage.setItem(ACTIVE, JSON.stringify(s));
    else localStorage.removeItem(ACTIVE);
  } catch {
    /* storage unavailable */
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(FOCUS_EVENT));
}

export function loadHistory(): FocusSession[] {
  try {
    const v = JSON.parse(localStorage.getItem(HISTORY) ?? "[]");
    return Array.isArray(v) ? (v.map(clean).filter(Boolean) as FocusSession[]) : [];
  } catch {
    return [];
  }
}

export function saveToHistory(s: FocusSession) {
  try {
    const all = loadHistory().filter((x) => x.id !== s.id);
    localStorage.setItem(HISTORY, JSON.stringify([...all, s].slice(-200)));
  } catch {
    /* storage unavailable */
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(FOCUS_EVENT));
}
