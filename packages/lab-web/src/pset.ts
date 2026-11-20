import type { LessonDefinition } from "@inside-tech/lesson-engine";
import type { WebLabAction, WebLabState } from "./plugin";
import { execute, type Row } from "./sql";

type L = LessonDefinition<WebLabState, WebLabAction>;

const API = "api.inside.kz";

/**
 * The last SELECT returned exactly what `reference` returns on the same data,
 * comparing only `cols` (so `SELECT *` is fine) and row order.
 */
function lastMatches(s: WebLabState, reference: string, cols: string[]): boolean {
  const last = s.sql.last;
  if (!last?.ok || last.kind !== "select" || !cols.every((c) => last.columns.includes(c))) return false;
  const ref = execute(s.world.db, reference).result;
  if (!ref.ok || ref.rows.length === 0 || ref.rows.length !== last.rows.length) return false;
  return ref.rows.every((r, i) => cols.every((c) => r[c] === last.rows[i]![c]));
}

const ORDERS_PATH = /^\/api\/users\/(\d+)\/orders$/;

/** A response body is exactly the 5 most expensive orders of the user named in the path. */
function ordersOk(s: WebLabState, body: string, path: string): boolean {
  const id = Number(ORDERS_PATH.exec(path)?.[1]);
  let rows: Row[];
  try {
    rows = JSON.parse(body) as Row[];
  } catch {
    return false;
  }
  const ref = execute(s.world.db, `SELECT price FROM orders WHERE user_id = ${id} ORDER BY price DESC LIMIT 5`).result;
  return (
    Array.isArray(rows) &&
    ref.rows.length > 0 &&
    rows.length === ref.rows.length &&
    rows.every((r, i) => r.user_id === id && r.price === ref.rows[i]!.price)
  );
}

