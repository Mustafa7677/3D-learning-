import { lessonCache, lessonCors, lessonIdempotency, lessonRoles, webMiddleContent } from "./middle";
import { withContent, withDeepDives, type LessonDefinition } from "@inside-tech/lesson-engine";
import { webContent } from "./content";
import { findAll, parseHtml, textContent } from "./html";
import { boxSizes, type WebLabAction, type WebLabState } from "./plugin";
import { BROKEN_HTML, DEPLOY_HTML, STARTER_HTML } from "./scenarios";
import { webDeepDives } from "./deep";
import { lessonPsetWeb } from "./pset";

type L = LessonDefinition<WebLabState, WebLabAction>;

const ok = (s: WebLabState, host: string, path: string, method = "GET") =>
  s.history.some((h) => h.host === host && h.path === path && h.method === method && h.status >= 200 && h.status < 300);
const status = (s: WebLabState, host: string, path: string, code: number) => s.history.some((h) => h.host === host && h.path === path && h.status === code);
const dom = (s: WebLabState) => parseHtml(s.html);

export const lessonInternet: L = {
  id: "web-1-internet",
  labId: "web",
  order: 1,
  title: "How Internet Works",
  summary: "URL енгізгеннен бет ашылғанға дейін: DNS, TCP, TLS, HTTP: әр қадам уақытымен.",
  estimatedMinutes: 12,
  steps: [
    {
      id: "journey",
      title: "Сұраудың саяхаты",
      body:
        "Браузерге inside.kz деп жазғанда, ол алдымен домен атауын IP адреске айналдырады (DNS), сосын сервермен байланыс орнатады (TCP), байланысты шифрлайды (TLS), содан кейін ғана бетті сұрайды (HTTP).\n\n«Жіберу» батырмасын бас та, 3D сахнада пакеттің жолын бақыла. Оң жақта әр кезеңнің уақыты көрсетіледі.",
      focus: "network",
      onEnter: [{ type: "scenario/load", id: "internet" }, { type: "req/set", params: { method: "GET", url: "https://inside.kz/", token: "" } }],
      objectives: [
        { id: "ok", text: "https://inside.kz/ бетін ал (200 OK)", check: (s) => ok(s, "inside.kz", "/") },
        { id: "stages", text: "DNS, TCP және TLS кезеңдерін көр", check: (s) => ["dns", "tcp", "tls"].every((k) => s.stats.stageKinds.includes(k)) },
      ],
    },
    {
      id: "dns-cache",
      title: "DNS кэші",
      body:
        "Браузер IP адресті есінде сақтайды. Сол бетті тағы сұрасаң, DNS серверіне бармайды: сұрау жылдамырақ.\n\nТағы бір рет жібер де, уақытты салыстыр.",
      focus: "network",
      objectives: [{ id: "cached", text: "DNS кэшінен IP алынған сұрау жібер", check: (s) => s.stats.dnsCacheHits >= 1 }],
    },
    {
      id: "https",
      title: "HTTP және HTTPS",
      body:
        "HTTPS-те TLS кезеңі қосылады: браузер мен сервер кілттер келісіп, деректерді шифрлайды. Бұл бір-екі қосымша сапар, бірақ онсыз сенің құпия сөзің желіде ашық жүреді.\n\nhttp:// арқылы жіберіп, кезеңдерді салыстыр.",
      focus: "network",
      objectives: [{ id: "http", text: "http:// арқылы сұрау жібер", check: (s) => s.stats.httpRequests >= 1 && s.stats.httpsRequests >= 1 }],
    },
    {
      id: "latency",
      title: "Кідіріс (latency)",
      body:
        "Сервер алыс болса, әр сапар ұзаққа созылады. HTTPS сұрау бетті алғанға дейін серверге бірнеше рет барып-қайтады, сондықтан кідіріс бірнеше есе көбейеді. Сол себепті ірі сайттар серверлерін әлемнің әр түкпіріне қояды (CDN).\n\nСервердің кідірісін 200 мс-қа дейін көтеріп, DNS кэшін тазала да, қайта жібер.",
      focus: "network",
      objectives: [
        { id: "slow", text: "Кідірісті өзгертіп, 1 секундтан ұзақ сұрауды көр", check: (s) => s.stats.latencyChanged && s.history.some((h) => h.ms >= 1000 && h.status === 200) },
      ],
      hints: ["«Сервер» бөліміндегі кідіріс жүгірткісі. 200 мс × ~6 сапар ≈ 1.2 с."],
    },
  ],
};

