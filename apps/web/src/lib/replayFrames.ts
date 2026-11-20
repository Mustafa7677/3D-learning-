import type { Recording, SimulationPlugin } from "@inside-tech/sim-core";
import type { LessonDefinition } from "@inside-tech/lesson-engine";

export interface ReplayFrame {
  /** Seconds since the session started (simulation time). */
  time: number;
  action: unknown;
  /** Objective ids that hold right after this action, per step id. */
  holds: Record<string, string[]>;
}

/** Hard stop for runaway recordings (e.g. hours of idle ticks). */
const MAX_TICKS = 200_000;

/**
 * Re-run a recorded session and note, after every action, which of the
 * lesson's objectives hold. Same loop as sim-core's `replay`.
 */
export function replayFrames<S, A>(plugin: SimulationPlugin<S, A>, rec: Recording<A>, lesson: LessonDefinition<S, A>): ReplayFrame[] {
  if (rec.pluginId !== plugin.id) throw new Error(`Recording is for "${rec.pluginId}", not "${plugin.id}"`);
  let state = plugin.initialize(rec.seed);
  const frames: ReplayFrame[] = [];
  let i = 0;
  const end = Math.min(rec.ticks, MAX_TICKS);
  for (let tick = 0; tick <= end; tick++) {
    while (i < rec.journal.length && rec.journal[i]!.tick === tick) {
      const action = rec.journal[i]!.action;
      state = plugin.dispatch(state, action);
      i++;
      const assessment = plugin.evaluate(state);
      const holds: Record<string, string[]> = {};
      for (const step of lesson.steps) {
        const ok = step.objectives.filter((o) => {
          try {
            return o.check(state, { assessment });
          } catch {
            return false;
          }
        });
        if (ok.length) holds[step.id] = ok.map((o) => o.id);
      }
      frames.push({ time: tick * rec.fixedDt, action, holds });
    }
    if (tick === end) break;
    state = plugin.step(state, rec.fixedDt);
  }
  return frames;
}
