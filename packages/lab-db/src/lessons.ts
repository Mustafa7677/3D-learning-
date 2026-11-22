import { withContent, withDeepDives, type LessonDefinition } from "@inside-tech/lesson-engine";
import { dbContent } from "./content";
import { dbDeepDives } from "./deep";
import { balance, lastMatches, total, usedJoin, type DbLabAction, type DbLabState } from "./plugin";
import { lessonPsetDb } from "./pset";
import { lessonLeftJoin, lessonNormalization, lessonPatterns, lessonSubqueries, middleContent } from "./middle";

type L = LessonDefinition<DbLabState, DbLabAction>;
const q = (s: DbLabState) => s.stats.queries;
const sqlText = (text: string): DbLabAction => ({ type: "sql/text", text });

export const lessonSelect: L = {
  id: "db-1-select",
  labId: "db",
  order: 1,
  title: "Tables & SELECT",
  summary: "Кесте, жол, баған, кілт. SELECT, WHERE, ORDER BY: деректерге сұрақ қою.",
  estimatedMinutes: 15,
  steps: [
    {
      id: "where",
      title: "SELECT және WHERE",
      body: "",
      focus: "sql",
      onEnter: [{ type: "mode/set", mode: "sql" }, { type: "sql/reset" }, sqlText("SELECT * FROM students")],
      objectives: [{ id: "almaty", text: "Алматыдағы студенттердің аттарын шығар", check: (s) => lastMatches(s, "SELECT name FROM students WHERE city = 'Алматы'") }],
    },
    {
      id: "order",
      title: "Сұрыптау және шектеу",
      body: "",
      focus: "sql",
      objectives: [{ id: "senior", text: "3-4 курс студенттерінің аттары, алфавит бойынша", check: (s) => lastMatches(s, "SELECT name FROM students WHERE year >= 3 ORDER BY name", true) }],
    },
  ],
};

export const lessonJoin: L = {
  id: "db-2-join",
  labId: "db",
  order: 2,
  title: "JOIN",
  summary: "Деректер бірнеше кестеге бөлінген. JOIN оларды кілттер арқылы қайта жинайды.",
  estimatedMinutes: 20,
  steps: [
    {
      id: "two",
      title: "Екі кесте",
      body: "",
      focus: "sql",
      onEnter: [{ type: "mode/set", mode: "sql" }, sqlText("SELECT * FROM enrollments")],
      objectives: [
        {
          id: "names",
          text: "Әр жазылудың студент атын шығар (enrollments + students)",
          check: (s) => usedJoin(s) && lastMatches(s, "SELECT s.name, e.course_id FROM enrollments e JOIN students s ON e.student_id = s.id"),
        },
      ],
    },
    {
      id: "three",
      title: "Үш кесте",
      body: "",
      focus: "sql",
      objectives: [
        {
          id: "algo",
          text: "«Алгоритмдер» курсының студенттерінің аттары",
          check: (s) => usedJoin(s) && lastMatches(s, "SELECT s.name FROM enrollments e JOIN students s ON e.student_id = s.id JOIN courses c ON e.course_id = c.id WHERE c.title = 'Алгоритмдер'"),
        },
      ],
    },
  ],
};

