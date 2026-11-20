import type { LessonProgress } from "@inside-tech/lesson-engine";
import type { Assignment, ClassRoom, Learner, Store } from "./store";

/**
 * The one method PgStore needs from a PostgreSQL client. Both `pg`
 * (`new Pool().query`) and `postgres.js` (`sql.unsafe`) can be adapted to it:
 *
 *   import pg from "pg";
 *   const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
 *   const store = new PgStore({ query: (text, params) => pool.query(text, params) });
 */
export interface Queryable {
  query<R = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: R[] }>;
}

interface LearnerRow {
  id: string;
  auth_subject: string | null;
  email: string | null;
  name: string | null;
  role: Learner["role"];
  plan: Learner["plan"];
  created_at: Date | string;
}

const ms = (v: Date | string | null): number | null => (v === null ? null : new Date(v).getTime());
const toLearner = (r: LearnerRow): Learner => ({
  id: r.id,
  authSubject: r.auth_subject,
  email: r.email,
  name: r.name,
  role: r.role,
  plan: r.plan,
  createdAt: ms(r.created_at)!,
});
const toClass = (r: { id: string; teacher_id: string; name: string; code: string; created_at: Date | string }): ClassRoom => ({
  id: r.id,
  teacherId: r.teacher_id,
  name: r.name,
  code: r.code,
  createdAt: ms(r.created_at)!,
});
interface ProgressRow {
  lesson_id: string;
  step_index: number;
  completed: Record<string, string[]>;
  started_at: Date | string;
  updated_at: Date | string;
  completed_at: Date | string | null;
}
const toProgress = (r: ProgressRow): LessonProgress => ({
  lessonId: r.lesson_id,
  stepIndex: r.step_index,
  completed: r.completed,
  startedAt: ms(r.started_at)!,
  updatedAt: ms(r.updated_at)!,
  ...(r.completed_at ? { completedAt: ms(r.completed_at)! } : {}),
});

/** PostgreSQL implementation of Store. Schema: db/migrations/0001_init.sql + 0002_platform.sql. */
export class PgStore implements Store {
  constructor(private readonly db: Queryable) {}

  async getLearner(id: string) {
    const { rows } = await this.db.query<LearnerRow>("select * from learners where id = $1", [id]);
    return rows[0] && toLearner(rows[0]);
  }
  async createLearner(l: Learner) {
    await this.db.query(
      "insert into learners (id, auth_subject, email, name, role, plan, created_at) values ($1, $2, $3, $4, $5, $6, to_timestamp($7 / 1000.0)) on conflict (id) do nothing",
      [l.id, l.authSubject, l.email, l.name, l.role, l.plan, l.createdAt],
    );
  }
  async updateLearner(id: string, patch: Partial<Omit<Learner, "id">>) {
    const cols: Record<string, string> = { authSubject: "auth_subject", email: "email", name: "name", role: "role", plan: "plan" };
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [k, col] of Object.entries(cols)) {
      if (k in patch) {
        vals.push((patch as Record<string, unknown>)[k]);
        sets.push(`${col} = $${vals.length}`);
      }
    }
    if (!sets.length) return;
    vals.push(id);
    await this.db.query(`update learners set ${sets.join(", ")} where id = $${vals.length}`, vals);
  }
  async findLearnerBySubject(subject: string) {
    const { rows } = await this.db.query<LearnerRow>("select * from learners where auth_subject = $1", [subject]);
    return rows[0] && toLearner(rows[0]);
  }
  async listLearners(limit: number) {
    const { rows } = await this.db.query<LearnerRow>("select * from learners order by created_at desc limit $1", [limit]);
    return rows.map(toLearner);
  }

  async getProgress(learnerId: string, lessonId: string) {
    const { rows } = await this.db.query<ProgressRow>("select * from lesson_progress where learner_id = $1 and lesson_id = $2", [learnerId, lessonId]);
    return rows[0] && toProgress(rows[0]);
  }
  async putProgress(learnerId: string, p: LessonProgress) {
    // Upsert that never lets an older client snapshot overwrite newer progress.
    await this.db.query(
      `insert into lesson_progress (learner_id, lesson_id, step_index, completed, started_at, updated_at, completed_at)
       values ($1, $2, $3, $4::jsonb, to_timestamp($5 / 1000.0), to_timestamp($6 / 1000.0), to_timestamp($7 / 1000.0))
       on conflict (learner_id, lesson_id) do update set
         step_index = excluded.step_index, completed = excluded.completed,
         updated_at = excluded.updated_at, completed_at = excluded.completed_at
       where lesson_progress.updated_at <= excluded.updated_at`,
      [learnerId, p.lessonId, p.stepIndex, JSON.stringify(p.completed), p.startedAt, p.updatedAt, p.completedAt ?? null],
    );
  }
  async listProgress(learnerId: string) {
    const { rows } = await this.db.query<ProgressRow>("select * from lesson_progress where learner_id = $1", [learnerId]);
    return rows.map(toProgress);
  }

  async createClass(c: ClassRoom) {
    await this.db.query("insert into classes (id, teacher_id, name, code, created_at) values ($1, $2, $3, $4, to_timestamp($5 / 1000.0))", [c.id, c.teacherId, c.name, c.code, c.createdAt]);
  }
  async getClass(id: string) {
    const { rows } = await this.db.query<Parameters<typeof toClass>[0]>("select * from classes where id = $1", [id]);
    return rows[0] && toClass(rows[0]);
  }
  async findClassByCode(code: string) {
    const { rows } = await this.db.query<Parameters<typeof toClass>[0]>("select * from classes where code = $1", [code]);
    return rows[0] && toClass(rows[0]);
  }
  async classesForTeacher(teacherId: string) {
    const { rows } = await this.db.query<Parameters<typeof toClass>[0]>("select * from classes where teacher_id = $1 order by created_at", [teacherId]);
    return rows.map(toClass);
  }
  async classesForStudent(learnerId: string) {
    const { rows } = await this.db.query<Parameters<typeof toClass>[0]>(
      "select c.* from classes c join class_members m on m.class_id = c.id where m.learner_id = $1 order by c.created_at",
      [learnerId],
    );
    return rows.map(toClass);
  }
  async joinClass(classId: string, learnerId: string) {
    await this.db.query("insert into class_members (class_id, learner_id) values ($1, $2) on conflict do nothing", [classId, learnerId]);
  }
  async classMembers(classId: string) {
    const { rows } = await this.db.query<LearnerRow>("select l.* from learners l join class_members m on m.learner_id = l.id where m.class_id = $1 order by l.name", [classId]);
    return rows.map(toLearner);
  }
  async addAssignment(a: Assignment) {
    await this.db.query("insert into assignments (id, class_id, lesson_id, due_at, created_at) values ($1, $2, $3, to_timestamp($4 / 1000.0), to_timestamp($5 / 1000.0))", [
      a.id,
      a.classId,
      a.lessonId,
      a.dueAt,
      a.createdAt,
    ]);
  }
  async assignments(classId: string) {
    const { rows } = await this.db.query<{ id: string; class_id: string; lesson_id: string; due_at: Date | string | null; created_at: Date | string }>(
      "select * from assignments where class_id = $1 order by created_at",
      [classId],
    );
    return rows.map((r) => ({ id: r.id, classId: r.class_id, lessonId: r.lesson_id, dueAt: ms(r.due_at), createdAt: ms(r.created_at)! }));
  }
}
