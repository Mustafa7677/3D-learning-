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

export const middleContent: Record<string, Record<string, StepContent>> = {
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
};
