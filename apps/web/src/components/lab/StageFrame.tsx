import { OyuCorner } from "./Oyu";
import styles from "./lab.module.css";

/**
 * The stage as a film frame: letterbox bars, ram's-horn corners, grain,
 * and a title plate naming the shot. Pure decoration over the scene: it
 * never takes a click.
 */
export function StageFrame({ shot, title }: { shot: number; title: string }) {
  return (
    <div className={styles.frame} aria-hidden>
      <span className={styles.letterTop} />
      <span className={styles.letterBottom} />
      <OyuCorner className={`${styles.corner} ${styles.cornerTL}`} />
      <OyuCorner className={`${styles.corner} ${styles.cornerTR}`} />
      <OyuCorner className={`${styles.corner} ${styles.cornerBL}`} />
      <OyuCorner className={`${styles.corner} ${styles.cornerBR}`} />
      <span className={styles.grain} />
      <span className={styles.plate}>
        <b>КАДР {String(shot).padStart(2, "0")}</b>
        <span>{title}</span>
      </span>
    </div>
  );
}
