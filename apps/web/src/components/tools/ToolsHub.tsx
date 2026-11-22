"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { LessonProgress } from "@inside-tech/lesson-engine";
import { loadActivity } from "@/lib/activity";
import { dueCards, newDeck, sanitizeDeck } from "@/lib/cards";
import { focusWeek, loadActive, loadHistory } from "@/lib/focus";
import { EPISODES, loadSeen } from "@/lib/learnHow";
import { lessonEntries } from "@/lib/lessons";
import { collectMistakes, dueMistakes, sanitizeReview, schedule } from "@/lib/notebook";
import { loadProblems, streakLength } from "@/lib/problems";
import { progressStore } from "@/lib/progress";
import { loadRecall, suggestions } from "@/lib/recall";
import { TOOL_GROUPS, type BadgeKey } from "@/lib/tools";
import { dayKey } from "@/lib/problems";
import { FilmHeader } from "../film/FilmHeader";
import film from "../film/film.module.css";
import styles from "./tools.module.css";

type Badges = Partial<Record<BadgeKey, { text: string; hot: boolean }>>;

/** Оқу құралдары: every study tool in one place, with what is waiting for the learner today. */
export function ToolsHub() {
  const [badges, setBadges] = useState<Badges>({});
  useEffect(() => {
    const now = new Date();
    const t = now.getTime();
    const b: Badges = {};
    try {
      const n = dueCards(sanitizeDeck(JSON.parse(localStorage.getItem("inside-tech:cards") ?? "null"), t), t).length;
      b.cards = { text: n ? `${n} карточка күтіп тұр` : "Бүгінге бәрі қайталанды", hot: n > 0 };
    } catch {
      b.cards = { text: `${dueCards(newDeck(t), t).length} карточка күтіп тұр`, hot: true };
    }
    const streak = streakLength(loadProblems().streak, now);
    b.streak = { text: streak ? `${streak} күн қатарынан` : "Күн есебі күтіп тұр", hot: streak === 0 };
    const focusToday = focusWeek(loadHistory(), now).at(-1)!.min;
    b.focus = loadActive() ? { text: "Сессия жүріп жатыр", hot: true } : { text: focusToday ? `Бүгін ${focusToday} мин` : "Бүгін әлі фокус жоқ", hot: focusToday === 0 };
    const seen = Object.keys(loadSeen()).length;
    b.learn = { text: `${seen}/${EPISODES.length} эпизод`, hot: seen < EPISODES.length };
    const today = loadActivity().days[dayKey(now)] ?? {};
    const moves = [today.review, today.lesson, today.problem].filter((x) => (x ?? 0) > 0).length;
    b.plan = { text: `Бүгінгі жоспар: ${moves}/3`, hot: moves < 3 };
    setBadges({ ...b });
    let review = {};
    try {
      review = sanitizeReview(JSON.parse(localStorage.getItem("inside-tech:notebook") ?? "null"));
    } catch {
      /* storage unavailable */
    }
    void progressStore()
      .list()
      .catch(() => [] as LessonProgress[])
      .then((progress) => {
        const ms = collectMistakes(lessonEntries, progress);
        const m = dueMistakes(schedule(review, ms, t), ms, t).length;
        const studied = progress.filter((p) => Object.values(p.completed).some((x) => x.length > 0) || p.completedAt).map((p) => ({ lessonId: p.lessonId, updatedAt: p.updatedAt }));
        const r = suggestions(lessonEntries, studied, loadRecall(), t).filter((x) => x.due).length;
        setBadges((x) => ({
          ...x,
          mistakes: { text: m ? `${m} қате қайта шешуге` : ms.length ? "Бүгінге бәрі қайталанды" : "Әзірге қате жоқ", hot: m > 0 },
          recall: { text: r ? `${r} тақырып еске түсіруге` : studied.length ? `${studied.length} оқылған тақырып` : "Алдымен бір сабақ өт", hot: r > 0 },
        }));
      });
  }, []);

  const waiting = Object.values(badges).filter((x) => x?.hot).length;

  return (
    <div className={film.page}>
      <FilmHeader />
      <main className={styles.page}>
        <header className={styles.head}>
          <p className={styles.kicker}>ОҚУ ҚҰРАЛДАРЫ</p>
          <h1 className={styles.title}>Сабақтан тыс, бірақ сабақ үшін.</h1>
          <p className={styles.lede}>Әр құрал оқу туралы бір ғылыми нәтижеге сүйенеді. Топтар бойынша таңда, ал бүгін не күтіп тұрғанын белгілер айтады.</p>
          {waiting > 0 && (
            <p className={styles.waiting} aria-label="Бүгін күтіп тұрғандар">
              <i aria-hidden /> Бүгін {waiting} құрал сені күтіп тұр
            </p>
          )}
        </header>

        {TOOL_GROUPS.map((g) => (
          <section key={g.id} className={styles.group} data-tone={g.tone} aria-labelledby={`g-${g.id}`}>
            <div className={styles.groupHead}>
              <h2 id={`g-${g.id}`}>{g.title}</h2>
              <p>{g.lede}</p>
            </div>
            <ul className={styles.grid}>
              {g.items.map((t) => {
                const b = t.badge ? badges[t.badge] : undefined;
                return (
                  <li key={t.href}>
                    <Link href={t.href} className={styles.card}>
                      <span className={styles.glyph} aria-hidden>
                        {t.glyph}
                      </span>
                      <strong>{t.title}</strong>
                      <span className={styles.text}>{t.text}</span>
                      <span className={styles.why}>{t.why}</span>
                      {b && (
                        <span className={styles.badge} data-hot={b.hot || undefined}>
                          {b.text}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </main>
    </div>
  );
}
