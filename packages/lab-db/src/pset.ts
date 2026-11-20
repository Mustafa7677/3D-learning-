import type { LessonDefinition } from "@inside-tech/lesson-engine";
import { balance, lastMatches, total, type DbLabAction, type DbLabState } from "./plugin";
import { execute } from "./sql";

type L = LessonDefinition<DbLabState, DbLabAction>;

const TOP_REF = "SELECT s.name, AVG(e.grade) AS a FROM enrollments e JOIN students s ON e.student_id = s.id GROUP BY s.name ORDER BY a DESC";

/** Top three by average grade: the right names (ties in any order) with averages in descending order. */
export function topThree(s: DbLabState): boolean {
  const last = s.sql.last;
  if (!last?.ok || last.kind !== "select" || last.rows.length !== 3) return false;
  const all = execute({ db: s.sql.session.db, snapshot: null }, TOP_REF).result.rows;
  const third = Number(all[2]?.a);
  const allowed = new Set(all.filter((r) => Number(r.a) >= third - 1e-9).map((r) => r["s.name"]));
  const names = new Set<string>();
  for (let i = 0; i < 3; i++) {
    const vals = Object.values(last.rows[i]!);
    const name = vals.find((v): v is string => typeof v === "string" && allowed.has(v));
    if (!name) return false;
    names.add(name);
    // Row i must carry the i-th highest average.
    if (!vals.some((v) => typeof v === "number" && Math.abs(v - Number(all[i]!.a)) < 0.01)) return false;
  }
  return names.size === 3;
}

