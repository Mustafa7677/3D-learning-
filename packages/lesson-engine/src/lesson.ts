import type { AssessmentResult } from "@inside-tech/sim-core";

export interface ObjectiveContext {
  assessment: AssessmentResult;
}

/** A gradable goal. `check` is evaluated against the live simulation state. */
export interface Objective<S> {
  id: string;
  text: string;
  check(state: S, ctx: ObjectiveContext): boolean;
  /**
   * Sticky objectives stay completed once met (for "observe X" goals).
   * Non-sticky objectives must hold at the moment the step is completed.
   * Default: true.
   */
  sticky?: boolean;
}

export interface LessonStep<S, A = unknown> {
  id: string;
  title: string;
  /** Explanation shown to the learner (plain text, paragraphs separated by blank lines). */
  body: string;
  objectives: Objective<S>[];
  hints?: string[];
  /** Scene anchor id the camera should focus on for this step. */
  focus?: string;
  /** Actions dispatched when the step is entered (e.g. load a dataset). */
  onEnter?: A[];
}

export interface LessonDefinition<S, A = unknown> {
  id: string;
  labId: string;
  order: number;
  title: string;
  summary: string;
  /** Minutes, for the catalogue. */
  estimatedMinutes: number;
  steps: LessonStep<S, A>[];
}

export interface LessonProgress {
  lessonId: string;
  stepIndex: number;
  /** Objective ids completed per step id. */
  completed: Record<string, string[]>;
  completedAt?: number;
  startedAt: number;
  updatedAt: number;
}
