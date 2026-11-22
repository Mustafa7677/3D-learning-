"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { LessonProgress } from "@inside-tech/lesson-engine";
import { ACTIVITY_EVENT, loadActivity, type ActivityLog } from "@/lib/activity";
import { dueCards, newDeck, sanitizeDeck } from "@/lib/cards";
import { findLab } from "@/lib/catalog";
import { lessonEntries } from "@/lib/lessons";
import { collectMistakes, dueMistakes, sanitizeReview, schedule } from "@/lib/notebook";
import { dailyProblem, loadProblems, streakLength } from "@/lib/problems";
import { progressStore } from "@/lib/progress";
import { GOALS, activeThisWeek, greeting, heatmap, loadGoal, mastery, saveGoal, todayPlan, type PlanItem } from "@/lib/today";
import { XP_EVENT, usePlayer } from "@/lib/xp";
import { FilmHeader } from "../film/FilmHeader";
import film from "../film/film.module.css";
import styles from "./today.module.css";

const MONTHS = ["қаңтар", "ақпан", "наурыз", "сәуір", "мамыр", "маусым", "шілде", "тамыз", "қыркүйек", "қазан", "қараша", "желтоқсан"];
const WEEKDAYS = ["жексенбі", "дүйсенбі", "сейсенбі", "сәрсенбі", "бейсенбі", "жұма", "сенбі"];
const ROWS = ["Дс", "", "Ср", "", "Жм", "", "Жс"];

function Ring({ value, max, label, sub, tone }: { value: number; max: number; label: string; sub: string; tone: "amber" | "teal" | "ember" }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  return (
    <div className={styles.ring} data-tone={tone} role="img" aria-label={`${label}: ${value}/${max}`}>
      <svg viewBox="0 0 100 100" aria-hidden>
        <circle cx="50" cy="50" r={r} className={styles.ringTrack} />
        <circle cx="50" cy="50" r={r} className={styles.ringBar} strokeDasharray={`${c * f} ${c}`} />
      </svg>
      <div className={styles.ringText}>
        <strong>
          {value}
          <small>/{max}</small>
        </strong>
      </div>
      <p className={styles.ringLabel}>{label}</p>
      <p className={styles.ringSub}>{sub}</p>
    </div>
  );
}

interface Data {
  progress: LessonProgress[];
  activity: ActivityLog;
  cardsDue: number;
  mistakesDue: number;
  streak: number;
}

