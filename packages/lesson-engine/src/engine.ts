import { EventBus, type AssessmentResult } from "@inside-tech/sim-core";
import type { LessonDefinition, LessonProgress, LessonStep } from "./lesson";

export type LessonEvents = {
  objectiveCompleted: { stepId: string; objectiveId: string };
  stepCompleted: { stepId: string; index: number };
  stepEntered: { stepId: string; index: number };
  lessonCompleted: { lessonId: string };
  progress: LessonProgress;
};

export interface ObjectiveView {
  id: string;
  text: string;
  done: boolean;
}

export interface QuizView {
  id: string;
  question: string;
  options: string[];
  answered: boolean;
  /** Shown once answered correctly. */
  explain?: string;
}

export interface StepView {
  index: number;
  total: number;
  id: string;
  title: string;
  body: string;
  hints: string[];
  focus?: string;
  objectives: ObjectiveView[];
  quiz: QuizView[];
  complete: boolean;
  isLast: boolean;
  lessonComplete: boolean;
}

export interface AnswerResult {
  correct: boolean;
  /** Explanation of the correct answer, or a nudge for a wrong one. */
  feedback: string;
}

/**
 * Tracks where a learner is inside a lesson and grades objectives against
 * simulation state, plus concept-check questions. Knows nothing about
 * rendering or the specific lab. A step is complete when every objective
 * holds and every question has been answered correctly.
 */
export class LessonEngine<S, A = unknown> {
  readonly bus = new EventBus<LessonEvents>();
  private progress: LessonProgress;
  /** Objectives currently holding (non-sticky) for the current step. */
  private live = new Set<string>();

  constructor(
    readonly lesson: LessonDefinition<S, A>,
    saved?: LessonProgress,
    private readonly now: () => number = Date.now,
  ) {
    if (saved && saved.lessonId === lesson.id) {
      this.progress = structuredClone(saved);
      this.progress.stepIndex = Math.min(this.progress.stepIndex, lesson.steps.length - 1);
    } else {
      const t = this.now();
      this.progress = { lessonId: lesson.id, stepIndex: 0, completed: {}, startedAt: t, updatedAt: t };
    }
  }

  get step(): LessonStep<S, A> {
    return this.lesson.steps[this.progress.stepIndex]!;
  }

  getProgress(): LessonProgress {
    return structuredClone(this.progress);
  }

  /** Evaluate objectives of the current step against new state. */
  update(state: S, assessment: AssessmentResult): void {
    const step = this.step;
    const done = new Set(this.progress.completed[step.id] ?? []);
    let changed = false;
    this.live.clear();
    for (const obj of step.objectives) {
      const ok = safeCheck(() => obj.check(state, { assessment }));
      if (ok) this.live.add(obj.id);
      const sticky = obj.sticky ?? true;
      if (ok && !done.has(obj.id)) {
        done.add(obj.id);
        changed = true;
        this.bus.emit("objectiveCompleted", { stepId: step.id, objectiveId: obj.id });
      } else if (!ok && !sticky && done.has(obj.id)) {
        done.delete(obj.id);
        changed = true;
      }
    }
    if (changed) {
      this.progress.completed[step.id] = [...done];
      this.afterChange();
    }
  }

  /** Answer a concept-check question of the current step. */
  answer(questionId: string, option: number): AnswerResult {
    const step = this.step;
    const q = step.quiz?.find((x) => x.id === questionId);
    if (!q) return { correct: false, feedback: "Мұндай сұрақ жоқ." };
    if (option !== q.answer) return { correct: false, feedback: q.wrongHint ?? "Дұрыс емес. Мәтінге қайта қарап, тағы ойлан." };
    const answers = new Set(this.progress.answers?.[step.id] ?? []);
    if (!answers.has(q.id)) {
      answers.add(q.id);
      this.progress.answers = { ...(this.progress.answers ?? {}), [step.id]: [...answers] };
      this.afterChange();
    }
    return { correct: true, feedback: q.explain };
  }

