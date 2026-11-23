"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CHARACTER_NAME, GADGETS } from "@inside-tech/lesson-engine";
import { openLabs } from "@/lib/catalog";
import { comicShelf, loadRead, markRead, type ShelfComic } from "@/lib/comicLibrary";
import { queryParam } from "@/lib/nav";
import { Face } from "../lab/StepMedia";
import { BackdropArt } from "../lab/Cast";
import { FilmHeader } from "../film/FilmHeader";
import film from "../film/film.module.css";
import styles from "./comics.module.css";

const SHELF_NAME = (id: string) => (id === "learn" ? "Қалай оқу керек?" : id === "stories" ? "Тірі заттар" : openLabs.find((l) => l.id === id)?.title ?? id);

/** Read one comic a frame at a time, like turning the pages of a comic book. */
function Reader({ c, onClose, onDone }: { c: ShelfComic; onClose(): void; onDone(): void }) {
  const [i, setI] = useState(0);
  const panels = c.comic.panels;
  const p = panels[i]!;
  const last = i === panels.length - 1;
  // Marked read once the last frame is reached. A ref, so a new callback each render does not loop.
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (last) done.current();
  }, [last]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setI((x) => Math.min(panels.length - 1, x + 1));
      else if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panels.length, onClose]);

  return (
    <div className={styles.scrim} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className={styles.reader} role="dialog" aria-modal="true" aria-label={`Комикс: ${c.comic.title}`}>
        <header className={styles.readerHead}>
          <p>
            <span className={styles.badge}>{c.comic.genre ?? SHELF_NAME(c.shelf)}</span> {c.comic.title}
          </p>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Жабу">
            ×
          </button>
        </header>
        <div className={styles.stage}>
          <article key={i} className={styles.frame} data-who={p.who} data-bg={p.bg} aria-live="polite" aria-label={`${i + 1}-кадр`}>
            {p.bg && <BackdropArt kind={p.bg} className={styles.backdrop} />}
            <span className={styles.frameNo}>{i + 1}</span>
            {p.scene && <p className={styles.slate}>{p.scene}</p>}
            {p.sfx && (
              <span className={styles.sfx} aria-hidden>
                {p.sfx}
              </span>
            )}
            {p.who === "narrator" ? (
              <p className={styles.caption}>{p.say}</p>
            ) : (
              <div className={styles.scene}>
                <div className={styles.actor}>
                  <Face who={p.who} mood={p.mood} />
                  <b>{CHARACTER_NAME[p.who]}</b>
                </div>
                <p className={styles.bubble}>{p.say}</p>
              </div>
            )}
            {p.board && <pre className={styles.board}>{p.board}</pre>}
            {p.with && p.with.length > 0 && (
              <div className={styles.extras} aria-label={`Сахнада: ${p.with.map((w) => CHARACTER_NAME[w]).join(", ")}`}>
                {p.with.map((w, k) => (
                  <span key={k} className={styles.extra}>
                    <Face who={w} mood="smile" />
                  </span>
                ))}
              </div>
            )}
          </article>
        </div>
        <footer className={styles.readerFoot}>
          <button type="button" className={styles.ghost} disabled={i === 0} onClick={() => setI(i - 1)}>
            ← Алдыңғы
          </button>
          <ol className={styles.dots} aria-label="Кадрлар">
            {panels.map((_, k) => (
              <li key={k}>
                <button type="button" aria-label={`${k + 1}-кадр`} aria-current={k === i ? "step" : undefined} onClick={() => setI(k)} />
              </li>
            ))}
          </ol>
          {last ? (
            <Link href={c.href} className={styles.primary}>
              Сабаққа өту →
            </Link>
          ) : (
            <button type="button" className={styles.primary} onClick={() => setI(i + 1)}>
              Келесі кадр →
            </button>
          )}
        </footer>
        <p className={styles.where}>{c.where}</p>
      </section>
    </div>
  );
}

