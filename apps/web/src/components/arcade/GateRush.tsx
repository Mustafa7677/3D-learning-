"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { COMBO_MAX, GATE_TIME, GATE_WORD, gateRound, rng, type GateName, type GateRound } from "@/lib/arcade";
import styles from "./arcade.module.css";

function Gate({ name }: { name: GateName }) {
  return (
    <div className={styles.gate} data-gate={name}>
      <b>{name}</b>
      <small>{GATE_WORD[name]}</small>
    </div>
  );
}

function Lamp({ label, on }: { label: string; on: boolean }) {
  return (
    <span className={styles.lamp} data-on={on || undefined} aria-label={`${label} = ${on ? 1 : 0}`}>
      <i>{label}</i>
      {on ? 1 : 0}
    </span>
  );
}

/** Қақпа жарысы: sixty seconds of gates, the combo grows while you are right. */
export function GateRush({ onEnd }: { onEnd: (score: number) => void }) {
  const r = useRef(rng(Date.now()));
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(1);
  const [left, setLeft] = useState(GATE_TIME);
  const [round, setRound] = useState<GateRound>(() => gateRound(0, r.current));
  const [flash, setFlash] = useState<"right" | "wrong">();
  const done = useRef(false);
  const end = useRef(onEnd);
  const scoreRef = useRef(0);
  useEffect(() => {
    end.current = onEnd;
    scoreRef.current = score;
  });

  useEffect(() => {
    const id = window.setInterval(() => {
      setLeft((t) => {
        const n = Math.max(0, +(t - 0.1).toFixed(1));
        if (n === 0 && !done.current) {
          done.current = true;
          window.setTimeout(() => end.current(scoreRef.current), 0);
        }
        return n;
      });
    }, 100);
    return () => window.clearInterval(id);
  }, []);

  const answer = useCallback(
    (v: boolean) => {
      if (done.current) return;
      if (v === round.answer) {
        const gained = 10 * combo;
        setScore((s) => s + gained);
        setCombo((c) => Math.min(COMBO_MAX, c + 1));
        setFlash("right");
        setRound(gateRound(score + gained, r.current));
      } else {
        setCombo(1);
        setLeft((t) => Math.max(0, t - 3));
        setFlash("wrong");
        setRound(gateRound(score, r.current));
      }
    },
    [round, combo, score],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "0" || e.key === "1") {
        e.preventDefault();
        answer(e.key === "1");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answer]);

  useEffect(() => {
    if (!flash) return;
    const id = window.setTimeout(() => setFlash(undefined), 260);
    return () => window.clearTimeout(id);
  }, [flash, round]);

  const names = ["A", "B", "C"];
  return (
    <div className={styles.gateGame} data-flash={flash}>
      <div className={styles.hud}>
        <span>
          Ұпай <b data-testid="score">{score}</b>
        </span>
        <span>Комбо ×{combo}</span>
        <span>{left.toFixed(0)} с</span>
      </div>
      <div className={styles.timer} aria-hidden>
        <i style={{ width: `${(left / GATE_TIME) * 100}%` }} />
      </div>

      <div className={styles.circuit} aria-label="Сұлба" role="group">
        <div className={styles.inputs}>
          {round.inputs.slice(0, round.first === "NOT" ? 1 : 2).map((b, k) => (
            <Lamp key={k} label={names[k]!} on={b} />
          ))}
        </div>
        <span className={styles.wire} aria-hidden>
          ⟶
        </span>
        <Gate name={round.first} />
        {round.second && (
          <>
            <span className={styles.wire} aria-hidden>
              ⟶
            </span>
            <div className={styles.inputs}>
              <Lamp label="C" on={round.inputs[2]!} />
            </div>
            <span className={styles.wire} aria-hidden>
              ⟶
            </span>
            <Gate name={round.second} />
          </>
        )}
        <span className={styles.wire} aria-hidden>
          ⟶
        </span>
        <span className={styles.out} aria-hidden>
          ?
        </span>
      </div>
      <p className={styles.formula}>
        {round.second ? `(A ${round.first} B) ${round.second} C = ?` : round.first === "NOT" ? "NOT A = ?" : `A ${round.first} B = ?`}
      </p>

      <div className={styles.answers}>
        <button type="button" onClick={() => answer(false)}>
          0 <kbd>0</kbd>
        </button>
        <button type="button" onClick={() => answer(true)}>
          1 <kbd>1</kbd>
        </button>
      </div>
    </div>
  );
}