export const lessonPsetDb: L = {
  id: "db-9-pset",
  labId: "db",
  order: 9,
  title: "Problem Set: дерекқор инженері",
  summary: "Аналитикалық сұраныс, баяу сұранысты жылдамдату, қауіпсіз аударым және параллельдік.",
  estimatedMinutes: 45,
  steps: [
    {
      id: "top",
      title: "1-есеп: үздік үштік",
      focus: "sql",
      onEnter: [{ type: "mode/set", mode: "sql" }, { type: "sql/reset" }, { type: "sql/text", text: "-- Орташа бағасы ең жоғары 3 студент\n" }],
      body: `## Спецификация
Орташа бағасы ең жоғары **3 студенттің** аты мен орташа бағасын шығар, бағасы кему ретімен.

## Ойлан
- Студенттің аты мен бағасы әр түрлі кестеде. Қай кестелер керек?
- Орташа баға: бір студенттің барлық бағаларының агрегаты. Нені топтайсың?
- Сұрыптау агрегат бойынша: ORDER BY-да AVG(...) не оның бүркеншік атын қолдануға болады.
- Тек 3 жол: LIMIT.

## Автотексеруші
- дәл 3 жол
- орташа бағалары нақты ең жоғары үш мән, кему ретімен
- аттар: сол студенттер (бағалары тең болса, рет маңызды емес)

## Нақты әлемде
«Ең көп сатылған 10 тауар», «ең белсенді пайдаланушылар»: аналитиканың ең жиі сұранысы осы үлгі: JOIN → GROUP BY → ORDER BY агрегат → LIMIT.`,
      objectives: [{ id: "top", text: "Үздік 3 студент және олардың орташа бағасы", check: topThree }],
      quiz: [
        {
          id: "order",
          question: "SELECT-тің логикалық орындалу реті қандай?",
          options: ["FROM/JOIN → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT", "SELECT → FROM → WHERE → ORDER BY", "WHERE → FROM → GROUP BY → SELECT"],
          answer: 0,
          explain: "Сондықтан WHERE-де агрегат қолдануға болмайды (топтар әлі жоқ), ал ORDER BY-да SELECT-тегі бүркеншік атты қолдануға болады.",
        },
        {
          id: "where-having",
          question: "«Орташа бағасы 90-нан жоғары студенттер» шартын қайда жазасың?",
          options: ["HAVING AVG(grade) > 90", "WHERE AVG(grade) > 90", "WHERE grade > 90"],
          answer: 0,
          explain: "WHERE жеке жолдарды топтауға дейін сүзеді; агрегатқа шарт: HAVING. «WHERE grade > 90»: басқа сұрақ: 90-нан жоғары әр бағаны алады.",
        },
      ],
    },
    {
      id: "fast",
      title: "2-есеп: баяу есеп",
      focus: "sql",
      onEnter: [{ type: "sql/text", text: "-- 7-пайдаланушының сатып алуларының (kind = 'buy') жалпы сомасы\n" }],
      body: `## Спецификация
7-пайдаланушының барлық сатып алуларының (\`kind = 'buy'\`) **жалпы сомасы** керек (events кестесі, 5000 жол).

**Шектеу:** сұраныс ≤ **50** жолды қарауы керек. Индекс жасауға болады.

## Ойлан
- Қай бағанға индекс пайдалы: \`kind\` пе, \`user_id\` ме? Әр мән неше жолда кездеседі? (Таңдамалылық: selectivity.)
- \`kind = 'buy'\` жолдардың ≈ 1/5-і: 1000 жол. \`user_id = 7\`: ≈ 10 жол.
- Индекс тапқан жолдарға қалған шарт қалай қолданылады?

## Автотексеруші
- нәтиже эталонмен бірдей
- қаралған жолдар ≤ 50

## Нақты әлемде
Өндірістегі баяулықтың ең жиі себебі: дұрыс индекстің жоқтығы. PostgreSQL-дегі \`EXPLAIN ANALYZE\` пен MySQL-дегі slow query log: дерекқор инженерінің күнделікті құралдары.`,
      objectives: [
        {
          id: "fast",
          text: "Дұрыс сома, ≤ 50 жол қаралды",
          check: (s) => lastMatches(s, "SELECT SUM(amount) FROM events WHERE user_id = 7 AND kind = 'buy'") && (s.sql.last?.examined ?? Infinity) <= 50,
        },
      ],
      quiz: [
        {
          id: "selectivity",
          question: "Неге kind бағанына индекс бұл сұранысты жеткілікті жылдамдатпайды?",
          options: [
            "kind = 'buy' жолдардың ≈ 20%-ы: индекс 1000 жолды қайтарады",
            "Мәтіндік бағандарға индекс жасалмайды",
            "Себебі kind бағаны бос",
          ],
          answer: 0,
          explain: "Индекс тек таңдамалы шартта көп пайда береді: жолдардың аз бөлігін қайтаратын. Мәні аз, қайталанатын баған (жыныс, статус) үшін индекс көбіне пайдасыз.",
        },
        {
          id: "cost",
          question: "Индекс қосудың бағасы қандай?",
          options: [
            "Әр INSERT/UPDATE/DELETE индексті де жаңартады және қосымша орын алады",
            "Ешқандай баға жоқ",
            "SELECT баяулайды",
          ],
          answer: 0,
          explain: "Индекстер оқуды жылдамдатып, жазуды баяулатады. Сондықтан «барлық бағанға индекс»: қате стратегия.",
        },
      ],
    },
    {
      id: "transfer",
      title: "3-есеп: қауіпсіз аударым",
      focus: "sql",
      onEnter: [{ type: "sql/reset" }, { type: "sql/text", text: "-- Нұрланнан (id 2) Данаға (id 3) 250 аудар\n" }],
      body: `## Спецификация
Нұрланнан (id = 2) Данаға (id = 3) **250** аудар.

## Талаптар
- екі өзгеріс бір транзакцияда: BEGIN … COMMIT
- соңында: Нұрлан: 250, Дана: 450
- жүйедегі жалпы ақша өзгермейді (1700)

## Ойлан
- UPDATE accounts SET balance = balance − 250 WHERE id = 2: бұл бір жолды өзгертеді. Дұрыс жолды таңдағаныңды тексер!
- Екінші UPDATE-тен бұрын сервер құласа не болар еді: транзакцияда және онсыз?
- Шартты ұмытсаң (WHERE-сіз UPDATE) не болады? Транзакция ішінде болсаң: ROLLBACK сені құтқарады.

## Нақты әлемде
Банк жүйелерінде аударым: бір транзакция, әрі әр шот өзгерісі журналға (ledger) жазылады: жалпы дебет пен кредит әрдайым тең болуы тиіс.

## Автотексеруші
- кемінде бір COMMIT болды
- баланстар мен жалпы сома спецификацияға сай`,
      objectives: [
        { id: "ok", text: "Нұрлан 250, Дана 450, жалпы 1700, COMMIT", check: (s) => s.stats.commits > 0 && balance(s, 2) === 250 && balance(s, 3) === 450 && total(s) === 1700 && !s.sql.session.snapshot },
      ],
      quiz: [
        {
          id: "acid",
          question: "ACID-тің «A» әрпі (atomicity) нені кепілдейді?",
          options: ["Транзакцияның барлық өзгерісі не орындалады, не ешқайсысы", "Деректер шифрланады", "Транзакциялар жылдам орындалады"],
          answer: 0,
          explain: "Атомарлық: аралық күй ешқашан сақталмайды. Аударым жарты жолда құласа, ақша «жоғалмайды».",
        },
        {
          id: "check",
          question: "Нұрланда 250 емес, 100 ғана болса, қай жерде тексеру керек?",
          options: [
            "Транзакция ішінде: баланс жеткілікті ме: жоқ болса ROLLBACK (немесе CHECK (balance >= 0) шектеуі)",
            "Транзакциядан кейін",
            "Ешқайда: дерекқор өзі шешеді",
          ],
          answer: 0,
          explain: "Бизнес ережесі (теріс баланс болмайды) не транзакция логикасында, не CHECK шектеуінде болуы керек. Әйтпесе жалпы сома дұрыс болса да, бір шот теріске түседі.",
        },
      ],
    },
    {
      id: "serial",
      title: "4-есеп: құлыпсыз, бірақ дұрыс",
      focus: "race",
      onEnter: [{ type: "mode/set", mode: "race" }, { type: "race/locking", on: false }],
      body: `## Спецификация
Құлыптар **өшірулі**. Екі клиент (A мен B) бір шотқа 100-ден қосады. Төрт операцияны (A оқиды, A жазады, B оқиды, B жазады) **жоғалған жаңартусыз** орындайтын рет тап. Нәтиже 700 болуы керек.

## Ойлан
- 7-сабақта жаңарту қай кезде жоғалды? Қай оқу «ескірген» мәнді көрді?
- Транзакциялар бір-бірімен **қиылыспаса** не болады?
- Мұндай ретті **сериялық** (serial) дейді. Ал нәтижесі қандай да бір сериялық ретпен бірдей болатын ретті: **сериялықталатын** (serializable).

## Автотексеруші
- құлыпсыз режимде аяқталған жүгіріс, нәтиже 700

## Нақты әлемде
Дерекқорлардың ең қатаң оқшаулау деңгейі: SERIALIZABLE: ол кез келген параллель орындалу сериялық ретке баламалы болуына кепілдік береді (PostgreSQL мұны SSI әдісімен жасайды).`,
      objectives: [{ id: "serial", text: "Құлыпсыз, бірақ 700", check: (s) => s.stats.raceRuns.some((r) => !r.locking && !r.lost && r.balance === 700) }],
      quiz: [
        {
          id: "how",
          question: "Құлыпсыз дұрыс нәтиже беретін рет қайсы?",
          options: ["A оқиды, A жазады, B оқиды, B жазады", "A оқиды, B оқиды, A жазады, B жазады", "B оқиды, A оқиды, B жазады, A жазады"],
          answer: 0,
          explain: "B A-ның жазғанын оқиды (600), сосын 700 жазады. Ал екі оқу қатар болса, екеуі де 500-ді көреді: біреуінің жаңартуы жоғалады.",
        },
        {
          id: "why-locks",
          question: "Сериялық рет жұмыс істесе, неге құлыптар керек?",
          options: [
            "Нақты жүйеде ретті біз емес, кездейсоқ уақыт таңдайды: құлыптар (не оқшаулау) қауіпті ретке жол бермейді",
            "Құлыптар деректерді жылдамдатады",
            "Құлыптар тек дискіге жазу үшін керек",
          ],
          answer: 0,
          explain: "Мыңдаған параллель сұраныста қиылыстардың ретін бақылау мүмкін емес. Құлыптар мен оқшаулау деңгейлері кез келген ретте нәтиженің дұрыс болуын қамтамасыз етеді.",
        },
      ],
    },
  ],
};
