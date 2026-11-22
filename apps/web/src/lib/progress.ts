import { HttpProgressStore, KeyValueProgressStore, MemoryProgressStore, type LessonProgress, type ProgressStore } from "@inside-tech/lesson-engine";
import { API_URL, apiEnabled } from "./api";
import { recordActivity } from "./activity";

let store: ProgressStore | undefined;

/**
 * Local first, server when configured: every save lands in the browser and is
 * mirrored to the API best-effort; loads take whichever copy is newer.
 */
class SyncedProgressStore implements ProgressStore {
  constructor(
    private readonly local: ProgressStore,
    private readonly remote: ProgressStore,
  ) {}
  async load(id: string) {
    const [l, r] = await Promise.all([this.local.load(id), this.remote.load(id).catch(() => undefined)]);
    if (!r) return l;
    if (!l) return r;
    return r.updatedAt >= l.updatedAt ? r : l;
  }
  async save(p: LessonProgress) {
    await this.local.save(p);
    await this.remote.save(p).catch(() => undefined);
  }
  async list() {
    const [l, r] = await Promise.all([this.local.list(), this.remote.list().catch(() => [] as LessonProgress[])]);
    const by = new Map<string, LessonProgress>();
    for (const p of [...l, ...r]) {
      const prev = by.get(p.lessonId);
      if (!prev || p.updatedAt > prev.updatedAt) by.set(p.lessonId, p);
    }
    return [...by.values()];
  }
}

/** How much work a record holds: objectives, right answers, a finished lesson. */
const work = (p?: LessonProgress) => (p ? Object.values(p.completed).reduce((n, xs) => n + xs.length, 0) + Object.values(p.answers ?? {}).reduce((n, xs) => n + xs.length, 0) + (p.completedAt ? 1 : 0) : 0);

/** Notes a day of study whenever a save holds more work than the one before it (opening a lesson is not studying). */
class ActivityProgressStore implements ProgressStore {
  constructor(private readonly inner: ProgressStore) {}
  load(id: string) {
    return this.inner.load(id);
  }
  list() {
    return this.inner.list();
  }
  async save(p: LessonProgress) {
    const before = await this.inner.load(p.lessonId).catch(() => undefined);
    await this.inner.save(p);
    if (work(p) > work(before)) recordActivity("lesson");
  }
}

/** Browser progress store. Falls back to memory when localStorage is blocked. */
export function progressStore(): ProgressStore {
  if (store) return store;
  let local: ProgressStore;
  try {
    const ls = window.localStorage;
    ls.getItem("inside-tech:probe");
    local = new KeyValueProgressStore(ls);
  } catch {
    local = new MemoryProgressStore();
  }
  store = new ActivityProgressStore(apiEnabled ? new SyncedProgressStore(local, new HttpProgressStore(API_URL)) : local);
  return store;
}
