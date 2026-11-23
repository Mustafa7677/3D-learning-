import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { lessonEntries } from "../src/lib/lessons";
import Home from "../src/app/page";
import { LabPage } from "../src/components/LabPage";
import { AccountPage } from "../src/components/AccountPage";
import { TeacherPage } from "../src/components/TeacherPage";
import { CreatorPage } from "../src/components/CreatorPage";
import { PlayPage } from "../src/components/PlayPage";
import { JourneyFilm } from "../src/components/film/JourneyFilm";
import { BlackBox } from "../src/components/blackbox/BlackBox";
import { Passport } from "../src/components/passport/Passport";
import { Mission } from "../src/components/mission/Mission";
import { Gazette } from "../src/components/gazette/Gazette";
import { Comic } from "../src/components/comic/Comic";
import { Cards } from "../src/components/cards/Cards";
import { Sky } from "../src/components/sky/Sky";
import { Notebook } from "../src/components/notebook/Notebook";
import { Ticket } from "../src/components/ticket/Ticket";
import { Parsons } from "../src/components/parsons/Parsons";
import { Today } from "../src/components/today/Today";
import { Focus } from "../src/components/focus/Focus";
import { Recall } from "../src/components/recall/Recall";
import { LearnHow } from "../src/components/learn/LearnHow";
import { ToolsHub } from "../src/components/tools/ToolsHub";
import { Problems } from "../src/components/problems/Problems";
import { Tactics } from "../src/components/tactics/Tactics";
import { Teach } from "../src/components/teach/Teach";
import { ComicLibrary } from "../src/components/comics/ComicLibrary";
import { World } from "../src/components/world/World";
import { SearchPalette } from "../src/components/nav/SearchPalette";
import { openLabs } from "../src/lib/catalog";
import { LessonView } from "../src/components/lab/LessonView";
import "../src/app/globals.css";



function currentRoute(): string {
  return decodeURIComponent(window.location.hash.replace(/^#/, ""));
}

/** Page titles for the routes that are not lessons or labs. */
const TITLES: Record<string, string> = {
  journey: "Бір басудың саяхаты",
  blackbox: "Қара жәшік",
  passport: "Оқу паспорты",
  mission: "Миссия: Бір қаланың интернеті",
  gazette: "INSIDE TECH газеті, № 1",
  comic: "Комикс: Үш қол алысу",
  cards: "Есте сақтау карточкалары",
  sky: "Білім аспаны",
  world: "IT архипелагы",
  notebook: "Қателер дәптері",
  ticket: "Емтихан билеті",
  parsons: "Ретке келтір",
  today: "Бүгін",
  focus: "Фокус бөлмесі",
  recall: "Бос парақ",
  learn: "Қалай оқу керек?",
  tools: "Оқу құралдары",
  problems: "Есептер залы",
  tactics: "Тактика алаңы",
  teach: "Мустафаға түсіндір",
  comics: "Комикс кітапханасы",
};

function App() {
  const [route, setRoute] = useState(currentRoute);

  useEffect(() => {
    const onHash = () => {
      setRoute(currentRoute());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const name = route.split("?")[0] ?? "";
  const lesson = lessonEntries.find((e) => e.lesson.id === name)?.lesson;
  useEffect(() => {
    const lab = openLabs.find((l) => l.id === name);
    const t = lesson ? lesson.title : lab ? lab.title : TITLES[name];
    document.title = t ? `${t} | INSIDE TECH` : "INSIDE TECH";
  }, [name, lesson]);

  return (
    <>
      <Page route={route} name={name} />
      <SearchPalette />
    </>
  );
}

function Page({ route, name }: { route: string; name: string }) {
  const lesson = lessonEntries.find((e) => e.lesson.id === name)?.lesson;
  if (lesson) return <LessonView key={lesson.id} lessonId={lesson.id} />;
  if (openLabs.some((l) => l.id === name)) return <LabPage labId={name} />;
  if (name === "journey") return <JourneyFilm />;
  if (name === "blackbox") return <BlackBox />;
  if (name === "passport") return <Passport />;
  if (name === "mission") return <Mission />;
  if (name === "gazette") return <Gazette />;
  if (name === "comic") return <Comic />;
  if (name === "cards") return <Cards />;
  if (name === "sky") return <Sky />;
  if (name === "world") return <World key={route} />;
  if (name === "notebook") return <Notebook />;
  if (name === "ticket") return <Ticket />;
  if (name === "parsons") return <Parsons />;
  if (name === "today") return <Today />;
  if (name === "focus") return <Focus />;
  if (name === "recall") return <Recall />;
  // Keyed by the whole route: a search can open another problem or episode on the same page.
  if (name === "learn") return <LearnHow key={route} />;
  if (name === "tools") return <ToolsHub />;
  if (name === "problems") return <Problems key={route} />;
  if (name === "tactics") return <Tactics />;
  if (name === "teach") return <Teach />;
  if (name === "comics") return <ComicLibrary key={route} />;
  if (name === "account") return <AccountPage />;
  if (name === "teacher") return <TeacherPage />;
  if (name === "create" || route.startsWith("import=")) return <CreatorPage />;
  if (route.startsWith("play=")) return <PlayPage key={route} code={route.slice(5)} />;
  return <Home />;
}

createRoot(document.getElementById("root")!).render(<App />);
