"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { SimulationRuntime } from "@inside-tech/sim-core";
import { aiLabPlugin, type AiLabState } from "@inside-tech/lab-ai";
import { useWebGL } from "@/lib/useWebGL";
import styles from "./home.module.css";

const AiScene = dynamic(() => import("./scene/AiScene"), { ssr: false });

/**
 * The real AI-lab engine, training live on the landing page: a 2-8-8-1 network
 * learning concentric circles. Restarts on a new dataset when it converges.
 */
export function HeroScene() {
  const [state, setState] = useState<AiLabState>();
  const [epoch, setEpoch] = useState(0);
  const webgl = useWebGL();

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rt = new SimulationRuntime(aiLabPlugin, 7);
    const kinds = ["circles", "moons", "xor", "spiral"] as const;
    let k = 0;
    const load = () => {
      rt.dispatch({ type: "dataset/generate", kind: kinds[k % kinds.length]!, count: 220, noise: 0.15 });
      rt.dispatch({ type: "network/setHidden", hidden: [8, 8] });
      rt.dispatch({ type: "hyper/set", params: { learningRate: 0.3, batchSize: 16, epochLimit: kinds[k % kinds.length] === "spiral" ? 400 : 200, epochsPerTick: 1 } });
      rt.dispatch({ type: "train/start" });
      k++;
    };
    load();
    if (reduce) {
      rt.stepTicks(200);
      setState(rt.getState());
      setEpoch(rt.getState().training.epoch);
      return;
    }
    let raf = 0;
    let last = performance.now();
    let lastPush = 0;
    let doneAt = 0;
    const loop = (now: number) => {
      rt.advance(Math.min(0.1, (now - last) / 1000) * 0.5);
      last = now;
      const s = rt.getState();
      if (!s.training.running) {
        doneAt ||= now;
        if (now - doneAt > 2500) {
          doneAt = 0;
          load();
        }
      }
      if (now - lastPush > 66) {
        setState(s);
        setEpoch(s.training.epoch);
        lastPush = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className={styles.heroStage}>
      {state && webgl && <AiScene state={state} focus="overview" autoRotate showSurface showNetwork={false} gridRes={30} />}
      <p className={styles.heroCaption} aria-live="off">
        Бұл анимация емес: нейрондық желі дәл қазір браузеріңде үйреніп жатыр. Epoch {epoch}
      </p>
    </div>
  );
}
