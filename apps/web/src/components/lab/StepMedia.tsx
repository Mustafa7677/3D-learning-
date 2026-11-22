"use client";

import { useMemo, useState } from "react";
import { CHARACTER_NAME, type Character, type Comic, type Contrast, type ErrorHunt, type Mood, type WorkedExample } from "@inside-tech/lesson-engine";
import { optionOrder } from "@/lib/shuffle";
import styles from "./media.module.css";

// ---------------- characters ----------------

const SKIN: Record<Character, string> = { nuray: "#f1c7a1", mustafa: "#d9a77c", ustaz: "#eac09a", narrator: "#ccc" };

function Mouth({ mood }: { mood: Mood }) {
  if (mood === "wow") return <ellipse cx="30" cy="42" rx="3.4" ry="4.2" fill="#5a1f1a" />;
  if (mood === "confused") return <path d="M24 43 q3 -3 6 0 t6 0" stroke="#5a1f1a" strokeWidth="1.8" fill="none" />;
  if (mood === "think") return <path d="M26 43 h8" stroke="#5a1f1a" strokeWidth="1.8" />;
  if (mood === "explain") return <path d="M24 40 q6 7 12 0 z" fill="#5a1f1a" />;
  return <path d="M24 41 q6 5 12 0" stroke="#5a1f1a" strokeWidth="1.8" fill="none" />;
}

function Brows({ mood }: { mood: Mood }) {
  if (mood === "confused") return <path d="M19 26 l7 -2 M34 23 l7 3" stroke="#2a1a12" strokeWidth="1.8" />;
  if (mood === "wow") return <path d="M19 23 q4 -3 8 0 M33 23 q4 -3 8 0" stroke="#2a1a12" strokeWidth="1.8" fill="none" />;
  if (mood === "think") return <path d="M19 25 l8 1 M33 26 l8 -1" stroke="#2a1a12" strokeWidth="1.8" />;
  return <path d="M19 25 q4 -2 8 0 M33 25 q4 -2 8 0" stroke="#2a1a12" strokeWidth="1.6" fill="none" />;
}

export function Face({ who, mood = "smile" }: { who: Character; mood?: Mood }) {
  return (
    <svg viewBox="0 0 60 60" className={styles.face} aria-hidden>
      {who === "nuray" && <path d="M10 34 Q8 6 30 6 Q52 6 50 34 L52 56 L44 50 L44 30 L16 30 L16 50 L8 56 Z" fill="#2b1d17" />}
      <circle cx="30" cy="33" r="16" fill={SKIN[who]} stroke="#1b1410" strokeWidth="1.2" />
      {who === "nuray" && (
        <>
          <path d="M14 26 Q30 8 46 26 Q40 16 30 16 Q20 16 14 26 Z" fill="#2b1d17" />
          <path d="M13 22 Q30 12 47 22" stroke="#c0392b" strokeWidth="2.6" fill="none" />
        </>
      )}
      {who === "mustafa" && (
        <>
          <path d="M14 27 Q16 12 30 12 Q44 12 46 27 Q40 19 30 19 Q20 19 14 27 Z" fill="#1d1b26" />
          <path d="M12 24 Q30 6 48 24 L52 26 L30 22 Z" fill="#2f5bea" />
        </>
      )}
      {who === "ustaz" && (
        <>
          <path d="M14 28 Q14 14 30 14 Q46 14 46 28 Q42 20 30 20 Q18 20 14 28 Z" fill="#b9bcc6" />
          <path d="M18 40 Q30 58 42 40 Q36 48 30 48 Q24 48 18 40 Z" fill="#c9ccd4" />
          <circle cx="24" cy="31" r="4.4" fill="none" stroke="#1b1410" strokeWidth="1.3" />
          <circle cx="36" cy="31" r="4.4" fill="none" stroke="#1b1410" strokeWidth="1.3" />
          <path d="M28.4 31 h3.2" stroke="#1b1410" strokeWidth="1.3" />
        </>
      )}
      <circle cx="24" cy="31" r="1.7" fill="#1b1410" />
      <circle cx="36" cy="31" r="1.7" fill="#1b1410" />
      <Brows mood={mood} />
      {who !== "ustaz" || mood === "wow" ? <Mouth mood={mood} /> : <Mouth mood={mood === "smile" ? "smile" : "explain"} />}
      {mood === "think" && (
        <g fill="#fff" stroke="#1b1410" strokeWidth="1">
          <circle cx="50" cy="14" r="2" />
          <circle cx="55" cy="7" r="3" />
        </g>
      )}
    </svg>
  );
}

// ---------------- comic ----------------

