"use client";

import { activeNetwork, predict, type AiLabState } from "@inside-tech/lab-ai";
import styles from "./lab.module.css";

/** 2D readout of the selected sample: the accessible twin of clicking a sphere in 3D. */
export function PointInspector({ state, onClose }: { state: AiLabState; onClose(): void }) {
  const p = state.points.find((q) => q.id === state.selectedPointId);
  if (!p) return null;
  const prob = predict(activeNetwork(state), [p.x, p.y]);
  const predicted = prob >= 0.5 ? 1 : 0;
  return (
    <div className={styles.inspector} role="dialog" aria-label="Таңдалған нүкте">
      <button type="button" className={styles.close} onClick={onClose} aria-label="Жабу">
        ×
      </button>
      <dl>
        <dt>x₁, x₂</dt>
        <dd>
          {p.x.toFixed(2)}, {p.y.toFixed(2)}
        </dd>
        <dt>Шын класы</dt>
        <dd>
          <span className={`dot dot-${p.label}`} /> {p.label}
        </dd>
        <dt>Жиын</dt>
        <dd>{p.split === "train" ? "train" : "test"}</dd>
        <dt>Модель болжамы</dt>
        <dd>
          <span className={`dot dot-${predicted}`} /> {predicted} ({(prob * 100).toFixed(0)}%)
          {predicted !== p.label && <strong className={styles.wrong}> қате</strong>}
        </dd>
      </dl>
    </div>
  );
}
