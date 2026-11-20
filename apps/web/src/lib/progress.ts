import { KeyValueProgressStore, MemoryProgressStore, type ProgressStore } from "@inside-tech/lesson-engine";

let store: ProgressStore | undefined;

/** Browser progress store. Falls back to memory when localStorage is blocked. */
export function progressStore(): ProgressStore {
  if (store) return store;
  try {
    const ls = window.localStorage;
    ls.getItem("inside-tech:probe");
    store = new KeyValueProgressStore(ls);
  } catch {
    store = new MemoryProgressStore();
  }
  return store;
}
