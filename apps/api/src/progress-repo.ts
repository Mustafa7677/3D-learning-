import type { LessonProgress } from "@inside-tech/lesson-engine";

/**
 * Storage boundary for learner progress. The in-memory implementation backs
 * local dev and tests; a PostgreSQL implementation (schema in
 * db/migrations/0001_init.sql) plugs in behind the same interface.
 */
export interface ProgressRepository {
  get(learnerId: string, lessonId: string): Promise<LessonProgress | undefined>;
  put(learnerId: string, progress: LessonProgress): Promise<void>;
  list(learnerId: string): Promise<LessonProgress[]>;
}

export class InMemoryProgressRepository implements ProgressRepository {
  private rows = new Map<string, Map<string, LessonProgress>>();

  async get(learnerId: string, lessonId: string) {
    const p = this.rows.get(learnerId)?.get(lessonId);
    return p && structuredClone(p);
  }

  async put(learnerId: string, progress: LessonProgress) {
    let m = this.rows.get(learnerId);
    if (!m) {
      m = new Map();
      this.rows.set(learnerId, m);
    }
    const prev = m.get(progress.lessonId);
    // Never let a stale client overwrite newer progress.
    if (prev && prev.updatedAt > progress.updatedAt) return;
    m.set(progress.lessonId, structuredClone(progress));
  }

  async list(learnerId: string) {
    return [...(this.rows.get(learnerId)?.values() ?? [])].map((p) => structuredClone(p));
  }
}