export const lessonAggregate: L = {
  id: "db-3-aggregate",
  labId: "db",
  order: 3,
  title: "GROUP BY",
  summary: "COUNT, SUM, AVG және топтау: мыңдаған жолдан бір жауап.",
  estimatedMinutes: 20,
  steps: [
    {
      id: "count",
      title: "Топтау",
      body: "",
      focus: "sql",
      onEnter: [{ type: "mode/set", mode: "sql" }, sqlText("SELECT COUNT(*) FROM students")],
      objectives: [{ id: "city", text: "Әр қаладағы студенттер саны", check: (s) => lastMatches(s, "SELECT city, COUNT(*) FROM students GROUP BY city") }],
    },
    {
      id: "avg",
      title: "Орташа баға",
      body: "",
      focus: "sql",
      objectives: [
        {
          id: "avg",
          text: "Әр курстың атауы мен орташа бағасы, кему ретімен",
          check: (s) => lastMatches(s, "SELECT c.title, AVG(e.grade) AS a FROM enrollments e JOIN courses c ON e.course_id = c.id GROUP BY c.title ORDER BY a DESC", true),
        },
      ],
    },
    {
      id: "having",
      title: "HAVING",
      body: "",
      focus: "sql",
      objectives: [
        {
          id: "busy",
          text: "Кемінде 7 студент жазылған курстардың атаулары мен саны",
          check: (s) => lastMatches(s, "SELECT c.title, COUNT(*) FROM enrollments e JOIN courses c ON e.course_id = c.id GROUP BY c.title HAVING COUNT(*) >= 7"),
        },
      ],
    },
  ],
};

export const lessonIndex: L = {
  id: "db-4-index",
  labId: "db",
  order: 4,
  title: "Indexes",
  summary: "5000 жолды сканерлеу мен 9 жолды табу: B-tree индексі және EXPLAIN.",
  estimatedMinutes: 20,
  steps: [
    {
      id: "scan",
      title: "Толық сканерлеу",
      body: "",
      focus: "sql",
      onEnter: [{ type: "mode/set", mode: "sql" }, { type: "sql/reset" }, sqlText("SELECT * FROM events WHERE user_id = 42")],
      objectives: [{ id: "scan", text: "42-пайдаланушының оқиғаларын тап: неше жол қаралды?", check: (s) => lastMatches(s, "SELECT * FROM events WHERE user_id = 42") && (s.sql.last?.examined ?? 0) >= 5000 }],
    },
    {
      id: "index",
      title: "Индекс жаса",
      body: "",
      focus: "sql",
      objectives: [
        {
          id: "fast",
          text: "Индекспен сол сұраныс: ≤ 50 жол қаралсын",
          check: (s) => lastMatches(s, "SELECT * FROM events WHERE user_id = 42") && (s.sql.last?.examined ?? Infinity) <= 50,
        },
      ],
    },
    {
      id: "explain",
      title: "EXPLAIN",
      body: "",
      focus: "sql",
      objectives: [{ id: "plan", text: "Кез келген сұраныстың жоспарын EXPLAIN арқылы қара", check: (s) => s.stats.explains > 0 }],
    },
  ],
};

export const lessonConstraints: L = {
  id: "db-5-constraints",
  labId: "db",
  order: 5,
  title: "Keys & Constraints",
  summary: "Дерекқор қате деректерді өзі қабылдамайды: PRIMARY KEY, NOT NULL, FOREIGN KEY.",
  estimatedMinutes: 15,
  steps: [
    {
      id: "pk",
      title: "Бірегей кілт",
      body: "",
      focus: "sql",
      onEnter: [{ type: "mode/set", mode: "sql" }, { type: "sql/reset" }, sqlText("INSERT INTO students (id, name, city, year) VALUES (1, 'Арман', 'Тараз', 1)")],
      objectives: [{ id: "pk", text: "PRIMARY KEY шектеуін іске қос", check: (s) => s.stats.constraintErrors.includes("PRIMARY KEY") }],
    },
    {
      id: "fk",
      title: "Сыртқы кілт",
      body: "",
      focus: "sql",
      objectives: [{ id: "fk", text: "FOREIGN KEY шектеуін іске қос", check: (s) => s.stats.constraintErrors.includes("FOREIGN KEY") }],
    },
  ],
};

