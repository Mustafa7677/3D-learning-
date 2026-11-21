"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { openLabs } from "@/lib/catalog";
import { go, prefersReducedMotion } from "@/lib/nav";
import { useQuality } from "@/lib/quality";
import { useScrollProgress } from "@/lib/useScrollProgress";
import { useWebGL } from "@/lib/useWebGL";
import { AiDemo } from "./AiDemo";
import { Atlas } from "./Atlas";
import { FilmHeader } from "./FilmHeader";
import { FormatShelf } from "./FormatShelf";
import type { ChipBlock, HeroMode } from "./HeroChip";
import film from "./film.module.css";
import styles from "./landing.module.css";
import { WorldFinale } from "./WorldFinale";

const HeroChip = dynamic(() => import("./HeroChip"), { ssr: false });

const scrollToEl = (el: Element | null | undefined) => el?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });

/** Without WebGL: the same die, drawn with CSS perspective. */
function CssDie({ blocks }: { blocks: ChipBlock[] }) {
  return (
    <div className={styles.cssStage} aria-hidden>
      <div className={styles.cssDie}>
        {blocks.map((b) => (
          <span key={b.id}>{b.title}</span>
        ))}
      </div>
    </div>
  );
}

export function HomeFilm() {
  const filmEl = useRef<HTMLDivElement>(null);
  const chapter2 = useRef<HTMLElement>(null);
  const { progress } = useScrollProgress(filmEl, 3);
  const [onStage, setOnStage] = useState(true);
  const webgl = useWebGL();
  const quality = useQuality();
  const [still, setStill] = useState(false);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<HeroMode>("cinematic");
  const [selected, setSelected] = useState<number | null>(null);
  useEffect(() => setStill(prefersReducedMotion()), []);
  // The chip stops rendering once the film has scrolled away.
  useEffect(() => {
    const node = filmEl.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setOnStage(e!.isIntersecting));
    io.observe(node);
    return () => io.disconnect();
  }, []);

  const blocks: ChipBlock[] = useMemo(() => openLabs.map((l) => ({ id: l.id, title: l.title, inside: l.inside, href: l.href! })), []);

  const explore = useCallback((i: number | null = null) => {
    window.scrollTo({ top: filmEl.current?.offsetTop ?? 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    setMode("explore");
    setSelected(i);
  }, []);
  const leave = useCallback(() => {
    setMode("cinematic");
    setSelected(null);
  }, []);

  useEffect(() => {
    if (mode !== "explore") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") leave();
      if (e.key === "ArrowRight") setSelected((s) => ((s ?? -1) + 1) % blocks.length);
      if (e.key === "ArrowLeft") setSelected((s) => ((s ?? 0) - 1 + blocks.length) % blocks.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, leave, blocks.length]);

  return (
    <div className={`${film.page} ${styles.landing}`}>
      <FilmHeader
        badge={false}
        lead={
          <button type="button" className={film.menuLink} onClick={() => scrollToEl(document.getElementById("labs"))}>
            Зертханалар
          </button>
        }
      />

      <div ref={filmEl} className={styles.film} data-mode={mode}>
        <div className={styles.stage}>
          <div className={styles.poster} aria-hidden />
          {webgl === false ? (
            <CssDie blocks={blocks} />
          ) : (
            webgl && (
              <div className={styles.canvas} data-ready={ready}>
                <HeroChip
                  progress={progress}
                  blocks={blocks}
                  mode={mode}
                  selected={selected}
                  onSelect={(i) => (mode === "explore" ? setSelected(i) : i !== null && explore(i))}
                  onOpen={go}
                  onReady={() => setReady(true)}
                  still={still}
                  quality={quality}
                  active={onStage || mode === "explore"}
                />
              </div>
            )
          )}
          <div className={styles.shade} aria-hidden />

          {mode === "explore" && (
            <div className={styles.explorePanel} role="region" aria-label="Чипті зерттеу">
              <p className={styles.micro}>EXPLORE / 10 БЛОК</p>
              <p className={styles.exploreTitle}>Блокты таңда</p>
              <ol className={styles.rail}>
                {blocks.map((b, i) => (
                  <li key={b.id}>
                    <button type="button" aria-pressed={selected === i} onClick={() => setSelected(i)}>
                      <span>{String(i + 1).padStart(2, "0")}</span>
                      {b.title}
                    </button>
                  </li>
                ))}
              </ol>
              {selected !== null && <p className={styles.exploreInfo}>{blocks[selected]!.inside}</p>}
              {selected !== null && (
                <Link href={blocks[selected]!.href} className={styles.exploreOpen}>
                  {blocks[selected]!.title} зертханасын ашу
                </Link>
              )}
              <button type="button" className={styles.exploreClose} onClick={leave}>
                Жабу <kbd>Esc</kbd>
              </button>
            </div>
          )}
        </div>

        <div className={styles.chapters}>
          <section className={styles.hero} aria-labelledby="hero-title">
            <p className={styles.micro}>АКТ I / ОБЪЕКТ</p>
            <h1 id="hero-title" className={styles.h1}>
              <span>Технологияның</span>
              <span>ішіне кір.</span>
            </h1>
            <p className={styles.lead}>Күрделі жүйелерді оқып қана қоймай, олардың қалай жұмыс істейтінін өз қолыңмен зертте.</p>
            <div className={styles.ctas}>
              <button type="button" className={styles.primary} onClick={() => scrollToEl(chapter2.current)}>
                Зерттеуді бастау
              </button>
              <button type="button" className={styles.secondary} onClick={() => (webgl === false ? scrollToEl(document.getElementById("labs")) : explore())}>
                Чипті зертте
              </button>
            </div>
            <p className={styles.scroll} aria-hidden>
              <span>SCROLL</span> ішіне қарай
            </p>
          </section>

          <section ref={chapter2} className={styles.exploded} aria-labelledby="layers-title">
            <p className={styles.micro}>АКТ II / ІШКІ ӘЛЕМ</p>
            <h2 id="layers-title" className={styles.h2}>
              Бәрі сен ойлағаннан терең.
            </h2>
            <p className={styles.line}>Қақпақ, мыс байланыс, кристалл, негіз. Кристалда он блок бар, әрқайсысы бір курс.</p>
          </section>

          <section className={styles.dive} aria-labelledby="dive-title">
            <p className={styles.micro}>АКТ II / СИГНАЛ</p>
            <h2 id="dive-title" className={styles.h2}>
              Сигнал AI блогына кірді.
            </h2>
            <p className={styles.line}>Енді оның ішінде не болып жатқанын көр: төменде нейрон желісі дәл қазір сенің браузеріңде үйреніп жатыр.</p>
          </section>
        </div>
      </div>

      <AiDemo />

      <WorldFinale onChoose={() => scrollToEl(document.getElementById("labs"))} />

      <Atlas />

      <FormatShelf />

      <footer className={styles.footer}>
        <span>INSIDE/TECH</span>
        <span>Басқалар технологияны түсіндіреді. Біз сені оның ішіне кіргіземіз.</span>
      </footer>
    </div>
  );
}