export const lessonHtml: L = {
  id: "web-2-html",
  labId: "web",
  order: 2,
  title: "HTML & DOM",
  summary: "HTML мәтінінен браузер DOM ағашын құрады. Кодты өзгерт: 3D ағаш бірден өзгереді.",
  estimatedMinutes: 12,
  steps: [
    {
      id: "tree",
      title: "DOM ағашы",
      body:
        "Браузер HTML мәтінін оқып, одан ағаш құрады: әр тег: түйін, ішіндегі тегтер: оның балалары. JavaScript те, CSS те осы ағашпен жұмыс істейді, мәтінмен емес.\n\n3D ағаштағы кез келген түйінді бас.",
      focus: "dom",
      onEnter: [{ type: "html/set", html: STARTER_HTML }],
      objectives: [{ id: "select", text: "DOM түйінін таңда", check: (s) => s.stats.domSelected >= 1 }],
    },
    {
      id: "build",
      title: "Тізім құр",
      body: "Кодқа тағы екі <li> қос: тізімде кемінде 3 элемент болсын. Әр жаңа тег ағашта жаңа бұтақ болып шығады.",
      focus: "dom",
      objectives: [
        { id: "li3", text: "<ul> ішінде кемінде 3 <li> болсын", check: (s) => findAll(dom(s).root, "ul").some((u) => u.children.filter((c) => c.tag === "li").length >= 3) },
        { id: "h1", text: "<h1> тақырыбы сақталсын", check: (s) => findAll(dom(s).root, "h1").length >= 1, sticky: false },
      ],
    },
    {
      id: "fix",
      title: "Қатені тап",
      body:
        "Бұл кодта тегтер дұрыс жабылмаған. Браузер мұндай қателерді үнсіз «түзейді»: бірақ әрдайым сен ойлағандай емес, сондықтан бет күтпеген түрде көрінеді.\n\nПарсердің ескертулерін оқып, барлық қатені түзет.",
      focus: "dom",
      onEnter: [{ type: "html/set", html: BROKEN_HTML }],
      objectives: [
        { id: "clean", text: "Барлық ескерту жойылсын", check: (s) => s.stats.htmlEdits >= 2 && dom(s).issues.length === 0 && findAll(dom(s).root, "li").length >= 2, sticky: false },
      ],
      hints: ["<b> мен <li> жабылмаған, ал </span> артық: оның орнында </div> болуы керек."],
    },
    {
      id: "attrs",
      title: "Атрибуттар",
      body: "Тегтің атрибуттары оған қосымша ақпарат береді: <a href=\"...\"> сілтеменің адресі, <img src=\"...\" alt=\"...\"> суреттің көзі мен сипаттамасы. alt: көзі көрмейтін адамдарға және сурет жүктелмегенде керек.",
      focus: "dom",
      objectives: [
        { id: "link", text: "href атрибуты бар <a> сілтемесін қос", check: (s) => findAll(dom(s).root, "a").some((a) => !!a.attrs.href) },
        { id: "img", text: "alt атрибуты бар <img> қос", check: (s) => findAll(dom(s).root, "img").some((i) => !!i.attrs.alt && !!i.attrs.src) },
      ],
    },
  ],
};

