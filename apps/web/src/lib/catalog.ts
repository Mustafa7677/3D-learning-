export interface LabInfo {
  id: string;
  title: string;
  /** What the learner gets to touch inside this lab. */
  inside: string;
  /** One-paragraph introduction on the lab page. */
  intro?: string;
  status: "open" | "soon";
  href?: string;
}

/** The ten labs from the master plan. Open labs have lessons; the rest are on the roadmap. */
export const labs: LabInfo[] = [
  {
    id: "ai",
    title: "AI & Machine Learning",
    inside: "Нейронды өз қолыңмен баптап, желіні нақты үйрет",
    intro: "Деректерден бастап нақты үйретілген нейрондық желіге, сосын тілдік модельдер мен attention-ға дейін. Әр сабақта бір симуляция ішінде жұмыс істейсің, сондықтан әр өзгерістің салдарын бірден көресің.",
    status: "open",
    href: "/labs/ai",
  },
  {
    id: "web",
    title: "Web Development",
    inside: "Request серверден браузерге дейін қалай жүретінін көр",
    intro: "URL енгізген сәттен бет ашылғанға дейін: DNS, TCP, HTTP, HTML, CSS, JavaScript event loop, сервер, дерекқор. Соңында өз сайтыңды жасап, «интернетке» шығарасың.",
    status: "open",
    href: "/labs/web",
  },
  {
    id: "game",
    title: "Game Development",
    inside: "Game loop, физика және камера ішінен",
    intro: "Ойын қозғалтқышының ішіне кір: объектілер ағашы, камера, delta time, физика, жарық пен материал, скрипттер және жаудың «миы». Соңында өз деңгейіңді салып, өз ойыныңды ұтып шығасың.",
    status: "open",
    href: "/labs/game",
  },
  {
    id: "net",
    title: "Computer Networks",
    inside: "DNS, TCP және пакеттердің маршруты",
    intro: "Интернеттің іші: пакеттер мен қабаттар, IP адрестер мен ішкі желілер, маршрутизаторлардың Дейкстрасы мен Беллман–Фордасы, TCP-нің ACK, терезе мен кептелісті басқаруы, NAT. Әр сызықты үзіп, әр пакетті жоғалтып, желінің қалай «өзін емдейтінін» көресің.",
    status: "open",
    href: "/labs/net",
  },
  {
    id: "db",
    title: "Databases",
    inside: "Индекстер, транзакциялар, query optimizer",
    intro: "Нақты SQL қозғалтқышы браузеріңде: SELECT, JOIN, GROUP BY, индекстер мен EXPLAIN, шектеулер, транзакциялар және құлаған сервер, параллель клиенттер, шардинг. Әр сұраныстың нәтижесін ғана емес, бағасын да — неше жол қаралғанын — көресің.",
    status: "open",
    href: "/labs/db",
  },
  {
    id: "arch",
    title: "Computer Architecture",
    inside: "CPU, жады және екілік сандар",
    intro: "Биттен бағдарламаға дейін: екілік сандар, логикалық элементтерден құрастырылған қосындылағыш, fetch–decode–execute циклімен жұмыс істейтін процессор, ассемблер және кэш. Соңында өз бағдарламаңды жазасың — оны автотексеруші жасырын тесттермен тексереді."
    ,
    status: "open",
    href: "/labs/arch",
  },
  {
    id: "cloud",
    title: "Cloud & DevOps",
    inside: "Контейнерлер, Kubernetes, CI/CD",
    intro: "Бұлттың іші: Docker қабаттары мен кэш, Kubernetes контроллері, кезек теориясы мен SLO, автомасштабтау, CI/CD конвейері, canary релиздер, «тоғыздар» мен қолжетімділік зоналары және түнгі 3-тегі инцидент. Әр санды өзің өлшеп, әр құлауды өзің тудырасың.",
    status: "open",
    href: "/labs/cloud",
  },
  {
    id: "sec",
    title: "Cybersecurity",
    inside: "Шифрлау мен аутентификацияны қорғау зертханасында",
    intro: "Шифрды жаса, сосын оны бұз. Цезарьдан RSA-ға дейін, ашық мәтіннен Argon2-ге дейін: әр қорғаныс қабатын алдымен шабуылшының көзімен көресің. Нақты SHA-256, нақты сөздік шабуылы, нақты SQL injection — бәрі қауіпсіз құмсалғышта.",
    status: "open",
    href: "/labs/sec",
  },
  {
    id: "algo",
    title: "Algorithms",
    inside: "Графтар мен сұрыптауды қадаммен бақыла",
    intro: "Іздеу, сұрыптау және графтар — әр салыстыру мен әр ауыстыру 3D-де көрінеді. Алгоритмнің қадамдарын өзің санап, Big O-ны тәжірибемен дәлелдейсің, соңында навигатор сияқты ең арзан жолды табасың.",
    status: "open",
    href: "/labs/algo",
  },
  {
    id: "iot",
    title: "Robotics & IoT",
    inside: "Сенсорлар мен контроллерлер симуляциясы",
    intro: "Физикалық әлем мен кодтың шекарасы: АЦП мен разрядтар, Найквист пен алиасинг, шуды сүзу, термостаттың гистерезисі, лифтті PID-пен басқару, робот қолының тура және кері кинематикасы, Калман сүзгісі, MQTT және батарея бюджеті. Әр коэффициентті өзің баптап, әр графиктің неге солай екенін көресің.",
    status: "open",
    href: "/labs/iot",
  },
];

export const openLabs = labs.filter((l) => l.status === "open");
export const findLab = (id: string) => labs.find((l) => l.id === id);
