import Link from "next/link";
import type { ReactNode } from "react";
import { PlayerBadge } from "./PlayerBadge";
import { FocusChip } from "../focus/FocusChip";
import { MobileTabs } from "../nav/MobileTabs";
import { SearchButton } from "../nav/SearchButton";
import styles from "./film.module.css";

/**
 * Header of the dark pages. Five main places (learn, today, tools, problems, me), search, the
 * running focus clock and the player badge; everything else under «Тағы». On a phone the main
 * places move to a tab bar at the bottom.
 */
export function FilmHeader({ lead, badge = true }: { lead?: ReactNode; badge?: boolean }) {
  return (
    <>
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
          <Link href="/today" className={`${styles.menuLink} ${styles.todayLink} ${styles.inTabs}`}>
            Бүгін
          </Link>
          <Link href="/tools" className={`${styles.menuLink} ${styles.wideOnly}`}>
            Құралдар
          </Link>
          <Link href="/problems" className={`${styles.menuLink} ${styles.wideOnly}`}>
            Есептер
          </Link>
          <Link href="/arcade" className={`${styles.menuLink} ${styles.wideOnly}`}>
            Ойындар
          </Link>
          <Link href="/mission" className={`${styles.menuLink} ${styles.wideOnly}`}>
            Миссия
          </Link>
          <Link href="/passport" className={`${styles.menuLink} ${styles.inTabs}`}>
            Паспорт
          </Link>
        </nav>
        <div className={styles.headerEnd}>
          <SearchButton />
          <FocusChip />
          {badge && (
            <span className={styles.badgeSlot}>
              <PlayerBadge />
            </span>
          )}
          <details className={styles.tools}>
            <summary>Тағы</summary>
            <div className={styles.toolsMenu}>
              <Link href="/tools" className={styles.toolsAll}>
                Барлық оқу құралдары →
              </Link>
              <p className={styles.menuGroup}>Оқу</p>
              <Link href="/learn">Қалай оқу керек?</Link>
              <Link href="/focus">Фокус бөлмесі</Link>
              <Link href="/recall">Бос парақ</Link>
              <Link href="/teach">Мустафаға түсіндір</Link>
              <Link href="/cards">Карточкалар</Link>
              <Link href="/notebook">Қателер дәптері</Link>
              <p className={styles.menuGroup}>Жаттығу</p>
              <Link href="/problems">Есептер залы</Link>
              <Link href="/tactics">Тактика алаңы</Link>
              <Link href="/parsons">Ретке келтір</Link>
              <Link href="/ticket">Емтихан билеті</Link>
              <p className={styles.menuGroup}>Зерттеу</p>
              <Link href="/arcade">Ойын залы</Link>
              <Link href="/world">Аралдар әлемі</Link>
              <Link href="/mission">Миссия</Link>
              <Link href="/journey">Саяхат</Link>
              <Link href="/gazette">Газет</Link>
              <Link href="/comics">Комикс кітапханасы</Link>
              <Link href="/comics?s=stories">Тірі заттар</Link>
              <Link href="/comic">Комикс: үш қол алысу</Link>
              <Link href="/sky">Білім аспаны</Link>
              <p className={styles.menuGroup}>Мұғалім мен автор</p>
              <Link href="/create">Сабақ жасау</Link>
              <Link href="/teacher">Мұғалімге</Link>
              <Link href="/account">Аккаунт</Link>
            </div>
          </details>
        </div>
      </header>
      <MobileTabs />
    </>
  );
}