export const lessonCss: L = {
  id: "web-3-css",
  labId: "web",
  order: 3,
  title: "CSS & Layout",
  summary: "Box model қабаттарын 3D-де ажырат, box-sizing-ті түсін, flexbox-пен орналастыр.",
  estimatedMinutes: 14,
  steps: [
    {
      id: "box",
      title: "Box model",
      body:
        "Әр элемент: қораптар матрешкасы: мазмұн (content), ішкі шегініс (padding), жиек (border), сыртқы шегініс (margin). 3D-де олар бөлек қабаттар.\n\ncontent-box режимінде width тек мазмұнның ені. Элемент алатын толық орын 300px болсын.",
      focus: "box",
      onEnter: [{ type: "box/set", patch: { width: 200, padding: 20, border: 4, margin: 16, boxSizing: "content-box" } }],
      objectives: [
        { id: "300", text: "Толық ені (margin қоса) = 300px, padding ≥ 10, border ≥ 1", check: (s) => boxSizes(s.box).total === 300 && s.box.padding >= 10 && s.box.border >= 1 && s.box.boxSizing === "content-box", sticky: false },
      ],
      hints: ["Толық ені = width + 2·padding + 2·border + 2·margin."],
    },
    {
      id: "border-box",
      title: "box-sizing: border-box",
      body:
        "content-box-та padding қосқан сайын элемент кеңейеді: бұл шатастырады. border-box режимінде width жиекке дейінгі бүкіл ені: padding көбейсе, мазмұн кішірейеді. Көп сайттар осы режимді қолданады.",
      focus: "box",
      objectives: [
        { id: "bb", text: "border-box, width = 300px, padding ≥ 20: элемент 300px болып қалсын", check: (s) => s.box.boxSizing === "border-box" && s.box.width === 300 && s.box.padding >= 20 && boxSizes(s.box).borderBox === 300, sticky: false },
      ],
    },
    {
      id: "flex",
      title: "Flexbox",
      body:
        "Flexbox элементтерді бір қатарға (немесе бағанға) тізеді. justify-content: негізгі осьтегі орналасу, align-items: көлденең осьтегі тураланым.\n\nЭлементтерді шеттерге тарат (space-between) және ортаға турала (center).",
      focus: "flex",
      onEnter: [{ type: "flex/set", patch: { direction: "row", justify: "flex-start", align: "stretch", wrap: false, containerWidth: 560, items: 4 } }],
      objectives: [
        { id: "layout", text: "row + space-between + align center", check: (s) => s.flex.direction === "row" && s.flex.justify === "space-between" && s.flex.align === "center", sticky: false },
      ],
    },
    {
      id: "responsive",
      title: "Тар экран",
      body: "Телефонда контейнер тар. flex-wrap болмаса, элементтер сығылып немесе шетке шығып кетеді. wrap қосылса, сыймағандары келесі жолға түседі.\n\nКонтейнерді 320px-ке дейін тарылтып, бұзылмайтын ет.",
      focus: "flex",
      objectives: [{ id: "wrap", text: "Ені ≤ 320px, wrap қосулы, кемінде 4 элемент", check: (s) => s.flex.containerWidth <= 320 && s.flex.wrap && s.flex.items >= 4, sticky: false }],
    },
  ],
};

export const lessonJs: L = {
  id: "web-4-js",
  labId: "web",
  order: 4,
  title: "JavaScript",
  summary: "Call stack, Web API, microtask және task кезектері: JavaScript бір ағында қалай «көп іс» істейді.",
  estimatedMinutes: 15,
  steps: [
    {
      id: "stack",
      title: "Call stack",
      body:
        "JavaScript-те бір ғана call stack бар: бір уақытта бір функция орындалады. setTimeout пен fetch күтуді браузерге (Web API) береді, ал дайын болған callback-тер кезекте тұрады.\n\nБағдарламаны соңына дейін қадамдап орында.",
      focus: "loop",
      onEnter: [{ type: "loop/select", programId: "basic" }],
      objectives: [{ id: "run", text: "«setTimeout(0) vs Promise» бағдарламасын соңына дейін орында", check: (s) => s.stats.loopCompleted.includes("basic") }],
    },
    {
      id: "predict",
      title: "Нәтижені болжа",
      body:
        "Ереже: стек босағанда алдымен БАРЛЫҚ microtask (Promise.then) орындалады, тек сосын бір task (setTimeout, fetch callback). Сондықтан setTimeout(…, 0) да Promise-тен кейін келеді.\n\nКонсольге шығатын ретті болжа.",
      focus: "loop",
      onEnter: [{ type: "loop/select", programId: "basic" }],
      objectives: [{ id: "basic", text: "«setTimeout(0) vs Promise» ретін дұрыс болжа", check: (s) => s.stats.predictedCorrect.includes("basic") }],
    },
    {
      id: "timers",
      title: "Таймерлер",
      body: "Екі таймер: біреуі 100 мс, екіншісі 10 мс. Кодта бірінші жазылғаны бірінші орындала ма?",
      focus: "loop",
      onEnter: [{ type: "loop/select", programId: "timers" }],
      objectives: [{ id: "timers", text: "«Екі таймер» ретін дұрыс болжа", check: (s) => s.stats.predictedCorrect.includes("timers") }],
    },
    {
      id: "fetch",
      title: "fetch және Promise",
      body: "Желі сұрауы 120 мс алады. Оның callback-і ішінде тағы Promise бар. Алдымен қадамдап орында, сосын болжа: немесе керісінше.",
      focus: "loop",
      onEnter: [{ type: "loop/select", programId: "fetch" }],
      objectives: [
        { id: "run", text: "Бағдарламаны соңына дейін орында", check: (s) => s.stats.loopCompleted.includes("fetch") },
        { id: "predict", text: "Ретін дұрыс болжа", check: (s) => s.stats.predictedCorrect.includes("fetch") },
      ],
    },
  ],
};