/** Комикс кітапханасы: every comic on the site on one shelf, read frame by frame. */
export function ComicLibrary() {
  const all = useMemo(() => comicShelf(), []);
  const [shelf, setShelf] = useState<string>("all");
  const [open, setOpen] = useState<ShelfComic | null>(null);
  const [read, setRead] = useState<string[]>([]);
  useEffect(() => {
    setRead(loadRead());
    const s = queryParam("s");
    if (s) setShelf(s);
    const asked = queryParam("c");
    const c = all.find((x) => x.id === asked);
    if (c) setOpen(c);
  }, [all]);
  const shelves = useMemo(() => [...new Set(all.map((c) => c.shelf))].filter((s) => s !== "stories"), [all]);
  const shown = shelf === "all" ? all : shelf === "films" ? all.filter((c) => c.comic.genre && c.shelf !== "stories") : all.filter((c) => c.shelf === shelf);

  return (
    <div className={film.page}>
      <FilmHeader />
      <main className={styles.page}>
        <header className={styles.head}>
          <p className={styles.kicker}>НҰРАЙ · МУСТАФА · ҰСТАЗ</p>
          <h1 className={styles.title}>
            Комикс <span>кітапханасы</span>
          </h1>
          <p className={styles.lede}>Әр тақырыптың артында бір өмірлік жағдай бар. Мұнда сайттағы барлық комикс: зертханалардың алғашқы сабақтары, математика курсы және «Қалай оқу керек?». Кадрма-кадр оқы, сосын сабаққа өт.</p>
          <p className={styles.progress} aria-label="Оқылған комикстер">
            {read.filter((id) => all.some((c) => c.id === id)).length}/{all.length} оқылды
          </p>
        </header>

        <nav className={styles.shelves} aria-label="Сөрелер">
          <button type="button" aria-pressed={shelf === "all"} onClick={() => setShelf("all")}>
            Барлығы <small>{all.length}</small>
          </button>
          <button type="button" aria-pressed={shelf === "stories"} onClick={() => setShelf("stories")}>
            Тірі заттар <small>{all.filter((c) => c.shelf === "stories").length}</small>
          </button>
          <button type="button" aria-pressed={shelf === "films"} onClick={() => setShelf("films")}>
            Кино-комикстер <small>{all.filter((c) => c.comic.genre && c.shelf !== "stories").length}</small>
          </button>
          {shelves.map((s) => (
            <button key={s} type="button" aria-pressed={shelf === s} onClick={() => setShelf(s)}>
              {SHELF_NAME(s)} <small>{all.filter((c) => c.shelf === s).length}</small>
            </button>
          ))}
        </nav>

        <ul className={styles.covers}>
          {shown.map((c, k) => {
            const first = c.comic.panels.find((p) => p.who !== "narrator") ?? c.comic.panels[0]!;
            // An illustrated story gets a drawn cover: its first place and its star, big.
            const art = c.comic.panels.find((p) => p.bg);
            const star = c.comic.panels.find((p) => (GADGETS as string[]).includes(p.who))?.who;
            return (
              <li key={c.id} style={{ ["--tilt" as string]: `${((k % 5) - 2) * 0.7}deg` }}>
                <button type="button" className={styles.cover} data-read={read.includes(c.id) || undefined} data-film={c.comic.genre ? "" : undefined} onClick={() => setOpen(c)} aria-label={`Оқу: ${c.comic.title}`}>
                  <span className={styles.coverShelf}>{SHELF_NAME(c.shelf)}</span>
                  {c.comic.genre && c.comic.genre !== SHELF_NAME(c.shelf) && <span className={styles.genre}>{c.comic.genre}</span>}
                  {art?.bg && (
                    <span className={styles.coverArt} aria-hidden>
                      <BackdropArt kind={art.bg} className={styles.coverBg} />
                      {star && <Face who={star} mood="wow" />}
                    </span>
                  )}
                  <strong>{c.comic.title}</strong>
                  {c.comic.tagline && <em className={styles.coverTagline}>{c.comic.tagline}</em>}
                  <span className={styles.coverQuote}>
                    <Face who={first.who === "narrator" ? "ustaz" : first.who} mood={first.mood} />
                    <q>{first.say}</q>
                  </span>
                  <span className={styles.coverFoot}>
                    {c.comic.panels.length} кадр {read.includes(c.id) && <b>✓ оқылды</b>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </main>
      {open && (
        <Reader
          key={open.id}
          c={open}
          onClose={() => setOpen(null)}
          onDone={() => setRead(markRead(open.id))}
        />
      )}
    </div>
  );
}
