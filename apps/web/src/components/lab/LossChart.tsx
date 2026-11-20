"use client";

import type { EpochRecord } from "@inside-tech/lab-ai";
import styles from "./lab.module.css";

interface Props {
  history: EpochRecord[];
}

const W = 320;
const Hh = 120;
const PAD = 6;

function path(values: number[], max: number): string {
  if (values.length === 0) return "";
  const n = values.length;
  return values
    .map((v, i) => {
      const x = PAD + (n === 1 ? 0 : (i / (n - 1)) * (W - 2 * PAD));
      const y = Hh - PAD - (Math.min(v, max) / max) * (Hh - 2 * PAD);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

/** Train vs test curves. Solid = train, dashed = test, same colour per metric. */
export function LossChart({ history }: Props) {
  const last = history[history.length - 1];
  const maxLoss = Math.max(0.8, ...history.map((h) => (Number.isFinite(h.trainLoss) ? h.trainLoss : 0)));
  const step = Math.max(1, Math.floor(history.length / 160));
  const sampled = history.filter((_, i) => i % step === 0 || i === history.length - 1);

  return (
    <figure className={styles.chart} aria-label="Loss және accuracy графигі">
      <div className={styles.chartLegend}>
        <span>
          <i className={styles.swLoss} /> Loss {last ? last.trainLoss.toFixed(3) : "—"}
        </span>
        <span>
          <i className={styles.swAcc} /> Accuracy {last ? `${(last.testAcc * 100).toFixed(0)}%` : "—"} test
        </span>
        <span className={styles.chartMuted}>— train · - - test</span>
      </div>
      <svg viewBox={`0 0 ${W} ${Hh}`} preserveAspectRatio="none" role="img" aria-hidden={history.length === 0}>
        <line x1={PAD} x2={W - PAD} y1={Hh - PAD} y2={Hh - PAD} className={styles.axis} />
        <path d={path(sampled.map((h) => h.trainLoss), maxLoss)} className={styles.lossLine} />
        <path d={path(sampled.map((h) => h.testLoss), maxLoss)} className={`${styles.lossLine} ${styles.dashed}`} />
        <path d={path(sampled.map((h) => h.trainAcc), 1)} className={styles.accLine} />
        <path d={path(sampled.map((h) => h.testAcc), 1)} className={`${styles.accLine} ${styles.dashed}`} />
      </svg>
      {history.length === 0 && <figcaption className={styles.chartEmpty}>Training басталғанда мұнда қисықтар пайда болады.</figcaption>}
    </figure>
  );
}
