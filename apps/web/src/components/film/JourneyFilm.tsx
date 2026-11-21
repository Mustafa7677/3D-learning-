"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { findLab } from "@/lib/catalog";
import { JOURNEY, JOURNEY_TOTAL, XP_JOURNEY_ANSWER, loadJourney, saveJourneyAnswer, type JourneyStop } from "@/lib/journey";
import { prefersReducedMotion } from "@/lib/nav";
import { useScrollProgress } from "@/lib/useScrollProgress";
import { useWebGL } from "@/lib/useWebGL";
import { FilmHeader } from "./FilmHeader";
import film from "./film.module.css";
import styles from "./journey.module.css";

const JourneyScene = dynamic(() => import("./JourneyScene"), { ssr: false });

const N = JOURNEY.length;
const CHAPTERS = N + 2;
/** One hue per stop for the time bar: network stops share cobalt, the rest copper-ish. */
const hue = (s: JourneyStop) => (s.lab === "net" ? "#6d8cff" : s.lab === "sec" ? "#b07cff" : s.lab === "game" ? "#3fd39a" : "#e3a04f");

function Question({ stop, solved, onSolved }: { stop: JourneyStop; solved: boolean; onSolved(): void }) {
  const [picked, setPicked] = useState<number | null>(null);
  const right = solved || picked === stop.question.answer;
  return (
    <fieldset className={styles.question} data-state={right ? "right" : picked !== null ? "wrong" : undefined}>
      <legend>{stop.question.q}</legend>
      <div className={styles.options}>
        {stop.question.options.map((o, k) => (
          <button
            key={k}
            type="button"
            disabled={right}
            aria-pressed={picked === k}
            data-correct={right && k === stop.question.answer}
            onClick={() => {
              setPicked(k);
              if (k === stop.question.answer) onSolved();
            }}
          >
            {o}
          </button>
        ))}
      </div>
      <p className={styles.feedback} aria-live="polite">
        {right ? `+${XP_JOURNEY_ANSWER} XP. ${stop.question.explain}` : picked !== null ? "Дұрыс емес. Мәтінге қайта қарап, тағы байқа." : ""}
      </p>
    </fieldset>
  );
}

