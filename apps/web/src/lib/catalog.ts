export interface LabInfo {
  id: string;
  title: string;
  /** What the learner gets to touch inside this lab. */
  inside: string;
  status: "open" | "soon";
  href?: string;
}

/** The ten labs from the master plan. Only AI is built; the rest are on the roadmap. */
export const labs: LabInfo[] = [
  { id: "ai", title: "AI & Machine Learning", inside: "Нейронды өз қолыңмен баптап, желіні нақты үйрет", status: "open", href: "/labs/ai" },
  { id: "web", title: "Web Development", inside: "Request серверден браузерге дейін қалай жүретінін көр", status: "soon" },
  { id: "game", title: "Game Development", inside: "Game loop, физика және камера ішінен", status: "soon" },
  { id: "net", title: "Computer Networks", inside: "DNS, TCP және пакеттердің маршруты", status: "soon" },
  { id: "db", title: "Databases", inside: "Индекстер, транзакциялар, query optimizer", status: "soon" },
  { id: "arch", title: "Computer Architecture", inside: "CPU, жады және екілік сандар", status: "soon" },
  { id: "cloud", title: "Cloud & DevOps", inside: "Контейнерлер, Kubernetes, CI/CD", status: "soon" },
  { id: "sec", title: "Cybersecurity", inside: "Шифрлау мен аутентификацияны қорғау зертханасында", status: "soon" },
  { id: "algo", title: "Algorithms", inside: "Графтар мен сұрыптауды қадаммен бақыла", status: "soon" },
  { id: "iot", title: "Robotics & IoT", inside: "Сенсорлар мен контроллерлер симуляциясы", status: "soon" },
];
