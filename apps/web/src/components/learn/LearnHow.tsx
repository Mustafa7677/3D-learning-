"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { solveChallenge } from "@/lib/challenges";
import { queryParam } from "@/lib/nav";
import { EPISODES, loadSeen, saveSeen } from "@/lib/learnHow";
import { ComicStrip } from "../lab/StepMedia";
import { FilmHeader } from "../film/FilmHeader";
import film from "../film/film.module.css";
import styles from "./learn.module.css";

/** «Қалай оқу керек?»: seven comic episodes on learning itself, each opened by a myth-or-fact guess. */
export function LearnHow() {
  const [i, setI] = useState(0);
  /** Episode id → whether the learner's guess was right. */
  const [seen, setSeen] = useState<Record<string, boolean>>({});
  useEffect(() => {
    setSeen(loadSeen());
    // A search result can open one episode: /learn?e=reread
    const asked = queryParam("e");
    const k = EPISODES.findIndex((x) => x.id === asked);
    if (k >= 0) setI(k);
  }, []);
  const e = EPISODES[i]!;
  const guessed = e.id in seen;
  const done = Object.keys(seen).length;
  const right = Object.values(seen).filter(Boolean).length;

  const guess = (fact: boolean) => {
    if (guessed) return;
    const next = { ...seen, [e.id]: fact === e.fact };
    setSeen(next);
    saveSeen(next);
    if (Object.keys(next).length === EPISODES.length) solveChallenge("learn-how");
  };

  return (
    <div className={film.page}>
      <FilmHeader />
      <main className={styles.page}>
        <header className={styles.head}>
          <p className={styles.kicker}>КОМИКС-КУРС · 7 ЭПИЗОД</p>
          <h1 className={styles.title}>Қалай оқу керек?</h1>
          <p className={styles.lede}>Көп адам оқуға ең тиімсіз тәсілдермен уақыт жұмсайды. Нұрай, Мустафа және Ұстаз жеті танымал сенімді тексереді. Әр эпизодта алдымен өзің шеш: миф пе, шындық па?</p>
          <p className={styles.progress} aria-label="Курс прогресі">
            {done}/{EPISODES.length} эпизод · {right} дұрыс болжам
          </p>
        </header>

        <nav className={styles.episodes} aria-label="Эпизодтар">
          {EPISODES.map((x, k) => (
            <button key={x.id} type="button" aria-current={k === i ? "true" : undefined} data-state={x.id in seen ? (seen[x.id] ? "right" : "wrong") : undefined} onClick={() => setI(k)}>
              <span>{k + 1}</span>
              {x.tool.label}
            </button>
          ))}
        </nav>

        <article className={styles.episode} aria-label={`Эпизод ${i + 1}: ${e.comic.title}`}>
          <section className={styles.claim}>
            <p className={styles.kicker}>СЕНІМ</p>
            <p className={styles.claimText}>«{e.claim}»</p>
            <div className={styles.verdictBtns} role="group" aria-label="Миф пе, шындық па?">
              <button type="button" disabled={guessed} data-state={guessed && !e.fact ? "truth" : undefined} onClick={() => guess(false)}>
                Миф
              </button>
              <button type="button" disabled={guessed} data-state={guessed && e.fact ? "truth" : undefined} onClick={() => guess(true)}>
                Шындық
              </button>
            </div>
            {guessed && (
              <p className={styles.verdict} role="status" data-right={seen[e.id]}>
                {seen[e.id] ? "Дұрыс таптың." : "Көп адам осылай ойлайды."} Бұл: <b>{e.fact ? "шындық" : "миф"}</b>. Енді комиксті оқы.
              </p>
            )}
          </section>

          {guessed ? (
            <>
              <div className={styles.comicWrap}>
                <ComicStrip comic={e.comic} />
              </div>
              <section className={styles.finding} aria-label="Зерттеулер не дейді">
                <p className={styles.kicker}>ЗЕРТТЕУЛЕР НЕ ДЕЙДІ</p>
                <p>{e.finding}</p>
              </section>
              <Link href={e.tool.href} className={styles.tool}>
                <span className={styles.kicker}>САЙТТА ҚАЛАЙ ҚОЛДАНАСЫҢ</span>
                <strong>{e.tool.label} →</strong>
                <span>{e.tool.how}</span>
              </Link>
              <div className={styles.nav}>
                <button type="button" className={styles.ghost} disabled={i === 0} onClick={() => setI(i - 1)}>
                  Алдыңғы эпизод
                </button>
                <button type="button" className={styles.primary} disabled={i === EPISODES.length - 1} onClick={() => setI(i + 1)}>
                  Келесі эпизод
                </button>
              </div>
            </>
          ) : (
            <p className={styles.locked}>Комикс сенің жауабыңнан кейін ашылады: алдын ала болжау оқуды күшейтеді. Бұл да зерттеулердің бірі.</p>
          )}
        </article>

        {done === EPISODES.length && (
          <section className={styles.final} role="status" aria-label="Курс аяқталды">
            <p className={styles.kicker}>КУРС АЯҚТАЛДЫ · +20 XP</p>
            <p>Енді сен оқудың өзін білесің: еске түсір, аралықпен қайтала, араластыр, қатеңнен үйрен, назарыңды сақта. Мұның бәрі «Бүгін» бетінде бір жоспарға жиналған.</p>
            <Link href="/today" className={styles.primary}>
              Бүгінгі жоспарға
            </Link>
          </section>
        )}
      </main>
    </div>
  );
}