export function JourneyFilm() {
  const filmEl = useRef<HTMLDivElement>(null);
  const chapters = useRef<(HTMLElement | null)[]>([]);
  const { progress, chapter } = useScrollProgress(filmEl, CHAPTERS);
  const webgl = useWebGL();
  const [still, setStill] = useState(false);
  const [solved, setSolved] = useState<string[]>([]);
  useEffect(() => {
    setStill(prefersReducedMotion());
    setSolved(loadJourney());
  }, []);

  // The scene only sees the stops: chapter 0 is the intro, the last one the finale.
  const sceneProgress = useMemo(
    () =>
      ({
        get current() {
          return Math.min(1, Math.max(0, (progress.current * CHAPTERS - 1) / N));
        },
      }) as MutableRefObject<number>,
    [progress],
  );
  const active = Math.min(N - 1, Math.max(-1, chapter - 1));
  const elapsed = JOURNEY.slice(0, active + 1).reduce((t, s) => t + s.ms, 0);
  const go = (i: number) => chapters.current[i]?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  const network = JOURNEY.filter((s) => s.lab === "net" || s.lab === "sec").reduce((t, s) => t + s.ms, 0);
  const stops = useMemo(() => JOURNEY.map((s) => ({ lab: s.lab, title: s.title })), []);

  return (
    <div className={film.page}>
      <FilmHeader
        lead={
          <Link href="/" className={film.menuLink}>
            Курстар
          </Link>
        }
      />
      <div ref={filmEl} className={film.film} style={{ height: `${CHAPTERS * 100}vh` }}>
        <div className={film.stage}>
          {webgl === false ? (
            <div className={styles.cssRoad} aria-hidden>
              {JOURNEY.map((s, i) => (
                <span key={s.id} data-done={i < active} data-active={i === active} />
              ))}
            </div>
          ) : (
            webgl && <JourneyScene progress={sceneProgress} stops={stops} active={active} still={still} />
          )}
          <div className={film.vignette} aria-hidden />
          {active >= 0 && chapter <= N && (
            <div className={styles.hud} aria-hidden>
              <div className={styles.clock}>
                <span>өткен уақыт</span>
                <strong>{elapsed} мс</strong>
              </div>
              <div className={styles.timeline}>
                {JOURNEY.map((s, i) => (
                  <span key={s.id} style={{ flexGrow: s.ms, background: hue(s) }} data-on={i <= active} title={`${s.title}: ${s.ms} мс`} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={film.chapters}>
          <section ref={(n) => void (chapters.current[0] = n)} className={`${film.chapter} ${styles.intro}`}>
            <p className={styles.kicker}>Inside Tech саяхаты</p>
            <h1 className={styles.title}>Бір басудың саяхаты</h1>
            <p className={film.lead}>
              Адрес жолына сайт атын жазып, Enter басасың. Бет {JOURNEY_TOTAL} миллисекундта ашылады. Сол сәтте он курстың бәрі жұмыс істейді: пернетақтадан бастап нейрондық желіге дейін. Пакетпен бірге ұш.
            </p>
            <button type="button" className={styles.key} onClick={() => go(1)}>
              <span>Enter</span>
              <span aria-hidden>↵</span>
            </button>
            <p className={film.scrollHint} aria-hidden>
              немесе төмен айналдыр
            </p>
          </section>

          {JOURNEY.map((s, i) => {
            const lab = findLab(s.lab);
            return (
              <section key={s.id} ref={(n) => void (chapters.current[i + 1] = n)} className={film.chapter} aria-labelledby={`stop-${s.id}`}>
                <article className={styles.card} data-active={i === active}>
                  <div className={styles.cardTop}>
                    <span className={styles.step}>
                      {i + 1} / {N}
                    </span>
                    <span className={styles.ms} style={{ borderColor: hue(s), color: hue(s) }}>
                      +{s.ms} мс
                    </span>
                  </div>
                  <h2 id={`stop-${s.id}`}>{s.title}</h2>
                  <p>{s.text}</p>
                  <Question
                    stop={s}
                    solved={solved.includes(s.id)}
                    onSolved={() => setSolved(saveJourneyAnswer(s.id))}
                  />
                  {lab?.href && (
                    <Link href={lab.href} className={styles.course}>
                      Толығырақ: {lab.title} курсы
                    </Link>
                  )}
                </article>
              </section>
            );
          })}

          <section ref={(n) => void (chapters.current[N + 1] = n)} className={film.chapter}>
            <article className={`${styles.card} ${styles.finale}`}>
              <p className={styles.step}>Бет ашылды</p>
              <h2 className={styles.total}>{JOURNEY_TOTAL} мс</h2>
              <p>
                Уақыттың {Math.round((network / JOURNEY_TOTAL) * 100)}%-ы желіде өтті: DNS, TCP, TLS және жауап. Оларды жарық жылдамдығы шектейді, сондықтан ірі сайттар серверлерін саған жақын қояды (CDN).
              </p>
              <ul className={styles.breakdown}>
                {[...JOURNEY]
                  .sort((a, b) => b.ms - a.ms)
                  .map((s) => (
                    <li key={s.id}>
                      <span>{s.title}</span>
                      <span className={styles.bar}>
                        <span style={{ width: `${(s.ms / 40) * 100}%`, background: hue(s) }} />
                      </span>
                      <strong>{s.ms} мс</strong>
                    </li>
                  ))}
              </ul>
              <div className={styles.badgeRow}>
                <span className={styles.badge} data-earned={solved.length === N} aria-hidden>
                  ↵
                </span>
                <p>
                  {solved.length === N
                    ? "«Сапаршы» белгісі сенікі: он сұрақтың бәріне дұрыс жауап бердің."
                    : `«Сапаршы» белгісіне дейін: ${solved.length} / ${N} сұрақ шешілді.`}
                </p>
              </div>
              <div className={film.actions}>
                <button type="button" className={film.ghost} onClick={() => go(1)}>
                  Қайта ұшу
                </button>
                <Link href="/" className={film.enter}>
                  Курстарды таңдау
                </Link>
              </div>
            </article>
          </section>
        </div>
      </div>
      <footer className={film.footer}>INSIDE TECH: технологияны ішінен үйрену</footer>
    </div>
  );
}
