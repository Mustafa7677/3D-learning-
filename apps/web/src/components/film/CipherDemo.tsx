"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { caesar, N } from "@inside-tech/lab-sec";
import { solveChallenge } from "@/lib/challenges";
import styles from "./landing.module.css";

const PLAIN = "технологияның ішіне кір: оны өз қолыңмен зертте";
const KEY = 11;
const CIPHER = caesar(PLAIN, KEY);

/** Break a Caesar cipher over the 42-letter Kazakh alphabet by turning the key. */
export function CipherDemo({ micro = "SECURITY / CHALLENGE" }: { micro?: string }) {
  const [k, setK] = useState(0);
  const [hint, setHint] = useState(false);
  const [won, setWon] = useState(false);
  const plain = useMemo(() => caesar(CIPHER, -k), [k]);
  const solved = k === KEY;
  useEffect(() => {
    if (solved && !won) {
      setWon(true);
      solveChallenge("cipher");
    }
  }, [solved, won]);
  return (
    <section className={styles.cipher} aria-labelledby="cipher-title" id="cipher-demo">
      <div className={styles.cipherInner}>
        <p className={styles.micro}>{micro}</p>
        <h2 id="cipher-title" className={styles.h2}>
          Шифрды бұз.
        </h2>
        <p className={styles.line}>Хабар Цезарь шифрымен жасырылған: әр әріп қазақ әліпбиінде бірнеше орынға жылжыған. Кілтті тап.</p>
        <p className={styles.cipherText} aria-label="Шифрланған мәтін">
          {CIPHER}
        </p>
        <p className={styles.decoded} data-solved={solved} aria-live="polite">
          {[...plain].map((ch, i) => (
            <span key={i} style={{ animationDelay: `${i * 12}ms` }}>
              {ch}
            </span>
          ))}
        </p>
        <label className={`${styles.range} ${styles.keyRange}`}>
          <span>
            Кілт <b>{k}</b> / {N - 1}
          </span>
          <input type="range" min={0} max={N - 1} value={k} onChange={(e) => setK(Number(e.target.value))} />
        </label>
        <div className={styles.cipherFoot}>
          <p className={styles.goal} data-done={solved}>
            {solved ? "Бұзылды! +20 XP. Енді неге бұл шифр қауіпсіз емес екенін білесің: бар болғаны 41 кілт." : "Кілтті айналдыр: мәтін мағыналы болғанда тоқта."}
          </p>
          {!solved && (
            <button type="button" className={styles.hintBtn} onClick={() => setHint(true)}>
              Кеңес
            </button>
          )}
          {hint && !solved && <p className={styles.note}>Шифрда ең жиі кездесетін әріп, ашық мәтінде, сірә, «а» немесе «е».</p>}
          <Link href="/labs/sec" className={styles.textLink}>
            Cybersecurity зертханасы
          </Link>
        </div>
      </div>
    </section>
  );
}
