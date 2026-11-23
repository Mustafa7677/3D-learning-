"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { go as goHash } from "@/lib/nav";
import { KIND_LABEL, search, type SearchItem } from "@/lib/search";
import styles from "./nav.module.css";

export const SEARCH_EVENT = "inside-tech:search";
export const openSearch = () => window.dispatchEvent(new Event(SEARCH_EVENT));

const SUGGEST = ["векторлар", "эллипс", "кэш", "нейрон", "SQL индекс", "фокус", "туған күн"];

/**
 * The search window: Ctrl+K, Cmd+K or "/" anywhere, or the search buttons. Arrow keys move,
 * Enter opens, Esc closes. Results are grouped by what they are.
 */
export function SearchPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const back = useRef<HTMLElement | null>(null);
  const hits = useMemo(() => search(q), [q]);

  useEffect(() => {
    const show = () => {
      back.current = document.activeElement as HTMLElement | null;
      setOpen(true);
    };
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName));
      if ((e.key === "k" || e.key === "K" || e.key === "қ") && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        show();
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        show();
      }
    };
    window.addEventListener(SEARCH_EVENT, show);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(SEARCH_EVENT, show);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => input.current?.focus(), 0);
    else back.current?.focus?.();
  }, [open]);
  // Esc closes from anywhere, even before the input has taken focus.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      setQ("");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  useEffect(() => setI(0), [q]);

  if (!open) return null;
  const close = () => {
    setOpen(false);
    setQ("");
  };
  const go = (h: SearchItem) => {
    close();
    if (process.env.NEXT_PUBLIC_STANDALONE === "1") goHash(h.href);
    else router.push(h.href);
  };

  return (
    <div className={styles.scrim} onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className={styles.palette} role="dialog" aria-modal="true" aria-label="Іздеу">
        <div className={styles.searchRow}>
          <span className={styles.lens} aria-hidden />
          <input
            ref={input}
            className={styles.searchInput}
            role="combobox"
            aria-expanded={hits.length > 0}
            aria-controls="search-results"
            aria-activedescendant={hits[i] ? `hit-${i}` : undefined}
            aria-label="Сабақ, құрал не есеп іздеу"
            placeholder="Сабақ, термин, құрал не есеп…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") (e.preventDefault(), setI((x) => Math.min(hits.length - 1, x + 1)));
              else if (e.key === "ArrowUp") (e.preventDefault(), setI((x) => Math.max(0, x - 1)));
              else if (e.key === "Enter" && hits[i]) go(hits[i]!);
            }}
          />
          <kbd className={styles.kbd}>Esc</kbd>
        </div>
        {q.trim().length < 2 ? (
          <div className={styles.empty}>
            <p>Мысалы:</p>
            <div className={styles.chips}>
              {SUGGEST.map((s) => (
                <button key={s} type="button" onClick={() => setQ(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : hits.length === 0 ? (
          <p className={styles.none} role="status">
            «{q}» бойынша ештеңе табылмады. Басқа сөзбен көр не түбірін жаз.
          </p>
        ) : (
          <ul id="search-results" role="listbox" className={styles.results} aria-label="Іздеу нәтижелері">
            {hits.map((h, k) => (
              <li key={h.href} id={`hit-${k}`} role="option" aria-selected={k === i} data-kind={h.kind} onMouseEnter={() => setI(k)} onClick={() => go(h)}>
                <span className={styles.kind}>{KIND_LABEL[h.kind]}</span>
                <span className={styles.hitText}>
                  <strong>{h.title}</strong>
                  <small>{h.sub}</small>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className={styles.foot} aria-hidden>
          <kbd>↑</kbd> <kbd>↓</kbd> таңдау · <kbd>Enter</kbd> ашу · <kbd>Ctrl</kbd>+<kbd>K</kbd> кез келген беттен
        </p>
      </div>
    </div>
  );
}
