/**
 * Teaching forms beyond prose, authored per step:
 * - a comic: theory told as a short dialogue between recurring characters,
 *   with a board for the formula of the moment;
 * - a worked example that fades: the teacher solves the first steps with a
 *   reason for each, the learner chooses the remaining ones;
 * - an error hunt: a solution with one wrong line to find.
 * None of them is graded; they prepare the experiment and the quiz.
 */

export type Character = "nuray" | "mustafa" | "ustaz" | "narrator";
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

export const CHARACTER_NAME: Record<Character, string> = { nuray: "Нұрай", mustafa: "Мустафа", ustaz: "Ұстаз", narrator: "" };

/**
 * A solution film: the solving of one problem played like a video. Each
 * frame adds to the board, says one sentence, marks where the eye should
 * go and may move the 3D scene. Frames are grouped by Pólya's four stages,
 * so the learner sees the route, not only the steps.
 */
export const FILM_STAGES = ["Түсіну", "Жоспар", "Шешу", "Тексеру"] as const;

export interface FilmFrame {
  /** Index into FILM_STAGES. */
  stage: 0 | 1 | 2 | 3;
  /** The whole board at this frame; a line longer than the previous frame's is written out. */
  board: string[];
  /** A piece of the board to highlight. */
  mark?: string;
  /** The narration, shown as a subtitle. */
  say: string;
  /** A lab-specific patch for the 3D scene (display only, never graded). */
  scene?: Record<string, unknown>;
}

export interface SolutionFilm {
  title: string;
  frames: FilmFrame[];
}
