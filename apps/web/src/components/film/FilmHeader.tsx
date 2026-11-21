import Link from "next/link";
import type { ReactNode } from "react";
import { PlayerBadge } from "./PlayerBadge";
import styles from "./film.module.css";

/**
 * Header of the dark pages: wordmark, two primary destinations, the player
 * badge, and the teacher/author tools tucked into one menu.
 */
export function FilmHeader({ lead }: { lead?: ReactNode }) {
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
        <Link href="/journey" className={styles.menuLink}>
          Саяхат
        </Link>
      </nav>
      <div className={styles.headerEnd}>
        <PlayerBadge />
        <details className={styles.tools}>
          <summary>Құралдар</summary>
          <div className={styles.toolsMenu}>
            <Link href="/create">Сабақ жасау</Link>
            <Link href="/teacher">Мұғалімге</Link>
            <Link href="/account">Аккаунт</Link>
          </div>
        </details>
      </div>
    </header>
  );
}
