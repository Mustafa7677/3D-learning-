"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { openLabs } from "@/lib/catalog";
import { go, prefersReducedMotion } from "@/lib/nav";
import { useQuality } from "@/lib/quality";
import { useScrollProgress } from "@/lib/useScrollProgress";
import { useWebGL } from "@/lib/useWebGL";
import styles from "./landing.module.css";

const WorldScene = dynamic(() => import("./WorldScene"), { ssr: false });

/**
 * ACT III, the world: the camera pulls back from the AI block and the ten labs
 * join the core one by one. The canvas mounts when the section comes near and
 * stops rendering whenever it is off screen.
 */
export function WorldFinale({ onChoose }: { onChoose(): void }) {
  const el = useRef<HTMLDivElement>(null);
  const { progress } = useScrollProgress(el, 2);
  const webgl = useWebGL();
  const quality = useQuality();
  const [near, setNear] = useState(false);
  const [visible, setVisible] = useState(false);
  const [still, setStill] = useState(false);
  useEffect(() => setStill(prefersReducedMotion()), []);
  const labs = useMemo(() => openLabs.map((l) => ({ id: l.id, title: l.title, href: l.href! })), []);

  useEffect(() => {
    const node = el.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setNear(true);
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e!.isIntersecting) setNear(true);
        setVisible(e!.isIntersecting);
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={el} className={styles.world} id="world">
      <div className={styles.stage}>
        <div className={styles.worldPoster} aria-hidden />
        {webgl && near && (
          <div className={styles.worldCanvas}>
            <WorldScene progress={progress} labs={labs} onOpen={go} still={still} quality={quality} active={visible} />
          </div>
        )}
        <div className={styles.worldShade} aria-hidden />
      </div>
      <div className={styles.chapters}>
        <section className={styles.worldBeat} aria-labelledby="world-title">
          <p className={styles.micro}>АКТ III / ӘЛЕМ</p>
          <h2 id="world-title" className={styles.h2}>
            Бір блок емес. Бүкіл әлем.
          </h2>
          <p className={styles.line}>Нейрон желісі тек бір бөлшек. Камера артқа шегінген сайын қалған тоғыз зертхана бір жүйеге қосылады.</p>
        </section>
        <section className={`${styles.worldBeat} ${styles.worldEnd}`} aria-labelledby="world-choose">
          <p className={styles.micro}>10 ЗЕРТХАНА / 1 ТЕХНОЛОГИЯ</p>
          <h2 id="world-choose" className={styles.h2}>
            Қайсысынан бастайсың?
          </h2>
          <p className={styles.line}>Әр арал: жеке курс. Аралды бас немесе төменнен таңда.</p>
          <button type="button" className={styles.primary} onClick={onChoose}>
            Курсты таңда
          </button>
        </section>
      </div>
    </div>
  );
}
