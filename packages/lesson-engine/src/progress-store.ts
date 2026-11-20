import type { LessonProgress } from "./lesson";

/**
 * Persistence boundary for learner progress. The web app uses the
 * localStorage adapter today; the API adapter swaps in once accounts exist.
 */
export interface ProgressStore {
  load(lessonId: string): Promise<LessonProgress | undefined>;
  save(progress: LessonProgress): Promise<void>;
  list(): Promise<LessonProgress[]>;
}

export class MemoryProgressStore implements ProgressStore {
  private data = new Map<string, LessonProgress>();
  async load(id: string) {
    const p = this.data.get(id);
    return p && structuredClone(p);
  }
  async save(p: LessonProgress) {
    this.data.set(p.lessonId, structuredClone(p));
  }
  async list() {
    return [...this.data.values()].map((p) => structuredClone(p));
  }
}

interface KeyValue {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

export class KeyValueProgressStore implements ProgressStore {
  constructor(
    private readonly kv: KeyValue,
    private readonly prefix = "inside-tech:progress:",
  ) {}
  async load(id: string) {
    try {
      const raw = this.kv.getItem(this.prefix + id);
      return raw ? (JSON.parse(raw) as LessonProgress) : undefined;
    } catch {
      return undefined;
    }
  }
  async save(p: LessonProgress) {
    try {
      this.kv.setItem(this.prefix + p.lessonId, JSON.stringify(p));
      const index = new Set(this.readIndex());
      index.add(p.lessonId);
      this.kv.setItem(this.prefix + "_index", JSON.stringify([...index]));
    } catch {
      /* storage unavailable (private mode, quota) — progress stays in memory */
    }
  }
  async list() {
    const out: LessonProgress[] = [];
    for (const id of this.readIndex()) {
      const p = await this.load(id);
      if (p) out.push(p);
    }
    return out;
  }
  private readIndex(): string[] {
    try {
      return JSON.parse(this.kv.getItem(this.prefix + "_index") ?? "[]") as string[];
    } catch {
      return [];
    }
  }
}

/** Server-backed store against apps/api (`/v1/progress`). */
export class HttpProgressStore implements ProgressStore {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}
  async load(id: string) {
    const res = await this.fetchFn(`${this.baseUrl}/v1/progress/${encodeURIComponent(id)}`, { credentials: "include" });
    if (res.status === 404) return undefined;
    if (!res.ok) throw new Error(`progress load failed: ${res.status}`);
    return (await res.json()) as LessonProgress;
  }
  async save(p: LessonProgress) {
    const res = await this.fetchFn(`${this.baseUrl}/v1/progress/${encodeURIComponent(p.lessonId)}`, {
      method: "PUT",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(p),
    });
    if (!res.ok) throw new Error(`progress save failed: ${res.status}`);
  }
  async list() {
    const res = await this.fetchFn(`${this.baseUrl}/v1/progress`, { credentials: "include" });
    if (!res.ok) throw new Error(`progress list failed: ${res.status}`);
    return (await res.json()) as LessonProgress[];
  }
}
