"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { COMIC, COMIC_START, type Panel, type Scene, type Speaker } from "@/lib/comic";
import { solveChallenge } from "@/lib/challenges";
import { prefersReducedMotion } from "@/lib/nav";
import { OyuRule } from "../lab/Oyu";
import { FilmHeader } from "../film/FilmHeader";
import film from "../film/film.module.css";
import styles from "./comic.module.css";

const SAVE = "inside-tech:comic:tcp";
const AGAIN = "#again";
const NAME: Record<Speaker, string> = { browser: "Браузер", server: "Сервер", spy: "Тыңшы", narrator: "" };

/** The cast, drawn as poster figures. */
function Figure({ who }: { who: Speaker }) {
  if (who === "narrator") return null;
  return (
    <svg className={styles.figure} viewBox="0 0 120 120" aria-hidden focusable="false">
      {who === "browser" && (
        <g>
          <rect x="18" y="22" width="84" height="56" rx="6" className={styles.ink} />
          <rect x="24" y="28" width="72" height="44" rx="3" className={styles.screen} />
          <circle cx="47" cy="48" r="6" className={styles.eye} />
          <circle cx="73" cy="48" r="6" className={styles.eye} />
          <path d="M48 62 Q60 70 72 62" className={styles.mouth} />
          <path d="M8 86 H112 L102 96 H18 Z" className={styles.ink} />
        </g>
      )}
      {who === "server" && (
        <g>
          <rect x="30" y="10" width="60" height="100" rx="6" className={styles.ink} />
          {[0, 1, 2].map((i) => (
            <rect key={i} x="38" y={62 + i * 14} width="44" height="9" className={styles.slot} />
          ))}
          <circle cx="50" cy="34" r="6" className={styles.eye} />
          <circle cx="70" cy="34" r="6" className={styles.eye} />
          <path d="M50 47 H70" className={styles.mouth} />
        </g>
      )}
      {who === "spy" && (
        <g>
          <path d="M22 44 Q60 4 98 44 Z" className={styles.red} />
          <rect x="14" y="42" width="92" height="8" rx="3" className={styles.red} />
          <path d="M30 50 Q60 64 90 50 L84 108 H36 Z" className={styles.ink} />
          <rect x="36" y="56" width="48" height="12" rx="6" className={styles.glasses} />
        </g>
      )}
    </svg>
  );
}

function PanelView({ p, n }: { p: Panel; n: number }) {
  return (
    <figure className={styles.panel} data-who={p.who} data-bad={!!p.bad}>
      <span className={styles.panelNo} aria-hidden>
        {n}
      </span>
      {p.who === "narrator" ? (
        <figcaption className={styles.caption}>{p.text}</figcaption>
      ) : (
        <>
          <Figure who={p.who} />
          <blockquote className={styles.bubble}>
            <cite>{NAME[p.who]}</cite>
            <p>{p.text}</p>
          </blockquote>
        </>
      )}
      {p.wire && <span className={styles.wire}>{p.wire}</span>}
    </figure>
  );
}

/** «Үш қол алысу»: TCP, TLS and HTTP as a comic where the reader speaks for the browser. */
export function Comic() {
  const [path, setPath] = useState<string[]>([COMIC_START]);
  const [mistakes, setMistakes] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(SAVE) ?? "null") as { path?: unknown; mistakes?: unknown } | null;
      const ok = Array.isArray(raw?.path) && raw.path.length > 0 && raw.path.every((x) => typeof x === "string" && !!COMIC[x.replace(AGAIN, "")]);
      if (ok) setPath(raw!.path as string[]);
      if (typeof raw?.mistakes === "number" && raw.mistakes >= 0) setMistakes(Math.floor(raw.mistakes));
    } catch {
      /* start from the first page */
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(SAVE, JSON.stringify({ path, mistakes }));
    } catch {
      /* storage unavailable */
    }
  }, [path, mistakes, loaded]);

  const lastId = path.at(-1)!;
  const last: Scene = COMIC[lastId.replace(AGAIN, "")]!;
  const again = lastId.endsWith(AGAIN);
  const finished = !!last.end && !again;
  useEffect(() => {
    if (finished) solveChallenge("comic-tcp");
  }, [finished]);
  useEffect(() => {
    if (path.length > 1) endRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "end" });
  }, [path.length]);

  // What to choose now: the last scene's choices, or, after a wrong turn, the scene it returns to.
  const deciding = again ? last : last.back ? undefined : last;
  let n = 0;
  let chapter = "";

  return (
    <div className={film.page}>
      <FilmHeader />
      <main className={styles.page}>
        <header className={styles.cover}>
          <p className={styles.issue}>КОМИКС · № 1 · WEB DEVELOPMENT</p>
          <h1 className={styles.title}>Үш қол алысу</h1>
          <OyuRule className={styles.rule} />
          <p className={styles.lede}>Браузер сайтқа қалай кіреді? Сен оның орнына сөйлейсің. Қате таңдасаң, не болатынын көресің, сосын қайта таңдайсың.</p>
        </header>

        <div className={styles.strip}>
          {path.map((id, k) => {
            const isAgain = id.endsWith(AGAIN);
            const s = COMIC[id.replace(AGAIN, "")]!;
            const title = s.chapter !== chapter ? (chapter = s.chapter) : null;
            if (isAgain)
              return (
                <p key={k} className={styles.again}>
                  Қайта таңдаймыз.
                </p>
              );
            return (
              <section key={k} className={styles.scene} aria-label={s.chapter}>
                {title && <h2 className={styles.chapter}>{title}</h2>}
                <div className={styles.panels}>
                  {s.panels.map((p, i) => (
                    <PanelView key={i} p={p} n={++n} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <div ref={endRef} className={styles.turn}>
          {deciding?.choices && (
            <fieldset className={styles.choices}>
              <legend>Браузер не дейді?</legend>
              {deciding.choices.map((c) => (
                <button
                  key={c.to}
                  type="button"
                  onClick={() => {
                    if (!c.correct) setMistakes((m) => m + 1);
                    setPath((p) => [...p, c.to]);
                  }}
                >
                  {c.text}
                </button>
              ))}
            </fieldset>
          )}
          {last.back && !again && (
            <button type="button" className={styles.retry} onClick={() => setPath((p) => [...p, `${last.back}${AGAIN}`])}>
              Қайта таңдау
            </button>
          )}
          {finished && (
            <div className={styles.end}>
              <span className={styles.stamp}>АЯҚТАЛДЫ</span>
              <p>
                {mistakes === 0 ? "Бірде-бір қатесіз. Браузер сенсіз де дәл осылай істейді." : `Жолда ${mistakes} рет бұрылдың: әрқайсысы бір нақты сабақ.`}
              </p>
              <div className={styles.endLinks}>
                <Link href="/labs/web/web-1-internet">Сұраудың саяхатын 3D-де көру</Link>
                <Link href="/labs/sec">Шифрлауды өзің жаса</Link>
                <button
                  type="button"
                  onClick={() => {
                    setPath([COMIC_START]);
                    setMistakes(0);
                    window.scrollTo({ top: 0 });
                  }}
                >
                  Басынан оқу
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
