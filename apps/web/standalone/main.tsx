import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { aiLessons } from "@inside-tech/lab-ai";
import Home from "../src/app/page";
import AiLabPage from "../src/app/labs/ai/page";
import { LessonView } from "../src/components/lab/LessonView";
import "../src/app/globals.css";

const TITLES: Record<string, string> = { "": "INSIDE TECH", ai: "AI LAB — INSIDE TECH" };

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

  const lesson = aiLessons.find((l) => l.id === route);
  useEffect(() => {
    document.title = lesson ? `${lesson.title} — INSIDE TECH` : (TITLES[route] ?? "INSIDE TECH");
  }, [route, lesson]);

  if (lesson) return <LessonView key={lesson.id} lessonId={lesson.id} />;
  if (route === "ai") return <AiLabPage />;
  return <Home />;
}

createRoot(document.getElementById("root")!).render(<App />);
