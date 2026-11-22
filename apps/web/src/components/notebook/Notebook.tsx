"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { findLab } from "@/lib/catalog";
import { lessonEntries } from "@/lib/lessons";
import { optionOrder } from "@/lib/shuffle";
import { MASTERED_BOX, collectMistakes, dueMistakes, gradeMistake, mastered, sanitizeReview, schedule, type Mistake, type Review } from "@/lib/notebook";
import { progressStore } from "@/lib/progress";
import { OyuRule } from "../lab/Oyu";
import { FilmHeader } from "../film/FilmHeader";
import film from "../film/film.module.css";
import styles from "./notebook.module.css";

const SAVE = "inside-tech:notebook";

function Practice({ m, onDone }: { m: Mistake; onDone(right: boolean): void }) {
  const [pick, setPick] = useState<number | null>(null);
  const right = pick === m.answer;
  return (
    <article className={styles.practice} aria-label="Қайта шешу">
      <p className={styles.meta}>
        {findLab(m.labId)?.title} · {m.lessonTitle} · {m.kind === "predict" ? "болжам" : "тексеру сұрағы"}
      </p>
      <h2 className={styles.q}>{m.question}</h2>
      <div className={styles.options} role="group" aria-label="Жауаптар">
        {optionOrder(m.question, m.options.length).map((i) => [m.options[i]!, i] as const).map(([o, i]) => (
          <button
            key={i}
            type="button"
            className={styles.option}
            disabled={pick !== null}
            data-state={pick === null ? undefined : i === m.answer ? "right" : i === pick ? "wrong" : undefined}
            onClick={() => setPick(i)}
          >
            {o}
          </button>
        ))}
      </div>
      {pick !== null && (
        <div className={styles.verdict} role="status">
          <strong>{right ? "Дұрыс. Енді бұл сирек қайтады." : "Тағы қате. Ертең емес, бүгін қайта шығады."}</strong>
          <p>{m.explain}</p>
          <button type="button" className={styles.next} onClick={() => onDone(right)}>
            Келесі
          </button>
        </div>
      )}
    </article>
  );
}

/** Every mistake in one notebook, and a daily review of the ones not yet mastered. */
export function Notebook() {
  const [mistakes, setMistakes] = useState<Mistake[] | null>(null);
  const [review, setReview] = useState<Review>({});
  const [lab, setLab] = useState<string | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [session, setSession] = useState({ right: 0, wrong: 0 });

  useEffect(() => {
    let alive = true;
    const now = Date.now();
    let saved: Review = {};
    try {
      saved = sanitizeReview(JSON.parse(localStorage.getItem(SAVE) ?? "null"));
    } catch {
      /* storage unavailable */
    }
    progressStore()
      .list()
      .then((list) => {
        if (!alive) return;
        const ms = collectMistakes(lessonEntries, list);
        const r = schedule(saved, ms, now);
        setMistakes(ms);
        setReview(r);
        setQueue(dueMistakes(r, ms, now).map((m) => m.key));
      })
      .catch(() => alive && setMistakes([]));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!mistakes) return;
    try {
      localStorage.setItem(SAVE, JSON.stringify(review));
    } catch {
      /* storage unavailable */
    }
  }, [review, mistakes]);

  const labs = useMemo(() => [...new Set((mistakes ?? []).map((m) => m.labId))], [mistakes]);
  const shown = (mistakes ?? []).filter((m) => !lab || m.labId === lab);
  const current = mistakes?.find((m) => m.key === queue[0]);
  const total = mistakes?.length ?? 0;
  const done = mistakes ? mastered(review, mistakes) : 0;

  const answer = (right: boolean) => {
    if (!current) return;
    setReview((r) => gradeMistake(r, current.key, right, Date.now()));
    setSession((s) => (right ? { ...s, right: s.right + 1 } : { ...s, wrong: s.wrong + 1 }));
    setQueue((q) => (right ? q.slice(1) : [...q.slice(1), q[0]!]));
  };

  return (
    <div className={film.page}>
      <FilmHeader />
      <main className={styles.page}>
        <header className={styles.head}>
          <p className={styles.issue}>ҚАТЕЛЕР ДӘПТЕРІ · ӘР ҚАТЕ: САБАҚ</p>
          <h1 className={styles.title}>Қателескен жерің: өсетін жерің</h1>
          <OyuRule className={styles.rule} />
          <p className={styles.lede}>Сабақтарда қате берген сұрақтарың мен тәжірибе расталмаған болжамдарың осында өзі жазылады. Әрқайсысын қайта шеш: дұрыс шешкенің сирек қайтады, бес рет қатарынан шешсең, меңгердің.</p>
        </header>

        <section className={styles.tally} aria-label="Дәптер есебі">
          <div>
            <b>{total}</b>
            <span>барлық қате</span>
          </div>
          <div>
            <b>{queue.length}</b>
            <span>бүгін қайталау</span>
          </div>
          <div>
            <b>{done}</b>
            <span>меңгерілді</span>
          </div>
          <div className={styles.meter} aria-hidden>
            <i style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
          </div>
        </section>

        {mistakes === null ? null : total === 0 ? (
          <section className={styles.empty}>
            <h2>Дәптер әзірге таза</h2>
            <p>Сабақта қате жауап берсең не болжамың расталмаса, ол осында келеді. Бұл жаза емес: ең жақсы оқитын жер дәл осы.</p>
            <Link href="/#labs" className={styles.next}>
              Сабақтарға
            </Link>
          </section>
        ) : current ? (
          <Practice key={`${current.key}-${session.right + session.wrong}`} m={current} onDone={answer} />
        ) : (
          <section className={styles.empty} role="status">
            <h2>Бүгінгі қайталау бітті</h2>
            <p>
              Дұрыс: {session.right} · қайта: {session.wrong}. Қалғандары өз күні келгенде қайтады.
            </p>
          </section>
        )}

        {total > 0 && (
          <section className={styles.pages} aria-label="Дәптер беттері">
            <div className={styles.filters} role="group" aria-label="Зертхана">
              <button type="button" aria-pressed={lab === null} onClick={() => setLab(null)}>
                Барлығы
              </button>
              {labs.map((l) => (
                <button key={l} type="button" aria-pressed={lab === l} onClick={() => setLab(l)}>
                  {findLab(l)?.title}
                </button>
              ))}
            </div>
            <ol className={styles.sheet}>
              {shown.map((m) => {
                const box = review[m.key]?.box ?? 1;
                return (
                  <li key={m.key} className={styles.entry} data-mastered={box >= MASTERED_BOX}>
                    <p className={styles.meta}>
                      <Link href={`/labs/${m.labId}/${m.lessonId}`}>{m.lessonTitle}</Link> · {m.stepTitle} · {box >= MASTERED_BOX ? "меңгерілді ✓" : `${box}-қорап`}
                    </p>
                    <p className={styles.eq}>{m.question}</p>
                    {m.chosen !== undefined && <p className={styles.struck}>{m.options[m.chosen]}</p>}
                    <p className={styles.fixed}>{m.options[m.answer]}</p>
                    <p className={styles.note}>{m.explain}</p>
                  </li>
                );
              })}
            </ol>
          </section>
        )}
      </main>
    </div>
  );
}
