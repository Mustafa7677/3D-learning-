"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { dailyProblem, loadProblems, streakLength, week, type HardProblem } from "@/lib/problems";
import styles from "./banner.module.css";

/**
 * The home page's daily hook: today's hard problem and the visitor's streak. Rendered after
 * mount only, so the server's date never disagrees with the visitor's.
 */
export function DailyBanner() {
  const [data, setData] = useState<{ p: HardProblem; streak: number; solvedToday: boolean; days: boolean[] } | null>(null);
  useEffect(() => {
    const now = new Date();
    const save = loadProblems();
    const w = week(save.streak, now);
    setData({ p: dailyProblem(now), streak: streakLength(save.streak, now), solvedToday: w.at(-1)!.solved, days: w.map((d) => d.solved) });
  }, []);
  if (!data) return <section className={styles.banner} aria-label="Бүгінгі қиын есеп" data-loading />;
  const { p, streak, solvedToday, days } = data;
  return (
    <section className={styles.banner} aria-label="Бүгінгі қиын есеп">
      <div className={styles.lamp} aria-hidden />
      <div className={styles.body}>
        <p className={styles.kicker}>БҮГІНГІ ҚИЫН ЕСЕП</p>
        <h2 className={styles.title}>{p.title}</h2>
        <p className={styles.text}>{p.statement}</p>
        <div className={styles.meta}>
          <span className={styles.streak}>
            <b>{streak}</b> күн қатарынан
          </span>
          <span className={styles.dots} aria-label="Соңғы жеті күн">
            {days.map((d, i) => (
              <i key={i} data-on={d} />
            ))}
          </span>
        </div>
      </div>
      <div className={styles.actions}>
        <Link href={`/problems?p=${p.id}`} className={styles.go}>
          {solvedToday ? "Тағы бір есеп" : streak > 0 ? "Серияны жалғастыр" : "Талдап, өзің шығар"}
        </Link>
        <Link href="/today" className={styles.plan}>
          Бүгінгі жоспарым →
        </Link>
      </div>
    </section>
  );
}
