"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FOCUS_EVENT, clock, loadActive, remainingMs, type FocusSession } from "@/lib/focus";
import styles from "./focus.module.css";

/** The running session in the header: a small clock that keeps counting while the learner studies elsewhere. */
export function FocusChip() {
  const [s, setS] = useState<FocusSession | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const load = () => {
      setS(loadActive());
      setNow(Date.now());
    };
    load();
    const t = setInterval(() => setNow(Date.now()), 1000);
    window.addEventListener(FOCUS_EVENT, load);
    window.addEventListener("storage", load);
    return () => {
      clearInterval(t);
      window.removeEventListener(FOCUS_EVENT, load);
      window.removeEventListener("storage", load);
    };
  }, []);
  if (!s || !now) return null;
  const left = remainingMs(s, now);
  const label = left === 0 ? "Фокус аяқталды" : s.pausedAt ? `Фокус кідірісте, ${clock(left)}` : `Фокус: ${clock(left)} қалды`;
  return (
    <Link href="/focus" className={styles.chip} data-state={left === 0 ? "done" : s.pausedAt ? "paused" : "running"} aria-label={label}>
      <i aria-hidden />
      {left === 0 ? "✓ Аяқталды" : clock(left)}
    </Link>
  );
}
