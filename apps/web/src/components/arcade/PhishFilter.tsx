"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { COMBO_MAX, LETTERS, letterTime, rng, type Letter } from "@/lib/arcade";
import styles from "./arcade.module.css";

const LIVES = 3;

function shuffled<T>(xs: T[], r: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Фишинг сүзгісі: a stream of letters, a few seconds each: safe or a trap? */
export function PhishFilter({ onEnd, seed }: { onEnd: (score: number) => void; seed?: number }) {
  const deck = useMemo(() => shuffled(LETTERS, rng(seed ?? Date.now())), [seed]);
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(1);
  const [lives, setLives] = useState(LIVES);
  const [left, setLeft] = useState(() => letterTime(0));
  const [missed, setMissed] = useState<{ letter: Letter; timeout: boolean }>();
  const [flash, setFlash] = useState<"right">();
  const end = useRef(onEnd);
  useEffect(() => {
    end.current = onEnd;
  });
  const letter = deck[i];

  const advance = useCallback(
    (s: number) => {
      if (i + 1 >= deck.length) {
        end.current(s + lives * 20);
        return;
      }
      setI(i + 1);
      setLeft(letterTime(s));
    },
    [i, deck.length, lives],
  );

  const judge = useCallback(
    (phish: boolean | undefined) => {
      if (!letter || missed) return;
      if (phish === letter.phish) {
        const s = score + 10 * combo;
        setScore(s);
        setCombo((c) => Math.min(COMBO_MAX, c + 1));
        setFlash("right");
        advance(s);
      } else {
        setCombo(1);
        setLives((l) => l - 1);
        setMissed({ letter, timeout: phish === undefined });
      }
    },
    [letter, missed, score, combo, advance],
  );

  // The fuse on each letter; paused while an explanation is on screen.
  useEffect(() => {
    if (missed) return;
    const id = window.setInterval(() => setLeft((t) => +(t - 0.1).toFixed(1)), 100);
    return () => window.clearInterval(id);
  }, [missed, i]);
  useEffect(() => {
    if (left <= 0 && !missed) judge(undefined);
  }, [left, missed, judge]);

  useEffect(() => {
    if (!flash) return;
    const id = window.setTimeout(() => setFlash(undefined), 250);
    return () => window.clearTimeout(id);
  }, [flash, i]);

  const understood = () => {
    setMissed(undefined);
    if (lives <= 0) end.current(score);
    else advance(score);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (missed) return;
      if (e.key === "ArrowLeft") judge(false);
      if (e.key === "ArrowRight") judge(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [judge, missed]);

  if (!letter) return null;
  const full = letterTime(score);
  return (
    <div className={styles.phishGame} data-flash={flash}>
      <div className={styles.hud}>
        <span>
          Ұпай <b data-testid="score">{score}</b>
        </span>
        <span>Комбо ×{combo}</span>
        <span>
          Хат {i + 1}/{deck.length}
        </span>
        <span aria-label={`Өмір: ${Math.max(lives, 0)}`}>
          {Array.from({ length: LIVES }, (_, k) => (
            <i key={k} data-on={k < lives || undefined}>
              ♥
            </i>
          ))}
        </span>
      </div>
      <div className={styles.timer} aria-hidden>
        <i style={{ width: `${Math.max(0, left / full) * 100}%` }} />
      </div>

      <article className={styles.letter} aria-label="Хат" key={i}>
        <p className={styles.from}>
          <span>Кімнен:</span> {letter.from}
        </p>
        <h3>{letter.subject}</h3>
        <p>{letter.body}</p>
        {letter.link && (
          <p className={styles.link}>
            🔗 <u>{letter.link}</u>
          </p>
        )}
      </article>

      {missed ? (
        <div className={styles.why} role="alert">
          <b>{missed.timeout ? "Уақыт бітті!" : missed.letter.phish ? "Бұл фишинг еді!" : "Бұл қауіпсіз хат еді."}</b> {missed.letter.why}
          <button type="button" className={styles.play} onClick={understood}>
            Түсіндім →
          </button>
        </div>
      ) : (
        <div className={styles.answers}>
          <button type="button" data-kind="safe" onClick={() => judge(false)}>
            ← Қауіпсіз
          </button>
          <button type="button" data-kind="phish" onClick={() => judge(true)}>
            Фишинг →
          </button>
        </div>
      )}
    </div>
  );
}
