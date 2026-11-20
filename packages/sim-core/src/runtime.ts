import { EventBus } from "./event-bus";
import type { AssessmentResult, SimulationPlugin } from "./types";

/** One entry of the action journal. `tick` is the fixed-step index when it was applied. */
export interface JournalEntry<Action> {
  tick: number;
  action: Action;
}

export interface Recording<Action> {
  pluginId: string;
  pluginVersion: string;
  seed: number;
  fixedDt: number;
  ticks: number;
  journal: JournalEntry<Action>[];
}

export type RuntimeEvents<State, Action> = {
  state: { state: State; tick: number };
  action: { action: Action; tick: number };
  assessment: AssessmentResult;
};

export interface RuntimeOptions {
  /** Fixed simulation timestep in seconds. Default 1/60. */
  fixedDt?: number;
  /** Max fixed steps per advance() call, guards against spiral of death. */
  maxStepsPerFrame?: number;
  /** Keep an undo checkpoint every N actions. Default 1 (every action). */
  checkpointEvery?: number;
  /** Max checkpoints retained. Default 200. */
  maxCheckpoints?: number;
}

interface Checkpoint {
  tick: number;
  journalLength: number;
  snapshot: unknown;
}

/**
 * Drives a SimulationPlugin with a fixed timestep, journals every action
 * (so any session can be replayed bit-exactly from its seed) and keeps
 * snapshots for undo/rewind.
 */
export class SimulationRuntime<State, Action> {
  readonly bus = new EventBus<RuntimeEvents<State, Action>>();
  private state: State;
  private tick = 0;
  private accumulator = 0;
  private journal: JournalEntry<Action>[] = [];
  private checkpoints: Checkpoint[] = [];
  private actionsSinceCheckpoint = 0;
  private readonly fixedDt: number;
  private readonly maxStepsPerFrame: number;
  private readonly checkpointEvery: number;
  private readonly maxCheckpoints: number;

  constructor(
    readonly plugin: SimulationPlugin<State, Action>,
    readonly seed: number,
    opts: RuntimeOptions = {},
  ) {
    this.fixedDt = opts.fixedDt ?? 1 / 60;
    this.maxStepsPerFrame = opts.maxStepsPerFrame ?? 8;
    this.checkpointEvery = opts.checkpointEvery ?? 1;
    this.maxCheckpoints = opts.maxCheckpoints ?? 200;
    this.state = plugin.initialize(seed);
  }

  getState(): State {
    return this.state;
  }

  getTick(): number {
    return this.tick;
  }

  canUndo(): boolean {
    return this.checkpoints.length > 0;
  }

  dispatch(action: Action): State {
    if (this.actionsSinceCheckpoint === 0 || this.actionsSinceCheckpoint >= this.checkpointEvery) {
      this.pushCheckpoint();
      this.actionsSinceCheckpoint = 0;
    }
    this.actionsSinceCheckpoint++;
    this.journal.push({ tick: this.tick, action });
    this.state = this.plugin.dispatch(this.state, action);
    this.bus.emit("action", { action, tick: this.tick });
    this.publish();
    return this.state;
  }

  /** Advance by real elapsed seconds; runs zero or more fixed steps. Returns steps run. */
  advance(elapsed: number): number {
    this.accumulator += Math.max(0, elapsed);
    let steps = 0;
    while (this.accumulator + 1e-9 >= this.fixedDt && steps < this.maxStepsPerFrame) {
      this.state = this.plugin.step(this.state, this.fixedDt);
      this.tick++;
      this.accumulator = Math.max(0, this.accumulator - this.fixedDt);
      steps++;
    }
    if (steps === this.maxStepsPerFrame) this.accumulator = 0;
    if (steps > 0) this.publish();
    return steps;
  }

  /** Run exactly `n` fixed steps (used by tests, replay and headless grading). */
  stepTicks(n: number): State {
    for (let i = 0; i < n; i++) {
      this.state = this.plugin.step(this.state, this.fixedDt);
      this.tick++;
    }
    if (n > 0) this.publish();
    return this.state;
  }

  /** Revert the most recent checkpointed action group. */
  undo(): boolean {
    const cp = this.checkpoints.pop();
    if (!cp) return false;
    this.state = this.plugin.restore(cp.snapshot);
    this.tick = cp.tick;
    this.journal.length = cp.journalLength;
    this.actionsSinceCheckpoint = 0;
    this.publish();
    return true;
  }

  reset(): void {
    this.state = this.plugin.initialize(this.seed);
    this.tick = 0;
    this.accumulator = 0;
    this.journal = [];
    this.checkpoints = [];
    this.actionsSinceCheckpoint = 0;
    this.publish();
  }

  evaluate(): AssessmentResult {
    const result = this.plugin.evaluate(this.state);
    this.bus.emit("assessment", result);
    return result;
  }

  record(): Recording<Action> {
    return {
      pluginId: this.plugin.id,
      pluginVersion: this.plugin.version,
      seed: this.seed,
      fixedDt: this.fixedDt,
      ticks: this.tick,
      journal: structuredClone(this.journal),
    };
  }

  private pushCheckpoint(): void {
    this.checkpoints.push({
      tick: this.tick,
      journalLength: this.journal.length,
      snapshot: this.plugin.snapshot(this.state),
    });
    if (this.checkpoints.length > this.maxCheckpoints) this.checkpoints.shift();
  }

  private publish(): void {
    this.bus.emit("state", { state: this.state, tick: this.tick });
  }
}

/**
 * Re-run a recording headlessly. Returns the final state; because plugins are
 * deterministic, this equals the state the learner ended with.
 * `onFrame` is called after every tick/action for scrubbing UIs.
 */
export function replay<State, Action>(
  plugin: SimulationPlugin<State, Action>,
  rec: Recording<Action>,
  onFrame?: (state: State, tick: number) => void,
): State {
  if (rec.pluginId !== plugin.id) {
    throw new Error(`Recording is for plugin "${rec.pluginId}", not "${plugin.id}"`);
  }
  let state = plugin.initialize(rec.seed);
  let tick = 0;
  let i = 0;
  const dt = rec.fixedDt;
  while (tick <= rec.ticks) {
    while (i < rec.journal.length && rec.journal[i]!.tick === tick) {
      state = plugin.dispatch(state, rec.journal[i]!.action);
      i++;
      onFrame?.(state, tick);
    }
    if (tick === rec.ticks) break;
    state = plugin.step(state, dt);
    tick++;
    onFrame?.(state, tick);
  }
  return state;
}