const API = "api.inside.kz";

export const lessonBackend: L = {
  id: "web-5-backend",
  labId: "web",
  order: 5,
  title: "Backend & API",
  summary: "Сервер маршруттары, статус кодтары, авторизация және деректерді жіберу.",
  estimatedMinutes: 15,
  steps: [
    {
      id: "routes",
      title: "Маршрут және статус код",
      body:
        "Сервер әр сұраудың әдісі (GET, POST) мен жолына (/api/hello) қарап, қай кодты орындау керегін таңдайды: бұл маршрутизация. Маршрут табылмаса, сервер 404 қайтарады.\n\n/api/hello сұрауын жібер, сосын жоқ жолды сұрап көр.",
      focus: "network",
      onEnter: [{ type: "scenario/load", id: "api" }, { type: "req/set", params: { method: "GET", url: "https://api.inside.kz/api/hello", token: "" } }],
      objectives: [
        { id: "200", text: "GET /api/hello → 200", check: (s) => ok(s, API, "/api/hello") },
        { id: "404", text: "Жоқ жолды сұрап, 404 ал", check: (s) => s.history.some((h) => h.host === API && h.status === 404) },
      ],
    },
    {
      id: "new-route",
      title: "Жаңа маршрут",
      body: "Серверге өз маршрутыңды қос: GET /api/time, JSON жауап қайтарсын. Сосын оны браузерден сұра.",
      focus: "network",
      objectives: [{ id: "time", text: "GET /api/time → 200", check: (s) => ok(s, API, "/api/time") }],
      hints: ["«Маршруттар» бөлімінде: әдіс GET, жол /api/time, түрі JSON, мысалы {\"time\":\"12:00\"}."],
    },
    {
      id: "auth",
      title: "Авторизация",
      body:
        "/api/secret тек рұқсаты барларға ашық. Token-сіз сұрау 401 Unauthorized алады. Token (кілт) Authorization тақырыбында жіберіледі: Authorization: Bearer secret-123.",
      focus: "network",
      onEnter: [{ type: "req/set", params: { url: "https://api.inside.kz/api/secret", token: "" } }],
      objectives: [
        { id: "401", text: "Token-сіз сұрап, 401 ал", check: (s) => status(s, API, "/api/secret", 401) },
        { id: "200", text: "Token-мен 200 ал", check: (s) => ok(s, API, "/api/secret") },
      ],
      hints: ["Token: secret-123"],
    },
    {
      id: "post",
      title: "POST: деректерді жіберу",
      body: "GET деректерді оқиды, POST жаңасын жасайды. POST /api/users сұрауымен жаңа қолданушы қос (name, city), сосын GET /api/users арқылы ол тізімде пайда болғанын тексер.",
      focus: "network",
      onEnter: [{ type: "req/set", params: { method: "POST", url: "https://api.inside.kz/api/users", token: "", body: { name: "", city: "" } } }],
      objectives: [
        { id: "201", text: "POST /api/users → 201 Created", check: (s) => status(s, API, "/api/users", 201) },
        {
          id: "read",
          text: "Сосын GET /api/users жаңа жазбаны көрсетсін",
          check: (s) => {
            const post = s.history.findIndex((h) => h.method === "POST" && h.status === 201);
            const get = s.history.findIndex((h) => h.method === "GET" && h.path === "/api/users" && h.status === 200);
            return post >= 0 && get >= 0 && get < post; // history is newest-first
          },
        },
      ],
    },
  ],
};

