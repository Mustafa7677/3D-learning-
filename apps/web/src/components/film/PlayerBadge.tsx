"use client";

import { usePlayer } from "@/lib/xp";
import styles from "./game.module.css";

/** Level hexagon and XP bar, like a player card in a game HUD. */
export function PlayerBadge() {
  const p = usePlayer();
  if (!p) return null;
  const pct = Math.round((p.into / p.need) * 100);
  return (
    <div className={styles.player} role="group" aria-label={`Деңгей ${p.level}, ${p.xp} XP, келесі деңгейге ${p.need - p.into} XP қалды`}>
      <span className={styles.hex} aria-hidden>
        {p.level}
      </span>
      <span className={styles.xpWrap} aria-hidden>
        <span className={styles.xpText}>
          {p.into} / {p.need} XP
        </span>
        <span className={styles.xpBar}>
          <span style={{ width: `${pct}%` }} />
        </span>
      </span>
    </div>
  );
}
