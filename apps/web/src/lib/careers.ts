/**
 * Мамандық картасы: eight IT professions, what a day in each looks like, and a road through
 * this site's lessons that leads there. A short interest test ranks them for the learner; the
 * road shows how ready they already are from the lessons they finished.
 */
import type { Gadget, LessonProgress } from "@inside-tech/lesson-engine";

export type CareerId = "frontend" | "backend" | "data" | "security" | "gamedev" | "devops" | "network" | "embedded";

export interface Career {
  id: CareerId;
  title: string;
  who: Gadget;
  color: string;
  tagline: string;
  does: string[];
  day: { at: string; text: string }[];
  tools: string[];
  /** Lessons on this site, in the order to take them. */
  road: string[];
  project: string;
  where: string;
  play: { href: string; label: string };
}

export const CAREERS: Career[] = [
  {
    id: "frontend",
    title: "Фронтенд әзірлеуші",
    who: "phone",
    color: "#32e0ff",
    tagline: "Адамдар көретін және басатын нәрсенің бәрін жасайды: сайт, қосымша, батырма, анимация.",
    does: ["Дизайнерің суретін нақты, жылдам ашылатын бетке айналдырады", "Бет телефонда да, үлкен экранда да әдемі көрінуін қадағалайды", "Пайдаланушы басқанда не болатынын JavaScript-пен жазады"],
    day: [
      { at: "09:30", text: "Командамен 15 минуттық кездесу: кеше не істедім, бүгін не істеймін" },
      { at: "11:00", text: "Жаңа төлем бетінің макетін кодқа айналдыру" },
      { at: "14:00", text: "Телефонда батырма экраннан шығып кетті: CSS-ті түзету" },
      { at: "16:30", text: "Әріптестің кодын қарап, пікір жазу (code review)" },
    ],
    tools: ["HTML", "CSS", "JavaScript", "React", "Figma", "Браузердің DevTools"],
    road: ["web-1-internet", "web-2-html", "web-3-css", "web-4-js", "web-7-debug", "web-8-deploy", "web-10-cache", "web-15-waterfall"],
    project: "Мектебіңнің кесте сайтын жаса: телефонда ыңғайлы, бүгінгі сабақтар бірінші көрінеді.",
    where: "Банктер мен маркетплейстер, стартаптар, веб-студиялар, кез келген өнімі бар компания.",
    play: { href: "/arcade?g=bughunt", label: "Баг аулау ойынында кодтағы қателерді жой" },
  },
  {
    id: "backend",
    title: "Бэкенд әзірлеуші",
    who: "server",
    color: "#ffd23d",
    tagline: "Экранның артындағы бәрі соның қолында: деректер, логика, миллиондаған сұранысқа жауап.",
    does: ["Қосымшаның серверін және API-ін жазады", "Деректерді дерекқорда дұрыс сақтап, тез табады", "Жүйе қатты жүктемеде де құламайтындай етеді"],
    day: [
      { at: "10:00", text: "Жаңа «тапсырысты қайтару» мүмкіндігінің API-ін жобалау" },
      { at: "12:00", text: "Баяу SQL сұранысын табу: индекс қосқанда 3 секунд 20 мс болды" },
      { at: "15:00", text: "Бір сұраныс екі рет келсе ақша екі рет алынбайтынын тексеру" },
      { at: "17:00", text: "Тесттер жасыл, өзгерісті серверге шығару" },
    ],
    tools: ["Python немесе Go", "SQL", "PostgreSQL", "HTTP және REST", "Docker", "Git"],
    road: ["web-1-internet", "web-5-backend", "db-1-select", "db-2-join", "db-4-index", "db-6-transactions", "web-11-roles", "web-12-idempotency"],
    project: "Сыныптың кітапханасына API жаса: кітапты алу, қайтару, кімде қай кітап жүргенін көру.",
    where: "Банктер, телеком, логистика, мемлекеттік сервистер, такси мен жеткізу қосымшалары.",
    play: { href: "/arcade?g=cache", label: "Кэш сақшысы ойынында жылдамдықты сына" },
  },
  {
    id: "data",
    title: "Деректер ғалымы / ML инженер",
    who: "robot",
    color: "#b6ff3d",
    tagline: "Деректердің ішінен заңдылық табады және компьютерді мысалдардан үйретеді.",
    does: ["Деректерді жинап, тазалап, графикке айналдырады", "Болжау жасайтын модельдерді үйретеді және тексереді", "Модельдің қай жерде қателесетінін және неге екенін түсіндіреді"],
    day: [
      { at: "09:00", text: "Кешегі модельдің нәтижесі: дәлдік 94%, бірақ сирек жағдайларда нашар" },
      { at: "11:30", text: "Деректерде қайталанған жолдар табылды: оларды тазалау" },
      { at: "14:00", text: "Жаңа модель үйретілуде, ал бұл уақытта графиктер салу" },
      { at: "16:00", text: "Бизнеске түсіндіру: модель неге осындай шешім қабылдайды" },
    ],
    tools: ["Python", "NumPy және pandas", "PyTorch", "Jupyter", "SQL", "Статистика"],
    road: ["ai-1-data", "ai-2-neuron", "ai-3-network", "ai-4-training", "ai-5-overfitting", "la-2-dot", "ai-11-metrics", "ai-14-leakage"],
    project: "Сыныптың бағаларынан қай пәннің қай пәнмен байланысты екенін тауып, графикпен көрсет.",
    where: "Банктер (алаяқтықты табу), медицина, ауыл шаруашылығы, интернет-дүкендер, зерттеу орталықтары.",
    play: { href: "/world?i=ai", label: "Нейрон ормандарының боссын жең" },
  },
  {
    id: "security",
    title: "Киберқауіпсіздік маманы",
    who: "laptop",
    color: "#ff3d7f",
    tagline: "Шабуылшыдай ойлайды, бірақ қорғау үшін: осалдықты олардан бұрын табады.",
    does: ["Жүйелерді бұзып көріп, осал жерлерін табады (пентест)", "Шабуылды ерте байқайтын бақылау құрады", "Қызметкерлерге фишингті тануды үйретеді"],
    day: [
      { at: "09:00", text: "Түнгі логтар: бір IP 5000 рет құпиясөз теріпті, оны бұғаттау" },
      { at: "11:00", text: "Жаңа сайттағы іздеу жолынан SQL injection табылды: әзірлеушілерге хабарлау" },
      { at: "14:00", text: "Құпиясөздер тұзбен хэштелгенін тексеру" },
      { at: "16:00", text: "Компанияға фишинг жаттығуы: жалған хатты кім басты?" },
    ],
    tools: ["Linux", "Wireshark", "Burp Suite", "Python", "Криптография", "Желі хаттамалары"],
    road: ["sec-1-caesar", "sec-3-xor", "sec-4-hash", "sec-5-passwords", "sec-7-rsa", "sec-8-injection", "sec-13-certs", "net-1-packets"],
    project: "Құпиясөз тексергішін жаса: ол құпиясөздің беріктігін бағалап, неге әлсіз екенін айтады.",
    where: "Банктер, мемлекеттік органдар, телеком, қауіпсіздік компаниялары, CTF жарыстары.",
    play: { href: "/arcade?g=defense", label: "Брандмауэр қорғанысында серверді қорға" },
  },
  {
    id: "gamedev",
    title: "Ойын әзірлеуші",
    who: "computer",
    color: "#ff9f1c",
    tagline: "Физика, графика, жасанды интеллект және оқиға: бәрін бір әлемге жинайды.",
    does: ["Кейіпкердің қозғалысын, физикасын, соқтығысуын жазады", "Жаулардың мінез-құлқын (AI) жасайды", "Ойын әлсіз компьютерде де 60 кадрмен жүруін қамтамасыз етеді"],
    day: [
      { at: "10:00", text: "Кейіпкер жылдам жүгіргенде қабырғадан өтіп кетеді: соқтығысуды түзету" },
      { at: "12:30", text: "Жау енді ойыншыны көріп, қуып, жоғалтқанда іздейді" },
      { at: "15:00", text: "Ойыншылар тестінен пікір: 3-деңгей тым қиын" },
      { at: "17:00", text: "Кадр жиілігі түсіп кетті: профайлермен себебін табу" },
    ],
    tools: ["Unity немесе Godot", "C#", "Векторлар мен матрицалар", "Blender", "Профайлер"],
    road: ["game-1-objects", "game-3-loop", "game-4-physics", "la-1-vectors", "game-7-logic", "game-10-pathfinding", "game-11-fsm", "game-14-timestep"],
    project: "Бір экранды платформер жаса: секіру, ауырлық күші, бір жау және жеңіс есігі.",
    where: "Ойын студиялары, мобильді ойындар, білім беру қосымшалары, VR және симуляторлар.",
    play: { href: "/arcade?g=surf", label: "Пакет-серферде өз рекордыңды жаса" },
  },
  {
    id: "devops",
    title: "DevOps / SRE инженері",
    who: "server",
    color: "#a46bff",
    tagline: "Сайт түнде де, мереке күні де, миллион адам кіргенде де жұмыс істеуі осыған байланысты.",
    does: ["Кодты автоматты түрде тексеріп, серверге шығаратын конвейер құрады", "Серверлердің денсаулығын бақылап, ақауды тез табады", "Жүктеме өскенде жүйе өздігінен кеңеюін баптайды"],
    day: [
      { at: "08:00", text: "Түнгі ескерту: бір сервер жауап бермеді, оркестратор оны ауыстырыпты" },
      { at: "10:30", text: "Сату акциясына дайындық: автомасштабтау шектерін тексеру" },
      { at: "14:00", text: "Жаңа нұсқаны алдымен 5% пайдаланушыға шығару (canary)" },
      { at: "16:00", text: "Ақаудан кейінгі талдау: кінәлі іздемей, себебін жазу" },
    ],
    tools: ["Linux", "Docker", "Kubernetes", "CI/CD", "Prometheus және Grafana", "Bash"],
    road: ["cloud-1-containers", "cloud-2-orchestration", "cloud-3-scaling", "cloud-4-autoscale", "cloud-5-cicd", "cloud-7-availability", "cloud-8-incident", "cloud-13-retries"],
    project: "Өз сайтыңды контейнерге орап, әр өзгерістен кейін автоматты түрде жаңарып тұратындай ет.",
    where: "Ірі интернет-сервистер, банктер, бұлт провайдерлері, кез келген үлкен жүйесі бар компания.",
    play: { href: "/world?i=cloud", label: "Бұлт шыңының боссын жең" },
  },
  {
    id: "network",
    title: "Желі инженері",
    who: "packet",
    color: "#3dd6ff",
    tagline: "Интернеттің тамырларын салады: кабель, маршрутизатор, Wi-Fi, қаладан қалаға жол.",
    does: ["Мекеменің желісін жобалап, баптайды", "Пакет қайда жоғалғанын тауып, жолды түзетеді", "Желіні шабуылдан және артық жүктемеден қорғайды"],
    day: [
      { at: "09:00", text: "Бір қабаттағы Wi-Fi баяу: арна кептелісін табу" },
      { at: "11:00", text: "Жаңа филиалды VPN арқылы бас кеңсеге қосу" },
      { at: "14:00", text: "Маршрутизация кестесін жаңарту: трафик енді резерв арнамен де жүреді" },
      { at: "16:00", text: "Wireshark-пен пакеттерді талдап, ақауды дәлелдеу" },
    ],
    tools: ["TCP/IP", "Cisco немесе MikroTik", "Wireshark", "Linux", "DNS", "VPN"],
    road: ["net-1-packets", "net-2-ip", "net-3-routing", "net-5-reliable", "net-7-congestion", "net-8-nat", "net-10-dns", "net-12-switch"],
    project: "Үйіңдегі желінің картасын сыз: қандай құрылғы, қандай IP, роутер не істейді.",
    where: "Телеком операторлары, провайдерлер, банктер, әуежайлар, университеттер, деректер орталықтары.",
    play: { href: "/arcade?g=surf", label: "Пакет-серферде пакет болып ұш" },
  },
  {
    id: "embedded",
    title: "Робототехник / IoT инженері",
    who: "cpu",
    color: "#ff7a3d",
    tagline: "Кодын нақты әлемде қозғалатын нәрсеге айналдырады: робот, дрон, ақылды жылыжай.",
    does: ["Датчиктерден деректі оқып, шуын сүзеді", "Мотор мен қолды дәл басқаратын бағдарлама жазады", "Құрылғы батареяда ай бойы жұмыс істеуін ойластырады"],
    day: [
      { at: "09:30", text: "Жылыжай датчигі секіреді: сүзгі қосу" },
      { at: "11:00", text: "Робот қолы мақсаттан 2 см ауытқиды: кинематиканы тексеру" },
      { at: "14:00", text: "Дәнекерлеу, сымдар, осциллограф: сигналды өлшеу" },
      { at: "16:30", text: "Құрылғы қатып қалса, watchdog оны өзі қайта қосатынын тексеру" },
    ],
    tools: ["C және C++", "Arduino, ESP32", "Датчиктер", "Осциллограф", "MQTT", "Электроника негіздері"],
    road: ["arch-1-binary", "arch-3-gates", "iot-1-adc", "iot-3-filter", "iot-4-thermostat", "iot-5-pid", "iot-10-pwm", "iot-15-watchdog"],
    project: "Бөлменің температурасы мен ылғалдылығын өлшеп, телефонға жіберетін құрылғы жаса.",
    where: "Өнеркәсіп, кен орындары, ауыл шаруашылығы, ақылды үй, дрон және робот компаниялары.",
    play: { href: "/arcade?g=bits", label: "Бит-метеорда екілік сандармен ат" },
  },
];

