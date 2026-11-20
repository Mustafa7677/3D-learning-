import { LessonList } from "./LessonList";
import { SiteHeader } from "./SiteHeader";
import { findLab } from "@/lib/catalog";
import styles from "./home.module.css";

export function LabPage({ labId }: { labId: string }) {
  const lab = findLab(labId);
  if (!lab || lab.status !== "open") return null;
  return (
    <div className={styles.page}>
      <SiteHeader current={labId} />
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
