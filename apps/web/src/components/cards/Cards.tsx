"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BOXES, CARDS, INTERVAL_DAYS, boxCounts, dueCards, grade, newDeck, nextDue, sanitizeDeck, type Card, type Deck } from "@/lib/cards";
import { findLab } from "@/lib/catalog";
import { solveChallenge } from "@/lib/challenges";
import { stampDate } from "@/lib/passport";
import { OyuCorner, OyuRule } from "../lab/Oyu";
import { FilmHeader } from "../film/FilmHeader";
import film from "../film/film.module.css";
import styles from "./cards.module.css";

const SAVE = "inside-tech:cards";

/** Memory cards: flip, say honestly whether you knew it, the boxes do the rest. */
export function Cards() {
  const [deck, setDeck] = useState<Deck>({});
  const [queue, setQueue] = useState<Card[]>([]);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [stats, setStats] = useState({ knew: 0, again: 0 });

  useEffect(() => {
    const now = Date.now();
    let d: Deck;
    try {
      d = sanitizeDeck(JSON.parse(localStorage.getItem(SAVE) ?? "null"), now);
    } catch {
      d = newDeck(now);
    }
    setDeck(d);
    setQueue(dueCards(d, now));
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(SAVE, JSON.stringify(deck));
    } catch {
      /* storage unavailable */
    }
  }, [deck, loaded]);

  const card = queue[i];
  const done = loaded && !card;
  useEffect(() => {
    if (done && stats.knew + stats.again > 0) solveChallenge("cards-session");
  }, [done, stats.knew, stats.again]);

  const answer = (knew: boolean) => {
    if (!card) return;
    setDeck((d) => grade(d, card.id, knew, Date.now()));
    setStats((s) => (knew ? { ...s, knew: s.knew + 1 } : { ...s, again: s.again + 1 }));
    // A card you did not know comes back at the end of today's pile.
    if (!knew) setQueue((q) => [...q, card]);
    setFlipped(false);
    setI((x) => x + 1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!card || (e.target as HTMLElement).closest("button, a, input, textarea")) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped && (e.key === "1" || e.key === "ArrowLeft")) answer(false);
      else if (flipped && (e.key === "2" || e.key === "ArrowRight")) answer(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const counts = loaded ? boxCounts(deck) : Array(BOXES).fill(0);
  const left = Math.max(0, queue.length - i);

  return (
    <div className={film.page}>
      <FilmHeader />
      <main className={styles.page}>
        <header className={styles.head}>
          <p className={styles.issue}>ЕСТЕ САҚТАУ КАРТОЧКАЛАРЫ · {CARDS.length} КАРТОЧКА · 10 ЗЕРТХАНА</p>
          <h1 className={styles.title}>Бүгін нені есіңе түсіресің?</h1>
          <OyuRule className={styles.rule} />
          <p className={styles.lede}>Карточканы аудар да, шынын айт: білдің бе? Білгенің сирек қайтады (1, 3, 7, 14 күннен кейін), білмегенің бүгін қайта шығады.</p>
        </header>

        <section className={styles.boxes} aria-label="Қораптар">
          {counts.map((n, b) => (
            <div key={b} className={styles.box} data-box={b + 1}>
              <span className={styles.boxStack} style={{ height: `${Math.min(100, n * 5)}%` }} aria-hidden />
              <b>{n}</b>
              <span>
                {b + 1}-қорап · {b === 0 ? "бүгін" : `${INTERVAL_DAYS[b + 1]} күн`}
              </span>
            </div>
          ))}
        </section>

        {!loaded ? null : card ? (
          <section className={styles.stage} aria-label="Карточка">
            <p className={styles.counter} role="status">
              Бүгін қалды: {left} · білдім: {stats.knew} · қайталаймын: {stats.again}
            </p>
            <button type="button" className={styles.card} data-flipped={flipped} onClick={() => setFlipped((f) => !f)} aria-label={flipped ? `Жауабы: ${card.back}` : `Сұрақ: ${card.front}. Аудару үшін бас`}>
              <span className={`${styles.face} ${styles.front}`} aria-hidden>
                <OyuCorner className={styles.corner} />
                <em>{findLab(card.lab)?.title}</em>
                <strong>{card.front}</strong>
                <small>Бас не Бос орын: аудару</small>
              </span>
              <span className={`${styles.face} ${styles.back}`} aria-hidden>
                <OyuCorner className={styles.corner} />
                <em>{card.front}</em>
                <p>{card.back}</p>
              </span>
            </button>
            <div className={styles.answers}>
              {flipped ? (
                <>
                  <button type="button" className={styles.again} onClick={() => answer(false)}>
                    Білмедім <kbd>1</kbd>
                  </button>
                  <button type="button" className={styles.knew} onClick={() => answer(true)}>
                    Білдім <kbd>2</kbd>
                  </button>
                </>
              ) : (
                <button type="button" className={styles.flip} onClick={() => setFlipped(true)}>
                  Жауабын көру
                </button>
              )}
            </div>
            <Link href={`/labs/${card.lab}`} className={styles.lab}>
              Бұл тақырып: {findLab(card.lab)?.title} зертханасы →
            </Link>
          </section>
        ) : (
          done && (
            <section className={styles.done} aria-label="Бүгінге бітті">
              <span className={styles.stamp}>БҮГІНГЕ БІТТІ</span>
              <p>
                {stats.knew + stats.again > 0 ? `Білдім: ${stats.knew}, қайталадым: ${stats.again}.` : "Бүгін қайталайтын карточка жоқ."} Келесі карточкалар {stampDate(nextDue(deck))} күні оралады.
              </p>
              <button
                type="button"
                className={styles.flip}
                onClick={() => {
                  setQueue([...CARDS]);
                  setI(0);
                  setFlipped(false);
                }}
              >
                Бәрін қазір қайталау
              </button>
            </section>
          )
        )}
      </main>
    </div>
  );
}
