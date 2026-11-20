import Link from "next/link";
import type { Metadata } from "next";
import { LessonList } from "@/components/LessonList";
import styles from "@/components/home.module.css";

export const metadata: Metadata = {
  title: "AI & Machine Learning — INSIDE TECH",
};

export default function AiLabPage() {
  return (
    <div className={styles.page}>
      <header className={styles.nav}>
        <Link href="/" className={styles.brand}>
          INSIDE TECH
        </Link>
      </header>
      <main>
        <div className={styles.labHead}>
          <h1>AI & Machine Learning</h1>
          <p>
            Деректерден бастап нақты үйретілген нейрондық желіге, сосын тілдік модельдер мен attention-ға дейін. Әр сабақта бір симуляция ішінде жұмыс істейсің, сондықтан әр өзгерістің салдарын бірден көресің.
          </p>
        </div>
        <LessonList />
      </main>
    </div>
  );
}
