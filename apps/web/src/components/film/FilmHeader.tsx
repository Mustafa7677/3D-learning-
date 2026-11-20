import Link from "next/link";
import type { ReactNode } from "react";
import { PlayerBadge } from "./PlayerBadge";
import styles from "./film.module.css";

/** The header over the dark film pages. `lead` goes first in the menu (e.g. a "Курстар" jump). */
export function FilmHeader({ lead }: { lead?: ReactNode }) {
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.brand}>
        INSIDE TECH
      </Link>
      <PlayerBadge />
      <nav aria-label="Негізгі мәзір" className={styles.menu}>
        {lead}
        <Link href="/create" className={styles.menuLink}>
          Сабақ жасау
        </Link>
        <Link href="/teacher" className={styles.menuLink}>
          Мұғалімге
        </Link>
        <Link href="/account" className={styles.menuLink}>
          Аккаунт
        </Link>
      </nav>
    </header>
  );
}