export const lessonDb: L = {
  id: "web-6-db",
  labId: "web",
  order: 6,
  title: "Databases",
  summary: "SQL арқылы деректерді оқу, қосу, өзгерту, өшіру және индекстің жылдамдыққа әсері.",
  estimatedMinutes: 15,
  steps: [
    {
      id: "select",
      title: "SELECT",
      body: "Дерекқор: кестелер жиыны. SELECT кестеден жолдарды оқиды, WHERE оларды сүзеді.\n\nМысалы: SELECT name, city FROM users WHERE city = 'Алматы'",
      focus: "db",
      onEnter: [{ type: "scenario/load", id: "api" }, { type: "sql/set", text: "SELECT * FROM users" }],
      objectives: [{ id: "where", text: "WHERE шарты бар SELECT орында", check: (s) => s.stats.sqlWhere }],
    },
    {
      id: "crud",
      title: "INSERT, UPDATE, DELETE",
      body: "Деректермен жұмыстың төрт әрекеті: CRUD: Create (INSERT), Read (SELECT), Update (UPDATE), Delete (DELETE). WHERE-сіз UPDATE не DELETE бүкіл кестені өзгертеді: абай бол!",
      focus: "db",
      objectives: [
        { id: "insert", text: "INSERT орында", check: (s) => s.stats.sqlKinds.includes("insert") },
        { id: "update", text: "UPDATE орында", check: (s) => s.stats.sqlKinds.includes("update") },
        { id: "delete", text: "DELETE орында", check: (s) => s.stats.sqlKinds.includes("delete") },
      ],
      hints: ["INSERT INTO users (name, city) VALUES ('Арман', 'Тараз')", "UPDATE users SET city = 'Астана' WHERE id = 2", "DELETE FROM users WHERE id = 3"],
    },
    {
      id: "index",
      title: "Индекс",
      body:
        "orders кестесінде 2000 жол бар. user_id бойынша іздегенде дерекқор әр жолды тексереді: толық сканерлеу. Индекс: кітаптың соңындағы көрсеткіш сияқты: дерекқор керекті жолдарға бірден жетеді.\n\nАлдымен индекссіз ізде, сосын CREATE INDEX ON orders (user_id) орындап, қайта ізде. «Қаралған жолдар» санын салыстыр.",
      focus: "db",
      onEnter: [{ type: "sql/set", text: "SELECT * FROM orders WHERE user_id = 7" }],
      objectives: [
        { id: "scan", text: "orders бойынша толық сканерлеуді көр", check: (s) => s.stats.fullScan.includes("orders") },
        { id: "fast", text: "Индекс жасап, сол сұрауды жылдам орында", check: (s) => s.stats.indexScan.includes("orders") },
      ],
    },
  ],
};

export const lessonDebug: L = {
  id: "web-7-debug",
  labId: "web",
  order: 7,
  title: "Debugging",
  summary: "shop.kz бұзылған: DNS, 404, 500 және баяу сұрауды тауып, түзет.",
  estimatedMinutes: 18,
  steps: [
    {
      id: "dns",
      title: "Сайт ашылмайды",
      body:
        "shop.kz ашылмайды. Қате хабарын оқы: браузер қай кезеңде тоқтады? DNS жазбаларын тексер: домен атауында қате бар.",
      focus: "network",
      onEnter: [{ type: "scenario/load", id: "debug" }, { type: "req/set", params: { method: "GET", url: "https://shop.kz/", token: "" } }],
      objectives: [{ id: "resolve", text: "shop.kz домені IP адреске шешілсін", check: (s) => s.history.some((h) => h.host === "shop.kz" && h.status > 0) }],
      hints: ["DNS бөлімінде shpo.kz деп жазылған. shop.kz → 93.184.10.5 жазбасын қос."],
    },
    {
      id: "404",
      title: "404 Not Found",
      body: "Енді сервер табылды, бірақ басты бет 404 қайтарады. Сервердің маршруттарын қара: басты бет қай жолда тұр?",
      focus: "network",
      objectives: [{ id: "home", text: "https://shop.kz/ → 200", check: (s) => ok(s, "shop.kz", "/") }],
    },
    {
      id: "500",
      title: "500 Internal Server Error",
      body: "/api/products сұрауы 500 қайтарады: сервер кодында қате бар. 500: сенің сұрауыңда емес, сервердің өзінде мәселе барын білдіреді.",
      focus: "network",
      onEnter: [{ type: "req/set", params: { url: "https://shop.kz/api/products" } }],
      objectives: [
        { id: "see", text: "500 қатесін көр", check: (s) => status(s, "shop.kz", "/api/products", 500) },
        { id: "fix", text: "Маршрутты түзетіп, 200 ал", check: (s) => ok(s, "shop.kz", "/api/products") },
      ],
      hints: ["Маршрут түрін «crash»-тан «JSON»-ға ауыстыр."],
    },
    {
      id: "slow",
      title: "Баяу API",
      body: "/api/orders/7 жұмыс істейді, бірақ өте баяу. Сұраудың кезеңдерін қара: уақыттың көбі қайда кетеді? Мәселені тауып, сұрауды 600 мс-тан жылдам ет.",
      focus: "network",
      onEnter: [{ type: "req/set", params: { url: "https://shop.kz/api/orders/7" } }],
      objectives: [
        { id: "slow", text: "Баяу сұрауды көр (≥ 1000 мс)", check: (s) => s.history.some((h) => h.path === "/api/orders/7" && h.status === 200 && h.ms >= 1000) },
        { id: "fast", text: "Сол сұрау < 600 мс", check: (s) => s.history.some((h) => h.path === "/api/orders/7" && h.status === 200 && h.ms < 600 && !h.fromCache) },
      ],
      hints: ["SQL консолінде: CREATE INDEX ON orders (user_id)"],
    },
  ],
};

