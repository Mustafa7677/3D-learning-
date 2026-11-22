/**
 * Парсонс есептері: the lines of a working program (or the steps of a
 * process) are shuffled together with one or two plausible wrong lines. The
 * learner builds the right order. Feedback names the first line that breaks
 * the order; a hint places the next line for you (a fading scaffold), at a
 * cost.
 */

export interface ParsonsPuzzle {
  id: string;
  labId: string;
  title: string;
  task: string;
  /** "code" lines keep their indentation and are shown monospaced. */
  kind: "code" | "steps";
  /** The lines in one correct order. */
  lines: string[];
  /** Plausible lines that do not belong. */
  distractors: { text: string; why: string }[];
  /** Other correct orders, as indexes into `lines`. */
  alt?: number[][];
  explain: string;
}

export const PARSONS: ParsonsPuzzle[] = [
  {
    id: "sql-clauses",
    labId: "db",
    title: "SQL сөйлемдерінің реті",
    task: "Екінші және одан жоғары курс студенттері ең көп тұратын үш қаланы тап: әр қалада кемінде үш студент болсын.",
    kind: "code",
    lines: ["SELECT city, COUNT(*) AS n", "FROM students", "WHERE year > 1", "GROUP BY city", "HAVING COUNT(*) >= 3", "ORDER BY n DESC", "LIMIT 3"],
    distractors: [{ text: "WHERE COUNT(*) >= 3", why: "WHERE топтау алдында жеке жолдарды сүзеді, ол кезде COUNT әлі жоқ. Топтың шарты HAVING-те жазылады." }],
    explain: "SQL жазылу реті: SELECT, FROM, WHERE, GROUP BY, HAVING, ORDER BY, LIMIT. Орындалу реті басқа: FROM, WHERE, GROUP BY, HAVING, SELECT, ORDER BY, LIMIT. Сондықтан ORDER BY-да SELECT-тегі n атауын қолдануға болады, ал WHERE-де болмайды.",
  },
  {
    id: "page-load",
    labId: "net",
    title: "Бір беттің жүктелуі",
    task: "Браузерге https://inside.kz/ деп жаздың. Желіде не болатынын ретімен қой.",
    kind: "steps",
    lines: [
      "DNS: inside.kz қай IP адресте?",
      "TCP: SYN",
      "TCP: SYN-ACK",
      "TCP: ACK, байланыс орнады",
      "TLS: ClientHello",
      "TLS: сертификат және кілт келісімі",
      "HTTP: GET /",
      "HTTP: 200 OK және HTML",
    ],
    distractors: [{ text: "TLS: сертификатты DNS сервер жібереді", why: "Сертификатты сайттың өз сервері TLS қол алысуында жібереді. DNS тек атауды IP-ге айналдырады." }],
    explain: "Әр қабат өзінен төменгісіне сүйенеді: адресті білмей қосыла алмайсың (DNS), қосылмай шифрлай алмайсың (TCP, сосын TLS), шифрланған арнасыз HTTPS сұранысы жоқ.",
  },
  {
    id: "binary-search",
    labId: "algo",
    title: "Екілік іздеу",
    task: "Сұрыпталған a массивінен x-тің орнын тап, жоқ болса -1 қайтар.",
    kind: "code",
    lines: [
      "function search(a, x) {",
      "  let lo = 0, hi = a.length - 1;",
      "  while (lo <= hi) {",
      "    const mid = (lo + hi) >> 1;",
      "    if (a[mid] === x) return mid;",
      "    if (a[mid] < x) lo = mid + 1;",
      "    else hi = mid - 1;",
      "  }",
      "  return -1;",
      "}",
    ],
    distractors: [{ text: "    if (a[mid] < x) hi = mid - 1;", why: "a[mid] x-тен кіші болса, x оң жақта: lo-ны көтеру керек, hi-ді емес." }],
    explain: "Әр қадамда іздеу аралығы екі есе тарылады: 1 000 000 элементте 20 қадам жеткілікті. lo <= hi шарты бір элементті аралықты да тексереді.",
  },
  {
    id: "fetch-json",
    labId: "web",
    title: "fetch және JSON",
    task: "Пайдаланушыны API-ден жүкте; сервер қате берсе, қатені лақтыр.",
    kind: "code",
    lines: [
      "async function loadUser(id) {",
      "  const res = await fetch(`/api/users/${id}`);",
      "  if (!res.ok) throw new Error(`HTTP ${res.status}`);",
      "  const user = await res.json();",
      "  return user;",
      "}",
    ],
    distractors: [{ text: "  const user = res.json();", why: "res.json() Promise қайтарады. await болмаса, user деректің өзі емес, күтіп тұрған уәде болады." }],
    explain: "fetch 404 не 500 келгенде де сәтті аяқталады: желі жұмыс істеді. Сондықтан res.ok-ты өзің тексересің. Дене ағын түрінде келеді, оны оқу да асинхронды.",
  },
  {
    id: "password",
    labId: "sec",
    title: "Құпиясөзді сақтау",
    task: "Тіркелу және кіру кезінде құпиясөзбен не істеу керек? Ретімен қой.",
    kind: "steps",
    lines: [
      "Тіркелу: әр пайдаланушыға жаңа кездейсоқ тұз (salt) жаса",
      "Құпиясөз бен тұзды баяу хэш-функцияға бер (Argon2, bcrypt)",
      "Дерекқорға тек хэш пен тұзды жаз",
      "Кіру: сол пайдаланушының тұзын дерекқордан ал",
      "Енгізілген құпиясөзді сол тұзбен қайта хэште",
      "Хэштерді тұрақты уақытта салыстыр",
    ],
    distractors: [{ text: "Құпиясөзді AES-пен шифрлап, кілтін қасына сақта", why: "Шифр қайтымды: кілт пен база бірге ұрланса, барлық құпиясөз ашылады. Құпиясөзге қайтымсыз хэш керек." }],
    explain: "Тұз бірдей құпиясөздердің хэшін әртүрлі етеді және дайын кестелерді (rainbow tables) пайдасыз қылады. Баяу хэш іріктеп табуды миллиондаған есе қымбаттатады.",
  },
  {
    id: "dockerfile",
    labId: "cloud",
    title: "Кэшке ыңғайлы Dockerfile",
    task: "Node.js қызметінің образын жина: код өзгерсе, тәуелділіктер қайта орнатылмасын.",
    kind: "code",
    lines: ["FROM node:20-alpine", "WORKDIR /app", "COPY package.json package-lock.json ./", "RUN npm ci", "COPY . .", 'CMD ["node", "server.js"]'],
    distractors: [{ text: "COPY node_modules ./node_modules", why: "Компьютеріңдегі node_modules басқа ОЖ-ға жиналған болуы мүмкін және образды үлкейтеді. Тәуелділіктер образдың ішінде npm ci-мен орнатылады." }],
    explain: "Әр нұсқау бір қабат, ал қабат өзгермесе, кэштен алынады. Алдымен тек package.json көшіріліп, npm ci орындалады: код қанша өзгерсе де, бұл баяу қабат қайта жиналмайды.",
  },
  {
    id: "train-loop",
    labId: "ai",
    title: "Үйрету циклі",
    task: "Модельді PyTorch-та бірнеше дәуір бойы үйрет.",
    kind: "code",
    lines: [
      "for epoch in range(epochs):",
      "    for x, y in batches:",
      "        optimizer.zero_grad()",
      "        pred = model(x)",
      "        loss = loss_fn(pred, y)",
      "        loss.backward()",
      "        optimizer.step()",
    ],
    alt: [
      [0, 1, 3, 2, 4, 5, 6],
      [0, 1, 3, 4, 2, 5, 6],
    ],
    distractors: [{ text: "        model = Model()", why: "Модельді цикл ішінде қайта жасасаң, үйренген салмақтардың бәрі әр батчта жойылады." }],
    explain: "Градиенттер PyTorch-та жинақталады, сондықтан backward-тан бұрын нөлдеу керек (ең болмаса бір рет, кез келген жерде backward-тан бұрын). Тура өту, қате, кері тарату, қадам: оқытудың бүкіл жүрегі осы бес жол.",
  },
  {
    id: "cpu-cycle",
    labId: "arch",
    title: "Нұсқау циклі",
    task: "Процессор бір нұсқауды қалай орындайды? Кезеңдерді ретімен қой.",
    kind: "steps",
    lines: [
      "Fetch: PC көрсеткен адрестен нұсқауды жадтан ал",
      "PC-ны келесі нұсқауға жылжыт",
      "Decode: нұсқаудың түрі мен операндтарын анықта",
      "Регистрлерден операндтарды оқы",
      "Execute: ALU-да амалды орында",
      "Write-back: нәтижені регистрге жаз",
    ],
    alt: [[0, 2, 3, 4, 5, 1]],
    distractors: [{ text: "Нәтижені әр нұсқаудан кейін дискіге сақта", why: "Нәтиже регистрге жазылады: ол наносекундтар. Дискіге жазу миллиондаған есе баяу және оны процессор емес, бағдарлама сұрайды." }],
    explain: "Бұл бес кезең конвейердің негізі: әр кезең бөлек блок болғандықтан, бір уақытта бес түрлі нұсқау әр кезеңде тұра алады.",
  },
  {
    id: "game-loop",
    labId: "game",
    title: "Тұрақты қадамды ойын циклі",
    task: "Физиканы әрқашан DT қадаммен жаңарт, ал суретті экран жиілігімен сал.",
    kind: "code",
    lines: [
      "function frame(now) {",
      "  acc += now - last;",
      "  last = now;",
      "  while (acc >= DT) {",
      "    update(DT);",
      "    acc -= DT;",
      "  }",
      "  render();",
      "  requestAnimationFrame(frame);",
      "}",
    ],
    alt: [
      [0, 1, 2, 3, 5, 4, 6, 7, 8, 9],
      [0, 1, 2, 3, 4, 5, 6, 8, 7, 9],
      [0, 1, 2, 3, 5, 4, 6, 8, 7, 9],
    ],
    distractors: [{ text: "  update(now - last);", why: "Айнымалы қадам физиканы кадр жиілігіне тәуелді етеді: баяу компьютерде серіппе жарылып кетеді." }],
    explain: "Уақыт жинақталады да, тұрақты DT бөліктерімен «жұмсалады». Сондықтан 30 FPS пен 144 FPS-те физика бірдей. last = now алдыңғы мәнді қолданғаннан кейін ғана жаңарады.",
  },
  {
    id: "debounce",
    labId: "iot",
    title: "Батырманы сүзу",
    task: "Arduino-да батырманың дірілін 20 мс сүзгімен елеме, әр басуды бір рет сана.",
    kind: "code",
    lines: [
      "void loop() {",
      "  int raw = digitalRead(BTN);",
      "  if (raw != lastRaw) lastChange = millis();",
      "  if (millis() - lastChange > 20 && raw != stable) {",
      "    stable = raw;",
      "    if (stable == LOW) presses++;",
      "  }",
      "  lastRaw = raw;",
      "}",
    ],
    distractors: [{ text: "  delay(1000);", why: "delay бүкіл микроконтроллерді тоқтатады: бір секунд ішінде басқа батырма да, датчик те оқылмайды." }],
    explain: "Сигнал 20 мс бойы өзгермей тұрғанда ғана «тұрақты» күй жаңарады. lastRaw ең соңында жаңарады, әйтпесе өзгерісті салыстыратын ештеңе қалмайды.",
  },
  {
    id: "gauss-steps",
    labId: "math",
    title: "Гаусс әдісінің қадамдары",
    task: "x + y + z = 6, 2x + y − z = 1, x − y + 2z = 5 жүйесін Гаусс әдісімен шешу қадамдарын ретімен қой.",
    kind: "steps",
    lines: [
      "R2 ← R2 − 2·R1: (0, −1, −3 | −11)",
      "R3 ← R3 − R1: (0, −2, 1 | −1)",
      "R3 ← R3 − 2·R2: (0, 0, 7 | 21), баспалдақ дайын",
      "R3 ← (1/7)·R3: z = 3",
      "R2 ← −(R2 + 3·R3): y = 2",
      "R1 ← R1 − R2 − R3: x = 1",
    ],
    alt: [[1, 0, 2, 3, 4, 5]],
    distractors: [{ text: "R1 ← 0·R1: бірінші теңдеуді тазалау", why: "Нөлге көбейткенде теңдеу 0 = 0-ге айналады: ақпарат жоғалып, шешім анықталмай қалады." }],
    explain: "Алдымен төмен қарай: бірінші бағандағы x-ті R2 мен R3-тен жою (бұл екеуінің реті маңызды емес), сосын R3-тен y-ті жою. Баспалдақтан кейін кері жүріс: соңғы жолдан z, сосын y, сосын x.",
  },
  {
    id: "promise-all",
    labId: "web",
    title: "Пікірлерді бірге жүкте",
    task: "Посттарды ал, сосын барлық посттың пікірлерін бір мезгілде сұра (Web 15).",
    kind: "code",
    lines: [
      "async function loadPage(userId) {",
      "  const posts = await getPosts(userId);",
      "  const comments = await Promise.all(",
      "    posts.map((p) => getComments(p.id)),",
      "  );",
      "  return { posts, comments };",
      "}",
    ],
    distractors: [{ text: "  for (const p of posts) comments.push(await getComments(p.id));", why: "Циклдағы await әр сұранысты алдыңғысы біткенше күттіреді: бұл сарқырама, 8 пікір 8 есе ұзақ." }],
    explain: "Посттар пайдаланушыға тәуелді, сондықтан алдымен соларды күтеміз. Ал пікірлер бір-біріне тәуелсіз: Promise.all оларды бірге жібереді де, бәрі келгенде ғана жалғастырады.",
  },
  {
    id: "graceful",
    labId: "cloud",
    title: "SIGTERM-ді дұрыс өңдеу",
    task: "Node.js сервері deploy кезінде бірде-бір сұранысты жоғалтпай тоқтасын (Cloud 15).",
    kind: "code",
    lines: [
      'process.on("SIGTERM", async () => {',
      "  await sleep(5000);",
      "  server.close(() => {",
      "    db.end();",
      "    process.exit(0);",
      "  });",
      "});",
    ],
    distractors: [{ text: "  server.closeAllConnections();", why: "Бұл ашық сұраныстарды аяқтамай үзеді: дәл осы deploy кезіндегі қателерді береді." }],
    explain: "Алдымен 5 секунд күтеміз: жүктеме балансы подты тізімнен шығарғанша сервер әдеттегідей жұмыс істейді. server.close жаңа қосылымды тоқтатып, ашықтарын аяқтағанда ғана шақырылады; содан кейін ғана дерекқорды жауып, шығамыз.",
  },
  {
    id: "safe-equal",
    labId: "sec",
    title: "Тұрақты уақытта салыстыру",
    task: "Екі токенді уақыты құпияны ашпайтындай етіп салыстыр (Cybersecurity 15).",
    kind: "code",
    lines: [
      "function safeEqual(a, b) {",
      "  if (a.length !== b.length) return false;",
      "  let diff = 0;",
      "  for (let i = 0; i < a.length; i++) {",
      "    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);",
      "  }",
      "  return diff === 0;",
      "}",
    ],
    alt: [[0, 2, 1, 3, 4, 5, 6, 7]],
    distractors: [{ text: "    if (a[i] !== b[i]) return false;", why: "Бірінші айырмада шығу дұрыс таңбалар санын уақыт арқылы ашып қояды: timing шабуылының дәл өзі." }],
    explain: "Цикл әрқашан барлық таңбаны өтеді, айырмаларды diff-ке жинайды, ал шешім тек соңында. Ұзындықты тексеру ұзындықты ғана ашады, ол әдетте құпия емес. Шын жобада дайын crypto.timingSafeEqual-ды қолдан.",
  },
  {
    id: "watchdog",
    labId: "iot",
    title: "Watchdog-ты циклде тамақтандыр",
    task: "Датчик секундына бір өлшем жіберсін, ал қатып қалса watchdog оны қайта жүктесін (IoT 15).",
    kind: "code",
    lines: ["void loop() {", "  int value = readSensor();", "  publish(value);", "  wdt_reset();", "  delay(1000);", "}"],
    alt: [[0, 1, 2, 4, 3, 5]],
    distractors: [{ text: "ISR(TIMER1_COMPA_vect) { wdt_reset(); }", why: "Таймер үзілісі негізгі цикл қатса да жұмыс істейді: watchdog ешқашан қатуды байқамайды." }],
    explain: "wdt_reset пайдалы жұмыс (оқу мен жіберу) аяқталғаннан кейін тұр. readSensor не publish қатса, тамақтандыру тоқтайды да, watchdog чипті қайта жүктейді. delay 1 с, ал watchdog 2 с күтеді, сондықтан оның алдында не артында тұруы маңызды емес.",
  },
];

