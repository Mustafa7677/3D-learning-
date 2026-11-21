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
import { openLabs } from "../src/lib/catalog";
import { LessonView } from "../src/components/lab/LessonView";
import "../src/app/globals.css";



function currentRoute(): string {
  return decodeURIComponent(window.location.hash.replace(/^#/, ""));
}

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

  const lesson = lessonEntries.find((e) => e.lesson.id === route)?.lesson;
  useEffect(() => {
    const lab = openLabs.find((l) => l.id === route);
    document.title = lesson ? `${lesson.title} | INSIDE TECH` : lab ? `${lab.title} | INSIDE TECH` : route === "journey" ? "Бір басудың саяхаты | INSIDE TECH" : route === "blackbox" ? "Қара жәшік | INSIDE TECH" : route === "passport" ? "Оқу паспорты | INSIDE TECH" : route === "mission" ? "Миссия: Бір қаланың интернеті | INSIDE TECH" : "INSIDE TECH";
  }, [route, lesson]);

  if (lesson) return <LessonView key={lesson.id} lessonId={lesson.id} />;
  if (openLabs.some((l) => l.id === route)) return <LabPage labId={route} />;
  if (route === "journey") return <JourneyFilm />;
  if (route === "blackbox") return <BlackBox />;
  if (route === "passport") return <Passport />;
  if (route === "mission") return <Mission />;
  if (route === "account") return <AccountPage />;
  if (route === "teacher") return <TeacherPage />;
  if (route === "create" || route.startsWith("import=")) return <CreatorPage />;
  if (route.startsWith("play=")) return <PlayPage key={route} code={route.slice(5)} />;
  return <Home />;
}

createRoot(document.getElementById("root")!).render(<App />);