// ---------------------------------------------------------------- the interest test

export interface Question {
  q: string;
  options: { text: string; adds: Partial<Record<CareerId, number>> }[];
}

export const QUIZ: Question[] = [
  {
    q: "Бос күнің. Не істегің келеді?",
    options: [
      { text: "Бір әдемі нәрсе салу немесе безендіру", adds: { frontend: 2, gamedev: 1 } },
      { text: "Ойын ойнау, сосын «мұны қалай жасаған?» деп ойлау", adds: { gamedev: 2, frontend: 1 } },
      { text: "Бір құрылғыны ашып, ішін көру немесе жөндеу", adds: { embedded: 2, network: 1 } },
      { text: "Жұмбақ, детектив, логикалық есеп шешу", adds: { security: 2, data: 1 } },
    ],
  },
  {
    q: "Мектептегі жоба. Сен қай рөлді аласың?",
    options: [
      { text: "Презентацияның дизайны мен көрінісі", adds: { frontend: 2 } },
      { text: "Барлық деректі жинап, кестеге салу", adds: { data: 2, backend: 1 } },
      { text: "Барлығы бір уақытта жұмыс істеуін ұйымдастыру", adds: { devops: 2, backend: 1 } },
      { text: "Макет пен модельді қолмен жасау", adds: { embedded: 2, gamedev: 1 } },
    ],
  },
  {
    q: "Қай сұрақ саған қызығырақ?",
    options: [
      { text: "Instagram 1 секундта қалай ашылады?", adds: { frontend: 1, backend: 1, network: 1 } },
      { text: "Netflix маған ұнайтын фильмді қалай біледі?", adds: { data: 2 } },
      { text: "Хакерлер банкті қалай бұзуға тырысады?", adds: { security: 2 } },
      { text: "Дрон қалай құламай ұшады?", adds: { embedded: 2 } },
    ],
  },
  {
    q: "Бір нәрсе бұзылды. Сенің алғашқы ойың?",
    options: [
      { text: "Қай жерде бұзылғанын қадам-қадаммен табамын", adds: { backend: 1, network: 2 } },
      { text: "Мұны біреу әдейі бұзған жоқ па?", adds: { security: 2 } },
      { text: "Келесі жолы өзі қалпына келетіндей етемін", adds: { devops: 2 } },
      { text: "Дәнекерлегіш қайда?", adds: { embedded: 2 } },
    ],
  },
  {
    q: "Қай сабақ саған жеңіл немесе ұнайды?",
    options: [
      { text: "Математика және статистика", adds: { data: 2, gamedev: 1 } },
      { text: "Физика", adds: { embedded: 2, gamedev: 1 } },
      { text: "Бейнелеу өнері немесе әдебиет", adds: { frontend: 2, gamedev: 1 } },
      { text: "Информатика және логика", adds: { backend: 2, security: 1 } },
    ],
  },
  {
    q: "Нәтижені қалай көргенді ұнатасың?",
    options: [
      { text: "Экранда бірден: әдемі, жанды", adds: { frontend: 2, gamedev: 1 } },
      { text: "Санмен: 3 секунд 20 мс болды", adds: { backend: 1, devops: 2 } },
      { text: "Графикпен: заңдылық көрінді", adds: { data: 2 } },
      { text: "Қолмен ұстап: робот жүрді!", adds: { embedded: 2 } },
    ],
  },
  {
    q: "Бір күнге суперкүш таңдайсың:",
    options: [
      { text: "Кез келген жүйеге көрінбей кіру", adds: { security: 2, network: 1 } },
      { text: "Болашақты болжау", adds: { data: 2 } },
      { text: "Бір уақытта мың жерде болу", adds: { devops: 1, network: 2, backend: 1 } },
      { text: "Өз әлеміңді жасау", adds: { gamedev: 2, frontend: 1 } },
    ],
  },
];

