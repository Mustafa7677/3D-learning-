/**
 * Site search: every lesson (with its key ideas), every lab, every study tool, every hard
 * problem and every episode of the learning course, in one index. Words are matched by their
 * stems, so Kazakh endings do not hide a result: «векторларды» finds «Векторлар».
 */
import { openLabs } from "./catalog";
import { EPISODES } from "./learnHow";
import { lessonEntries } from "./lessons";
import { PROBLEMS } from "./problems";
import { keyIdeas, stem } from "./recall";
import { TOOL_GROUPS } from "./tools";

export type HitKind = "lesson" | "lab" | "tool" | "problem" | "episode";

export interface SearchItem {
  kind: HitKind;
  title: string;
  sub: string;
  href: string;
  /** Normalised title and body text. */
  t: string;
  b: string;
}

export const KIND_LABEL: Record<HitKind, string> = {
  lesson: "Сабақ",
  lab: "Зертхана",
  tool: "Құрал",
  problem: "Қиын есеп",
  episode: "Оқу туралы",
};

const norm = (s: string) => ` ${s.toLowerCase().replace(/ё/g, "е").replace(/[«»"()`*:;,.!?/]/g, " ").replace(/\s+/g, " ").trim()} `;

let cache: SearchItem[] | null = null;

export function searchIndex(): SearchItem[] {
  if (cache) return cache;
  const items: SearchItem[] = [];
  const labTitle = (id: string) => openLabs.find((l) => l.id === id)?.title ?? id;
  for (const l of openLabs) items.push({ kind: "lab", title: l.title, sub: "Зертхана", href: `/labs/${l.id}`, t: norm(l.title), b: norm(`${l.id}`) });
  for (const e of lessonEntries) {
    const ideas = keyIdeas(e.lesson)
      .map((k) => k.label)
      .join(" ");
    items.push({
      kind: "lesson",
      title: e.lesson.title,
      sub: `${labTitle(e.labId)} · ${e.lesson.order}-сабақ`,
      href: `/labs/${e.labId}/${e.lesson.id}`,
      t: norm(e.lesson.title),
      b: norm(`${e.lesson.summary ?? ""} ${ideas} ${e.lesson.steps.map((s) => s.title).join(" ")}`),
    });
  }
  for (const g of TOOL_GROUPS) for (const x of g.items) items.push({ kind: "tool", title: x.title, sub: g.title, href: x.href, t: norm(x.title), b: norm(`${x.text} ${x.why}`) });
  for (const p of PROBLEMS) items.push({ kind: "problem", title: p.title, sub: `Есептер залы · ${p.tags.join(", ")}`, href: `/problems?p=${p.id}`, t: norm(p.title), b: norm(`${p.statement} ${p.tags.join(" ")} ${p.idea}`) });
  for (const e of EPISODES) items.push({ kind: "episode", title: e.comic.title, sub: `Қалай оқу керек? · ${e.tool.label}`, href: `/learn?e=${e.id}`, t: norm(e.comic.title), b: norm(`${e.claim} ${e.finding}`) });
  cache = items;
  return items;
}

/** Ranked hits: every query word must appear (by stem) in the title or the body; titles weigh more. */
export function search(query: string, limit = 12): SearchItem[] {
  const words = norm(query)
    .trim()
    .split(" ")
    .filter((w) => w.length >= 2);
  if (!words.length) return [];
  const stems = words.map((w) => (w.length >= 4 ? stem(w) : w));
  const scored: { item: SearchItem; score: number }[] = [];
  for (const item of searchIndex()) {
    let score = 0;
    let ok = true;
    for (const s of stems) {
      const inTitle = item.t.includes(` ${s}`) ? 3 : item.t.includes(s) ? 2 : 0;
      const inBody = item.b.includes(s) ? 1 : 0;
      if (!inTitle && !inBody) {
        ok = false;
        break;
      }
      score += inTitle * 4 + inBody;
    }
    if (!ok) continue;
    if (item.t.trim().startsWith(stems[0]!)) score += 6;
    if (item.kind === "tool" || item.kind === "lab") score += 2;
    scored.push({ item, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.item.title.length - b.item.title.length)
    .slice(0, limit)
    .map((x) => x.item);
}
