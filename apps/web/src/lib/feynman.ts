/**
 * Мустафаға түсіндір: the Feynman technique with elaborative interrogation. The learner explains
 * a topic to Мустафа, who knows nothing; he answers like a curious friend would, with one
 * question per gap: why (no causal link), for example (no example or comparison), what is X (a
 * key idea missing), slower (sentences too long). The learner fills the gaps and tries again.
 */
import type { LessonDefinition } from "@inside-tech/lesson-engine";
import { checkRecall, keyIdeas, type KeyIdea } from "./recall";

export type Sign = "ideas" | "why" | "example" | "simple";

export const SIGN_LABEL: Record<Sign, string> = {
  ideas: "Негізгі ойлар",
  why: "Себеп-салдар",
  example: "Мысал не салыстыру",
  simple: "Қарапайым сөйлемдер",
};

const norm = (s: string) => ` ${s.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ")} `;
const CAUSE = ["себебі", "өйткені", "сондықтан", "сол үшін", "себептен", "нәтижесінде", "демек", "салдарынан", "сондай болғандықтан", "неге десең"];
const EXAMPLE = ["мысалы", "мысал ", "сияқты", "секілді", "тәрізді", "елестет", "ойлап көр", "мәселен", "сол сияқты", "дәл солай", "салыстыр"];

export interface Review {
  signs: Record<Sign, boolean>;
  covered: KeyIdea[];
  missed: KeyIdea[];
  /** Average words per sentence. */
  avgWords: number;
  /** Мустафа's replies, most important first. */
  questions: string[];
  score: number;
}

/** How many key ideas a good explanation should touch: about half, at least two. */
export const enoughIdeas = (n: number) => Math.min(n, Math.max(2, Math.ceil(n * 0.5)));

export function sentences(text: string): string[] {
  return text
    .split(/[.!?…\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).filter(Boolean).length >= 2);
}

export function review(lesson: LessonDefinition<unknown, unknown>, text: string): Review {
  const ideas = keyIdeas(lesson);
  const r = checkRecall(ideas, text);
  const t = norm(text);
  const ss = sentences(text);
  const words = ss.reduce((n, s) => n + s.split(/\s+/).filter(Boolean).length, 0);
  const avgWords = ss.length ? words / ss.length : 0;
  const signs: Record<Sign, boolean> = {
    ideas: r.found.length >= enoughIdeas(ideas.length),
    why: CAUSE.some((w) => t.includes(` ${w}`)),
    example: EXAMPLE.some((w) => t.includes(w)),
    simple: ss.length >= 2 && avgWords <= 18,
  };
  const questions: string[] = [];
  if (!signs.ideas) {
    const next = r.missed[0];
    questions.push(next ? `Ал «${next.label.split(":")[0]!.trim()}» деген не? Ол бұған қалай қатысты?` : "Тағы не білу керек? Ең маңызды ойды айтшы.");
  }
  if (!signs.why) questions.push("Неге солай? «Себебі…» деп бастап түсіндірші.");
  if (!signs.example) questions.push("Мысал келтірші? Не болмаса өмірдегі бір нәрсемен салыстыршы.");
  if (!signs.simple) questions.push(ss.length < 2 ? "Тым қысқа. Кемінде екі-үш сөйлеммен айтшы." : "Баяуырақ! Сөйлемдерің ұзын, басым айналып кетті. Қысқа сөйлемдермен айтшы.");
  const score = (Object.values(signs) as boolean[]).filter(Boolean).length;
  return { signs, covered: r.found, missed: r.missed, avgWords, questions, score };
}

/** What Мустафа says when he finally gets it, by score. */
export function verdict(score: number): string {
  return score === 4 ? "Енді түсіндім! Ертең өзім сыныптастарыма айтып беремін." : score === 3 ? "Көбін түсіндім. Бір нәрсе ғана қалды." : score === 2 ? "Біразын түсіндім, бірақ әлі шатасып тұрмын." : "Ештеңе түсінбедім… Басынан, қарапайым айтшы.";
}

// ---------------------------------------------------------------- storage

export interface TeachRecord {
  lessonId: string;
  at: number;
  score: number;
  rounds: number;
}
const KEY = "inside-tech:teach";
export function loadTeach(): TeachRecord[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((r) => r && typeof r.lessonId === "string" && typeof r.score === "number" && typeof r.at === "number") : [];
  } catch {
    return [];
  }
}
export function saveTeach(all: TeachRecord[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(all.slice(-200)));
  } catch {
    /* storage unavailable */
  }
}
