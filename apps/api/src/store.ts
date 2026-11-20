import type { LessonProgress } from "@inside-tech/lesson-engine";

export type Role = "student" | "teacher" | "admin";
export type Plan = "free" | "premium" | "classroom";

/** A learner is anonymous until an OIDC login links `authSubject`. */
export interface Learner {
  id: string;
  authSubject: string | null;
  email: string | null;
  name: string | null;
  role: Role;
  plan: Plan;
  createdAt: number;
}

export interface ClassRoom {
  id: string;
  teacherId: string;
  name: string;
  /** Short join code shared with students. */
  code: string;
  createdAt: number;
}

export interface Assignment {
  id: string;
  classId: string;
  lessonId: string;
  dueAt: number | null;
  createdAt: number;
}

/**
 * Persistence boundary of the API. `MemoryStore` serves tests and local dev;
 * `PgStore` (pg-store.ts) implements the same contract on PostgreSQL.
 */
export interface Store {
  getLearner(id: string): Promise<Learner | undefined>;
  createLearner(l: Learner): Promise<void>;
  updateLearner(id: string, patch: Partial<Omit<Learner, "id">>): Promise<void>;
  findLearnerBySubject(subject: string): Promise<Learner | undefined>;
  listLearners(limit: number): Promise<Learner[]>;

  getProgress(learnerId: string, lessonId: string): Promise<LessonProgress | undefined>;
  /** Insert or update; ignores writes older than what is stored. */
  putProgress(learnerId: string, p: LessonProgress): Promise<void>;
  listProgress(learnerId: string): Promise<LessonProgress[]>;

  createClass(c: ClassRoom): Promise<void>;
  getClass(id: string): Promise<ClassRoom | undefined>;
  findClassByCode(code: string): Promise<ClassRoom | undefined>;
  classesForTeacher(teacherId: string): Promise<ClassRoom[]>;
  classesForStudent(learnerId: string): Promise<ClassRoom[]>;
  joinClass(classId: string, learnerId: string): Promise<void>;
  classMembers(classId: string): Promise<Learner[]>;
  addAssignment(a: Assignment): Promise<void>;
  assignments(classId: string): Promise<Assignment[]>;
}

const clone = <T,>(x: T): T => structuredClone(x);

export class MemoryStore implements Store {
  private learners = new Map<string, Learner>();
  private progress = new Map<string, Map<string, LessonProgress>>();
  private classes = new Map<string, ClassRoom>();
  private members = new Map<string, Set<string>>();
  private assignmentList: Assignment[] = [];

  async getLearner(id: string) {
    const l = this.learners.get(id);
    return l && clone(l);
  }
  async createLearner(l: Learner) {
    if (!this.learners.has(l.id)) this.learners.set(l.id, clone(l));
  }
  async updateLearner(id: string, patch: Partial<Omit<Learner, "id">>) {
    const l = this.learners.get(id);
    if (l) this.learners.set(id, { ...l, ...clone(patch) });
  }
  async findLearnerBySubject(subject: string) {
    for (const l of this.learners.values()) if (l.authSubject === subject) return clone(l);
    return undefined;
  }
  async listLearners(limit: number) {
    return [...this.learners.values()].slice(0, limit).map(clone);
  }

  async getProgress(learnerId: string, lessonId: string) {
    const p = this.progress.get(learnerId)?.get(lessonId);
    return p && clone(p);
  }
  async putProgress(learnerId: string, p: LessonProgress) {
    let m = this.progress.get(learnerId);
    if (!m) {
      m = new Map();
      this.progress.set(learnerId, m);
    }
    const prev = m.get(p.lessonId);
    if (prev && prev.updatedAt > p.updatedAt) return;
    m.set(p.lessonId, clone(p));
  }
  async listProgress(learnerId: string) {
    return [...(this.progress.get(learnerId)?.values() ?? [])].map(clone);
  }

  async createClass(c: ClassRoom) {
    this.classes.set(c.id, clone(c));
  }
  async getClass(id: string) {
    const c = this.classes.get(id);
    return c && clone(c);
  }
  async findClassByCode(code: string) {
    for (const c of this.classes.values()) if (c.code === code) return clone(c);
    return undefined;
  }
  async classesForTeacher(teacherId: string) {
    return [...this.classes.values()].filter((c) => c.teacherId === teacherId).map(clone);
  }
  async classesForStudent(learnerId: string) {
    return [...this.classes.values()].filter((c) => this.members.get(c.id)?.has(learnerId)).map(clone);
  }
  async joinClass(classId: string, learnerId: string) {
    let s = this.members.get(classId);
    if (!s) {
      s = new Set();
      this.members.set(classId, s);
    }
    s.add(learnerId);
  }
  async classMembers(classId: string) {
    return [...(this.members.get(classId) ?? [])].map((id) => this.learners.get(id)).filter((l): l is Learner => !!l).map(clone);
  }
  async addAssignment(a: Assignment) {
    this.assignmentList.push(clone(a));
  }
  async assignments(classId: string) {
    return this.assignmentList.filter((a) => a.classId === classId).map(clone);
  }
}
