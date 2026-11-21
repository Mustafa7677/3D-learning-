import type { MissionFix, SegmentId } from "@inside-tech/lab-web";
import { solveChallenge } from "./challenges";

/** One measurement the learner made: which scenario, with which fix, how long. */
export interface Measure {
  scenario: string;
  fix: MissionFix;
  totalMs: number;
}

/** The learner's work on the mission, kept apart from "done" so it can be reopened. */
export interface MissionWork {
  version: 1;
  stage: number;
  /** Stages the learner has reached (the stepper only lets you go back to these). */
  reached: number;
  hypothesis?: SegmentId;
  fix?: Exclude<MissionFix, "none">;
  /** Fixes tried in the counter-test, in order. */
  tried: Exclude<MissionFix, "none">[];
  measures: Measure[];
  report: { before?: string; after?: string; text: string };
  done: boolean;
}

export const MISSION_KEY = "inside-tech:mission:school";
export const STAGES = 6;
const SEGS: SegmentId[] = ["dns", "connect", "server", "download"];
const FIXES = ["resize", "cache"] as const;

export const freshWork = (): MissionWork => ({ version: 1, stage: 0, reached: 0, tried: [], measures: [], report: { text: "" }, done: false });

export const measureKey = (m: Pick<Measure, "scenario" | "fix">) => `${m.scenario}:${m.fix}`;

/** Read saved work; anything malformed is dropped rather than trusted. */
export function loadWork(): MissionWork {
  const w = freshWork();
  try {
    const raw = JSON.parse(localStorage.getItem(MISSION_KEY) ?? "null") as Partial<MissionWork> | null;
    if (!raw || typeof raw !== "object" || raw.version !== 1) return w;
    const int = (v: unknown, max: number) => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v < max ? v : 0);
    w.reached = int(raw.reached, STAGES);
    w.stage = Math.min(int(raw.stage, STAGES), w.reached);
    if (SEGS.includes(raw.hypothesis as SegmentId)) w.hypothesis = raw.hypothesis as SegmentId;
    if (FIXES.includes(raw.fix as never)) w.fix = raw.fix as MissionWork["fix"];
    if (Array.isArray(raw.tried)) w.tried = raw.tried.filter((f): f is MissionWork["tried"][number] => FIXES.includes(f as never)).slice(0, 4);
    if (Array.isArray(raw.measures))
      w.measures = raw.measures
        .filter((m) => m && typeof m.scenario === "string" && ["none", ...FIXES].includes(m.fix) && typeof m.totalMs === "number" && Number.isFinite(m.totalMs))
        .slice(0, 20)
        .map((m) => ({ scenario: m.scenario.slice(0, 24), fix: m.fix, totalMs: m.totalMs }));
    const keys = new Set(w.measures.map(measureKey));
    const r = raw.report;
    if (r && typeof r === "object") {
      w.report = {
        before: typeof r.before === "string" && keys.has(r.before) ? r.before : undefined,
        after: typeof r.after === "string" && keys.has(r.after) ? r.after : undefined,
        text: typeof r.text === "string" ? r.text.slice(0, 1200) : "",
      };
    }
    w.done = raw.done === true && !!w.report.before && !!w.report.after;
  } catch {
    /* storage unavailable or corrupt: a fresh start */
  }
  return w;
}

export function saveWork(w: MissionWork) {
  try {
    localStorage.setItem(MISSION_KEY, JSON.stringify(w));
  } catch {
    /* storage unavailable */
  }
}

/** Mark the mission done once; it pays the challenge XP. */
export const finishMission = () => solveChallenge("mission-school");
