"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { PID_DT, TARGET, runPid } from "@inside-tech/lab-iot";
import { solveChallenge } from "@/lib/challenges";
import { prefersReducedMotion } from "@/lib/nav";
import styles from "./landing.module.css";

const W = 640;
const H = 280;
const Y = (x: number) => H - 20 - Math.max(-0.2, Math.min(1.7, x)) * ((H - 40) / 1.6);
const X = (i: number, n: number) => 40 + (i / (n - 1)) * (W - 56);

/** A lift held at 1 m by a PID controller, on paper: drag the gains, watch the curve and the cabin. */
export function PidDemo() {
  const [kp, setKp] = useState(10);
  const [ki, setKi] = useState(0);
  const [kd, setKd] = useState(0);
  const run = useMemo(() => runPid({ kp, ki, kd }), [kp, ki, kd]);
  const path = useMemo(() => run.xs.filter((_, i) => i % 2 === 0).map((x, i, a) => `${i ? "L" : "M"}${X(i, a.length).toFixed(1)},${Y(x).toFixed(1)}`).join(""), [run]);
  const [cabin, setCabin] = useState(0);
  const [won, setWon] = useState(false);
  const pass = run.overshoot <= 0.1 && run.settle <= 3 && run.ssError <= 0.02;

  // Ride the cabin along the new response each time the gains change.
  const raf = useRef(0);
  useEffect(() => {
    if (prefersReducedMotion()) return setCabin(run.xs.at(-1)!);
    const t0 = performance.now();
    const tick = (now: number) => {
      const i = Math.min(run.xs.length - 1, Math.floor(Math.max(0, now - t0) / 6));
      setCabin(run.xs[i]!);
      if (i < run.xs.length - 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [run]);

  useEffect(() => {
    if (pass && !won) {
      setWon(true);
      solveChallenge("pid");
    }
  }, [pass, won]);

  const slider = (label: string, v: number, set: (n: number) => void, max: number) => (
    <label className={styles.range}>
      <span>
        {label} <b>{v}</b>
      </span>
      <input type="range" min={0} max={max} step={0.5} value={v} onChange={(e) => set(Number(e.target.value))} />
    </label>
  );

  return (
    <section className={styles.paper} aria-labelledby="pid-title" id="pid-demo">
      <div className={styles.paperInner}>
        <div className={styles.paperText}>
          <p className={styles.micro}>04 / ROBOTICS / CONTROL</p>
          <h2 id="pid-title" className={styles.h2}>
            Бұрап көр.
          </h2>
          <p className={styles.line}>Лифтті дәл 1 метрге тоқтат. Kp итереді, Ki қалған қатені жояды, Kd тежейді.</p>
          {slider("Kp", kp, setKp, 40)}
          {slider("Ki", ki, setKi, 20)}
          {slider("Kd", kd, setKd, 15)}
          <p className={styles.goal} data-done={pass}>
            {pass ? "Тапсырма орындалды: +20 XP" : "Тапсырма: асып кету ≤ 10%, орнығу ≤ 3 с"}
          </p>
          <Link href="/labs/iot/iot-5-pid" className={styles.textLink}>
            PID сабағына өту
          </Link>
        </div>
        <figure className={styles.plot}>
          <div className={styles.shaft} aria-hidden>
            <span className={styles.cabin} style={{ bottom: `${(Math.max(-0.2, Math.min(1.7, cabin)) / 1.7) * 100}%` }} />
            <span className={styles.floor} style={{ bottom: `${(TARGET / 1.7) * 100}%` }} />
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Лифттің биіктігі уақыт бойынша. Асып кету ${Math.round(run.overshoot * 100)} пайыз.`}>
            <rect x={40} y={Y(TARGET * 1.02)} width={W - 56} height={Y(TARGET * 0.98) - Y(TARGET * 1.02)} className={styles.band} />
            <line x1={40} x2={W - 16} y1={Y(TARGET)} y2={Y(TARGET)} className={styles.target} />
            <line x1={40} x2={W - 16} y1={Y(0)} y2={Y(0)} className={styles.axis} />
            {[0, 5, 10, 15, 20].map((s) => (
              <text key={s} x={X(s / PID_DT / 2, 200)} y={H - 4} className={styles.tick}>
                {s} с
              </text>
            ))}
            <text x={8} y={Y(TARGET) + 4} className={styles.tick}>
              1 м
            </text>
            <path key={path} d={path} className={styles.curve} pathLength={1} />
          </svg>
          <figcaption className={styles.metrics}>
            <span>
              Асып кету <strong>{(run.overshoot * 100).toFixed(1)}%</strong>
            </span>
            <span>
              Орнығу <strong>{Number.isFinite(run.settle) ? `${run.settle.toFixed(2)} с` : "жоқ"}</strong>
            </span>
            <span>
              Қате <strong>{run.ssError.toFixed(3)} м</strong>
            </span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
