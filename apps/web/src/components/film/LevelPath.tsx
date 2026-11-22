"use client";

import { LEVEL_WORD, levelOf, type Level } from "@/lib/levels";
import styles from "./film.module.css";

const LEVELS: Level[] = ["Junior", "Middle", "Senior"];

/** Junior → Middle → Senior: three medallions on one road, filled as lessons are finished. */
export function LevelPath({ orders, done, onJump }: { orders: number[]; done: boolean[]; onJump(index: number): void }) {
  const rows = LEVELS.map((lv) => {
    const idx = orders.map((o, i) => (levelOf(o) === lv ? i : -1)).filter((i) => i >= 0);
    const finished = idx.filter((i) => done[i]).length;
    return { lv, idx, finished, total: idx.length };
  });
  return (
    <nav className={styles.levelPath} aria-label="Деңгей жолы">
      {rows.map((r, k) => {
        const share = r.total ? r.finished / r.total : 0;
        const state = r.total === 0 ? "soon" : share === 1 ? "done" : r.finished > 0 ? "going" : "open";
        return (
          <div key={r.lv} className={styles.levelStop} data-state={state}>
            {k > 0 && <span className={styles.levelRoad} aria-hidden style={{ ["--fill" as string]: rows[k - 1]!.total ? rows[k - 1]!.finished / rows[k - 1]!.total : 0 }} />}
            <button type="button" className={styles.levelMedal} disabled={r.total === 0} onClick={() => onJump(r.idx[0]!)} aria-label={`${r.lv}: ${r.total ? `${r.finished}/${r.total} сабақ` : "жақында"}`}>
              <svg viewBox="0 0 64 64" aria-hidden>
                <circle cx="32" cy="32" r="28" className={styles.levelRing} />
                <circle cx="32" cy="32" r="28" className={styles.levelArc} style={{ strokeDasharray: `${share * 176} 176` }} />
                <path d="M32 14 L38 32 L32 50 L26 32 Z" className={styles.levelStar} />
              </svg>
            </button>
            <strong>{r.lv}</strong>
            <small>{r.total ? `${r.finished}/${r.total} · ${LEVEL_WORD[r.lv]}` : "жақында"}</small>
          </div>
        );
      })}
    </nav>
  );
}
