import Link from "next/link";
import { LessonList } from "./LessonList";
import { findLab, openLabs } from "@/lib/catalog";
import styles from "./home.module.css";

export function LabPage({ labId }: { labId: string }) {
  const lab = findLab(labId);
  if (!lab || lab.status !== "open") return null;
  return (
    <div className={styles.page}>
      <header className={styles.nav}>
        <Link href="/" className={styles.brand}>
          INSIDE TECH
        </Link>
        <nav className={styles.labSwitch} aria-label="Зертханалар">
          {openLabs.map((l) => (
            <Link key={l.id} href={l.href!} aria-current={l.id === labId ? "page" : undefined}>
              {l.title}
            </Link>
          ))}
        </nav>
      </header>
      <main>
        <div className={styles.labHead}>
          <h1>{lab.title}</h1>
          <p>{lab.intro}</p>
        </div>
        <LessonList labId={labId} />
      </main>
    </div>
  );
}
