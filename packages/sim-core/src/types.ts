/** Result of grading the current simulation state. */
export interface AssessmentResult {
  /** 0..1 overall score. */
  score: number;
  /** Named numeric metrics, e.g. { accuracy: 0.93, loss: 0.12 }. */
  metrics: Record<string, number>;
  /** Human-readable notes (diagnostics, misconceptions detected). */
  notes: string[];
}

/**
 * Contract every lab implements. A plugin is a pure state machine:
 * no I/O, no wall clock, no Math.random — all randomness comes from the
 * seed stored in state. This makes snapshots, replay and grading exact.
 */
export interface SimulationPlugin<State, Action> {
  id: string;
  version: string;
  initialize(seed: number): State;
  dispatch(state: State, action: Action): State;
  step(state: State, dt: number): State;
  snapshot(state: State): unknown;
  restore(snapshot: unknown): State;
  evaluate(state: State): AssessmentResult;
}

export type StateOf<P> = P extends SimulationPlugin<infer S, unknown> ? S : never;
export type ActionOf<P> = P extends SimulationPlugin<unknown, infer A> ? A : never;