export const lessonPsetWeb: L = {
  id: "web-9-pset",
  labId: "web",
  order: 9,
  title: "Problem Set: full-stack",
  summary: "SQL сұраныстар, өз API-ің және event loop болжамы. Тек спецификация мен автотексеруші.",
  estimatedMinutes: 40,
  steps: [
    {
      id: "sql",
      title: "1-есеп: SQL",
      focus: "db",
      onEnter: [{ type: "scenario/load", id: "api" }, { type: "sql/set", text: "SELECT * FROM users" }],
      body: `## Спецификация
Дерекқорда екі кесте бар: \`users (id, name, city)\` және \`orders (id, user_id, item, price)\` — 2000 жол. Үш сұраныс жаз. Автотексеруші сенің **соңғы** SELECT нәтижеңді эталон сұраныстың нәтижесімен жол-жолымен салыстырады (баған реті мен артық бағандар маңызды емес, ал жол **реті** маңызды).

1. **Астана мен Алматыдан басқа** қалалардағы пайдаланушылардың аттары, **алфавит бойынша**.
2. 3-пайдаланушының **ең қымбат 5** тапсырысы, бағасы кемуі бойынша.
3. 5-пайдаланушының барлық тапсырыстары — бірақ дерекқор 2000 жолдың бәрін **қарамауы** керек (индекс арқылы).

## Синтаксис еске салғыш
\`\`\`
SELECT бағандар FROM кесте
  WHERE шарт AND шарт
  ORDER BY баған [ASC|DESC]
  LIMIT n
CREATE INDEX ON кесте (баған)
\`\`\`
Салыстыру: \`=  !=  <  >  <=  >=\`. Мәтін — бір тырнақшада: \`'Алматы'\`.

> ⚠ Жиі қате: \`ORDER BY\` жоқ сұраныстың реті — «кездейсоқ». Ол бүгін дұрыс шығуы мүмкін, ертең — жоқ. Рет керек болса, оны әрдайым **айт**.

## Енді сен
Үш сұранысты жазып, әрқайсысын орында.`,
      objectives: [
        {
          id: "q1",
          text: "1: Астана мен Алматыдан тыс пайдаланушылар, алфавитпен",
          check: (s) => lastMatches(s, "SELECT name FROM users WHERE city != 'Алматы' AND city != 'Астана' ORDER BY name", ["name"]),
        },
        {
          id: "q2",
          text: "2: 3-пайдаланушының ең қымбат 5 тапсырысы",
          check: (s) =>
            /user_id\s*=\s*3\b/i.test(s.sql.text) && lastMatches(s, "SELECT price FROM orders WHERE user_id = 3 ORDER BY price DESC LIMIT 5", ["price"]),
        },
        {
          id: "q3",
          text: "3: 5-пайдаланушының тапсырыстары индекс арқылы",
          check: (s) => s.sql.last?.usedIndex === "user_id" && lastMatches(s, "SELECT id FROM orders WHERE user_id = 5", ["id"]),
        },
      ],
      hints: [
        "1: SELECT name FROM users WHERE city != 'Алматы' AND city != 'Астана' ORDER BY name",
        "3: алдымен CREATE INDEX ON orders (user_id)",
      ],
      quiz: [
        {
          id: "limit",
          question: "«ORDER BY price DESC LIMIT 5» мен «LIMIT 5» сосын сұрыптау — айырмашылығы бар ма?",
          options: [
            "Иә: SQL алдымен бәрін сұрыптап, сосын 5-ін алады; керісінше болса — кездейсоқ 5 жолдың ішіндегі ең қымбаттары",
            "Жоқ, нәтиже бірдей",
            "LIMIT әрдайым ең үлкен мәндерді алады",
          ],
          answer: 0,
          explain: "SELECT-тің логикалық реті: FROM → WHERE → ORDER BY → LIMIT. Сондықтан «ең қымбат 5» дұрыс шығады. Алдымен кез келген 5 жолды алып, сосын сұрыптасақ — ол «ең қымбат» емес.",
        },
        {
          id: "index",
          question: "user_id бойынша индекс бар. Қай сұраныс одан пайда көрмейді?",
          options: ["WHERE user_id = 5", "WHERE price > 1000", "WHERE user_id = 5 AND price > 1000"],
          answer: 1,
          explain: "Индекс тек өзі салынған баған бойынша іздегенде көмектеседі. price бойынша индекс жоқ — толық сканерлеу. Үшінші сұраныста индекс user_id = 5 жолдарын тауып береді, price шарты солардың ішінде ғана тексеріледі.",
        },
      ],
    },
    {
      id: "api",
      title: "2-есеп: өз API-ің",
      focus: "network",
      onEnter: [{ type: "req/set", params: { method: "GET", url: "https://api.inside.kz/api/users/2/orders", token: "" } }],
      body: `## Спецификация
Мобильді қосымша командасы сенен endpoint сұрайды:
\`\`\`
GET /api/users/:id/orders   →   200, сол пайдаланушының ең қымбат 5 тапсырысы (JSON массив, бағасы кемуі бойынша)
\`\`\`
Неге бәрі емес? Әр пайдаланушыда ≈ 250 тапсырыс — телефонға 15 КБ жіберудің мәні жоқ. Нақты API-лер деректі **беттеп** (pagination) береді: LIMIT пен ORDER BY осы үшін.
Бұл — **жеке** деректер, сондықтан:
- token-сіз сұрау → **401**
- дұрыс token-мен (\`secret-123\`) → **200**

## Автотексеруші
1. \`/api/users/N/orders\` сұрауына 200 және денесінде **дәл** N-пайдаланушының ең қымбат 5 тапсырысы, дұрыс ретпен.
2. Маршрут қорғалған: token-сіз 401, **кейін** token-мен 200.

## Ойлан
- Маршрут жолындағы \`:id\` — параметр. SQL ішінде ол \`:id\` болып қолданылады, сервер оны **параметр ретінде** қояды (SQL injection жоқ).
- Неге 401, 404 емес? 404 — «мұндай ресурс жоқ». Бірақ ресурс бар, тек сен кім екеніңді дәлелдемедің.

## Енді сен
Маршрутты құр, тексер, сосын қорға.`,
      objectives: [
        {
          id: "orders",
          text: "GET /api/users/N/orders → N-нің ең қымбат 5 тапсырысы",
          check: (s) => s.history.some((h) => h.host === API && h.method === "GET" && h.status === 200 && ORDERS_PATH.test(h.path) && ordersOk(s, h.body, h.path)),
        },
        {
          id: "auth",
          text: "Token-сіз 401, сосын token-мен 200",
          check: (s) => {
            const mine = s.history.filter((h) => h.host === API && ORDERS_PATH.test(h.path));
            const denied = mine.findIndex((h) => h.status === 401);
            const allowed = mine.findIndex((h) => h.status === 200);
            return denied >= 0 && allowed >= 0 && allowed < denied; // history is newest-first
          },
        },
      ],
      hints: ["Маршрут: GET, жол /api/users/:id/orders, түрі SQL, SELECT * FROM orders WHERE user_id = :id ORDER BY price DESC LIMIT 5. Сосын «Token керек» қосқышын қос."],
      quiz: [
        {
          id: "401",
          question: "Пайдаланушы кірген, бірақ басқа біреудің тапсырыстарын сұрап тұр. Дұрыс жауап қандай?",
          options: ["403 Forbidden", "401 Unauthorized", "404 Not Found", "200 OK"],
          answer: 0,
          explain: "Сервер оны таниды (401 емес), бірақ бұл деректерге рұқсаты жоқ — 403. Кейбір жүйелер ресурс барын жасыру үшін әдейі 404 қайтарады. Ал 200 — қауіпсіздік қатесі (IDOR).",
        },
        {
          id: "param",
          question: "Неге SQL ішінде :id параметрін қолданамыз, жолды жай қосып жазбаймыз?",
          options: [
            "Параметр дерек ретінде ғана қойылады — «2 OR 1=1» сияқты мән SQL болып орындалмайды",
            "Параметр жылдамырақ, басқа айырмашылық жоқ",
            "Жолды қосу синтаксистік қате береді",
          ],
          answer: 0,
          explain: "/api/users/2 OR 1=1/orders сияқты сұрау жолды қосқан кодта бүкіл кестені ашар еді. Параметрлер деректі кодтан бөледі — SQL injection-нан қорғаудың негізгі тәсілі.",
        },
      ],
    },
    {
      id: "loop",
      title: "3-есеп: event loop",
      focus: "loop",
      onEnter: [{ type: "loop/select", programId: "nested" }],
      body: `## Спецификация
Екі жаңа бағдарлама: «кірістірілген кезектер» және «жарыс». Әрқайсысының шығысын **іске қоспай** болжа.

## Ережелер (басқа ештеңе керек емес)
1. Синхронды код соңына дейін орындалады.
2. Сосын microtask кезегі (Promise.then) **толық** босатылады — орындалу кезінде қосылған microtask-тар да.
3. Сосын **бір** macrotask (setTimeout, желі жауабы) — және қайтадан 2-қадам.
4. Таймерлер кезегі уақыт бойынша: 0 мс-тық таймер 50 мс-тық таймерден бұрын, қай ретпен жазылғанына қарамастан.
5. fetch жауабы желі кешігуінен кейін келеді; оның \`.then\`-і — сол кезде орындалады.

## Әдіс
Қағаз ал. Үш баған сыз: **стек**, **microtask-тар**, **macrotask-тар (уақытымен)**. Әр жолды «орында» да, кезектерді жаңартып отыр. Бұл — «trace table», CS50-дің негізгі құралы.

## Енді сен
Екі бағдарламаның ретін де дұрыс болжа. Қателессең — «Болжамды тазалау» да, trace table-ды қайта тексер.`,
      objectives: [
        { id: "nested", text: "«Кірістірілген кезектер» ретін дұрыс болжа", check: (s) => s.stats.predictedCorrect.includes("nested") },
        { id: "race", text: "«Жарыс» ретін дұрыс болжа", check: (s) => s.stats.predictedCorrect.includes("race") },
      ],
      quiz: [
        {
          id: "nested",
          question: "«Кірістірілген кезектер»-де неге 4 саны 2-ден бұрын шығады?",
          options: [
            "4 — microtask, 2 — macrotask; синхронды кодтан кейін алдымен microtask-тар толық босатылады",
            "Себебі 4 кодта кейінірек жазылған",
            "Себебі setTimeout 0 мс-тан ұзақ күтеді",
          ],
          answer: 0,
          explain: "Синхронды: 1, 6. Microtask: 4 (ол 5-ке таймер қояды). Macrotask кезегі: [2-нің таймері, 5-тің таймері]. 2 шығады → оның ішіндегі Promise 3-ті microtask-қа қояды → ол бірден орындалады. Соңында 5. Нәтиже: 1 6 4 2 3 5.",
        },
        {
          id: "race",
          question: "«Жарыс»-та B неге A-дан бұрын, бірақ C-дан кейін?",
          options: [
            "C — 0 мс таймер; fetch жауабы 20 мс-та келеді; A — 50 мс таймер",
            "Себебі fetch әрдайым ең баяу",
            "Себебі Promise-тер таймерлерден кейін орындалады",
          ],
          answer: 0,
          explain: "Синхронды: E. Microtask: D. Сосын уақыт бойынша macrotask-тар: C (0 мс), желі жауабы (20 мс) → B, A (50 мс). Нәтиже: E D C B A.",
        },
      ],
    },
  ],
};
