"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { openSearch } from "./SearchPalette";
import styles from "./nav.module.css";

const TABS = [
  { href: "/", label: "Басты", icon: "M3 11 12 4l9 7v9h-6v-6H9v6H3z" },
  { href: "/today", label: "Бүгін", icon: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 4v5l3 3" },
  { href: "/tools", label: "Құралдар", icon: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" },
  { href: "/passport", label: "Мен", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 9a7 7 0 0 1 14 0" },
];

/** On a phone, the four main places and search sit under the thumb, like an app. */
export function MobileTabs() {
  const path = usePathname();
  const tab = (t: (typeof TABS)[number]) => {
    const on = t.href === "/" ? path === "/" : path?.startsWith(t.href);
    return (
      <Link key={t.href} href={t.href} className={styles.tab} aria-current={on ? "page" : undefined}>
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d={t.icon} />
        </svg>
        {t.label}
      </Link>
    );
  };
  return (
    <nav className={styles.tabs} aria-label="Төменгі мәзір">
      {tab(TABS[0]!)}
      {tab(TABS[1]!)}
      <button type="button" className={`${styles.tab} ${styles.tabSearch}`} onClick={openSearch}>
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16-4.5-4.5" />
        </svg>
        Іздеу
      </button>
      {tab(TABS[2]!)}
      {tab(TABS[3]!)}
    </nav>
  );
}
