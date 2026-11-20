import Link from "next/link";
import { openLabs } from "@/lib/catalog";
import styles from "./home.module.css";

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
        {openLabs.map((l) => link(l.href!, l.id, l.title.split(" ")[0]!))}
        {link("/teacher", "teacher", "Мұғалімге")}
        {link("/account", "account", "Аккаунт")}
      </nav>
    </header>
  );
}
