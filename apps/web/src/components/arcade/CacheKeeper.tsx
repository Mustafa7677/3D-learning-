"use client";

import { useEffect, useMemo, useState } from "react";
import { CACHE_SLOTS, cacheSequence, simulate } from "@/lib/arcade";
import styles from "./arcade.module.css";

interface Slot {
  page: string;
  used: number;
}

/** Кэш сақшысы: three slots, a stream of requests, you choose what to evict. */
export function CacheKeeper({ onEnd, seed }: { onEnd: (score: number) => void; seed?: number }) {
  const seq = useMemo(() => cacheSequence(seed ?? Date.now() % 1_000_000), [seed]);
  const [i, setI] = useState(0);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [hits, setHits] = useState(0);
  const [last, setLast] = useState<"hit" | "load" | "evict">();
  const [finished, setFinished] = useState(false);
  const page = seq[i];
  const inCache = page !== undefined && slots.some((s) => s.page === page);
  const mustEvict = page !== undefined && !inCache && slots.length >= CACHE_SLOTS;

  // A hit or a free slot plays itself; only a full cache waits for the player.
  useEffect(() => {
    if (finished || page === undefined || mustEvict) return;
    const id = window.setTimeout(() => {
      if (inCache) {
        setHits((h) => h + 1);
        setSlots((ss) => ss.map((s) => (s.page === page ? { ...s, used: i } : s)));
        setLast("hit");
      } else {
        setSlots((ss) => [...ss, { page, used: i }]);
        setLast("load");
      }
      setI(i + 1);
    }, 650);
    return () => window.clearTimeout(id);
  }, [i, page, inCache, mustEvict, finished]);

  useEffect(() => {
    if (i < seq.length || finished) return;
    setFinished(true);
  }, [i, seq.length, finished]);

  const evict = (k: number) => {
    if (!mustEvict || page === undefined) return;
    setSlots((ss) => ss.map((s, j) => (j === k ? { page, used: i } : s)));
    setLast("evict");
    setI(i + 1);
  };

  const opt = useMemo(() => simulate(seq, CACHE_SLOTS, "opt"), [seq]);
  const lru = useMemo(() => simulate(seq, CACHE_SLOTS, "lru"), [seq]);
  const fifo = useMemo(() => simulate(seq, CACHE_SLOTS, "fifo"), [seq]);
  const percent = opt ? Math.round((hits / opt) * 100) : 100;

  if (finished) {
    const rows = [
      { who: "Сен", n: hits },
      { who: "LRU (ең ұзақ қолданылмаған)", n: lru },
      { who: "FIFO (ең бірінші келген)", n: fifo },
      { who: "Оптималды (болашақты біледі)", n: opt },
    ];
    return (
      <div className={styles.cacheGame}>
        <h3 className={styles.cacheTitle}>Нәтиже: {seq.length} сұраныстан тиістер</h3>
        <ul className={styles.race} aria-label="Алгоритмдермен жарыс">
          {rows.map((r) => (
            <li key={r.who} data-you={r.who === "Сен" || undefined}>
              <span>{r.who}</span>
              <i style={{ width: `${(r.n / seq.length) * 100}%` }} />
              <b>{r.n}</b>
            </li>
          ))}
        </ul>
        <p className={styles.note}>
          Оптималды алгоритм (Белади) ең алыс болашақта керек болатын деректі шығарады. Оны нақты процессор біле алмайды, сондықтан LRU сияқты ережелер өткенге қарап болжайды.
        </p>
        <button type="button" className={styles.play} onClick={() => onEnd(percent)}>
          Ұпайды алу: {percent}% →
        </button>
      </div>
    );
  }

  return (
    <div className={styles.cacheGame}>
      <div className={styles.hud}>
        <span>
          Тиіс <b data-testid="score">{hits}</b>
        </span>
        <span>
          Сұраныс {Math.min(i + 1, seq.length)}/{seq.length}
        </span>
      </div>

      <div className={styles.cpuRow}>
        <div className={styles.request} aria-live="polite">
          <small>Процессор сұрайды</small>
          <b data-testid="request">{page}</b>
        </div>
        <ol className={styles.upcoming} aria-label="Келесі сұраныстар">
          {seq.slice(i + 1, i + 6).map((p, k) => (
            <li key={k}>{p}</li>
          ))}
        </ol>
      </div>

      <p className={styles.status} role="status">
        {mustEvict ? `${page} кэште жоқ, орын толы. Қайсысын шығарасың?` : inCache ? `${page} кэште бар: тиіс!` : last === "evict" ? "Ауыстырылды." : `${page ?? ""} жүктелуде…`}
      </p>

      <div className={styles.slots} role="group" aria-label="Кэш ұяшықтары">
        {Array.from({ length: CACHE_SLOTS }, (_, k) => {
          const s = slots[k];
          return (
            <button
              key={k}
              type="button"
              disabled={!mustEvict || !s}
              data-hit={(s && s.page === page && inCache) || undefined}
              onClick={() => evict(k)}
              aria-label={s ? `Ұяшық ${k + 1}: ${s.page}, соңғы рет ${s.used + 1}-сұраныста` : `Ұяшық ${k + 1}: бос`}
            >
              <b>{s?.page ?? "·"}</b>
              <small>{s ? `соңғы: №${s.used + 1}` : "бос"}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}