const rng = (seed: number) => {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 2 ** 32;
  };
};

/** A tile is a line of the solution (index into `lines`) or a distractor (-1, -2, ...). */
export type Tile = number;
export const tileText = (p: ParsonsPuzzle, t: Tile) => (t >= 0 ? p.lines[t]! : p.distractors[-t - 1]!.text);

/** All tiles, shuffled; never already in a correct order. */
export function shuffled(p: ParsonsPuzzle, seed: number): Tile[] {
  const tiles: Tile[] = [...p.lines.map((_, i) => i), ...p.distractors.map((_, i) => -i - 1)];
  const r = rng(seed * 7919 + p.id.length);
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j]!, tiles[i]!];
  }
  const sol = tiles.filter((t) => t >= 0);
  if (orders(p).some((o) => o.every((x, i) => x === sol[i]))) tiles.push(tiles.shift()!);
  return tiles;
}

export const orders = (p: ParsonsPuzzle): number[][] => [p.lines.map((_, i) => i), ...(p.alt ?? [])];

export interface Verdict {
  correct: boolean;
  /** Lines in place from the top before the first mistake. */
  prefix: number;
  /** A distractor in the answer, if any. */
  distractor: number | null;
  missing: number;
}

export function check(p: ParsonsPuzzle, answer: Tile[]): Verdict {
  const best = Math.max(
    ...orders(p).map((o) => {
      let k = 0;
      while (k < answer.length && k < o.length && answer[k] === o[k]) k++;
      return k;
    }),
  );
  const d = answer.find((t) => t < 0);
  const missing = p.lines.length - answer.filter((t) => t >= 0).length;
  return { correct: best === p.lines.length && answer.length === p.lines.length, prefix: best, distractor: d === undefined ? null : -d - 1, missing };
}

/** Fading scaffold: the correct prefix stays, the next line of the closest order is placed after it. */
export function hint(p: ParsonsPuzzle, answer: Tile[]): Tile[] {
  const v = check(p, answer);
  if (v.correct) return answer;
  const order = orders(p).find((o) => o.slice(0, v.prefix).every((x, i) => x === answer[i])) ?? orders(p)[0]!;
  const kept = answer.slice(0, v.prefix);
  const next = order[v.prefix]!;
  const rest = answer.slice(v.prefix).filter((t) => t !== next && t >= 0);
  return [...kept, next, ...rest];
}

/** 3 points for a clean first check, minus a point per extra check and per hint, never below 1. */
export const score = (checks: number, hints: number) => Math.max(1, 3 - Math.max(0, checks - 1) - hints);
