/** Small challenges solved on the home page (cipher, PID…), kept in this browser. */
const KEY = "inside-tech:challenges";
export const XP_CHALLENGE = 20;

export function loadChallenges(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Mark a challenge solved; returns true the first time. */
export function solveChallenge(id: string): boolean {
  const done = loadChallenges();
  if (done.includes(id)) return false;
  done.push(id);
  try {
    localStorage.setItem(KEY, JSON.stringify(done));
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event("inside-tech:xp"));
  return true;
}
