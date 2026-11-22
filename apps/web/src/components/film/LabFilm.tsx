"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { LessonDefinition, LessonProgress } from "@inside-tech/lesson-engine";
import type { LabInfo } from "@/lib/catalog";
import { lessonsForLab } from "@/lib/lessons";
import { levelOf } from "@/lib/levels";
import { prefersReducedMotion } from "@/lib/nav";
import { progressStore } from "@/lib/progress";
import { LevelPath } from "./LevelPath";
import { useScrollProgress } from "@/lib/useScrollProgress";
import { useWebGL } from "@/lib/useWebGL";
import { FilmHeader } from "./FilmHeader";
import styles from "./film.module.css";

const TraceScene = dynamic(() => import("./TraceScene"), { ssr: false });

export function completion(lesson: LessonDefinition<unknown, unknown>, p?: LessonProgress): number {
  if (!p) return 0;
  let total = 0;
  let done = 0;
  for (const s of lesson.steps) {
    total += s.objectives.length;
    done += p.completed[s.id]?.length ?? 0;
  }
  return total ? done / total : 0;
}

export function LabFilm({ lab, warmup, extra }: { lab: LabInfo; warmup?: ReactNode; extra?: { href: string; label: string } }) {
  const lessons = useMemo(() => lessonsForLab(lab.id).map((e) => e.lesson), [lab.id]);
  const film = useRef<HTMLDivElement>(null);
  const items = useRef<(HTMLElement | null)[]>([]);
  const chapters = lessons.length + 1;
  const { progress, chapter } = useScrollProgress(film, chapters);
  const webgl = useWebGL();
  const [still, setStill] = useState(false);
  const [prog, setProg] = useState<Record<string, LessonProgress>>({});

  useEffect(() => setStill(prefersReducedMotion()), []);
  useEffect(() => {
    void progressStore()
      .list()
      .then((all) => setProg(Object.fromEntries(all.map((p) => [p.lessonId, p]))));
  }, []);

  const done = lessons.map((l) => !!prog[l.id]?.completedAt);
  const next = lessons.find((l) => !prog[l.id]?.completedAt) ?? lessons[0];
  const started = lessons.some((l) => prog[l.id]);
  const jump = (i: number) => items.current[i]?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });

  return (
    <div className={styles.page}>
      <FilmHeader
        lead={
          <Link href="/" className={styles.menuLink}>
            Барлық курстар
          </Link>
        }
      />
      <div ref={film} className={styles.film}>
        <div className={styles.stage}>
          {webgl === false ? (
            <div className={styles.cssTrace} aria-hidden>
              {lessons.map((l, i) => (
                <span key={l.id} data-done={done[i]} data-active={chapter - 1 === i} />
              ))}
            </div>
          ) : (
            webgl && <TraceScene labId={lab.id} progress={progress} titles={lessons.map((l) => l.title)} done={done} active={chapter - 1} still={still} />
          )}
          <div className={styles.vignette} aria-hidden />
        </div>

        <div className={styles.chapters}>
          <section className={`${styles.chapter} ${styles.labIntro}`}>
            <h1 className={styles.labTitle}>{lab.title}</h1>
            <p className={styles.lead}>{lab.intro}</p>
            <div className={styles.actions}>
              {next && (
                <Link href={`/labs/${lab.id}/${next.id}`} className={styles.enter}>
                  {started ? "Жалғастыру" : "Бірінші сабақтан бастау"}
                </Link>
              )}
              <button type="button" className={styles.ghost} onClick={() => jump(0)}>
                Сабақтарды аралау
              </button>
              {extra && (
                <Link href={extra.href} className={styles.ghost}>
                  {extra.label}
                </Link>
              )}
            </div>
            <LevelPath orders={lessons.map((l) => l.order)} done={done} onJump={jump} />
            <p className={styles.scrollHint} aria-hidden>
              {lessons.length} сабақ · төмен айналдыр: жол бойымен жүреміз
            </p>
          </section>

          <ol className={styles.stations}>
            {lessons.map((l, i) => {
              const c = completion(l, prog[l.id]);
              const isPset = l.title.startsWith("Problem Set");
              return (
                <li key={l.id} ref={(n) => void (items.current[i] = n)} className={styles.station} data-active={chapter - 1 === i} data-level={levelOf(l.order)}>
                  <Link href={`/labs/${lab.id}/${l.id}`} className={styles.stationCard}>
                    <span className={styles.stationNum}>
                      <b className={styles.level}>{levelOf(l.order)}</b> {isPset ? "Есептер" : `${l.order}-сабақ`}
                    </span>
                    <h2>{l.title}</h2>
                    <p>{l.summary}</p>
                    <span className={styles.stationMeta}>
                      {prog[l.id]?.completedAt ? "Аяқталды" : c > 0 ? `${Math.round(c * 100)}% орындалды` : `${l.estimatedMinutes} мин · ${l.steps.length} кезең`}
                      <span className={styles.bar} aria-hidden>
                        <span style={{ width: `${Math.round(c * 100)}%` }} />
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
      {warmup}
      <footer className={styles.footer}>INSIDE TECH: технологияны ішінен үйрену</footer>
    </div>
  );
}
