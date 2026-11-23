"use client";

import { openSearch } from "./SearchPalette";
import styles from "./nav.module.css";

/** Opens the search window; shows the shortcut on wide screens. */
export function SearchButton() {
  return (
    <button type="button" className={styles.searchBtn} onClick={openSearch} aria-label="Іздеу (Ctrl+K)">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16-4.5-4.5" />
      </svg>
      <span>Іздеу</span>
      <kbd>Ctrl K</kbd>
    </button>
  );
}