  isStepComplete(index = this.progress.stepIndex): boolean {
    const step = this.lesson.steps[index];
    if (!step) return false;
    const done = new Set(this.progress.completed[step.id] ?? []);
    const objectivesOk = step.objectives.every((o) => done.has(o.id) && ((o.sticky ?? true) || index !== this.progress.stepIndex || this.live.has(o.id)));
    return objectivesOk && this.quizDone(index);
  }

  isLastStep(): boolean {
    return this.progress.stepIndex === this.lesson.steps.length - 1;
  }

  isLessonComplete(): boolean {
    return this.progress.completedAt !== undefined;
  }

  /** Move to the next step if the current one is complete. Returns entered step or undefined. */
  advance(): LessonStep<S, A> | undefined {
    if (!this.isStepComplete() || this.isLastStep()) return undefined;
    return this.goTo(this.progress.stepIndex + 1);
  }

  /** Jump to any step already reached (or the next unlocked one). */
  goTo(index: number): LessonStep<S, A> | undefined {
    if (index < 0 || index >= this.lesson.steps.length) return undefined;
    const unlocked = index === 0 || this.lesson.steps.slice(0, index).every((_, i) => this.isStepCompleteStored(i));
    if (!unlocked) return undefined;
    this.progress.stepIndex = index;
    this.live.clear();
    this.touch();
    this.bus.emit("stepEntered", { stepId: this.step.id, index });
    return this.step;
  }

  view(): StepView {
    const step = this.step;
    const done = new Set(this.progress.completed[step.id] ?? []);
    const answered = new Set(this.progress.answers?.[step.id] ?? []);
    return {
      index: this.progress.stepIndex,
      total: this.lesson.steps.length,
      id: step.id,
      title: step.title,
      body: step.body,
      hints: step.hints ?? [],
      focus: step.focus,
      objectives: step.objectives.map((o) => ({
        id: o.id,
        text: o.text,
        done: done.has(o.id) && ((o.sticky ?? true) || this.live.has(o.id)),
      })),
      quiz: (step.quiz ?? []).map((q) => ({ id: q.id, question: q.question, options: q.options, answered: answered.has(q.id), explain: answered.has(q.id) ? q.explain : undefined })),
      complete: this.isStepComplete(),
      isLast: this.isLastStep(),
      lessonComplete: this.isLessonComplete(),
    };
  }

  /** Fraction of all objectives and questions in the lesson completed (0..1). */
  completion(): number {
    let total = 0;
    let done = 0;
    for (const s of this.lesson.steps) {
      total += s.objectives.length + (s.quiz?.length ?? 0);
      done += (this.progress.completed[s.id] ?? []).length + (this.progress.answers?.[s.id] ?? []).length;
    }
    return total === 0 ? 1 : done / total;
  }

  private quizDone(index: number): boolean {
    const step = this.lesson.steps[index]!;
    const answered = new Set(this.progress.answers?.[step.id] ?? []);
    return (step.quiz ?? []).every((q) => answered.has(q.id));
  }

  private isStepCompleteStored(index: number): boolean {
    const step = this.lesson.steps[index]!;
    const done = new Set(this.progress.completed[step.id] ?? []);
    return step.objectives.every((o) => done.has(o.id)) && this.quizDone(index);
  }

  private afterChange(): void {
    const step = this.step;
    const wasComplete = this.progress.completedAt !== undefined;
    if (this.isStepComplete()) {
      this.bus.emit("stepCompleted", { stepId: step.id, index: this.progress.stepIndex });
      if (this.isLastStep() && !wasComplete) {
        this.progress.completedAt = this.now();
        this.bus.emit("lessonCompleted", { lessonId: this.lesson.id });
      }
    }
    this.touch();
  }

  private touch(): void {
    this.progress.updatedAt = this.now();
    this.bus.emit("progress", this.getProgress());
  }
}

function safeCheck(fn: () => boolean): boolean {
  try {
    return fn();
  } catch {
    return false;
  }
}