export const lessonDeploy: L = {
  id: "web-8-deploy",
  labId: "web",
  order: 8,
  title: "Deploy",
  summary: "Өз бетіңді жаз, доменге байла, серверге шығар және кэш мәселесін шеш.",
  estimatedMinutes: 18,
  steps: [
    {
      id: "write",
      title: "Сайтыңды жаз",
      body: "Бұл: сенің сайтың. Тақырыбын (<h1>) өзгерт, кемінде бір абзац (<p>) жаз. Қате болмасын.",
      focus: "dom",
      onEnter: [{ type: "scenario/load", id: "deploy" }, { type: "html/set", html: DEPLOY_HTML }],
      objectives: [
        {
          id: "content",
          text: "Өз тақырыбың мен абзацың бар, HTML қатесіз",
          check: (s) => {
            const d = dom(s);
            const h1 = findAll(d.root, "h1")[0];
            return d.issues.length === 0 && !!h1 && textContent(h1) !== "Менің сайтым" && findAll(d.root, "p").length >= 1;
          },
          sticky: false,
        },
      ],
    },
    {
      id: "publish",
      title: "Интернетке шығар",
      body:
        "Сайтты серверге жүктеу: deploy. Бірақ оны адамдар табуы үшін домен атауы IP адреске бағытталуы керек.\n\n1) DNS-ке mysite.kz → 93.184.10.9 жазбасын қос. 2) «Deploy» бас. 3) https://mysite.kz/ ашып көр.",
      focus: "network",
      onEnter: [{ type: "req/set", params: { method: "GET", url: "https://mysite.kz/", token: "" } }],
      objectives: [
        { id: "deploy", text: "Сайтты deploy жаса", check: (s) => s.stats.deploys >= 1 },
        { id: "live", text: "https://mysite.kz/ → 200, сенің бетің", check: (s) => s.history.some((h) => h.host === "mysite.kz" && h.path === "/" && h.status === 200 && h.body === s.html) },
      ],
    },
    {
      id: "cache",
      title: "Неге жаңа нұсқа көрінбейді?",
      body:
        "Сервер браузерге «бұл бетті 60 секунд сақта» дейді (Cache-Control: max-age=60). Енді тақырыпты өзгертіп, қайта deploy жаса да, бетті аш: ескі нұсқа шығады!\n\nКэш бетті жылдамдатады, бірақ жаңартуды кешіктіреді. Жаңа нұсқаны көрудің жолын тап.",
      focus: "network",
      objectives: [
        { id: "stale", text: "Кэштен ескі нұсқаны көр", check: (s) => s.stats.staleSeen },
        { id: "fresh", text: "Жаңа нұсқаны ал", check: (s) => s.stats.freshAfterStale },
      ],
      hints: ["Кэшті тазала, уақытты 60 с алға жылжыт немесе max-age-ті 0 қой."],
    },
    {
      id: "export",
      title: "Файлды сақта",
      body: "Сенің бетің: жай HTML файл. Оны жүктеп алып, кез келген хостингке (GitHub Pages, Netlify) салуға болады.",
      focus: "dom",
      objectives: [{ id: "export", text: "HTML файлын экспортта", check: (s) => s.stats.exports >= 1 }],
    },
  ],
};

/** Lessons with their lecture text and concept checks merged in. */
export const webLessons: L[] = [
  lessonInternet,
  lessonHtml,
  lessonCss,
  lessonJs,
  lessonBackend,
  lessonDb,
  lessonDebug,
  lessonDeploy,
  lessonPsetWeb,
  // Middle level
  lessonCache,
  lessonRoles,
  lessonIdempotency,
  lessonCors,
].map((l) => withDeepDives(withContent(l, webContent[l.id] ?? webMiddleContent[l.id] ?? {}), webDeepDives[l.id] ?? {}));
