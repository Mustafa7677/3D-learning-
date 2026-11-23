"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LessonProgress } from "@inside-tech/lesson-engine";
import { CAREERS, QUIZ, loadAnswers, rank, readiness, saveAnswers, type Career as CareerInfo, type CareerId } from "@/lib/careers";
import { progressStore } from "@/lib/progress";
import { lessonEntries } from "@/lib/lessons";
import { prefersReducedMotion, queryParam } from "@/lib/nav";
import { GadgetFace } from "../lab/Cast";
import { FilmHeader } from "../film/FilmHeader";
import film from "../film/film.module.css";
import styles from "./career.module.css";

const lessonOf = (id: string) => lessonEntries.find((e) => e.lesson.id === id);

/** Кім боламын?: an interest test, eight professions, and a road through the lessons to each. */
export function Career() {
  const [progress, setProgress] = useState<LessonProgress[]>([]);
  const [answers, setAnswers] = useState<number[]>([]);
  const [quiz, setQuiz] = useState(false);
  const [chosen, setChosen] = useState<CareerId>();
  const detail = useRef<HTMLElement>(null);
  const questionRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const saved = loadAnswers();
    if (saved) setAnswers(saved);
    const c = queryParam("c");
    if (CAREERS.some((x) => x.id === c)) setChosen(c as CareerId);
    void progressStore()
      .list()
      .then(setProgress, () => undefined);
  }, []);

  const done = answers.length === QUIZ.length;

  // A new question takes the focus, so the last pick does not stay lit on the next one.
  useEffect(() => {
    if (quiz) questionRef.current?.focus();
  }, [quiz, answers.length]);
  const ranking = useMemo(() => (done ? rank(answers) : []), [answers, done]);

  const choose = (id: CareerId) => {
    setChosen(id);
    window.setTimeout(() => {
      detail.current?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
      detail.current?.focus({ preventScroll: true });
    }, 30);
  };

  const answer = (k: number) => {
    const next = [...answers, k];
    setAnswers(next);
    if (next.length === QUIZ.length) {
      saveAnswers(next);
      setQuiz(false);
    }
  };

  const startQuiz = () => {
    setAnswers([]);
    setQuiz(true);
  };

  const career = CAREERS.find((c) => c.id === chosen);

  return (
    <div className={film.page}>
      <FilmHeader />
      <main className={styles.page}>
        <header className={styles.head}>
          <p className={styles.issue}>МАМАНДЫҚ КАРТАСЫ · {CAREERS.length} МАМАНДЫҚ</p>
          <h1 className={styles.title}>
            Кім <span>боламын?</span>
          </h1>
          <p className={styles.lede}>IT деген бір мамандық емес, ондаған әртүрлі жол. Біреуі сурет пен анимацияны жақсы көреді, біреуі хакерлерді ұстайды, біреуі робот жасайды. Жеті сұраққа жауап бер де, саған қайсысы жақын екенін көр. Әр мамандықтың «бір күні» және осы сайттағы сабақтардан құралған жол картасы бар.</p>
          {!quiz && (
            <div className={styles.actions}>
              <button type="button" className={styles.primary} onClick={startQuiz}>
                {done ? "↻ Тестті қайта тапсыру" : "▶ Тестті бастау · 2 минут"}
              </button>
              <a className={styles.ghost} href="#all">
                Барлық мамандықтар ↓
              </a>
            </div>
          )}
        </header>

        {quiz && !done && (
          <section className={styles.quiz} aria-labelledby="quiz-q">
            <p className={styles.step}>
              {answers.length + 1}/{QUIZ.length}-сұрақ
            </p>
            <div className={styles.dots} aria-hidden>
              {QUIZ.map((_, k) => (
                <i key={k} data-on={k <= answers.length || undefined} />
              ))}
            </div>
            <h2 id="quiz-q" ref={questionRef} tabIndex={-1} className={styles.question}>
              {QUIZ[answers.length]!.q}
            </h2>
            <div className={styles.options}>
              {QUIZ[answers.length]!.options.map((o, k) => (
                <button key={`${answers.length}:${k}`} type="button" onClick={() => answer(k)}>
                  {o.text}
                </button>
              ))}
            </div>
            {answers.length > 0 && (
              <button type="button" className={styles.ghost} onClick={() => setAnswers(answers.slice(0, -1))}>
                ← Алдыңғы сұрақ
              </button>
            )}
          </section>
        )}

        {done && !quiz && (
          <section className={styles.result} aria-labelledby="result-title">
            <h2 id="result-title" className={styles.sectionTitle}>
              Саған ең жақыны
            </h2>
            <TopMatch career={CAREERS.find((c) => c.id === ranking[0]!.id)!} percent={ranking[0]!.percent} onOpen={choose} />
            <ol className={styles.ranking} aria-label="Барлық мамандыққа сәйкестік">
              {ranking.map((r) => {
                const c = CAREERS.find((x) => x.id === r.id)!;
                return (
                  <li key={r.id}>
                    <button type="button" onClick={() => choose(r.id)}>
                      <span>{c.title}</span>
                      <i style={{ width: `${r.percent}%`, background: c.color }} />
                      <b>{r.percent}%</b>
                    </button>
                  </li>
                );
              })}
            </ol>
            <p className={styles.note}>Бұл тек бағдар: қызығушылық уақыт өте өзгереді. Ең жақсы тест: әр бағыттың бір сабағын өтіп көру.</p>
          </section>
        )}

        <section id="all" className={styles.allSection} aria-labelledby="all-title">
          <h2 id="all-title" className={styles.sectionTitle}>
            Сегіз мамандық
          </h2>
          <ul className={styles.grid}>
            {CAREERS.map((c) => {
              const r = readiness(c, progress);
              return (
                <li key={c.id} style={{ ["--c" as string]: c.color }} data-on={c.id === chosen || undefined}>
                  <button type="button" className={styles.card} onClick={() => choose(c.id)} aria-label={`${c.title}: толығырақ`}>
                    <GadgetFace who={c.who} mood="smile" className={styles.cardFace} />
                    <h3>{c.title}</h3>
                    <p>{c.tagline}</p>
                    <span className={styles.mini} aria-hidden>
                      <i style={{ width: `${r.percent}%` }} />
                    </span>
                    <small>Дайындық: {r.percent}%</small>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {career && <Detail ref={detail} career={career} progress={progress} />}
      </main>
    </div>
  );
}

function TopMatch({ career, percent, onOpen }: { career: CareerInfo; percent: number; onOpen: (id: CareerId) => void }) {
  return (
    <div className={styles.top} style={{ ["--c" as string]: career.color }}>
      <GadgetFace who={career.who} mood="wow" className={styles.topFace} />
      <div>
        <p className={styles.topPercent}>{percent}% сәйкес</p>
        <h3>{career.title}</h3>
        <p>{career.tagline}</p>
        <button type="button" className={styles.primary} onClick={() => onOpen(career.id)}>
          Бұл мамандықтың бір күні →
        </button>
      </div>
    </div>
  );
}

function Detail({ career, progress, ref }: { career: CareerInfo; progress: LessonProgress[]; ref: React.Ref<HTMLElement> }) {
  const r = readiness(career, progress);
  const next = r.next ? lessonOf(r.next) : undefined;
  return (
    <section ref={ref} tabIndex={-1} className={styles.detail} style={{ ["--c" as string]: career.color }} aria-labelledby="career-title">
      <div className={styles.detailHead}>
        <GadgetFace who={career.who} mood="explain" className={styles.detailFace} />
        <div>
          <p className={styles.issue}>МАМАНДЫҚ</p>
          <h2 id="career-title" className={styles.detailTitle}>
            {career.title}
          </h2>
          <p className={styles.lede}>{career.tagline}</p>
        </div>
      </div>

      <div className={styles.columns}>
        <div className={styles.block}>
          <h3>Не істейді?</h3>
          <ul className={styles.does}>
            {career.does.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
          <h3>Құралдары</h3>
          <ul className={styles.chips}>
            {career.tools.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <h3>Қайда жұмыс істейді?</h3>
          <p>{career.where}</p>
        </div>

        <div className={styles.block}>
          <h3>Бір күні</h3>
          <ol className={styles.day}>
            {career.day.map((d) => (
              <li key={d.at}>
                <time>{d.at}</time>
                <span>{d.text}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className={styles.road}>
        <div className={styles.roadHead}>
          <h3>Жол картасы: осы сайттағы 8 сабақ</h3>
          <p className={styles.ready} aria-label={`Дайындық ${r.percent} пайыз`}>
            <span>
              <i style={{ width: `${r.percent}%` }} />
            </span>
            <b>{r.percent}%</b>
          </p>
        </div>
        <ol className={styles.roadList}>
          {career.road.map((id, k) => {
            const e = lessonOf(id);
            if (!e) return null;
            const ok = r.done.includes(id);
            return (
              <li key={id} data-done={ok || undefined} data-next={id === r.next || undefined}>
                <span className={styles.stop} aria-hidden>
                  {ok ? "✓" : k + 1}
                </span>
                <Link href={`/labs/${e.labId}/${id}`}>{e.lesson.title}</Link>
                <span className={styles.sr}>{ok ? ", аяқталды" : ""}</span>
              </li>
            );
          })}
        </ol>
        {next ? (
          <Link className={styles.primary} href={`/labs/${next.labId}/${next.lesson.id}`}>
            Келесі қадам: {next.lesson.title} →
          </Link>
        ) : (
          <p className={styles.note}>Жолдың бәрі өтілді! Енді бірінші жобаңды баста.</p>
        )}
      </div>

      <div className={styles.columns}>
        <div className={styles.block}>
          <h3>Бірінші жоба</h3>
          <p>{career.project}</p>
        </div>
        <div className={styles.block}>
          <h3>Ойнап көр</h3>
          <Link className={styles.ghost} href={career.play.href}>
            {career.play.label} →
          </Link>
        </div>
      </div>
    </section>
  );
}
