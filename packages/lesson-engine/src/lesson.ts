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

/** A concept check: the learner must pick the right option to finish the step. */
export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  /** Index of the correct option. */
  answer: number;
  /** Why the answer is right — shown after a correct answer. */
  explain: string;
  /** Nudge shown after a wrong answer (without giving the answer away). */
  wrongHint?: string;
}

export interface LessonStep<S, A = unknown> {
  id: string;
  title: string;
  /**
   * Lecture text in a small Markdown subset: paragraphs, "## " headings,
   * "- " and "1. " lists, ``` code blocks, "> " callouts, **bold** and `code`.
   */
  body: string;
  objectives: Objective<S>[];
  quiz?: QuizQuestion[];
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
  /** Question ids answered correctly per step id. */
  answers?: Record<string, string[]>;
  completedAt?: number;
  startedAt: number;
  updatedAt: number;
}

/** Lecture text and questions for one step, kept apart from lesson logic. */
export interface StepContent {
  body?: string;
  quiz?: QuizQuestion[];
  hints?: string[];
}

/**
 * Merge authored content (keyed by step id) into a lesson definition.
 * Throws when content names a step that does not exist, so typos fail tests.
 */
export function withContent<S, A>(lesson: LessonDefinition<S, A>, content: Record<string, StepContent>): LessonDefinition<S, A> {
  for (const id of Object.keys(content)) {
    if (!lesson.steps.some((s) => s.id === id)) throw new Error(`${lesson.id}: content for unknown step "${id}"`);
  }
  return {
    ...lesson,
    steps: lesson.steps.map((s) => {
      const c = content[s.id];
      if (!c) return s;
      return { ...s, body: c.body ?? s.body, quiz: c.quiz ?? s.quiz, hints: c.hints ?? s.hints };
    }),
  };
}

/**
 * Insert optional deep-dive sections (Markdown starting with "## Тереңірек")
 * into step bodies, just before the "## Енді сен" task section if present.
 */
export function withDeepDives<S, A>(lesson: LessonDefinition<S, A>, dives: Record<string, string>): LessonDefinition<S, A> {
  for (const id of Object.keys(dives)) {
    if (!lesson.steps.some((s) => s.id === id)) throw new Error(`${lesson.id}: deep dive for unknown step "${id}"`);
  }
  return {
    ...lesson,
    steps: lesson.steps.map((s) => {
      const d = dives[s.id];
      if (!d) return s;
      const at = s.body.indexOf("## Енді сен");
      const body = at >= 0 ? `${s.body.slice(0, at)}${d.trim()}\n\n${s.body.slice(at)}` : `${s.body}\n\n${d.trim()}`;
      return { ...s, body };
    }),
  };
}
