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
  { id: "net", title: "Computer Networks", inside: "DNS, TCP және пакеттердің маршруты", status: "soon" },
  { id: "db", title: "Databases", inside: "Индекстер, транзакциялар, query optimizer", status: "soon" },
  {
    id: "arch",
    title: "Computer Architecture",
    inside: "CPU, жады және екілік сандар",
    intro: "Биттен бағдарламаға дейін: екілік сандар, логикалық элементтерден құрастырылған қосындылағыш, fetch–decode–execute циклімен жұмыс істейтін процессор, ассемблер және кэш. Соңында өз бағдарламаңды жазасың — оны автотексеруші жасырын тесттермен тексереді."
    ,
    status: "open",
    href: "/labs/arch",
  },
  { id: "cloud", title: "Cloud & DevOps", inside: "Контейнерлер, Kubernetes, CI/CD", status: "soon" },
  { id: "sec", title: "Cybersecurity", inside: "Шифрлау мен аутентификацияны қорғау зертханасында", status: "soon" },
  {
    id: "algo",
    title: "Algorithms",
    inside: "Графтар мен сұрыптауды қадаммен бақыла",
    intro: "Іздеу, сұрыптау және графтар — әр салыстыру мен әр ауыстыру 3D-де көрінеді. Алгоритмнің қадамдарын өзің санап, Big O-ны тәжірибемен дәлелдейсің, соңында навигатор сияқты ең арзан жолды табасың.",
    status: "open",
    href: "/labs/algo",
  },
  { id: "iot", title: "Robotics & IoT", inside: "Сенсорлар мен контроллерлер симуляциясы", status: "soon" },
];

export const openLabs = labs.filter((l) => l.status === "open");
export const findLab = (id: string) => labs.find((l) => l.id === id);
