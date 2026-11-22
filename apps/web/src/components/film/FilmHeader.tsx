import Link from "next/link";
import type { ReactNode } from "react";
import { PlayerBadge } from "./PlayerBadge";
import styles from "./film.module.css";

/**
 * Header of the dark pages: wordmark, two primary destinations, the player
 * badge, and the teacher/author tools tucked into one menu.
 */
export function FilmHeader({ lead, badge = true }: { lead?: ReactNode; badge?: boolean }) {
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.brand} aria-label="INSIDE TECH, басты бет">
        INSIDE<span aria-hidden>/</span>TECH
      </Link>
      <nav aria-label="Негізгі мәзір" className={styles.menu}>
        {lead ?? (
          <Link href="/" className={styles.menuLink}>
            Зертханалар
          </Link>
        )}
        <Link href="/mission" className={styles.menuLink}>
          Миссия
        </Link>
        <Link href="/journey" className={`${styles.menuLink} ${styles.wideOnly}`}>
          Саяхат
        </Link>
        <Link href="/gazette" className={`${styles.menuLink} ${styles.wideOnly}`}>
          Газет
        </Link>
        <Link href="/passport" className={styles.menuLink}>
          Паспорт
        </Link>
      </nav>
      <div className={styles.headerEnd}>
        {badge && (
          <span className={styles.badgeSlot}>
            <PlayerBadge />
          </span>
        )}
        <details className={styles.tools}>
          <summary>Құралдар</summary>
          <div className={styles.toolsMenu}>
            <Link href="/journey" className={styles.narrowOnly}>
              Саяхат
            </Link>
            <Link href="/gazette" className={styles.narrowOnly}>
              Газет
            </Link>
            <Link href="/comic">Комикс</Link>
            <Link href="/cards">Карточкалар</Link>
            <Link href="/notebook">Қателер дәптері</Link>
            <Link href="/sky">Білім аспаны</Link>
            <Link href="/create">Сабақ жасау</Link>
            <Link href="/teacher">Мұғалімге</Link>
            <Link href="/account">Аккаунт</Link>
          </div>
        </details>
      </div>
    </header>
  );
}
