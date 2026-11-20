import { HttpProgressStore, KeyValueProgressStore, MemoryProgressStore, type LessonProgress, type ProgressStore } from "@inside-tech/lesson-engine";
import { API_URL, apiEnabled } from "./api";

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
  store = apiEnabled ? new SyncedProgressStore(local, new HttpProgressStore(API_URL)) : local;
  return store;
}
