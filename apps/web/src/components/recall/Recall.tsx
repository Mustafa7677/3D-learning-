"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { LessonProgress } from "@inside-tech/lesson-engine";
import { recordActivity } from "@/lib/activity";
import { openLabs as CATALOG } from "@/lib/catalog";
import { clock } from "@/lib/focus";
import { lessonEntries, type LessonEntry } from "@/lib/lessons";
import { progressStore } from "@/lib/progress";
import { checkRecall, keyIdeas, loadRecall, nextGapDays, record, saveRecall, suggestions, type RecallRecord, type RecallResult } from "@/lib/recall";
import { FilmHeader } from "../film/FilmHeader";
import film from "../film/film.module.css";
import styles from "./recall.module.css";

type Phase = "choose" | "write" | "result";
const WRITE_MS = 3 * 60000;
const MIN_TEXT = 20;

/** The learner's own page with the recalled terms marked. */
function marked(text: string, r: RecallResult): ReactNode {
  const stems = [...new Set(r.found.flatMap((k) => k.groups.flat()).filter((w) => w.length >= 3))].sort((a, b) => b.length - a.length);
  if (!stems.length) return text;
  const esc = stems.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  // Mark the whole word a stem starts, not only the stem.
  const re = new RegExp(`((?:${esc.join("|")})[^\\s.,;:!?()«»]*)`, "gi");
  return text.split(re).map((part, i) => (i % 2 === 1 ? <mark key={i}>{part}</mark> : part));
}

