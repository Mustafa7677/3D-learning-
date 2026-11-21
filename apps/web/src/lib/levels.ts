/**
 * Career levels of a course. Lessons 1-8 and the first problem set are
 * Junior; 10-17 Middle; 18 and on Senior. The order number decides it, so
 * a lab grows level by level without renumbering what learners finished.
 */
export type Level = "Junior" | "Middle" | "Senior";

export function levelOf(order: number): Level {
  if (order <= 9) return "Junior";
  if (order <= 17) return "Middle";
  return "Senior";
}

export const LEVEL_WORD: Record<Level, string> = {
  Junior: "бастапқы деңгей",
  Middle: "орта деңгей",
  Senior: "жоғары деңгей",
};
