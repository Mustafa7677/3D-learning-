"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { LessonProgress } from "@inside-tech/lesson-engine";
import { loadActivity } from "@/lib/activity";
import { lessonEntries } from "@/lib/lessons";
import { dayKey } from "@/lib/problems";
import { progressStore } from "@/lib/progress";
import { nextLesson } from "@/lib/today";
import styles from "./continue.module.css";

const HIDE = "inside-tech:continue-hidden";

/**
 * A returning learner should not have to scroll a film to get back to work: a small card on
 * the home page offers the lesson to continue and today's plan. Newcomers never see it.
 */
export function ContinueCard() {
  const [data, setData] = useState<{ title: string; href: string; resume: boolean; moves: number } | null>(null);
  useEffect(() => {
    try {
      if (sessionStorage.getItem(HIDE)) return;
    } catch {
      /* storage unavailable */
    }
    void progressStore()
      .list()
      .catch(() => [] as LessonProgress[])
      .then((progress) => {
        const worked = progress.filter((p) => Object.values(p.completed).some((x) => x.length > 0) || p.completedAt);
        if (!worked.length) return;
        const n = nextLesson(lessonEntries, progress);
        if (!n) return;
        const today = loadActivity().days[dayKey(new Date())] ?? {};
        const moves = [today.review, today.lesson, today.problem].filter((x) => (x ?? 0) > 0).length;
        setData({ title: n.entry.lesson.title, href: `/labs/${n.entry.labId}/${n.entry.lesson.id}`, resume: n.resume, moves });
      });
  }, []);
  if (!data) return null;
  const hide = () => {
    try {
      sessionStorage.setItem(HIDE, "1");
    } catch {
      /* storage unavailable */
    }
    setData(null);
  };
  return (
    <aside className={styles.card} aria-label="Қайта қош келдің">
      <button type="button" className={styles.close} onClick={hide} aria-label="Жабу">
        ×
      </button>
      <p className={styles.kicker}>ҚАЙТА ҚОШ КЕЛДІҢ</p>
      <p className={styles.title}>{data.title}</p>
      <div className={styles.row}>
        <Link href={data.href} className={styles.go}>
          {data.resume ? "Жалғастыр" : "Келесі сабақ"}
        </Link>
        <Link href="/today" className={styles.plan}>
          Бүгін: {data.moves}/3 →
        </Link>
      </div>
    </aside>
  );
}