/** Бүгін: the learner's daily plan, week and progress, built from their own saved work. */
export function Today() {
  const [now, setNow] = useState<Date | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [goal, setGoal] = useState(3);
  const player = usePlayer();

  const load = useCallback(() => {
    const t = new Date();
    setNow(t);
    setGoal(loadGoal());
    let cardsDue = 0;
    try {
      cardsDue = dueCards(sanitizeDeck(JSON.parse(localStorage.getItem("inside-tech:cards") ?? "null"), t.getTime()), t.getTime()).length;
    } catch {
      cardsDue = dueCards(newDeck(t.getTime()), t.getTime()).length;
    }
    let review = {};
    try {
      review = sanitizeReview(JSON.parse(localStorage.getItem("inside-tech:notebook") ?? "null"));
    } catch {
      /* storage unavailable */
    }
    const problems = loadProblems();
    void progressStore()
      .list()
      .catch(() => [] as LessonProgress[])
      .then((progress) => {
        const ms = collectMistakes(lessonEntries, progress);
        const r = schedule(review, ms, t.getTime());
        setData({ progress, activity: loadActivity(), cardsDue, mistakesDue: dueMistakes(r, ms, t.getTime()).length, streak: streakLength(problems.streak, t) });
      });
  }, []);

  useEffect(() => {
    load();
    window.addEventListener(ACTIVITY_EVENT, load);
    window.addEventListener(XP_EVENT, load);
    return () => {
      window.removeEventListener(ACTIVITY_EVENT, load);
      window.removeEventListener(XP_EVENT, load);
    };
  }, [load]);

  const plan: PlanItem[] = now && data ? todayPlan({ entries: lessonEntries, progress: data.progress, activity: data.activity, cardsDue: data.cardsDue, mistakesDue: data.mistakesDue, daily: dailyProblem(now), now }) : [];
  const planDone = plan.filter((x) => x.done).length;
  const week = now && data ? activeThisWeek(data.activity, now) : 0;
  const heat = now && data ? heatmap(data.activity, now, 16) : [];
  const labs = data ? mastery(lessonEntries, data.progress) : [];
  const activeDays = data ? Object.keys(data.activity.days).length : 0;

  return (
    <div className={film.page}>
      <FilmHeader />
      <main className={styles.page}>
        <header className={styles.hero}>
          <p className={styles.date}>{now ? `${now.getDate()} ${MONTHS[now.getMonth()]}, ${WEEKDAYS[now.getDay()]}` : " "}</p>
          <h1 className={styles.title}>{now ? greeting(now) : "Бүгін"}</h1>
          <p className={styles.lede}>
            {plan.length === 0
              ? "Жоспар жиналып жатыр…"
              : planDone === 3
                ? "Бүгінгі үш қадамның бәрі орындалды. Мидың бекітуіне уақыт бер: ертең жалғастырамыз."
                : `Бүгінгі сессия үш қысқа қадам: еске түсір, жаңасын үйрен, қиын есеппен сына. ${3 - planDone} қадам қалды.`}
          </p>
        </header>

        <section className={styles.rings} aria-label="Бүгінгі көрсеткіштер">
          <Ring value={planDone} max={3} label="бүгінгі жоспар" sub="Үш қадамның неше орындалды" tone="amber" />
          <Ring value={week} max={goal} label="апта мақсаты" sub="Осы аптадағы белсенді күндер" tone="teal" />
          <Ring value={data?.streak ?? 0} max={Math.max(7, data?.streak ?? 0)} label="есеп сериясы" sub="Күн есебі қатарынан неше күн" tone="ember" />
          <div className={styles.level}>
            <p className={styles.levelNum}>{player?.level ?? 1}</p>
            <p className={styles.levelLabel}>деңгей</p>
            <div className={styles.levelBar}>
              <span style={{ width: `${player ? Math.round((player.into / player.need) * 100) : 0}%` }} />
            </div>
            <p className={styles.levelSub}>{player ? `${player.into} / ${player.need} XP · барлығы ${player.xp}` : "…"}</p>
          </div>
        </section>

        <section aria-labelledby="plan-title">
          <h2 id="plan-title" className={styles.h2}>
            Бүгінгі үш қадам
          </h2>
          <ol className={styles.plan}>
            {plan.map((x) => (
              <li key={x.id} data-done={x.done}>
                <Link href={x.href} className={styles.planCard} aria-label={`${x.kicker}: ${x.title}${x.done ? " (орындалды)" : ""}`}>
                  <span className={styles.planKicker}>{x.kicker}</span>
                  <strong>{x.title}</strong>
                  <span className={styles.planDetail}>{x.detail}</span>
                  <span className={styles.planGo} aria-hidden>
                    {x.done ? "✓ Орындалды" : "Бастау →"}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.panel} aria-labelledby="goal-title">
          <div className={styles.panelHead}>
            <h2 id="goal-title" className={styles.h2}>
              Апта мақсаты
            </h2>
            <div className={styles.goals} role="group" aria-label="Аптасына неше күн">
              {GOALS.map((g) => (
                <button
                  key={g}
                  type="button"
                  aria-pressed={goal === g}
                  onClick={() => {
                    setGoal(g);
                    saveGoal(g);
                  }}
                >
                  {g} күн
                </button>
              ))}
            </div>
          </div>
          <p className={styles.note}>
            {week >= goal ? `Мақсат орындалды: осы аптада ${week} күн оқыдың.` : `Осы аптада ${week} күн оқыдың. Мақсатқа ${goal - week} күн қалды.`} Тұрақтылық ұзақтықтан маңызды: күніне 15 минут аптасына бір рет 2 сағаттан жақсы есте қалады.
          </p>
          <div className={styles.heat} role="img" aria-label={`Соңғы 16 аптадағы белсенділік: ${activeDays} белсенді күн`}>
            <div className={styles.heatRows} aria-hidden>
              {ROWS.map((r, i) => (
                <span key={i}>{r}</span>
              ))}
            </div>
            <div className={styles.heatGrid}>
              {heat.map((col, i) => (
                <div key={i} className={styles.heatCol}>
                  {col.map((c) => (
                    <i key={c.key} data-level={c.level} data-future={c.future || undefined} title={`${c.key}: ${c.total}`} />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <p className={styles.heatLegend} aria-hidden>
            аз <i data-level="1" /> <i data-level="2" /> <i data-level="3" /> <i data-level="4" /> көп
          </p>
        </section>

        <section className={styles.panel} aria-labelledby="mastery-title">
          <h2 id="mastery-title" className={styles.h2}>
            Шеберлік картасы
          </h2>
          <ul className={styles.mastery}>
            {labs.map((m) => {
              const lab = findLab(m.labId);
              const pct = m.total ? Math.round((m.done / m.total) * 100) : 0;
              return (
                <li key={m.labId}>
                  <Link href={`/labs/${m.labId}`} className={styles.masteryRow}>
                    <span className={styles.masteryName}>{lab?.title ?? m.labId}</span>
                    <span className={styles.masteryBar} aria-hidden>
                      <span style={{ width: `${pct}%` }} />
                    </span>
                    <span className={styles.masteryNum}>
                      {m.done}/{m.total}
                      {m.accuracy !== undefined && <small> · {Math.round(m.accuracy * 100)}% бірден дұрыс</small>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </main>
    </div>
  );
}
