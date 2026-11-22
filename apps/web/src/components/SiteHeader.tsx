import Link from "next/link";
import { openLabs } from "@/lib/catalog";
import styles from "./home.module.css";

/** Short menu names: "Computer Networks" and "Computer Architecture" must not both read "Computer". */
const SHORT: Record<string, string> = { ai: "AI", web: "Web", game: "Game", net: "Networks", db: "Databases", arch: "Architecture", cloud: "Cloud", sec: "Security", algo: "Algorithms", iot: "IoT", math: "Math" };

/** Top navigation shared by the home, lab, account, teacher and creator pages. */
export function SiteHeader({ current }: { current?: string }) {
  const link = (href: string, id: string, label: string) => (
    <Link key={id} href={href} aria-current={current === id ? "page" : undefined}>
      {label}
    </Link>
  );
  return (
    <header className={styles.nav}>
      <Link href="/" className={styles.brand}>
        INSIDE TECH
      </Link>
      <nav className={styles.labSwitch} aria-label="Негізгі мәзір">
        {openLabs.map((l) => link(l.href!, l.id, SHORT[l.id] ?? l.title))}
        {link("/journey", "journey", "Саяхат")}
        {link("/create", "create", "Сабақ жасау")}
        {link("/teacher", "teacher", "Мұғалімге")}
        {link("/account", "account", "Аккаунт")}
      </nav>
    </header>
  );
}