export function ComicStrip({ comic }: { comic: Comic }) {
  return (
    <section className={styles.comic} aria-label={`Комикс: ${comic.title}`}>
      <p className={styles.comicTitle}>
        <span>КОМИКС</span> {comic.title}
      </p>
      <ol className={styles.panels}>
        {comic.panels.map((p, i) => (
          <li key={i} className={styles.panel} data-who={p.who} data-side={p.who === "mustafa" ? "right" : "left"}>
            {p.who === "narrator" ? (
              <p className={styles.caption}>{p.say}</p>
            ) : (
              <>
                <div className={styles.speaker}>
                  <Face who={p.who} mood={p.mood} />
                  <b>{CHARACTER_NAME[p.who]}</b>
                </div>
                <p className={styles.bubble}>{p.say}</p>
              </>
            )}
            {p.board && <p className={styles.board}>{p.board}</p>}
            <span className={styles.panelNo} aria-hidden>
              {i + 1}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ---------------- worked example that fades ----------------

/** Same order on every render, different per step: no reshuffling while the learner reads. */
function orderOf<T>(xs: T[], seed: number): T[] {
  return xs.map((x, i) => ({ x, k: ((i + 1) * 2654435761 + seed * 40503) % 997 })).sort((a, b) => a.k - b.k).map((o) => o.x);
}

export function WorkedBoard({ w }: { w: WorkedExample }) {
  const [shown, setShown] = useState(1);
  const [missed, setMissed] = useState<Record<number, string>>({});
  const current = w.steps[shown];
  const learnerTurn = shown < w.steps.length && shown >= w.fadeFrom;
  const options = useMemo(() => (current ? orderOf([current.line, ...(current.wrong ?? [])], shown) : []), [current, shown]);
  const done = shown >= w.steps.length;
  return (
    <section className={styles.worked} aria-label="Тақтада шығару">
      <p className={styles.workedKicker}>ТАҚТАДА ШЫҒАРУ</p>
      <p className={styles.problem}>{w.problem}</p>
      <ol className={styles.steps}>
        {w.steps.slice(0, shown).map((s, i) => (
          <li key={i} data-mine={i >= w.fadeFrom || undefined}>
            <code>{s.line}</code>
            <span>{s.why}</span>
          </li>
        ))}
      </ol>
      {!done && !learnerTurn && (
        <button type="button" className={styles.chalkBtn} onClick={() => setShown((n) => n + 1)}>
          Ұстаз: келесі қадам
        </button>
      )}
      {learnerTurn && current && (
        <div className={styles.turn} role="group" aria-label="Келесі қадамды таңда">
          <p>Енді сен: келесі жол қайсы?</p>
          {options.map((o) => (
            <button
              key={o}
              type="button"
              className={styles.option}
              data-wrong={missed[shown] === o || undefined}
              onClick={() => {
                if (o === current.line) setShown((n) => n + 1);
                else setMissed((m) => ({ ...m, [shown]: o }));
              }}
            >
              <code>{o}</code>
            </button>
          ))}
          {missed[shown] && (
            <p className={styles.nudge} role="status">
              Бұл жол келмейді. Ойлан: {current.why}
            </p>
          )}
        </div>
      )}
      {done && (
        <p className={styles.solved} role="status">
          Шешім дайын. Соңғы {w.steps.length - w.fadeFrom} қадамды өзің таптың.
        </p>
      )}
    </section>
  );
}

// ---------------- error hunt ----------------

export function ErrorHuntBoard({ h }: { h: ErrorHunt }) {
  const [tried, setTried] = useState<number[]>([]);
  const found = tried.includes(h.wrong);
  return (
    <section className={styles.hunt} aria-label="Қатені тап">
      <p className={styles.workedKicker}>ҚАТЕНІ ТАП</p>
      <p className={styles.problem}>{h.problem}</p>
      <p className={styles.huntHint}>Мустафа есепті шығарды, бірақ бір жолда қателесті. Сол жолды бас.</p>
      <ol className={styles.huntLines}>
        {h.lines.map((l, i) => (
          <li key={i}>
            <button type="button" disabled={found} data-state={tried.includes(i) ? (i === h.wrong ? "wrong" : "fine") : undefined} onClick={() => setTried((t) => (t.includes(i) ? t : [...t, i]))}>
              <code>{l}</code>
            </button>
          </li>
        ))}
      </ol>
      {(found || tried.length > 0) && (
        <div className={styles.huntVerdict} role="status">
          {found ? (
            <>
              <strong>Таптың: {h.wrong + 1}-жол.</strong> {h.why}
              <p>
                Дұрысы: <code>{h.fix}</code>
              </p>
            </>
          ) : (
            <span>Бұл жол дұрыс. Іздеуді жалғастыр.</span>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * Салыстыр: two cases side by side that differ in one thing. The learner names the
 * difference that matters; a wrong pick says what it does not explain, and they try again.
 */
export function ContrastBoard({ c }: { c: Contrast }) {
  const [tried, setTried] = useState<number[]>([]);
  const order = useMemo(() => optionOrder(c.question, c.options.length), [c.question, c.options.length]);
  const right = tried.includes(c.answer);
  const last = tried.at(-1);
  return (
    <section className={styles.contrast} aria-label={`Салыстыр: ${c.title}`}>
      <p className={styles.contrastKicker}>САЛЫСТЫР</p>
      <p className={styles.problem}>{c.title}</p>
      <div className={styles.contrastCases}>
        {[c.a, c.b].map((k, i) => (
          <article key={i} className={styles.contrastCase} aria-label={k.label}>
            <h4>{k.label}</h4>
            {k.lines.map((l) => (
              <code key={l}>{l}</code>
            ))}
            <p>{k.result}</p>
          </article>
        ))}
      </div>
      <p className={styles.contrastQ}>{c.question}</p>
      <div className={styles.contrastOptions} role="group" aria-label="Айырманың себебі">
        {order.map((i) => (
          <button key={i} type="button" disabled={right} data-state={tried.includes(i) ? (i === c.answer ? "right" : "wrong") : undefined} onClick={() => setTried((t) => (t.includes(i) ? t : [...t, i]))}>
            {c.options[i]}
          </button>
        ))}
      </div>
      {last !== undefined && (
        <p className={styles.contrastVerdict} role="status" data-right={right}>
          {right ? (
            <>
              <strong>Дәл таптың.</strong> {c.why}
            </>
          ) : (
            "Бұл екеуінде бірдей ғой: айырманы түсіндірмейді. Екі жағдайдың сандарын қатар қойып қара."
          )}
        </p>
      )}
    </section>
  );
}
