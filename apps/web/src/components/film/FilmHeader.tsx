import Link from "next/link";
import type { ReactNode } from "react";
import { PlayerBadge } from "./PlayerBadge";
import { FocusChip } from "../focus/FocusChip";
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
        <Link href="/today" className={`${styles.menuLink} ${styles.todayLink}`}>
          Бүгін
        </Link>
        <Link href="/mission" className={`${styles.menuLink} ${styles.wideOnly}`}>
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
        <FocusChip />
        {badge && (
          <span className={styles.badgeSlot}>
            <PlayerBadge />
          </span>
        )}
        <details className={styles.tools}>
          <summary>Құралдар</summary>
          <div className={styles.toolsMenu}>
            <Link href="/tools" className={styles.toolsAll}>
              Барлық оқу құралдары →
            </Link>
            <Link href="/learn">Қалай оқу керек?</Link>
            <Link href="/mission" className={styles.narrowOnly}>
              Миссия
            </Link>
            <Link href="/journey" className={styles.narrowOnly}>
              Саяхат
            </Link>
            <Link href="/gazette" className={styles.narrowOnly}>
              Газет
            </Link>
            <Link href="/comic">Комикс</Link>
            <Link href="/cards">Карточкалар</Link>
            <Link href="/notebook">Қателер дәптері</Link>
            <Link href="/ticket">Емтихан билеті</Link>
            <Link href="/parsons">Ретке келтір</Link>
            <Link href="/tactics">Тактика алаңы</Link>
            <Link href="/problems">Есептер залы</Link>
            <Link href="/focus">Фокус бөлмесі</Link>
            <Link href="/recall">Бос парақ</Link>
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
