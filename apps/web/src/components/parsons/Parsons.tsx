"use client";

import { useEffect, useState } from "react";
import { findLab } from "@/lib/catalog";
import { PARSONS, check, hint, score, shuffled, tileText, type ParsonsPuzzle, type Tile, type Verdict } from "@/lib/parsons";
import { OyuRule } from "../lab/Oyu";
import { FilmHeader } from "../film/FilmHeader";
import film from "../film/film.module.css";
import styles from "./parsons.module.css";

const SAVE = "inside-tech:parsons";
type Results = Record<string, number>;

function load(): Results {
  try {
    const v = JSON.parse(localStorage.getItem(SAVE) ?? "{}");
    if (!v || typeof v !== "object") return {};
    return Object.fromEntries(Object.entries(v).filter(([k, n]) => PARSONS.some((p) => p.id === k) && typeof n === "number" && n >= 1 && n <= 3)) as Results;
  } catch {
    return {};
  }
}

function Board({ p, onSolved }: { p: ParsonsPuzzle; onSolved(points: number): void }) {
  const [tray, setTray] = useState<Tile[]>(() => shuffled(p, 1));
  const [stick, setStick] = useState<Tile[]>([]);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [checks, setChecks] = useState(0);
  const [hints, setHints] = useState(0);
  const solved = verdict?.correct ?? false;

  const edit = (next: Tile[]) => {
    setStick(next);
    setVerdict(null);
  };
  const take = (t: Tile) => {
    setTray((x) => x.filter((y) => y !== t));
    edit([...stick, t]);
  };
  const back = (t: Tile) => {
    setTray((x) => [...x, t]);
    edit(stick.filter((y) => y !== t));
  };
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= stick.length) return;
    const next = [...stick];
    [next[i], next[j]] = [next[j]!, next[i]!];
    edit(next);
  };
  const doCheck = () => {
    const v = check(p, stick);
    setVerdict(v);
    setChecks((c) => c + 1);
    if (v.correct) onSolved(score(checks + 1, hints));
  };
  const doHint = () => {
    const next = hint(p, stick);
    setTray((x) => [...x.filter((t) => !next.includes(t)), ...stick.filter((t) => !next.includes(t))]);
    setHints((h) => h + 1);
    edit(next);
  };

  const line = (t: Tile) => <code className={p.kind === "code" ? styles.mono : styles.prose}>{tileText(p, t)}</code>;

  return (
    <article className={styles.board} aria-label={p.title}>
      <header className={styles.boardHead}>
        <p className={styles.meta}>
          {findLab(p.labId)?.title} · {p.kind === "code" ? "код" : "процесс"} · {p.lines.length} жол, біреуі артық
        </p>
        <h2>{p.title}</h2>
        <p className={styles.task}>{p.task}</p>
      </header>

      <div className={styles.cases}>
        <section className={styles.tray} aria-label="Касса">
          <h3>Касса</h3>
          {tray.length === 0 && <p className={styles.empty}>Бос</p>}
          <ul>
            {tray.map((t) => (
              <li key={t}>
                <button type="button" className={styles.slug} disabled={solved} onClick={() => take(t)} aria-label={`Тізгішке: ${tileText(p, t).trim()}`}>
                  {line(t)}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.stick} aria-label="Тізгіш">
          <h3>Тізгіш</h3>
          {stick.length === 0 && <p className={styles.empty}>Кассадан жолды бас: ол осында тізіледі</p>}
          <ol>
            {stick.map((t, i) => {
              const state = !verdict ? undefined : i < verdict.prefix ? "ok" : i === verdict.prefix ? "bad" : "after";
              return (
                <li key={t} className={styles.set} data-state={state}>
                  {line(t)}
                  {!solved && (
                    <span className={styles.tools}>
                      <button type="button" aria-label={`Жоғары: ${tileText(p, t).trim()}`} disabled={i === 0} onClick={() => move(i, -1)}>
                        ↑
                      </button>
                      <button type="button" aria-label={`Төмен: ${tileText(p, t).trim()}`} disabled={i === stick.length - 1} onClick={() => move(i, 1)}>
                        ↓
                      </button>
                      <button type="button" aria-label={`Кассаға қайтару: ${tileText(p, t).trim()}`} onClick={() => back(t)}>
                        ×
                      </button>
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      </div>

      {!solved && (
        <div className={styles.actions}>
          <button type="button" className={styles.press} disabled={stick.length === 0} onClick={doCheck}>
            Басып шығару: тексеру
          </button>
          <button type="button" className={styles.ghost} onClick={doHint}>
            Бір жолды қойып бер (−1 ұпай)
          </button>
          <span className={styles.counter}>
            Тексеру: {checks} · Көмек: {hints}
          </span>
        </div>
      )}

      {verdict && (
        <div className={styles.verdict} role="status" data-ok={verdict.correct}>
          {verdict.correct ? (
            <>
              <strong>Дұрыс тізілді. {score(checks, hints)} ұпай.</strong>
              <p>{p.explain}</p>
              {p.distractors.map((d) => (
                <p key={d.text} className={styles.why}>
                  <s>{d.text.trim()}</s> {d.why}
                </p>
              ))}
            </>
          ) : verdict.distractor !== null && stick.indexOf(-verdict.distractor - 1) <= verdict.prefix ? (
            <>
              <strong>{verdict.prefix + 1}-жол бұл бағдарламаға жатпайды.</strong>
              <p>{p.distractors[verdict.distractor]!.why}</p>
            </>
          ) : (
            <>
              <strong>
                Алғашқы {verdict.prefix} жол дұрыс, {verdict.prefix + 1}-жолдан бастап рет бұзылды.
              </strong>
              <p>{verdict.missing > 0 ? `Әлі ${verdict.missing} жол кассада жатыр.` : "Белгіленген жолдан бастап қайта ойлан: оған дейін не болуы керек?"}</p>
            </>
          )}
        </div>
      )}
    </article>
  );
}

/** Парсонс есептері: rebuild a working program or process from shuffled lines, one per lab. */
export function Parsons() {
  const [current, setCurrent] = useState(PARSONS[0]!.id);
  const [results, setResults] = useState<Results>({});
  useEffect(() => setResults(load()), []);
  const p = PARSONS.find((x) => x.id === current)!;
  const total = Object.values(results).reduce((a, b) => a + b, 0);
  const idx = PARSONS.indexOf(p);

  const solved = (points: number) => {
    const next = { ...results, [p.id]: Math.max(points, results[p.id] ?? 0) };
    setResults(next);
    try {
      localStorage.setItem(SAVE, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  };

  return (
    <div className={film.page}>
      <FilmHeader />
      <main className={styles.page}>
        <header className={styles.head}>
          <p className={styles.issue}>ПАРСОНС ЕСЕПТЕРІ · БАСПАХАНА</p>
          <h1 className={styles.title}>Ретке келтір</h1>
          <OyuRule className={styles.rule} />
          <p className={styles.lede}>Дұрыс бағдарламаның жолдары кассаға шашылып кетті, араларында бір жалған жол бар. Оларды тізгішке дұрыс ретпен жина. Жазуды нөлден бастамайсың, бірақ әр жолдың орнын түсінбей тізе алмайсың: бұл оқудың ең тиімді аралық сатысы.</p>
        </header>

        <nav className={styles.picker} aria-label="Есептер">
          {PARSONS.map((x, i) => (
            <button key={x.id} type="button" aria-current={x.id === current ? "true" : undefined} onClick={() => setCurrent(x.id)}>
              <span>{i + 1}</span> {findLab(x.labId)?.title}
              {results[x.id] ? <b aria-label={`${results[x.id]} ұпай`}>{"★".repeat(results[x.id]!)}</b> : null}
            </button>
          ))}
        </nav>
        <p className={styles.tally} aria-label="Ұпай">
          {Object.keys(results).length}/{PARSONS.length} есеп · {total}/{PARSONS.length * 3} ұпай
        </p>

        <Board key={p.id} p={p} onSolved={solved} />

        <div className={styles.nav}>
          <button type="button" className={styles.ghost} disabled={idx === 0} onClick={() => setCurrent(PARSONS[idx - 1]!.id)}>
            Алдыңғы есеп
          </button>
          <button type="button" className={styles.ghost} disabled={idx === PARSONS.length - 1} onClick={() => setCurrent(PARSONS[idx + 1]!.id)}>
            Келесі есеп
          </button>
        </div>
      </main>
    </div>
  );
}
