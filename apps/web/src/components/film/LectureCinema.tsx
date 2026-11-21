"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Prose } from "../lab/Prose";
import { OyuCorner, OyuRule } from "../lab/Oyu";
import { findLab } from "@/lib/catalog";
import { useWebGL } from "@/lib/useWebGL";
import styles from "./lecture.module.css";

const LectureBackdrop = dynamic(() => import("./LectureBackdrop"), { ssr: false });

export interface LectureSection {
  title: string;
  text: string;
}

/** Split a lecture into its "## " sections; text before the first heading becomes "Кіріспе". */
export function splitSections(body: string): LectureSection[] {
  const out: LectureSection[] = [];
  let cur: LectureSection = { title: "Кіріспе", text: "" };
  let inCode = false;
  for (const line of body.replace(/\r/g, "").split("\n")) {
    if (line.startsWith("```")) inCode = !inCode;
    const m = !inCode && /^##\s+(.*)$/.exec(line);
    if (m) {
      if (cur.text.trim()) out.push(cur);
      cur = { title: m[1]!.trim(), text: "" };
    } else cur.text += line + "\n";
  }
  if (cur.text.trim()) out.push(cur);
  return out;
}

/**
 * The lecture as a 3D reel: each section is a page standing in space; the
 * current one faces you, the rest recede to either side. CSS 3D only, so it
 * works without WebGL; with WebGL the lab's emblem turns behind the pages.
 */
export function LectureCinema({ labId, stepTitle, body, onClose }: { labId: string; stepTitle: string; body: string; onClose(): void }) {
  const sections = useMemo(() => splitSections(body), [body]);
  const [i, setI] = useState(0);
  const webgl = useWebGL();
  const closeRef = useRef<HTMLButtonElement>(null);
  const wheelAt = useRef(0);
  const touchX = useRef<number | null>(null);
  const n = sections.length;
  const go = useCallback((d: number) => setI((v) => Math.min(n - 1, Math.max(0, v + d))), [n]);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" || e.key === "PageDown") go(1);
      else if (e.key === "ArrowLeft" || e.key === "PageUp") go(-1);
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [go, onClose]);

  // Rendered on <body>: a panel with backdrop-filter would otherwise trap this
  // fixed overlay inside its own box (that is what clipped it to the sidebar).
  return createPortal(
    <div
      className={styles.cinema}
      role="dialog"
      aria-modal="true"
      aria-label={`${stepTitle}: түсіндірме`}
      onWheel={(e) => {
        // One page per wheel gesture, unless the page itself still scrolls.
        const page = (e.target as HTMLElement).closest(`.${styles.page}`) as HTMLElement | null;
        if (page && page.scrollHeight > page.clientHeight + 4) {
          const atEnd = page.scrollTop + page.clientHeight >= page.scrollHeight - 4;
          const atStart = page.scrollTop <= 0;
          if ((e.deltaY > 0 && !atEnd) || (e.deltaY < 0 && !atStart)) return;
        }
        const now = performance.now();
        if (Math.abs(e.deltaY) < 12 || now - wheelAt.current < 650) return;
        wheelAt.current = now;
        go(e.deltaY > 0 ? 1 : -1);
      }}
      onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)}
      onTouchEnd={(e) => {
        const x0 = touchX.current;
        const x1 = e.changedTouches[0]?.clientX;
        if (x0 != null && x1 != null && Math.abs(x1 - x0) > 50) go(x1 < x0 ? 1 : -1);
        touchX.current = null;
      }}
    >
      {webgl && <LectureBackdrop labId={labId} index={i} count={n} />}
      <span className={styles.spot} aria-hidden />
      <span className={styles.grain} aria-hidden />
      <div className={styles.top}>
        <p className={styles.where}>
          <b>ДӘРІС</b>
          <span>{stepTitle}</span>
        </p>
        <button ref={closeRef} type="button" className={styles.close} onClick={onClose}>
          Жабу
        </button>
      </div>

      <div className={styles.space}>
        <div className={styles.track}>
          {sections.map((s, k) => {
            const d = k - i;
            const ad = Math.abs(d);
            return (
              <article
                key={k}
                className={styles.page}
                data-offset={Math.max(-3, Math.min(3, d))}
                aria-hidden={d !== 0}
                inert={d !== 0}
                style={{
                  transform: `translateX(${d * 62}%) translateZ(${-ad * 260}px) rotateY(${-Math.sign(d) * Math.min(ad, 2) * 28}deg)`,
                  opacity: ad === 0 ? 1 : ad === 1 ? 0.7 : ad === 2 ? 0.2 : 0,
                  zIndex: 10 - ad,
                }}
                onClick={() => d !== 0 && setI(k)}
              >
                <OyuCorner className={`${styles.pc} ${styles.pcTL}`} />
                <OyuCorner className={`${styles.pc} ${styles.pcTR}`} />
                <header className={styles.mast}>
                  <span>INSIDE TECH</span>
                  <span>{findLab(labId)?.title ?? labId}</span>
                </header>
                <p className={styles.count}>
                  § {k + 1} <span>/ {n}</span>
                </p>
                <h2>{s.title}</h2>
                <OyuRule className={styles.rule} />
                <div className={styles.text}>
                  <Prose text={s.text} />
                </div>
                <footer className={styles.folio}>· {k + 1} ·</footer>
                {k === n - 1 && (
                  <button type="button" className={styles.done} onClick={onClose}>
                    Тапсырмаға өту
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </div>

      <nav className={styles.controls} aria-label="Түсіндірме беттері">
        <button type="button" onClick={() => go(-1)} disabled={i === 0}>
          Алдыңғы
        </button>
        <p className={styles.now} aria-live="polite">
          <b>§ {i + 1}</b> {sections[i]?.title}
        </p>
        <ol className={styles.dots}>
          {sections.map((s, k) => (
            <li key={k}>
              <button type="button" aria-current={k === i ? "step" : undefined} onClick={() => setI(k)} title={s.title}>
                <span className="visually-hidden">{s.title}</span>
              </button>
            </li>
          ))}
        </ol>
        <button type="button" onClick={() => go(1)} disabled={i === n - 1}>
          Келесі
        </button>
      </nav>
    </div>,
    document.body,
  );
}
