"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { prefersReducedMotion } from "@/lib/nav";
import styles from "./game.module.css";

const BOOT_KEY = "inside-tech:booted";

/** A short "system boot" the first time a visitor opens the site in a session. Clicks pass through. */
export function BootIntro() {
  const [phase, setPhase] = useState<"off" | "run" | "done">("off");
  const [pct, setPct] = useState(0);
  useEffect(() => {
    let seen = true;
    try {
      seen = sessionStorage.getItem(BOOT_KEY) === "1";
      sessionStorage.setItem(BOOT_KEY, "1");
    } catch {
      seen = false;
    }
    if (seen || prefersReducedMotion()) return;
    setPhase("run");
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - t0) / 1500));
      setPct(Math.round(100 * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
      else setTimeout(() => setPhase("done"), 250);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  if (phase === "off") return null;
  const word = "INSIDE TECH";
  return (
    <div className={styles.boot} data-done={phase === "done"} aria-hidden={phase === "done"}>
      <div className={styles.bootLogo} aria-label={word}>
        {[...word].map((ch, k) => (
          <span key={k} style={{ ["--k" as string]: k }} aria-hidden>
            {ch === " " ? " " : ch}
          </span>
        ))}
      </div>
      <div className={styles.bootBar} aria-hidden>
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className={styles.bootText}>Чип іске қосылуда {pct}%</p>
      <button type="button" className={styles.bootSkip} onClick={() => setPhase("done")}>
        Өткізу
      </button>
    </div>
  );
}

/** Progress ring for a world card. */
function Ring({ done, total }: { done: number; total: number }) {
  const r = 19;
  const c = 2 * Math.PI * r;
  const f = total ? done / total : 0;
  return (
    <svg className={styles.ring} viewBox="0 0 46 46" aria-hidden>
      <circle cx="23" cy="23" r={r} stroke="rgb(233 237 243 / 0.12)" />
      <circle cx="23" cy="23" r={r} stroke="url(#ringGrad)" strokeDasharray={`${c * f} ${c}`} strokeLinecap="round" />
      <defs>
        <linearGradient id="ringGrad" x1="0" x2="1">
          <stop offset="0" stopColor="#6d8cff" />
          <stop offset="1" stopColor="#e3a04f" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** A course as a world in a level select: tilts toward the pointer, shows progress and stars. */
export function WorldCard({ href, index, title, inside, done, total }: { href: string; index: number; title: string; inside: string; done: number; total: number }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const move = (e: PointerEvent<HTMLAnchorElement>) => {
    const el = ref.current;
    if (!el || e.pointerType === "touch") return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--ry", `${(x - 0.5) * 14}deg`);
    el.style.setProperty("--rx", `${(0.5 - y) * 12}deg`);
    el.style.setProperty("--mx", `${x * 100}%`);
    el.style.setProperty("--my", `${y * 100}%`);
  };
  const leave = () => {
    ref.current?.style.setProperty("--rx", "0deg");
    ref.current?.style.setProperty("--ry", "0deg");
  };
  const stars = done === 0 ? 0 : done >= total ? 3 : done >= total / 2 ? 2 : 1;
  return (
    <Link ref={ref} href={href} className={styles.world} data-done={done >= total && total > 0} onPointerMove={move} onPointerLeave={leave}>
      <span className={styles.worldTop}>
        <span className={styles.worldNum}>{index}-әлем</span>
        <Ring done={done} total={total} />
      </span>
      <span className={styles.ringText} aria-hidden>
        {done}/{total}
      </span>
      <h3>{title}</h3>
      <p>{inside}</p>
      <span className={styles.stars} aria-label={`${stars} жұлдыз, ${done} сабақ аяқталды, барлығы ${total}`}>
        {[0, 1, 2].map((k) => (
          <span key={k} data-on={k < stars} aria-hidden>
            ★
          </span>
        ))}
      </span>
    </Link>
  );
}

/** The reward after finishing a lesson: XP counting up and a burst of sparks. */
export function Reward({ xp, nextHref, onClose }: { xp: number; nextHref?: string; onClose(): void }) {
  const [shown, setShown] = useState(0);
  const btn = useRef<HTMLButtonElement>(null);
  // The parent re-renders every simulation frame: keep the latest onClose without restarting the count.
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    btn.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && close.current();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []);
  useEffect(() => {
    if (prefersReducedMotion()) return setShown(xp);
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - t0) / 900));
      setShown(Math.round(xp * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [xp]);
  const sparks = Array.from({ length: 36 }, (_, i) => {
    const a = (i / 36) * Math.PI * 2;
    const d = 140 + ((i * 37) % 90);
    return { dx: `${Math.cos(a) * d}px`, dy: `${Math.sin(a) * d}px`, rot: `${(i * 47) % 360}deg`, color: i % 3 === 0 ? "#6d8cff" : "#e3a04f" };
  });
  return (
    <div className={styles.reward} role="dialog" aria-modal="true" aria-label="Сабақ аяқталды" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.rewardCard}>
        {sparks.map((s, i) => (
          <span key={i} className={styles.spark} style={{ ["--dx" as string]: s.dx, ["--dy" as string]: s.dy, ["--rot" as string]: s.rot, background: s.color }} aria-hidden />
        ))}
        <h2>Сабақ аяқталды!</h2>
        <div className={styles.rewardXp} aria-live="polite">
          +{shown} XP
        </div>
        <div className={styles.rewardActions}>
          {nextHref && (
            <Link href={nextHref} className={styles.rewardPrimary}>
              Келесі сабақ
            </Link>
          )}
          <button ref={btn} type="button" className={nextHref ? styles.rewardGhost : styles.rewardPrimary} onClick={onClose}>
            Жабу
          </button>
        </div>
      </div>
    </div>
  );
}
