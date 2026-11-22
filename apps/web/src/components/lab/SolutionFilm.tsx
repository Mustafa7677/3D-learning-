"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { FILM_STAGES, type SolutionFilm } from "@inside-tech/lesson-engine";
import styles from "./film.module.css";

const reduced = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const SPEEDS = [0.75, 1, 1.5];

/** Wrap every occurrence of `mark` in a highlight. */
function marked(line: string, mark?: string): ReactNode {
  if (!mark || !line.includes(mark)) return line;
  const parts = line.split(mark);
  return parts.map((p, i) => (
    <span key={i}>
      {p}
      {i < parts.length - 1 && <mark>{mark}</mark>}
    </span>
  ));
}

/**
 * Plays the solving of a problem like a film: the board is written line by
 * line, a subtitle narrates, the route (Pólya's four stages) shows where we
 * are, and the 3D scene follows through `onScene`.
 */
export function SolutionFilmPlayer({
  film,
  onScene,
  kicker = "ПРАКТИКАДАН КЕЙІН · ШЕШІМ ФИЛЬМІ",
  note = "Өзің шығарып болдың ба? Енді маманның шешімін фильм сияқты көр: қай жолмен, қандай қадаммен.",
  onEnd,
}: {
  film: SolutionFilm;
  onScene?(patch: Record<string, unknown> | null): void;
  kicker?: string;
  note?: string;
  /** Called once the last frame has been reached. */
  onEnd?(): void;
}) {
  const [started, setStarted] = useState(false);
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [typed, setTyped] = useState(0);
  // Cinema: the 3D scene fills the screen and the film plays over it.
  const [cinema, setCinema] = useState(false);
  const frame = film.frames[i]!;
  const prevLen = i > 0 ? film.frames[i - 1]!.board.length : 0;
  const newLines = frame.board.slice(prevLen).join("\n");
  const doneTyping = typed >= newLines.length;
  const sceneRef = useRef(onScene);
  sceneRef.current = onScene;

  // The scene follows the film: every frame's patch from the start, so jumping back works.
  useEffect(() => {
    if (!started) return;
    const patch: Record<string, unknown> = {};
    for (const f of film.frames.slice(0, i + 1)) Object.assign(patch, f.scene ?? {});
    sceneRef.current?.(patch);
  }, [i, started, film]);
  useEffect(() => () => sceneRef.current?.(null), []);

  // Write the new lines out.
  useEffect(() => {
    setTyped(reduced() || !started ? newLines.length : 0);
  }, [i, started, newLines.length]);
  useEffect(() => {
    if (doneTyping || !started) return;
    const t = setTimeout(() => setTyped((n) => n + 2), 26 / speed);
    return () => clearTimeout(t);
  }, [typed, doneTyping, started, speed]);

  // Advance while playing, once the line is written and the subtitle had time to be read.
  useEffect(() => {
    if (!playing || !doneTyping) return;
    if (i >= film.frames.length - 1) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setI((n) => n + 1), Math.max(2200, frame.say.length * 55) / speed);
    return () => clearTimeout(t);
  }, [playing, doneTyping, i, frame.say.length, speed, film.frames.length]);

  useEffect(() => {
    if (!cinema) return;
    const body = document.body;
    body.dataset.cinema = "on";
    let wentFull = false;
    let left = false;
    const root = document.documentElement;
    if (root.requestFullscreen && !document.fullscreenElement) {
      root
        .requestFullscreen()
        .then(() => {
          // Left the cinema before the browser said yes: do not stay in full screen.
          if (left) void document.exitFullscreen?.().catch(() => undefined);
        })
        .catch(() => undefined);
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCinema(false);
    };
    // In real full screen the browser takes Esc itself and the page gets no key: leaving full
    // screen is then the signal. Track it from the events, not from the promise's timing.
    const onFull = () => {
      if (document.fullscreenElement) wentFull = true;
      else if (wentFull) setCinema(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFull);
    // The canvas measures its box: tell it the box changed.
    window.dispatchEvent(new Event("resize"));
    return () => {
      left = true;
      delete body.dataset.cinema;
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFull);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined);
      window.dispatchEvent(new Event("resize"));
    };
  }, [cinema]);

  const endRef = useRef(onEnd);
  endRef.current = onEnd;
  useEffect(() => {
    if (started && i === film.frames.length - 1) endRef.current?.();
  }, [i, started, film.frames.length]);

  const go = (n: number) => {
    setI(Math.max(0, Math.min(film.frames.length - 1, n)));
  };
  const start = (big = false) => {
    setStarted(true);
    setI(0);
    setPlaying(true);
    setCinema(big);
  };
  const stop = () => {
    setCinema(false);
    setStarted(false);
    setPlaying(false);
    setI(0);
    onScene?.(null);
  };

  if (!started)
    return (
      <section className={styles.poster} aria-label={`Шешім фильмі: ${film.title}`}>
        <p className={styles.kicker}>{kicker}</p>
        <p className={styles.posterTitle}>{film.title}</p>
        <ol className={styles.route} aria-label="Шешу жолы">
          {FILM_STAGES.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <p className={styles.posterNote}>{note}</p>
        <div className={styles.posterButtons}>
          {onScene && (
            <button type="button" className={styles.play} onClick={() => start(true)}>
              <span aria-hidden>⛶</span> Кинотеатрда көру
            </button>
          )}
          <button type="button" className={onScene ? styles.playGhost : styles.play} onClick={() => start(false)}>
            <span aria-hidden>▶</span> Осы жерде көру
          </button>
        </div>
      </section>
    );

  // Show the board with the new lines cut to what has been written.
  const old = frame.board.slice(0, prevLen);
  let left = typed;
  const fresh = frame.board.slice(prevLen).map((l) => {
    const s = l.slice(0, Math.max(0, left));
    left -= l.length + 1;
    return s;
  });

  const player = (
    <section className={cinema ? `${styles.player} ${styles.cinema}` : styles.player} aria-label={`Шешім фильмі: ${film.title}`}>
      <div className={styles.strip} aria-hidden />
      <div className={cinema ? styles.cinemaTop : undefined}>
        {cinema && (
          <p className={styles.cinemaTitle}>
            <span>ШЕШІМ ФИЛЬМІ</span> {film.title}
          </p>
        )}
        <ol className={styles.route} aria-label="Шешу жолы">
          {FILM_STAGES.map((s, k) => (
            <li key={s} data-state={k < frame.stage ? "done" : k === frame.stage ? "now" : undefined} aria-current={k === frame.stage ? "step" : undefined}>
              {s}
            </li>
          ))}
        </ol>
      </div>
      <div className={styles.board}>
        {old.map((l, k) => (
          <p key={k} className={styles.line}>
            {marked(l, frame.mark)}
          </p>
        ))}
        {fresh.map((l, k) =>
          l ? (
            <p key={`n${k}`} className={styles.line} data-new>
              {doneTyping ? marked(l, frame.mark) : l}
              {!doneTyping && k === fresh.filter(Boolean).length - 1 && <span className={styles.caret} aria-hidden />}
            </p>
          ) : null,
        )}
      </div>
      <p className={styles.subtitle} aria-live="polite">
        {frame.say}
      </p>
      <div className={styles.controls}>
        <button type="button" aria-label="Алдыңғы кадр" disabled={i === 0} onClick={() => go(i - 1)}>
          ⏮
        </button>
        <button type="button" aria-label={playing ? "Тоқтату" : "Ойнату"} onClick={() => (i >= film.frames.length - 1 && !playing ? (go(0), setPlaying(true)) : setPlaying((p) => !p))}>
          {playing ? "⏸" : "▶"}
        </button>
        <button type="button" aria-label="Келесі кадр" disabled={i >= film.frames.length - 1} onClick={() => go(i + 1)}>
          ⏭
        </button>
        <input type="range" min={0} max={film.frames.length - 1} value={i} aria-label="Фильм уақыты" onChange={(e) => go(Number(e.target.value))} />
        <span className={styles.count}>
          {i + 1}/{film.frames.length}
        </span>
        <button type="button" aria-label="Жылдамдық" onClick={() => setSpeed((v) => SPEEDS[(SPEEDS.indexOf(v) + 1) % SPEEDS.length]!)}>
          {speed}×
        </button>
        {onScene && (
          <button type="button" aria-label={cinema ? "Кинотеатрдан шығу" : "Кинотеатр"} aria-pressed={cinema} onClick={() => setCinema((c) => !c)}>
            ⛶
          </button>
        )}
        <button type="button" aria-label="Фильмді жабу" onClick={stop}>
          ✕
        </button>
      </div>
      <div className={styles.strip} aria-hidden />
    </section>
  );
  if (!cinema) return player;
  return (
    <>
      <p className={styles.inCinema}>Фильм кинотеатрда жүріп жатыр. Шығу үшін Esc.</p>
      {createPortal(player, document.body)}
    </>
  );
}
