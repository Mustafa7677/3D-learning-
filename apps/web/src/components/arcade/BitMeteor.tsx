"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { bitLevel, bitPoints, bitsValue, rng } from "@/lib/arcade";
import styles from "./arcade.module.css";

interface Meteor {
  id: number;
  n: number;
  x: number;
  /** 0 at the top, 1 on the ground. */
  y: number;
}
interface Blast {
  id: number;
  x: number;
  y: number;
  text: string;
  hit: boolean;
}

const LIVES = 3;

/** Бит-метеор: set the switches to a falling number to shoot it down. */
export function BitMeteor({ onEnd }: { onEnd: (score: number) => void }) {
  const g = useRef({ meteors: [] as Meteor[], blasts: [] as Blast[], next: 0.6, zaps: 0, score: 0, lives: LIVES, id: 0, over: false, r: rng(Date.now()) });
  const [, tick] = useReducer((x: number) => x + 1, 0);
  const [bits, setBits] = useState<boolean[]>(() => Array(bitLevel(0).width).fill(false));
  const end = useRef(onEnd);
  useEffect(() => {
    end.current = onEnd;
  });

  const blast = (b: Omit<Blast, "id">) => {
    const s = g.current;
    const id = ++s.id;
    s.blasts.push({ ...b, id });
    window.setTimeout(() => {
      s.blasts = s.blasts.filter((x) => x.id !== id);
    }, 700);
  };

  // The game clock.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const s = g.current;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!s.over) {
        const L = bitLevel(s.zaps);
        s.next -= dt;
        if (s.next <= 0 && s.meteors.length < 4) {
          const max = 2 ** L.width - 1;
          let n = 1 + Math.floor(s.r() * max);
          while (s.meteors.some((m) => m.n === n)) n = 1 + Math.floor(s.r() * max);
          s.meteors.push({ id: ++s.id, n, x: 10 + s.r() * 76, y: 0 });
          s.next = L.every;
        }
        for (const m of s.meteors) m.y += dt / L.fall;
        const landed = s.meteors.filter((m) => m.y >= 1);
        if (landed.length) {
          s.meteors = s.meteors.filter((m) => m.y < 1);
          s.lives -= landed.length;
          for (const m of landed) blast({ x: m.x, y: 0.94, text: "БУМ!", hit: false });
          if (s.lives <= 0) {
            s.over = true;
            window.setTimeout(() => end.current(s.score), 600);
          }
        }
      }
      tick();
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  const bitsRef = useRef(bits);
  useEffect(() => {
    bitsRef.current = bits;
  });

  const toggle = useCallback((k: number) => {
    const s = g.current;
    if (s.over) return;
    const nb = bitsRef.current.map((b, i) => (i === k ? !b : b));
    const v = bitsValue(nb);
    const target = s.meteors.filter((m) => m.n === v).sort((a, b) => b.y - a.y)[0];
    if (target) {
      const pts = bitPoints(bitLevel(s.zaps).level, target.y);
      s.score += pts;
      s.zaps++;
      s.meteors = s.meteors.filter((m) => m !== target);
      blast({ x: target.x, y: target.y, text: `+${pts}`, hit: true });
      // The register clears after a shot, and a new level may make it wider.
      const cleared = Array(bitLevel(s.zaps).width).fill(false);
      bitsRef.current = cleared;
      setBits(cleared);
    } else {
      bitsRef.current = nb;
      setBits(nb);
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = Number(e.key);
      if (e.key >= "1" && e.key <= "8" && k <= bits.length) {
        e.preventDefault();
        toggle(k - 1);
      }
      if (e.key === "Backspace") setBits((b) => b.map(() => false));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bits.length, toggle]);

  const s = g.current;
  const L = bitLevel(s.zaps);
  const value = bitsValue(bits);

  return (
    <div className={styles.bitGame}>
      <div className={styles.hud}>
        <span>
          Ұпай <b data-testid="score">{s.score}</b>
        </span>
        <span>Деңгей {L.level}</span>
        <span aria-label={`Қалқан: ${Math.max(s.lives, 0)}`}>
          {Array.from({ length: LIVES }, (_, k) => (
            <i key={k} data-on={k < s.lives || undefined}>
              ⬢
            </i>
          ))}
        </span>
      </div>

      <div className={styles.sky} aria-label="Метеорлар" role="list">
        {s.meteors.map((m) => (
          <div key={m.id} role="listitem" className={styles.meteor} style={{ left: `${m.x}%`, top: `${m.y * 86}%` }} data-n={m.n} aria-label={`Метеор ${m.n}`}>
            <span>{m.n}</span>
          </div>
        ))}
        {s.blasts.map((b) => (
          <span key={b.id} className={styles.blast} data-hit={b.hit || undefined} style={{ left: `${b.x}%`, top: `${b.y * 86}%` }} aria-hidden>
            {b.text}
          </span>
        ))}
        <div className={styles.ground} aria-hidden />
        <div className={styles.cannon} aria-hidden>
          <span>{value}</span>
        </div>
      </div>

      <div className={styles.register} role="group" aria-label="Биттер">
        {bits.map((b, k) => {
          const weight = 2 ** (bits.length - 1 - k);
          return (
            <button key={k} type="button" aria-pressed={b} aria-label={`${weight} биті`} onClick={() => toggle(k)}>
              <small>{weight}</small>
              <b>{b ? 1 : 0}</b>
              <kbd>{k + 1}</kbd>
            </button>
          );
        })}
        <output className={styles.value} aria-label="Қазіргі сан">
          = {value}
        </output>
      </div>
    </div>
  );
}
