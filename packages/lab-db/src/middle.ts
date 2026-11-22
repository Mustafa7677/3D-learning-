/**
 * DATABASES, Middle level: LEFT JOIN and NULL, subqueries, search patterns.
 * Every objective compares the learner's result with a reference query run
 * on the same data, so there is one meaning of "right" and it is the data's.
 */
import type { LessonDefinition, StepContent } from "@inside-tech/lesson-engine";
import { lastMatches, type DbLabAction, type DbLabState } from "./plugin";

type L = LessonDefinition<DbLabState, DbLabAction>;
const text = (t: string): DbLabAction => ({ type: "sql/text", text: t });
const run = (t: string): DbLabAction[] => [text(t), { type: "sql/run" }];
/** The learner's last statement really used a subquery (not a number copied from the screen). */
export const usedSubquery = (s: DbLabState) => /\(\s*select\b/i.test(s.sql.lastSql);
const used = (s: DbLabState, word: RegExp) => word.test(s.sql.lastSql);

export const lessonLeftJoin: L = {
  id: "db-10-left-join",
  labId: "db",
  order: 10,
  title: "LEFT JOIN & NULL",
  summary: "Жұбы жоқ жолдар қайда кетеді? LEFT JOIN, NULL және «нөл» мен «жоқтың» айырмасы.",
  estimatedMinutes: 25,
  steps: [
    {
      id: "orphans",
      title: "Ешкім жазылмаған курс",
      body: "",
      focus: "sql",
      onEnter: [
        { type: "mode/set", mode: "sql" },
        { type: "sql/reset" },
        ...run("INSERT INTO courses (id, title, credits) VALUES (5, 'Бұлт', 3)"),
        ...run("INSERT INTO students (id, name, city, year) VALUES (13, 'Ерасыл', 'Алматы', 1)"),
        text("SELECT c.title, e.student_id FROM courses c JOIN enrollments e ON e.course_id = c.id"),
      ],
      objectives: [
        {
          id: "all",
          text: "Барлық курсты, оның ішінде студенті жоқ «Бұлт» курсын да шығар (LEFT JOIN)",
          check: (s) => used(s, /\bleft\s+(outer\s+)?join\b/i) && lastMatches(s, "SELECT c.title, e.student_id FROM courses c LEFT JOIN enrollments e ON e.course_id = c.id"),
        },
        {
          id: "none",
          text: "Тек бірде-бір студенті жоқ курстарды тап",
          check: (s) => lastMatches(s, "SELECT c.title FROM courses c LEFT JOIN enrollments e ON e.course_id = c.id WHERE e.student_id IS NULL"),
        },
      ],
    },
    {
      id: "zero",
      title: "Нөл мен «жоқ»",
      body: "",
      focus: "sql",
      onEnter: [text("SELECT c.title, COUNT(*) AS n FROM courses c LEFT JOIN enrollments e ON e.course_id = c.id GROUP BY c.title")],
      objectives: [
        {
          id: "count",
          text: "Әр курстың студент санын шығар: «Бұлт» үшін 1 емес, 0 шығуы керек",
          check: (s) => lastMatches(s, "SELECT c.title, COUNT(e.student_id) AS n FROM courses c LEFT JOIN enrollments e ON e.course_id = c.id GROUP BY c.title"),
        },
        {
          id: "lonely",
          text: "Бірде-бір курсқа жазылмаған студентті тап",
          check: (s) => lastMatches(s, "SELECT s.name FROM students s LEFT JOIN enrollments e ON e.student_id = s.id WHERE e.course_id IS NULL"),
        },
      ],
    },
  ],
};

export const lessonSubqueries: L = {
  id: "db-11-subqueries",
  labId: "db",
  order: 11,
  title: "Subqueries",
  summary: "Сұрақтың ішіндегі сұрақ: бір мән қайтаратын ішкі сұраныс, IN (SELECT ...) және NOT IN тұзағы.",
  estimatedMinutes: 25,
  steps: [
    {
      id: "scalar",
      title: "Орташадан жоғары",
      body: "",
      focus: "sql",
      onEnter: [{ type: "mode/set", mode: "sql" }, { type: "sql/reset" }, text("SELECT AVG(grade) FROM enrollments")],
      objectives: [
        {
          id: "above",
          text: "Бағасы жалпы орташадан жоғары жазылуларды шығар (санды қолмен жазбай, ішкі сұраныспен)",
          check: (s) => usedSubquery(s) && lastMatches(s, "SELECT student_id, course_id, grade FROM enrollments WHERE grade > (SELECT AVG(grade) FROM enrollments)"),
        },
      ],
    },
    {
      id: "in",
      title: "IN (SELECT ...)",
      body: "",
      focus: "sql",
      onEnter: [text("SELECT student_id FROM enrollments WHERE course_id = 1")],
      objectives: [
        {
          id: "algo",
          text: "«Алгоритмдер» (course_id = 1) курсындағы студенттердің аттарын IN (SELECT ...) арқылы шығар",
          check: (s) => usedSubquery(s) && used(s, /\bin\s*\(/i) && lastMatches(s, "SELECT name FROM students WHERE id IN (SELECT student_id FROM enrollments WHERE course_id = 1)"),
        },
        {
          id: "not",
          text: "Ал енді керісінше: бұл курсқа жазылмаған студенттер",
          check: (s) => usedSubquery(s) && lastMatches(s, "SELECT name FROM students WHERE id NOT IN (SELECT student_id FROM enrollments WHERE course_id = 1)"),
        },
      ],
    },
  ],
};

export const lessonPatterns: L = {
  id: "db-12-patterns",
  labId: "db",
  order: 12,
  title: "LIKE, BETWEEN, DISTINCT",
  summary: "Мәтін үлгісі бойынша іздеу, аралықтар және қайталанбайтын мәндер.",
  estimatedMinutes: 20,
  steps: [
    {
      id: "distinct",
      title: "Қайталанбайтын мәндер",
      body: "",
      focus: "sql",
      onEnter: [{ type: "mode/set", mode: "sql" }, { type: "sql/reset" }, text("SELECT city FROM students")],
      objectives: [{ id: "cities", text: "Студенттер тұратын қалалар, әрқайсысы бір-ақ рет", check: (s) => lastMatches(s, "SELECT DISTINCT city FROM students") }],
    },
    {
      id: "like",
      title: "LIKE және BETWEEN",
      body: "",
      focus: "sql",
      onEnter: [text("SELECT name FROM students")],
      objectives: [
        { id: "a", text: "Аты «А» әрпінен басталатын студенттер", check: (s) => used(s, /\blike\b/i) && lastMatches(s, "SELECT name FROM students WHERE name LIKE 'А%'") },
        {
          id: "range",
          text: "Бағасы 70 пен 85 аралығындағы жазылулар (екі шеті де кіреді)",
          check: (s) => lastMatches(s, "SELECT student_id, course_id, grade FROM enrollments WHERE grade BETWEEN 70 AND 85"),
        },
      ],
    },
  ],
};

const flatRows = (s: DbLabState) => s.sql.session.db.enrollments_flat?.rows ?? [];
/** Some student appears with two different cities in the flat table. */
export const hasAnomaly = (s: DbLabState) => {
  const seen = new Map<string, string>();
  for (const r of flatRows(s)) {
    const name = String(r.student_name);
    const city = String(r.student_city);
    if (seen.has(name) && seen.get(name) !== city) return true;
    seen.set(name, city);
  }
  return false;
};
const studentCity = (s: DbLabState, name: string) => String(s.sql.session.db.students?.rows.find((r) => r.name === name)?.city ?? "");
/** Every row of some student in the flat table moved to a new city, consistently. */
const movedConsistently = (s: DbLabState) => !hasAnomaly(s) && flatRows(s).some((r) => String(r.student_city) !== studentCity(s, String(r.student_name)));
const studentsChanged = (s: DbLabState) => (s.sql.session.db.students?.rows ?? []).some((r, i) => String(r.city) !== ["Алматы", "Астана", "Шымкент", "Қарағанды"][i % 4]);

export const lessonNormalization: L = {
  id: "db-13-normalization",
  labId: "db",
  order: 13,
  title: "Normalization: One Fact, One Place",
  summary: "Бір дерек бірнеше жерде тұрса, ерте ме, кеш пе, екі түрлі болады. Жаңарту аномалиясы, нормализация және JOIN.",
  estimatedMinutes: 25,
  steps: [
    {
      id: "anomaly",
      title: "Жаңарту аномалиясы",
      body: "",
      focus: "sql",
      onEnter: [{ type: "mode/set", mode: "sql" }, { type: "sql/reset" }, text("SELECT * FROM enrollments_flat WHERE student_name = 'Айгерім'")],
      objectives: [
        { id: "break", text: "Бір ғана жолдағы қаланы өзгерт: бір студенттің екі қаласы пайда болсын", check: hasAnomaly },
        { id: "fix", text: "Бір UPDATE-пен сол студенттің барлық жолдарын түзет", check: movedConsistently },
      ],
    },
    {
      id: "normalize",
      title: "Бір дерек: бір орын",
      body: "",
      focus: "sql",
      onEnter: [{ type: "sql/reset" }, text("SELECT s.name, s.city, c.title FROM enrollments e JOIN students s ON s.id = e.student_id JOIN courses c ON c.id = e.course_id")],
      objectives: [
        { id: "join", text: "Сол мәліметті үш кестеден JOIN-мен құрастыр", check: (s) => used(s, /join/i) && used(s, /students/i) && (s.sql.last?.ok ?? false) },
        { id: "once", text: "students кестесінде бір қаланы бір рет өзгерт те, JOIN-мен қайта қара", check: (s) => studentsChanged(s) && used(s, /join/i) && (s.sql.last?.ok ?? false) },
      ],
    },
  ],
};

const selects = (s: DbLabState) => s.stats.queries.filter((q) => q.ok && q.kind === "select");
const lastInsert = (s: DbLabState) => s.stats.queries.map((q, i) => (q.ok && q.kind === "insert" ? i : -1)).reduce((a, b) => Math.max(a, b), -1);
/** A newest-first page taken before the insert, and a later page that overlaps it (OFFSET shifted). */
const duplicated = (s: DbLabState) => {
  const qs = s.stats.queries;
  const ins = lastInsert(s);
  if (ins < 0) return false;
  const before = qs.slice(0, ins).filter((q) => q.ok && q.kind === "select" && /desc/i.test(q.sql ?? "") && (q.ids?.length ?? 0) === 20);
  const after = qs.slice(ins + 1).filter((q) => q.ok && q.kind === "select" && /offset\s+20\b/i.test(q.sql ?? ""));
  return after.some((b) => before.some((a) => (b.ids ?? []).some((id) => a.ids!.includes(id))));
};
const keysetClean = (s: DbLabState) => {
  const qs = s.stats.queries;
  const ins = lastInsert(s);
  if (ins < 0) return false;
  const before = qs.slice(0, ins).filter((q) => q.ok && q.kind === "select" && /desc/i.test(q.sql ?? "") && (q.ids?.length ?? 0) === 20);
  const after = qs.slice(ins + 1).filter((q) => q.ok && q.kind === "select" && /\bid\s*<\s*\d+/i.test(q.sql ?? "") && !/offset/i.test(q.sql ?? "") && (q.ids?.length ?? 0) === 20);
  return after.some((k) => before.some((a) => Math.max(...k.ids!) === Math.min(...a.ids!) - 1));
};

export const lessonPagination: L = {
  id: "db-14-pagination",
  labId: "db",
  order: 14,
  title: "Pagination: OFFSET vs Keyset",
  summary: "Тереңдегі бетті ашу неге баяу, ал лента неге бір жазбаны екі рет көрсетеді. OFFSET-тің бағасы және «осы id-ден кейінгілер» әдісі.",
  estimatedMinutes: 25,
  steps: [
    {
      id: "deep",
      title: "Тереңдегі бет",
      body: "",
      focus: "sql",
      onEnter: [{ type: "mode/set", mode: "sql" }, { type: "sql/reset" }, text("SELECT id, kind, amount FROM events ORDER BY id LIMIT 20 OFFSET 4980")],
      objectives: [
        { id: "offset", text: "Соңғы бетті OFFSET-пен аш: 20 жол үшін 5000 жол оқылды", check: (s) => selects(s).some((q) => /offset/i.test(q.sql ?? "") && q.rows === 20 && q.examined >= 5000) },
        { id: "keyset", text: "Сол бетті WHERE id > ... арқылы аш: 20 жол оқылды", check: (s) => selects(s).some((q) => /\bid\s*>\s*\d+/i.test(q.sql ?? "") && !/offset/i.test(q.sql ?? "") && q.rows === 20 && q.examined <= 20) },
      ],
    },
    {
      id: "feed",
      title: "Қозғалатын лента",
      body: "",
      focus: "sql",
      onEnter: [{ type: "sql/reset" }, text("SELECT id, kind FROM events ORDER BY id DESC LIMIT 20")],
      objectives: [
        { id: "dup", text: "1-бетті аш, жаңа оқиға қос, 2-бетті OFFSET 20-пен аш: бір жазба қайталанды", check: duplicated },
        { id: "clean", text: "Жаңа оқиғадан кейін 2-бетті WHERE id < ... арқылы аш: қайталану жоқ", check: keysetClean },
      ],
    },
  ],
};

export const middleContent: Record<string, Record<string, StepContent>> = {
  "db-14-pagination": {
    deep: {
      predict: {
        question: "events кестесінде 5000 жол, id бойынша индекс бар. «ORDER BY id LIMIT 20 OFFSET 4980» сұранысы неше жолды оқиды?",
        options: ["5000: алдымен 4980 жолды оқып, лақтырады, сосын 20-сын береді", "20: дерекқор 4981-жолға бірден секіреді", "4980"],
        answer: 0,
        explain: "Индекс жолдарды ретімен береді, бірақ «4980-орын» қай жерде екенін білмейді. OFFSET жолдарды бір-бірлеп санап өтуге мәжбүрлейді.",
      },
      body: `## Идея
Үлкен тізімді беттерге бөлудің ең қарапайым жолы:
\`\`\`
SELECT ... ORDER BY id LIMIT 20 OFFSET 4980
\`\`\`
Бірақ **OFFSET тегін емес**. Дерекқор 4980 жолды индекс бойымен оқиды, оларды санайды да, лақтырып тастайды. Бет неғұрлым терең болса, соғұрлым баяу: 1-бет 20 жол, 250-бет 5000 жол.

**Keyset** (seek) беттеу басқаша сұрайды: «қай орында» емес, «қай мәннен кейін»:
\`\`\`
SELECT ... WHERE id > 4980 ORDER BY id LIMIT 20
\`\`\`
Индекс B-ағаш: ол id = 4980 орнын логарифмдік уақытта табады, сосын тек 20 жол оқиды. Тереңдік маңызды емес.

## Түйсік
Кітаптың 250-бетін ашу. OFFSET: бірінші беттен бастап парақтарды санап шығу. Keyset: бетбелгі қойылған жерден ашу.

## Есептеп көрейік
EXPLAIN нәтижесінде «оқылды» санын қара:
- OFFSET 4980: 5000 жол оқылды, 20 жол қайтарылды. Оқылғанның 99,6%-ы босқа.
- WHERE id > 4980: 20 жол оқылды, 20 қайтарылды.
Мыңдаған пайдаланушы ары қарай парақтаса, бұл айырма серверлердің санына айналады.

## Нақты әлемде
Twitter, Instagram, GitHub API-лері «келесі бет» үшін сан емес, курсор береді (мысалы, \`?after=4980\`): бұл keyset. Бағасы: «250-бетке бірден өту» мүмкіндігі жоғалады, тек алға не артқа жүруге болады.

> ⚠ Keyset үшін сұрыптау бағаны бірегей және индекстелген болуы керек. Бірдей мәндер болса, (created_at, id) сияқты екі бағанды кілт керек.

## Енді сен
Дайын OFFSET сұранысын орында да, оқылған жолдарды көр. Сосын сол 20 жолды WHERE id > 4980 арқылы ал.`,
      quiz: [
        {
          id: "cost",
          question: "Неге OFFSET беттің тереңдігіне қарай баяулайды?",
          options: ["Дерекқор өткізіп жіберілетін жолдарды да оқып, санап өтуі керек", "OFFSET индексті өшіреді", "Терең беттер дискіде алыс жатады"],
          answer: 0,
          explain: "Индекс ретті береді, бірақ «N-орынға» секіре алмайды. Ал мәнге (id > 4980) секіре алады.",
        },
        {
          id: "need",
          question: "Keyset беттеуге не керек?",
          options: ["Бірегей әрі индекстелген сұрыптау кілті және алдыңғы беттің соңғы мәні", "Кестенің жалпы жол саны", "Әр беттің нөмірі"],
          answer: 0,
          explain: "«Осы мәннен кейінгілер» деп сұрау үшін соңғы көрген мәнді есте сақтау жеткілікті.",
        },
      ],
    },
    feed: {
      selfExplain: {
        prompt: "Жаңа оқиға қосылғанда неге OFFSET 20 бір жазбаны қайталады, ал WHERE id < ... қайталамады?",
        concepts: [
          {
            label: "OFFSET орынмен санайды, орындар жылжиды",
            words: ["орын", "жылжи", "ығыс"],
          },
          {
            label: "жаңа жол басына қосылды",
            words: ["басына", "жаңа жол", "жаңа оқиға", "5001"],
          },
          {
            label: "keyset мәнмен санайды",
            words: ["мән", "id <", "id<", "keyset", "соңғы id", "курсор"],
          },
        ],
        model: "OFFSET «21-орыннан баста» дейді. Ең жаңасынан басталатын лентаның басына 5001 қосылғанда бәрі бір орынға жылжыды: бұрын 20-орында тұрған 4981 енді 21-орында, сондықтан 2-бетте тағы шықты. Keyset орынмен емес, мәнмен сұрайды: «id < 4981». Жаңа жолдың id-і үлкен, ол шартқа кірмейді, ығысу болмайды.",
      },
      predict: {
        question: "Лента ең жаңасынан басталады (ORDER BY id DESC). Сен 1-бетті көрдің, сол кезде біреу жаңа оқиға қосты. 2-бетті OFFSET 20-пен ашсаң не болады?",
        options: ["1-беттің соңғы жазбасы 2-беттің басында тағы шығады", "Бәрі дұрыс: 2-бет жаңа жазбаларды көрсетеді", "Бір жазба жоғалып кетеді"],
        answer: 0,
        explain: "Жаңа жол басына қосылды да, бәрін бір орынға ығыстырды. 20-орындағы жол енді 21-орында: OFFSET 20 оны тағы береді.",
      },
      body: `## Идея
OFFSET орынмен санайды, ал орындар жылжиды. Беттер арасында:
- басына жаңа жол **қосылса**: келесі бетте бір жазба **қайталанады**;
- алдыңғы беттен жол **өшірілсе**: бір жазба **көрінбей қалады**, ешкім байқамайды.

Keyset мәнмен санайды: «id < 4981 болғандар». Жаңа жолдың id-і үлкен, ол шартқа кірмейді. Ығысу жоқ.

## Түйсік
Кезекте тұрғанда «маған 20-орыннан кейінгілерді шақыр» десең, біреу алдыға кіріп кетсе, сен бір адамды екі рет көресің. «Мына кісіден кейінгілерді шақыр» десең, ешкім шатаспайды.

## Есептеп көрейік
1-бет (DESC): 5000, 4999, ..., 4981.
Жаңа оқиға: id = 5001.
- OFFSET 20: 4981, 4980, ..., 4962. 4981 екі бетте де бар.
- WHERE id < 4981: 4980, 4979, ..., 4961. Қайталану жоқ.

## Нақты әлемде
Шексіз айналдырылатын ленталарда (жаңалықтар, чат, хабарламалар) OFFSET-тің бұл ақауы жиі кездеседі: пайдаланушы бір постты екі рет көреді, не біреуін мүлде көрмейді. Сондықтан ленталар әрқашан курсормен жасалады.

## Енді сен
1. 1-бетті аш.
2. Жаңа оқиға қос: INSERT INTO events (id, user_id, kind, amount) VALUES (5001, 1, 'buy', 100).
3. 2-бетті OFFSET 20-пен аш да, қайталанған id-ді тап.
4. Сол бетті WHERE id < 4981 арқылы аш.`,
      quiz: [
        {
          id: "why",
          question: "Беттер арасында басына жол қосылғанда OFFSET неге қайталайды?",
          options: ["Барлық жолдың орны бір орынға жылжиды, ал OFFSET орынмен санайды", "Дерекқор кэштен ескі бетті береді", "INSERT индексті бұзады"],
          answer: 0,
          explain: "OFFSET 20 «21-орыннан баста» дейді. Жаңа жол қосылғанда бұрынғы 20-орын 21-орынға айналды.",
        },
        {
          id: "delete",
          question: "Ал беттер арасында бірінші беттен жол өшірілсе, OFFSET беттеуде не болады?",
          options: ["Бір жазба ешбір бетте көрсетілмей қалады", "Бір жазба екі рет шығады", "Ештеңе өзгермейді"],
          answer: 0,
          explain: "Жолдар бір орын алға жылжиды. 21-орындағы жол 20-орынға келіп, келесі беттің сыртында қалады.",
        },
      ],
    },
  },
  "db-10-left-join": {
    orphans: {
      body: `## Идея
**JOIN** (толығырақ: INNER JOIN) тек жұбы табылған жолдарды қалдырады. Ешкім жазылмаған курс нәтижеде мүлде жоқ болып кетеді: ол «0 студент» болып емес, жай **жоғалып** кетеді.

**LEFT JOIN** сол жақтағы кестенің **әр жолын** сақтайды. Жұбы табылмаса, оң жақ кестенің бағандары **NULL** болады:
\`\`\`
SELECT c.title, e.student_id
FROM courses c LEFT JOIN enrollments e ON e.course_id = c.id
\`\`\`

## Түйсік
Сынып журналы. INNER JOIN: «сабаққа келгендер тізімі». LEFT JOIN: «барлық оқушы, келмегендердің тұсы бос». Бос тұс та ақпарат: ол келмегенін айтады.

## Есептеп көрейік
Бұл кезеңде дерекқорға екі жаңа жол қосылды: «Бұлт» курсы (оған әлі ешкім жазылмаған) және студент Ерасыл (ол әлі ешбір курсқа жазылмаған).
- INNER JOIN: 28 жол, «Бұлт» жоқ.
- LEFT JOIN: 29 жол, «Бұлт» бар, оның student_id бағаны NULL.

Енді «жұбы жоқтарды» табу оңай: LEFT JOIN-нен кейін оң жақтың кілті NULL болған жолдарды қалдыр:
\`\`\`
... WHERE e.student_id IS NULL
\`\`\`

## Нақты әлемде
«Тапсырыс бермеген клиенттер», «ешкім оқымаған мақалалар», «төленбеген шоттар»: бұл есептердің бәрі LEFT JOIN және IS NULL арқылы шешіледі.

> ⚠ Жиі қате: \`WHERE e.student_id = NULL\`. NULL ештеңеге тең емес, тіпті өзіне де. Тек \`IS NULL\` жұмыс істейді.

## Енді сен
Алдымен барлық курсты (студентсіз «Бұлт»-ты да) шығар. Сосын тек студенті жоқ курстарды қалдыр.`,
      quiz: [
        {
          id: "inner",
          question: "INNER JOIN жұбы табылмаған сол жақ жолмен не істейді?",
          options: ["Нәтижеден шығарып тастайды", "NULL-мен қалдырады", "Қате береді"],
          answer: 0,
          explain: "INNER JOIN тек екі жақта да жұбы бар жолдарды қалдырады. Жұбы жоқтарды сақтау үшін LEFT JOIN керек.",
        },
        {
          id: "isnull",
          question: "Неге WHERE e.student_id = NULL ештеңе қайтармайды?",
          options: ["NULL-мен кез келген салыстыру «белгісіз» болады, ал WHERE тек «ақиқатты» өткізеді", "NULL сан емес", "Бұл синтаксис қатесі"],
          answer: 0,
          explain: "SQL-де үш мәнді логика бар: ақиқат, жалған және белгісіз. x = NULL әрдайым белгісіз болады.",
        },
      ],
    },
    zero: {
      body: `## Идея
LEFT JOIN-нен кейін санау кезінде бір нәзік айырма бар:
- \`COUNT(*)\` **жолдарды** санайды. «Бұлт» курсының NULL-ы бар бір жолы бар, сондықтан ол **1** болып шығады.
- \`COUNT(e.student_id)\` тек **NULL емес** мәндерді санайды, сондықтан «Бұлт» үшін **0** шығады.

## Түйсік
«Сыныпта қанша оқушы бар?» деген сұраққа бос партаны санап, «1» деп жауап беруге болмайды. Бос орын оқушы емес.

## Есептеп көрейік
\`\`\`
SELECT c.title, COUNT(e.student_id) AS n
FROM courses c LEFT JOIN enrollments e ON e.course_id = c.id
GROUP BY c.title
\`\`\`
Алгоритмдер: 7, Дерекқорлар: 7, Желілер: 8, Веб: 6, Бұлт: **0**.

## Нақты әлемде
Есеп-қисап (дашбордтағы «0 сатылым» жолы) осы қатемен жиі бұзылады: COUNT(*) «бір сатылым» деп көрсетеді. Аналитик бұл қатені тапқанша, бизнес жоқ сатылымға қуанып жүреді.

## Енді сен
Әр курстың студент санын «Бұлт» үшін 0 шығатындай етіп жаз. Сосын ешбір курсқа жазылмаған студентті тап: бұл жолы сол жақта students тұрады.`,
      quiz: [
        {
          id: "count",
          question: "LEFT JOIN-нен кейін бос курс үшін COUNT(*) не береді?",
          options: ["1, себебі NULL-ы бар бір жол бар", "0", "NULL"],
          answer: 0,
          explain: "COUNT(*) жолдарды санайды. 0 алу үшін оң жақ кестенің NULL болатын бағанын санау керек: COUNT(e.student_id).",
        },
        {
          id: "side",
          question: "Курсқа жазылмаған студенттерді табу үшін қай кесте LEFT JOIN-нің сол жағында тұруы керек?",
          options: ["students: жұбы жоқ жолдарын сақтағымыз келетін кесте", "enrollments", "Айырмасы жоқ"],
          answer: 0,
          explain: "LEFT JOIN сол жақтың барлық жолын сақтайды. Кімнің «жұбы жоқтарын» іздесең, сол кесте сол жақта тұрады.",
        },
      ],
    },
  },
  "db-11-subqueries": {
    scalar: {
      body: `## Идея
**Ішкі сұраныс** (subquery) деп жақшаның ішіндегі SELECT-ті айтады. Бір ғана мән қайтаратын ішкі сұранысты кез келген сан тұратын жерге қоюға болады:
\`\`\`
SELECT student_id, course_id, grade
FROM enrollments
WHERE grade > (SELECT AVG(grade) FROM enrollments)
\`\`\`
Дерекқор алдымен ішкі сұранысты орындайды (орташа баға), сосын оны сыртқы сұраныста сан ретінде қолданады.

## Түйсік
«Сыныптағы орташа бойдан ұзын оқушылар» деген сұрақ екі қадамнан тұрады: алдымен орташаны есепте, сосын салыстыр. Ішкі сұраныс екі қадамды бір сөйлемге сыйғызады.

## Есептеп көрейік
Неге санды қолмен жазбаймыз (\`WHERE grade > 84.89\`)? Себебі деректер өзгереді. Ертең жаңа бағалар қосылғанда қолмен жазылған сан ескіреді, ал ішкі сұраныс әр орындалғанда қайта есептеледі.

## Нақты әлемде
«Орташа чектен үлкен тапсырыстар», «ең соңғы күннің деректері»: бұлар \`(SELECT MAX(date) ...)\` сияқты ішкі сұраныстармен жазылады.

> ⚠ Бір мән күтілетін жерге бірнеше мән қайтаратын ішкі сұраныс қойсаң, дерекқор қате береді. Ол дұрыс та: қайсысымен салыстыру керегін ол білмейді.

## Енді сен
Орташадан жоғары бағаларды санды қолмен жазбай, ішкі сұраныспен шығар.`,
      quiz: [
        {
          id: "many",
          question: "WHERE id = (SELECT student_id FROM enrollments) неге қате береді?",
          options: ["Ішкі сұраныс көп мән қайтарады, ал «=» бір мән күтеді", "Ішкі сұраныста WHERE жоқ", "student_id бағаны жоқ"],
          answer: 0,
          explain: "Көп мәнмен салыстыру үшін IN (SELECT ...) қолданылады. Келесі кезеңде соны көресің.",
        },
        {
          id: "fresh",
          question: "Ертең жаңа бағалар қосылса, орташаны ішкі сұраныспен жазған сұраныс не істейді?",
          options: ["Орташаны қайта есептейді: нәтиже әрдайым жаңа", "Кешегі орташаны қолданады", "Қате береді"],
          answer: 0,
          explain: "Ішкі сұраныс сыртқы сұраныс орындалған сайын қайта орындалады. Қолмен жазылған сан болса, ол ескіріп қалар еді.",
        },
      ],
    },
    in: {
      body: `## Идея
**IN (SELECT ...)**: ішкі сұраныс мәндер **тізімін** қайтарады, ал сыртқы сұраныс «осы тізімде бар ма?» деп сұрайды:
\`\`\`
SELECT name FROM students
WHERE id IN (SELECT student_id FROM enrollments WHERE course_id = 1)
\`\`\`
Мұны JOIN арқылы да жазуға болады. Нәтиже бірдей, бірақ ниет басқаша оқылады: «мына курста оқитындар» деген сұрақ IN-мен тікелей естіледі.

## Түйсік
Қақпадағы күзетші қолында тізім бар: «тізімде бар ма? Кір». IN дәл сол тізім.

## Есептеп көрейік: NOT IN тұзағы
\`NOT IN\` «тізімде жоқтар» дегенді білдіреді. Бірақ тізімде бір **NULL** болса, нәтиже **бос** шығады. Себебі «x тізімде жоқ» деу үшін x-тің әр элементке тең еместігін білу керек, ал x ≠ NULL **белгісіз**. Біздің курстар тізімінде NULL жоқ, сондықтан бұл жерде дұрыс жұмыс істейді. Бірақ өндірісте бұл ең жиі кездесетін жасырын қателердің бірі.

## Нақты әлемде
Тәжірибелі әзірлеушілер NOT IN орнына \`NOT EXISTS\`-ті не \`LEFT JOIN ... WHERE ... IS NULL\` тәсілін қолданады: олар NULL-ға сезімтал емес. Соңғысын сен алдыңғы сабақта жазып көрдің.

## Енді сен
«Алгоритмдер» курсындағы студенттерді IN (SELECT ...) арқылы тап. Сосын керісінше: ол курсқа жазылмағандарды тап.`,
      quiz: [
        {
          id: "notin",
          question: "WHERE year NOT IN (1, 2, NULL) не қайтарады?",
          options: ["Ештеңе: NULL-мен салыстыру белгісіз болғандықтан ешбір жол «ақиқат» болмайды", "3 және 4 курс студенттерін", "Қате береді"],
          answer: 0,
          explain: "Біздің қозғалтқышта да солай: бұл SQL стандарты. NOT IN тізіміне NULL түспейтінін тексер не NOT EXISTS қолдан.",
        },
        {
          id: "same",
          question: "IN (SELECT ...) пен JOIN неге кейде әртүрлі жол санын береді?",
          options: ["JOIN бір студентті әр сәйкес жазылу үшін қайталауы мүмкін, ал IN әр студентті бір рет береді", "Ешқашан айырмашылық болмайды", "IN баяу, сондықтан жолдарды жоғалтады"],
          answer: 0,
          explain: "Бір студент бір курсқа екі рет жазылса, JOIN оны екі рет шығарады. IN «бар ма?» деп сұрайды, сондықтан студентті бір-ақ рет береді.",
        },
      ],
    },
  },
  "db-12-patterns": {
    distinct: {
      body: `## Идея
**DISTINCT** нәтижедегі бірдей жолдарды біреу етіп қалдырады:
\`\`\`
SELECT DISTINCT city FROM students
\`\`\`
12 студент 4 қалада тұрады: DISTINCT-сіз 12 жол, DISTINCT-пен 4 жол.

## Түйсік
Сыныптағы барлық оқушының туған қалаларын тақтаға жазып, сосын қайталанғандарын өшіру.

## Есептеп көрейік
\`SELECT DISTINCT city\` пен \`SELECT city ... GROUP BY city\` бірдей нәтиже береді. Айырмасы ниетте: GROUP BY «әр топ туралы есептеу керек» дегенді, ал DISTINCT «тек қайталанбайтын мәндер керек» дегенді білдіреді.

> ⚠ DISTINCT-ті JOIN-нен кейінгі артық жолдарды «жасыру» үшін қолданба. Артық жолдар шықса, JOIN шартында қате бар деген сөз. DISTINCT оны түзетпейді, тек көзден тасалайды.

## Енді сен
Студенттер тұратын қалаларды әрқайсысын бір реттен шығар.`,
      quiz: [
        {
          id: "hide",
          question: "JOIN-нен кейін бірдей жолдар шықты. Не істейсің?",
          options: ["JOIN шартын тексеремін: қайталану бір нәрсе дұрыс біріктірілмегенін білдіреді", "DISTINCT қосамын", "LIMIT қосамын"],
          answer: 0,
          explain: "DISTINCT дұрыс жауап сияқты көрінеді, бірақ қатені жасырады. Сонымен қатар ол сұранысты баяулатады: дерекқор бүкіл нәтижені сұрыптауы не хэштеуі керек.",
        },
        {
          id: "rows",
          question: "SELECT DISTINCT city, year FROM students нені қайталанбайтын етеді?",
          options: ["(қала, курс) жұптарын: екі бағаны да бірдей жолдар ғана біріктіріледі", "Тек қаланы", "Тек курсты"],
          answer: 0,
          explain: "DISTINCT бүкіл жолға қолданылады. Алматы 1-курс пен Алматы 2-курс екі бөлек жол болып қалады.",
        },
      ],
    },
    like: {
      body: `## Идея
**LIKE** мәтінді үлгімен салыстырады:
- \`%\`: кез келген ұзындықтағы кез келген таңбалар (бос та болады)
- \`_\`: дәл бір таңба

\`'А%'\`: «А»-дан басталатындар. \`'%н'\`: «н»-ға аяқталатындар. \`'Д_на'\`: «Дана», «Дина».

**BETWEEN a AND b**: \`x >= a AND x <= b\` деудің қысқа жолы. **Екі шеті де кіреді.**

## Түйсік
LIKE: телефон кітабынан «А-дан басталатын» тегтерді іздеу. BETWEEN: «70-тен 85-ке дейін, екеуін қоса».

## Есептеп көрейік
\`WHERE name LIKE '%ан%'\`: «ан» мәтіннің кез келген жерінде. Мұндай іздеуге индекс көмектеспейді: үлгі % таңбасымен басталса, дерекқор әр жолды қарауға мәжбүр. Ал \`'Ай%'\` сияқты бас жағы бекітілген үлгіде сұрыпталған индекс жұмыс істей алады.

## Нақты әлемде
Сайттағы іздеу жолағы көбіне LIKE '%сөз%' деп басталады. Деректер көбейгенде ол баяулайды, сондықтан арнайы толық мәтінді іздеу (full-text search) құралдарына ауысады.

## Енді сен
Аты «А» әрпінен басталатын студенттерді тап. Сосын бағасы 70 пен 85 аралығындағы жазылуларды шығар.`,
      quiz: [
        {
          id: "between",
          question: "grade BETWEEN 70 AND 85 бағасы дәл 85 болатын жолды қоса ма?",
          options: ["Иә, екі шеті де кіреді", "Жоқ, жоғарғы шеті кірмейді", "Тек 70 кіреді"],
          answer: 0,
          explain: "BETWEEN: >= және <=. Уақыт аралықтарында бұл жиі тұзаққа айналады: '2026-01-01' AND '2026-01-31' 31-қаңтардың түн ортасынан кейінгі жазбаларды өткізіп жібереді.",
        },
        {
          id: "index",
          question: "LIKE '%ан' іздеуіне индекс неге көмектеспейді?",
          options: ["Үлгінің басы белгісіз: сұрыпталған индекстен қай жерден бастап іздеу керегі белгісіз", "LIKE индексті мүлде қолданбайды", "% таңбасы рұқсат етілмеген"],
          answer: 0,
          explain: "Сұрыпталған индекс сөздіктегі әліпби сияқты: басын білсең, тез табасың. 'Ай%' индекспен жұмыс істейді, '%ай' жұмыс істемейді.",
        },
      ],
    },
  },
  "db-13-normalization": {
    anomaly: {
      predict: {
        question: "enrollments_flat кестесінде Айгерімнің қаласы оның әр курсының жолында қайталанады. Ол көшті, біз тек бір жолды (id = 1) жаңарттық. Енді «Айгерім қай қалада тұрады?» деген сұраққа дерекқор не айтады?",
        options: ["Жаңа қаланы: соңғы өзгеріс жеңеді", "Екі түрлі жауап: қай жолды оқысаң, сол", "Қате береді"],
        answer: 1,
        explain: "Дерекқор қай жол дұрыс екенін білмейді: оның үшін бәрі бірдей шын. Бір дерек екі жерде тұрды да, екеуі екі түрлі болды.",
      },
      body: `## Идея
**Нормализация**: әр деректі **бір рет**, бір жерде сақтау. Әйтпесе қайталанған көшірмелер ерте ме, кеш пе, бір-біріне қайшы келеді.

## Денормалданған кесте
\`enrollments_flat\`: әр жазылу жолында студенттің аты, **қаласы**, курстың аты. Оқуға ыңғайлы: JOIN керек емес. Бірақ Айгерімнің қаласы оның әр курсында қайталанады.

## Үш аномалия
1. **Жаңарту**: қаланы бір жолда өзгертсең, қалғандары ескі қалады. Енді дерекқорда «шындық» екеу.
2. **Енгізу**: курсқа әлі жазылмаған студентті мүлде сақтай алмайсың, себебі кесте жазылулар туралы.
3. **Жою**: студенттің соңғы курсын өшірсең, оның қаласы туралы білім де жоғалады.

## Есептеп көрейік
\`\`\`sql
UPDATE enrollments_flat SET student_city = 'Тараз' WHERE id = 1;
SELECT DISTINCT student_city FROM enrollments_flat WHERE student_name = 'Айгерім';
\`\`\`
Екі қала. Түзету үшін **барлық** көшірмені табу керек: \`WHERE student_name = 'Айгерім'\`. Бірақ аты бірдей екі студент болса ше? Онда бөтен адамның қаласын да өзгертесің.

## Енді сен
Бір жолды жаңартып, аномалияны жаса. Сосын бір UPDATE-пен Айгерімнің барлық жолдарын түзет.`,
      quiz: [
        {
          id: "update",
          question: "Жаңарту аномалиясы дегеніміз не?",
          options: ["Бір деректің көшірмелерінің бірі өзгеріп, қалғандары ескі қалуы", "UPDATE-тің баяулығы", "Кестенің жойылуы"],
          answer: 0,
          explain: "Дерек бірнеше жерде тұрса, оларды бірге өзгертуді ұмытуға оңай.",
        },
        {
          id: "delete",
          question: "enrollments_flat-тан студенттің жалғыз курсын өшірсең не жоғалады?",
          options: ["Оның қаласы туралы мәлімет те: ол басқа ешқайда сақталмаған", "Ештеңе", "Курстың өзі"],
          answer: 0,
          explain: "Жою аномалиясы: бір фактіні өшіріп, байқамай басқасын да өшіресің.",
        },
        {
          id: "name",
          question: "Неге \`WHERE student_name = 'Айгерім'\` деп түзету де қауіпті?",
          options: ["Аты бірдей екі студент болуы мүмкін: бөтен адамның қаласы да өзгереді", "Ол баяу", "Кириллица жұмыс істемейді"],
          answer: 0,
          explain: "Атау: кілт емес. Сондықтан нормалданған кестелер бірегей id қолданады.",
        },
      ],
    },
    normalize: {
      predict: {
        question: "Нормалданған схемада қала тек students кестесінде, бір рет. Айгерімнің қаласын сол жерде бір рет өзгертсек, оның барлық курстарының JOIN нәтижесінде не көрінеді?",
        options: ["Барлығында жаңа қала: дерек бір-ақ жерде", "Тек бір курста", "Ескі қала: JOIN кэштейді"],
        answer: 0,
        explain: "JOIN әр сұрауда қаланы students-тен оқиды. Көшірме жоқ, сондықтан қайшылық та жоқ.",
      },
      body: `## Нормалданған схема
Бір фактіге бір кесте:
- \`students(id, name, city)\`: студент туралы;
- \`courses(id, title)\`: курс туралы;
- \`enrollments(student_id, course_id, grade)\`: кім қай курста.

Қала **бір рет** жазылған. Оны өзгерту: бір жолды жаңарту. Ал «әр жазылудың қасында қаласы» керек болса, JOIN құрастырады:
\`\`\`sql
SELECT s.name, s.city, c.title
FROM enrollments e
JOIN students s ON s.id = e.student_id
JOIN courses c ON c.id = e.course_id;
\`\`\`

## Қалыпты формалар (қысқаша)
- **1NF**: әр ұяшықта бір мән (тізім емес).
- **2NF**: құрама кілттің бір бөлігіне ғана тәуелді баған жоқ (курс атауы course_id-ге, жазылуға емес).
- **3NF**: кілт емес баған басқа кілт емес бағанға тәуелді емес (қала студентке тәуелді, жазылуға емес).
Қысқа ереже: «әр баған кілтке, толық кілтке және тек кілтке тәуелді».

## Денормализация қашан дұрыс?
Оқу жазудан мыңдаған есе көп болса (есептер, аналитика, кэш), JOIN-сыз дайын көшірме жылдамырақ. Бірақ сонда көшірмені **жүйе өзі** жаңартуы керек (триггер, materialized view, оқиғалар), адамның есіне емес.

## Енді сен
JOIN-мен құрастыр, сосын students-те бір қаланы өзгертіп, JOIN-ды қайта іске қос.`,
      quiz: [
        {
          id: "nf3",
          question: "enrollments кестесінде student_city бағаны неге 3NF-ті бұзады?",
          options: ["Қала жазылуға емес, студентке тәуелді", "Ол мәтін", "Ол бос болуы мүмкін"],
          answer: 0,
          explain: "Ол student_id арқылы ғана кілтке байланысты: транзитивті тәуелділік.",
        },
        {
          id: "join",
          question: "Нормалданған схемада «студент, қаласы, курсы» тізімін қалай аламыз?",
          options: ["Кестелерді JOIN-мен байланыстырып", "Барлық кестені бір-бірден оқып, қолмен", "Мүмкін емес"],
          answer: 0,
          explain: "Нормализацияның бағасы: оқуда JOIN. Сыйлығы: жазуда қайшылық жоқ.",
        },
        {
          id: "denorm",
          question: "Денормализация қашан ақталады?",
          options: ["Оқу өте көп, ал көшірмелерді жүйе өзі автоматты жаңартатын кезде", "Әрқашан", "Ешқашан"],
          answer: 0,
          explain: "Материалдандырылған көріністер, аналитикалық қоймалар: көшірмені адам емес, механизм ұстайды.",
        },
      ],
    },
  },
};