/** Бос парақ: write what you remember of a topic, then see which key ideas came back. */
export function Recall() {
  const [phase, setPhase] = useState<Phase>("choose");
  const [progress, setProgress] = useState<LessonProgress[] | null>(null);
  const [history, setHistory] = useState<RecallRecord[]>([]);
  const [entry, setEntry] = useState<LessonEntry | null>(null);
  const [labPick, setLabPick] = useState(CATALOG[0]!.id);
  const [text, setText] = useState("");
  const [started, setStarted] = useState(0);
  const [now, setNow] = useState(0);
  const [result, setResult] = useState<RecallResult | null>(null);
  const [short, setShort] = useState(false);

  useEffect(() => {
    setHistory(loadRecall());
    void progressStore()
      .list()
      .catch(() => [] as LessonProgress[])
      .then(setProgress);
  }, []);
  useEffect(() => {
    if (phase !== "write") return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [phase]);

  const studied = useMemo(() => (progress ?? []).filter((p) => Object.values(p.completed).some((x) => x.length > 0) || p.completedAt).map((p) => ({ lessonId: p.lessonId, updatedAt: p.updatedAt })), [progress]);
  const sugg = useMemo(() => suggestions(lessonEntries, studied, history, Date.now()).slice(0, 6), [studied, history]);
  const ideas = useMemo(() => (entry ? keyIdeas(entry.lesson) : []), [entry]);

  const begin = (e: LessonEntry) => {
    setEntry(e);
    setText("");
    setResult(null);
    setShort(false);
    setStarted(Date.now());
    setNow(Date.now());
    setPhase("write");
  };

  const check = () => {
    if (!entry) return;
    if (text.trim().length < MIN_TEXT) {
      setShort(true);
      return;
    }
    const r = checkRecall(ideas, text);
    setResult(r);
    const rec = record(entry.lesson.id, r.share, Date.now());
    const all = [...history, rec];
    setHistory(all);
    saveRecall(all);
    recordActivity("review");
    setPhase("result");
  };

  const left = Math.max(0, WRITE_MS - (now - started));
  const pct = result ? Math.round(result.share * 100) : 0;
  const labTitle = (id: string) => CATALOG.find((l) => l.id === id)?.title ?? id;
  const recent = [...history].reverse().slice(0, 8);

  return (
    <div className={film.page}>
      <FilmHeader />
      <main className={styles.page}>
        {phase === "choose" && (
          <>
            <header className={styles.head}>
              <p className={styles.kicker}>БОС ПАРАҚ · ЕРКІН ЕСКЕ ТҮСІРУ</p>
              <h1 className={styles.title}>Есіңде не қалды?</h1>
              <p className={styles.lede}>
                Оқығаныңды қайта оқу жеңіл, бірақ аз береді. Ең мықты тәсіл: кітапты жауып, есіңде қалғанның бәрін ақ параққа жазу. Ми әр еске түсірген сайын білімді бекітеді. Сосын қай негізгі ойлар келмегенін көрсетеміз, оларды қайта қарап, келесі жолы қашан қайталайтыныңды айтамыз.
              </p>
            </header>

            <section className={styles.pick} aria-label="Ұсынылған тақырыптар">
              <h2 className={styles.h2}>Бүгін еске түсір</h2>
              {progress === null ? (
                <p className={styles.muted}>Жүктелуде…</p>
              ) : sugg.length === 0 ? (
                <p className={styles.muted}>Әзірге оқылған тақырып жоқ не бәрі ерте қайталанған. Төменнен кез келген сабақты таңда, немесе алдымен бір сабақ өт.</p>
              ) : (
                <ul className={styles.cards}>
                  {sugg.map((s) => (
                    <li key={s.entry.lesson.id}>
                      <button type="button" onClick={() => begin(s.entry)} aria-label={`Еске түсіру: ${s.entry.lesson.title}`}>
                        <span className={styles.cardLab}>{labTitle(s.entry.labId)}</span>
                        <strong>{s.entry.lesson.title}</strong>
                        <span className={styles.cardMeta}>{s.due ? `Қайталау уақыты келді · соңғысы ${Math.round((s.last?.share ?? 0) * 100)}%` : "Әлі еске түсірілмеген"}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className={styles.pick} aria-label="Кез келген тақырып">
              <h2 className={styles.h2}>Немесе кез келген тақырып</h2>
              <div className={styles.labs} role="group" aria-label="Зертхана">
                {CATALOG.map((l) => (
                  <button key={l.id} type="button" aria-pressed={labPick === l.id} onClick={() => setLabPick(l.id)}>
                    {l.title}
                  </button>
                ))}
              </div>
              <ul className={styles.lessons}>
                {lessonEntries
                  .filter((e) => e.labId === labPick)
                  .map((e) => (
                    <li key={e.lesson.id}>
                      <button type="button" onClick={() => begin(e)}>
                        <span>{e.lesson.order}</span> {e.lesson.title}
                      </button>
                    </li>
                  ))}
              </ul>
            </section>
          </>
        )}

        {phase === "write" && entry && (
          <section className={styles.write} aria-label="Бос парақ">
            <div className={styles.writeHead}>
              <div>
                <p className={styles.kicker}>{labTitle(entry.labId)}</p>
                <h1 className={styles.topic}>{entry.lesson.title}</h1>
              </div>
              <p className={styles.timer} data-over={left === 0 || undefined} role="timer" aria-label="Жазу уақыты">
                {left > 0 ? clock(left) : "Уақыт бітті, бірақ жалғастыра бер"}
              </p>
            </div>
            <p className={styles.prompts}>Қарамай жаз: анықтамалар, формулалар, мысалдар, «неге солай?». Толық сөйлем міндетті емес, сөздер мен байланыстар да жарайды.</p>
            <label className="visually-hidden" htmlFor="page">
              Есіңде қалғанның бәрі
            </label>
            <textarea id="page" className={styles.paper} value={text} onChange={(e) => (setText(e.target.value), setShort(false))} placeholder="Есіңде қалғанның бәрі…" autoFocus spellCheck={false} />
            <div className={styles.writeFoot}>
              <span className={styles.muted}>{text.trim() ? text.trim().split(/\s+/).length : 0} сөз</span>
              {short && <span className={styles.warn}>Тағы бірнеше сөз жаз: еске түсірудің өзі пайдалы.</span>}
              <button type="button" className={styles.ghost} onClick={() => setPhase("choose")}>
                Басқа тақырып
              </button>
              <button type="button" className={styles.primary} onClick={check}>
                Тексеру
              </button>
            </div>
          </section>
        )}

        {phase === "result" && entry && result && (
          <section className={styles.result} aria-label="Нәтиже">
            <div className={styles.resultHead}>
              <div className={styles.score} style={{ ["--p" as string]: `${pct}%` }} role="img" aria-label={`Еске түсірілді: ${result.found.length}/${ideas.length}`}>
                <strong>{pct}%</strong>
                <span>
                  {result.found.length}/{ideas.length} ой
                </span>
              </div>
              <div>
                <p className={styles.kicker}>{entry.lesson.title}</p>
                <h1 className={styles.topic}>{pct >= 80 ? "Тамаша, тақырып есіңде." : pct >= 50 ? "Негізі есіңде, бірақ саңылаулар бар." : "Көп нәрсе ұмытылған: бұл қалыпты, енді бекітеміз."}</h1>
                <p className={styles.next}>
                  Келесі еске түсіру: <b>{nextGapDays(result.share)} күннен кейін</b>. Аралық ұзарған сайын білім берік болады.
                </p>
              </div>
            </div>

            <div className={styles.columns}>
              <div>
                <h2 className={styles.h2}>Есіңе түскені</h2>
                <ul className={styles.found}>
                  {result.found.map((k) => (
                    <li key={k.label}>✓ {k.label}</li>
                  ))}
                  {result.found.length === 0 && <li className={styles.muted}>Әзірге ешбірі. Төмендегі ойларды оқып шық.</li>}
                </ul>
                <h2 className={styles.h2}>Сенің парағың</h2>
                <p className={styles.mine}>{marked(text, result)}</p>
              </div>
              <div>
                <h2 className={styles.h2}>Келмегені: қайта қара</h2>
                <ul className={styles.missed}>
                  {result.missed.map((k) => (
                    <li key={k.label}>
                      <strong>{k.label}</strong>
                      <span>«{k.stepTitle}» кезеңінде</span>
                    </li>
                  ))}
                  {result.missed.length === 0 && <li className={styles.muted}>Бәрі келді. Келесі жолы сабақты көрмей қиын есеп шығарып көр.</li>}
                </ul>
                <Link className={styles.primary} href={`/labs/${entry.labId}/${entry.lesson.id}`}>
                  Сабақты қайта қарау
                </Link>
              </div>
            </div>
            <div className={styles.writeFoot}>
              <button type="button" className={styles.ghost} onClick={() => setPhase("choose")}>
                Басқа тақырып
              </button>
              <button type="button" className={styles.ghost} onClick={() => begin(entry)}>
                Осы тақырыпты қайта жазу
              </button>
            </div>
          </section>
        )}

        {recent.length > 0 && phase !== "write" && (
          <section className={styles.history} aria-label="Еске түсіру тарихы">
            <h2 className={styles.h2}>Соңғы парақтар</h2>
            <ul>
              {recent.map((r) => {
                const e = lessonEntries.find((x) => x.lesson.id === r.lessonId);
                return (
                  <li key={`${r.lessonId}-${r.at}`}>
                    <span className={styles.bar}>
                      <span style={{ width: `${Math.round(r.share * 100)}%` }} />
                    </span>
                    <span>{e?.lesson.title ?? r.lessonId}</span>
                    <b>{Math.round(r.share * 100)}%</b>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}

