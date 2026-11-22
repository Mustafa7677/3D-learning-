/**
 * Teaching forms beyond prose, authored per step:
 * - a comic: theory told as a short dialogue between recurring characters,
 *   with a board for the formula of the moment;
 * - a worked example that fades: the teacher solves the first steps with a
 *   reason for each, the learner chooses the remaining ones;
 * - an error hunt: a solution with one wrong line to find.
 * None of them is graded; they prepare the experiment and the quiz.
 */

export type Character = "aliya" | "arman" | "ustaz" | "narrator";
export type Mood = "think" | "wow" | "confused" | "smile" | "explain";

export interface ComicPanel {
  who: Character;
  mood?: Mood;
  say: string;
  /** A formula or a drawing caption written on the board behind them. */
  board?: string;
}

export interface Comic {
  title: string;
  panels: ComicPanel[];
}

export interface WorkedStep {
  line: string;
  why: string;
  /** For faded steps: wrong lines offered with the right one. */
  wrong?: string[];
}

export interface WorkedExample {
  problem: string;
  steps: WorkedStep[];
  /** Steps from this index on are chosen by the learner. */
  fadeFrom: number;
}

export interface ErrorHunt {
  problem: string;
  lines: string[];
  /** Index of the wrong line. */
  wrong: number;
  why: string;
  fix: string;
}

export const CHARACTER_NAME: Record<Character, string> = { aliya: "Әлия", arman: "Арман", ustaz: "Ұстаз", narrator: "" };
