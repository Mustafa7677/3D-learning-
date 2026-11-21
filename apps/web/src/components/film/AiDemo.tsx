"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { SimulationRuntime } from "@inside-tech/sim-core";
import { aiLabPlugin, type AiLabState } from "@inside-tech/lab-ai";
import Link from "next/link";
import { prefersReducedMotion } from "@/lib/nav";
import { useWebGL } from "@/lib/useWebGL";
import styles from "./landing.module.css";

const AiScene = dynamic(() => import("../scene/AiScene"), { ssr: false });

const DATASETS = [
  ["circles", "Шеңберлер"],
  ["xor", "XOR"],
  ["moons", "Айлар"],
  ["spiral", "Спираль"],
] as const;
type Kind = (typeof DATASETS)[number][0];
const RATES = [0.01, 0.03, 0.1, 0.3, 1, 3];

/**
 * The real AI-lab engine on the home page: a 2-8-8-1 network learning the
 * chosen dataset in this browser. It runs only while the section is visible.
 */
export function AiDemo() {
  const box = useRef<HTMLElement>(null);
  const rt = useRef<SimulationRuntime<AiLabState, never> | null>(null);
  const [state, setState] = useState<AiLabState>();
  const [kind, setKind] = useState<Kind>("circles");
  const [rate, setRate] = useState(3);
  const [visible, setVisible] = useState(false);
  const webgl = useWebGL();

  const restart = (k: Kind = kind, r: number = rate) => {
    const sim = new SimulationRuntime(aiLabPlugin, 7);
    sim.dispatch({ type: "dataset/generate", kind: k, count: 220, noise: 0.12, seed: 3 } as never);
    sim.dispatch({ type: "network/setHidden", hidden: [8, 8] } as never);
    sim.dispatch({ type: "hyper/set", params: { learningRate: RATES[r]!, batchSize: 16, epochLimit: 400, epochsPerTick: 1 } } as never);
    sim.dispatch({ type: "train/start" } as never);
    rt.current = sim as unknown as SimulationRuntime<AiLabState, never>;
    setState(sim.getState() as AiLabState);
  };

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(!!e?.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    if (!rt.current) restart();
    if (prefersReducedMotion()) {
      rt.current!.stepTicks(240);
      setState(rt.current!.getState());
      return;
    }
    let raf = 0;
    let last = performance.now();
    let pushed = 0;
    const loop = (now: number) => {
      rt.current?.advance(Math.min(0.1, (now - last) / 1000));
      last = now;
      if (now - pushed > 66 && rt.current) {
        setState(rt.current.getState());
        pushed = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const last = state?.training.history.at(-1);
  const lr = RATES[rate]!;
  const note =
    lr >= 1
      ? "Қадам тым үлкен: loss секіріп, желі шатасады. Кішірейтіп көр."
      : lr <= 0.03
        ? "Қадам тым кішкентай: үйрену өте баяу."
        : last && last.testAcc > 0.95
          ? "Желі шекараны тапты. Енді спиральды байқап көр."
          : "Түстер үйрену барысында ауысады: бұл желінің әр нүктедегі болжамы.";

  return (
    <section ref={box} className={styles.ai} aria-labelledby="ai-title" id="ai-demo">
      <div className={styles.aiText}>
        <p className={styles.micro}>АКТ II / AI БЛОГЫНЫҢ ІШІ / LIVE</p>
        <h2 id="ai-title" className={styles.h2}>
          Нейрон қалай үйренеді?
        </h2>
        <p className={styles.line}>Бұл бейне емес: желі дәл қазір сенің браузеріңде үйреніп жатыр.</p>

        <div className={styles.controls}>
          <div className={styles.seg} role="group" aria-label="Деректер">
            {DATASETS.map(([k, label]) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => {
                  setKind(k);
                  restart(k, rate);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <label className={styles.range}>
            <span>
              Learning rate <b>{lr}</b>
            </span>
            <input
              type="range"
              min={0}
              max={RATES.length - 1}
              value={rate}
              onChange={(e) => {
                const r = Number(e.target.value);
                setRate(r);
                restart(kind, r);
              }}
            />
          </label>
          <dl className={styles.stats}>
            <div>
              <dt>Epoch</dt>
              <dd>{state?.training.epoch ?? 0}</dd>
            </div>
            <div>
              <dt>Loss</dt>
              <dd>{last ? last.trainLoss.toFixed(3) : "-"}</dd>
            </div>
            <div>
              <dt>Дәлдік</dt>
              <dd>{last ? `${Math.round(last.testAcc * 100)}%` : "-"}</dd>
            </div>
          </dl>
          <p className={styles.note} aria-live="polite">
            {note}
          </p>
          <Link href="/labs/ai" className={styles.textLink}>
            AI LAB-ты ашу
          </Link>
        </div>
      </div>
      <div className={styles.aiStage} aria-label="Нейрондық желінің шешім беті, 3D" role="img">
        {state && webgl !== false && visible && <AiScene state={state} focus="overview" autoRotate showSurface showNetwork={false} gridRes={30} />}
        {webgl === false && <p className={styles.note}>Бұл құрылғыда 3D жоқ: желі бәрібір үйреніп жатыр, нәтижесі сол жақта.</p>}
      </div>
    </section>
  );
}
