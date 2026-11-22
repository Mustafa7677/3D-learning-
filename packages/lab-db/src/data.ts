import type { Db, Row } from "./sql";

const NAMES = ["Айгерім", "Нұрлан", "Дана", "Ерлан", "Әсел", "Тимур", "Жанар", "Мирас", "Аружан", "Бекзат", "Камила", "Дәулет"];
const CITIES = ["Алматы", "Астана", "Шымкент", "Қарағанды"];
export const COURSES = ["Алгоритмдер", "Дерекқорлар", "Желілер", "Веб"];

/** Deterministic pseudo-random numbers so every learner sees the same data. */
function lcg(seed: number) {
  let s = seed >>> 0;
  return (n: number) => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return (s >>> 16) % n;
  };
}

export const EVENT_ROWS = 5000;
export const EVENT_USERS = 500;

export function seedDb(): Db {
  const r = lcg(2026);
  const students: Row[] = NAMES.map((name, i) => ({ id: i + 1, name, city: CITIES[i % 4]!, year: 1 + (i % 4) }));
  const courses: Row[] = COURSES.map((title, i) => ({ id: i + 1, title, credits: [5, 4, 4, 3][i]! }));
  const enrollments: Row[] = [];
  for (const s of students)
    for (const c of courses) {
      // Most students take 2-3 courses; grades 60-100.
      if ((Number(s.id) + Number(c.id) * 3) % 5 < 3) enrollments.push({ student_id: s.id ?? null, course_id: c.id ?? null, grade: 60 + r(41) });
    }
  // The same facts, denormalized: the student's name and city repeated on every enrollment.
  const flat: Row[] = enrollments.map((e, i) => {
    const st = students.find((x) => x.id === e.student_id)!;
    const c = courses.find((x) => x.id === e.course_id)!;
    return { id: i + 1, student_name: st.name ?? null, student_city: st.city ?? null, course_title: c.title ?? null, grade: e.grade ?? null };
  });
  const events: Row[] = Array.from({ length: EVENT_ROWS }, (_, i) => ({ id: i + 1, user_id: 1 + r(EVENT_USERS), kind: ["view", "view", "view", "click", "buy"][r(5)]!, amount: r(50) * 100 }));
  return {
    students: {
      name: "students",
      columns: [{ name: "id", primaryKey: true }, { name: "name", notNull: true }, { name: "city" }, { name: "year" }],
      rows: students,
      indexes: ["id"],
    },
    courses: { name: "courses", columns: [{ name: "id", primaryKey: true }, { name: "title", notNull: true }, { name: "credits" }], rows: courses, indexes: ["id"] },
    enrollments: {
      name: "enrollments",
      columns: [{ name: "student_id", notNull: true, references: "students.id" }, { name: "course_id", notNull: true, references: "courses.id" }, { name: "grade" }],
      rows: enrollments,
      indexes: [],
    },
    accounts: {
      name: "accounts",
      columns: [{ name: "id", primaryKey: true }, { name: "owner", notNull: true }, { name: "balance", notNull: true }],
      rows: [
        { id: 1, owner: "Айгерім", balance: 1000 },
        { id: 2, owner: "Нұрлан", balance: 500 },
        { id: 3, owner: "Дана", balance: 200 },
      ],
      indexes: ["id"],
    },
    enrollments_flat: {
      name: "enrollments_flat",
      columns: [{ name: "id", primaryKey: true }, { name: "student_name" }, { name: "student_city" }, { name: "course_title" }, { name: "grade" }],
      rows: flat,
      indexes: ["id"],
    },
    events: { name: "events", columns: [{ name: "id", primaryKey: true }, { name: "user_id" }, { name: "kind" }, { name: "amount" }], rows: events, indexes: ["id"] },
  };
}
