import { api, apiEnabled } from "./api";

export interface SessionEvent {
  t: number;
  type: "enter" | "done" | "wrong" | "right" | "undo" | "restart";
  step: string;
  q?: string;
  o?: number;
}

const MAX_EVENTS = 600;
/** Recordings above this size are not uploaded (the event log still is). */
const MAX_RECORDING_CHARS = 400_000;

/**
 * What happened in one lesson session, for the teacher's analytics: steps
 * entered and finished, answers, undos and restarts, with times.
 */
export class SessionLog {
  private readonly start = Date.now();
  readonly events: SessionEvent[] = [];

  push(type: SessionEvent["type"], step: string, extra: { q?: string; o?: number } = {}) {
    if (this.events.length >= MAX_EVENTS) return;
    this.events.push({ t: Date.now() - this.start, type, step, ...extra });
  }

  /** Send the log (and the simulation journal, when small enough) to the API. Never throws. */
  async upload(lessonId: string, kind: string, recording?: unknown, keepalive = false): Promise<void> {
    if (!apiEnabled || this.events.length === 0) return;
    // Leave "recording" out to keep the replay already on the server.
    const body: Record<string, unknown> = { kind, events: this.events };
    if (recording !== undefined) body.recording = JSON.stringify(recording).length <= MAX_RECORDING_CHARS ? recording : null;
    try {
      await api<void>(`/v1/sessions/${encodeURIComponent(lessonId)}`, {
        method: "PUT",
        keepalive,
        body: JSON.stringify(body),
      });
    } catch {
      /* analytics are best-effort */
    }
  }
}