/** The most points a career can collect in the test: its best option in every question. */
export function maxScore(id: CareerId): number {
  return QUIZ.reduce((n, q) => n + Math.max(0, ...q.options.map((o) => o.adds[id] ?? 0)), 0);
}

/** Careers ranked by match for the chosen options (answer index per question). */
export function rank(answers: number[]): { id: CareerId; percent: number }[] {
  const score = new Map<CareerId, number>();
  answers.forEach((a, i) => {
    const opt = QUIZ[i]?.options[a];
    if (!opt) return;
    for (const [id, n] of Object.entries(opt.adds) as [CareerId, number][]) score.set(id, (score.get(id) ?? 0) + n);
  });
  return CAREERS.map((c) => ({ id: c.id, percent: Math.round((100 * (score.get(c.id) ?? 0)) / maxScore(c.id)) })).sort((a, b) => b.percent - a.percent);
}

/** How far along the road a learner is: finished lessons of the road. */
export function readiness(career: Career, progress: LessonProgress[]): { done: string[]; percent: number; next?: string } {
  const finished = new Set(progress.filter((p) => p.completedAt).map((p) => p.lessonId));
  const done = career.road.filter((id) => finished.has(id));
  return { done, percent: Math.round((100 * done.length) / career.road.length), next: career.road.find((id) => !finished.has(id)) };
}

const KEY = "inside-tech:career";

export function loadAnswers(): number[] | undefined {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return Array.isArray(v) && v.length === QUIZ.length && v.every((x) => Number.isInteger(x) && x >= 0 && x < 4) ? v : undefined;
  } catch {
    return undefined;
  }
}

export function saveAnswers(answers: number[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(answers));
  } catch {
    /* storage unavailable */
  }
}