export const lessonTransactions: L = {
  id: "db-6-transactions",
  labId: "db",
  order: 6,
  title: "Transactions",
  summary: "Ақша аудару: не бәрі, не ештеңе. ACID және құлаған сервер.",
  estimatedMinutes: 20,
  steps: [
    {
      id: "transfer",
      title: "Аудару",
      body: "",
      focus: "sql",
      onEnter: [{ type: "mode/set", mode: "sql" }, { type: "sql/reset" }, sqlText("SELECT * FROM accounts")],
      objectives: [
        { id: "commit", text: "Айгерімнен Данаға 300 аудар: бір транзакцияда (COMMIT)", check: (s) => s.stats.commits > 0 && balance(s, 3) === 500 && total(s) === 1700 },
      ],
    },
    {
      id: "rollback",
      title: "ROLLBACK",
      body: "",
      focus: "sql",
      objectives: [{ id: "rb", text: "Транзакцияны бастап, өзгерт, сосын ROLLBACK жаса", check: (s) => s.stats.rollbacks > 0 }],
    },
    {
      id: "crash",
      title: "Сервер құлады",
      body: "",
      focus: "sql",
      objectives: [
        { id: "crash", text: "Транзакция ортасында серверді «құлат»: жалпы сома өзгермеуі керек", check: (s) => s.stats.crashes > 0 && total(s) === 1700 },
      ],
    },
  ],
};

export const lessonConcurrency: L = {
  id: "db-7-concurrency",
  labId: "db",
  order: 7,
  title: "Concurrency",
  summary: "Екі клиент бір жазбаны өзгертеді. Жоғалған жаңарту және құлыптар.",
  estimatedMinutes: 20,
  steps: [
    {
      id: "lost",
      title: "Жоғалған жаңарту",
      body: "",
      focus: "race",
      onEnter: [{ type: "mode/set", mode: "race" }, { type: "race/locking", on: false }],
      objectives: [{ id: "lost", text: "Құлыпсыз екі клиенттің бір жаңартуы жоғалатын ретті тап", check: (s) => s.stats.raceRuns.some((r) => !r.locking && r.lost) }],
    },
    {
      id: "lock",
      title: "SELECT … FOR UPDATE",
      body: "",
      focus: "race",
      objectives: [
        { id: "lock", text: "Құлыппен сол ретті қайтала: B күтуі керек, нәтиже 700", check: (s) => s.stats.raceRuns.some((r) => r.locking && !r.lost && r.waited) },
      ],
    },
  ],
};

export const lessonSharding: L = {
  id: "db-8-sharding",
  labId: "db",
  order: 8,
  title: "Scaling & Sharding",
  summary: "Деректер бір серверге сыймағанда: шардинг, mod N және consistent hashing.",
  estimatedMinutes: 20,
  steps: [
    {
      id: "spread",
      title: "Шардтарға бөлу",
      body: "",
      focus: "shard",
      onEnter: [{ type: "mode/set", mode: "shard" }, { type: "shard/method", method: "mod" }, { type: "shard/n", n: 4 }],
      objectives: [{ id: "views", text: "Шард санын өзгертіп, жүктеменің таралуын бақыла", check: (s) => new Set(s.stats.shardViews.map((v) => v.n)).size >= 2 }],
    },
    {
      id: "add",
      title: "Жаңа сервер қосу",
      body: "",
      focus: "shard",
      objectives: [
        { id: "mod", text: "mod N: 4 → 5 шард: кілттердің көбі көшеді", check: (s) => s.stats.shardMoves.some((m) => m.method === "mod" && m.from === 4 && m.to === 5) },
        { id: "ring", text: "Consistent hashing: 4 → 5 шард: тек ≈ 1/5 көшеді", check: (s) => s.stats.shardMoves.some((m) => m.method === "consistent" && m.from === 4 && m.to === 5) },
      ],
    },
  ],
};

export const dbLessons: L[] = [
  lessonSelect,
  lessonJoin,
  lessonAggregate,
  lessonIndex,
  lessonConstraints,
  lessonTransactions,
  lessonConcurrency,
  lessonSharding,
  lessonPsetDb,
  // Middle level
  lessonLeftJoin,
  lessonSubqueries,
  lessonPatterns,
  lessonNormalization,
].map((l) => withDeepDives(withContent(l, dbContent[l.id] ?? middleContent[l.id] ?? {}), dbDeepDives[l.id] ?? {}));

export { q };
