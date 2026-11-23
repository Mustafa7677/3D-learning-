"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LessonProgress } from "@inside-tech/lesson-engine";
import { recordActivity } from "@/lib/activity";
import { openLabs } from "@/lib/catalog";
import { SIGN_LABEL, loadTeach, review, saveTeach, verdict, type Review, type Sign, type TeachRecord } from "@/lib/feynman";
import { lessonEntries, type LessonEntry } from "@/lib/lessons";
import { progressStore } from "@/lib/progress";
import { Face } from "../lab/StepMedia";
import { FilmHeader } from "../film/FilmHeader";
import film from "../film/film.module.css";
import styles from "./teach.module.css";

type Msg = { who: "mustafa" | "me" | "ustaz"; text: string; questions?: string[]; review?: Review };
const SIGNS: Sign[] = ["ideas", "why", "example", "simple"];
const MAX_ROUNDS = 3;

/** Мустафаға түсіндір: the Feynman technique as a conversation with a curious friend. */
export function Teach() {
  const [entry, setEntry] = useState<LessonEntry | null>(null);
  const [studied, setStudied] = useState<string[]>([]);
  const [lab, setLab] = useState(openLabs[0]!.id);
  const [log, setLog] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [rounds, setRounds] = useState(0);
  const [history, setHistory] = useState<TeachRecord[]>([]);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHistory(loadTeach());
    void progressStore()
      .list()
      .catch(() => [] as LessonProgress[])
      .then((ps) => setStudied(ps.filter((p) => Object.values(p.completed).some((x) => x.length > 0) || p.completedAt).sort((a, b) => b.updatedAt - a.updatedAt).map((p) => p.lessonId)));
  }, []);
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: "nearest" });
  }, [log]);

  const last = [...log].reverse().find((m) => m.review)?.review;
  const done = (last?.score ?? 0) === 4 || rounds >= MAX_ROUNDS;
  const studiedEntries = useMemo(() => studied.map((id) => lessonEntries.find((e) => e.lesson.id === id)).filter(Boolean).slice(0, 6) as LessonEntry[], [studied]);

  const begin = (e: LessonEntry) => {
    setEntry(e);
    setRounds(0);
    setText("");
    setLog([{ who: "mustafa", text: `Маған «${e.lesson.title}» туралы түсіндірші. Мен бұл туралы ештеңе білмеймін! Қарапайым сөзбен, досыңа айтқандай.` }]);
  };

  const send = () => {
    if (!entry || text.trim().length < 10) return;
    const r = review(entry.lesson as never, text);
    const round = rounds + 1;
    setRounds(round);
    const reply: Msg = { who: "mustafa", text: verdict(r.score), questions: r.questions, review: r };
    const next: Msg[] = [...log, { who: "me", text: text.trim() }, reply];
    if (r.score === 4 || round >= MAX_ROUNDS) {
      next.push({
        who: "ustaz",
        text:
          r.score === 4
            ? "Тамаша. Фейнман әдісі осы: қарапайым айта алсаң, шын түсінгенсің. Әр «неге?» сұрағы білімді тереңдетті."
            : "Үш айналым болды. Мустафаның сұрақтары: сенің біліміңдегі саңылаулар. Сабаққа қайта қарап, кейін тағы көр.",
      });
      const rec: TeachRecord = { lessonId: entry.lesson.id, at: Date.now(), score: r.score, rounds: round };
      const all = [...history, rec];
      setHistory(all);
      saveTeach(all);
      recordActivity("review");
    }
    setLog(next);
  };

  const mood = (m: Msg) => {
    const s = m.review?.score;
    return s === undefined ? "confused" : s === 4 ? "wow" : s >= 2 ? "think" : "confused";
  };

  return (
    <div className={film.page}>
      <FilmHeader />
      <main className={styles.page}>
        {!entry ? (
          <>
            <header className={styles.head}>
              <p className={styles.kicker}>ФЕЙНМАН ӘДІСІ · СҰРАҚТЫ ТҮСІНДІРУ</p>
              <h1 className={styles.title}>Мустафаға түсіндір</h1>
              <p className={styles.lede}>Шын түсінгеніңді тексерудің ең сенімді жолы: ештеңе білмейтін досыңа қарапайым түсіндіру. Мустафа әр саңылауды табады: «Неге?», «Мысал келтірші?», «Ал мына сөз не?». Сен толықтырасың, ол қайта тыңдайды.</p>
              <ul className={styles.rules} aria-label="Мустафа нені тексереді">
                {SIGNS.map((s) => (
                  <li key={s}>{SIGN_LABEL[s]}</li>
                ))}
              </ul>
            </header>
            {studiedEntries.length > 0 && (
              <section className={styles.pick} aria-label="Сен оқыған тақырыптар">
                <h2>Сен оқыған тақырыптар</h2>
                <div className={styles.cards}>
                  {studiedEntries.map((e) => (
                    <button key={e.lesson.id} type="button" onClick={() => begin(e)} aria-label={`Түсіндіру: ${e.lesson.title}`}>
                      <small>{openLabs.find((l) => l.id === e.labId)?.title}</small>
                      {e.lesson.title}
                    </button>
                  ))}
                </div>
              </section>
            )}
            <section className={styles.pick} aria-label="Кез келген тақырып">
              <h2>Кез келген тақырып</h2>
              <div className={styles.labs} role="group" aria-label="Зертхана">
                {openLabs.map((l) => (
                  <button key={l.id} type="button" aria-pressed={lab === l.id} onClick={() => setLab(l.id)}>
                    {l.title}
                  </button>
                ))}
              </div>
              <ul className={styles.lessons}>
                {lessonEntries
                  .filter((e) => e.labId === lab)
                  .map((e) => (
                    <li key={e.lesson.id}>
                      <button type="button" onClick={() => begin(e)}>
                        <span>{e.lesson.order}</span> {e.lesson.title}
                      </button>
                    </li>
                  ))}
              </ul>
            </section>
            {history.length > 0 && (
              <section className={styles.pick} aria-label="Түсіндірген тақырыптарым">
                <h2>Түсіндірген тақырыптарым</h2>
                <ul className={styles.past}>
                  {[...history]
                    .reverse()
                    .slice(0, 8)
                    .map((h) => (
                      <li key={`${h.lessonId}-${h.at}`}>
                        <span>{lessonEntries.find((e) => e.lesson.id === h.lessonId)?.lesson.title ?? h.lessonId}</span>
                        <b aria-label={`${h.score} белгі төрттен`}>{"●".repeat(h.score)}{"○".repeat(4 - h.score)}</b>
                      </li>
                    ))}
                </ul>
              </section>
            )}
          </>
        ) : (
          <section className={styles.chat} aria-label={`Мустафаға түсіндіру: ${entry.lesson.title}`}>
            <div className={styles.chatHead}>
              <button type="button" className={styles.ghost} onClick={() => setEntry(null)}>
                ← Тақырыптар
              </button>
              <p>
                <b>{entry.lesson.title}</b> · {rounds}/{MAX_ROUNDS} айналым
              </p>
            </div>
            <ol className={styles.log} aria-live="polite">
              {log.map((m, i) => (
                <li key={i} className={styles.msg} data-who={m.who}>
                  {m.who !== "me" && (
                    <span className={styles.avatar}>
                      <Face who={m.who === "ustaz" ? "ustaz" : "mustafa"} mood={m.who === "ustaz" ? "smile" : mood(m)} />
                      <b>{m.who === "ustaz" ? "Ұстаз" : "Мустафа"}</b>
                    </span>
                  )}
                  <div className={styles.bubble}>
                    <p>{m.text}</p>
                    {m.questions && m.questions.length > 0 && (
                      <ul className={styles.questions}>
                        {m.questions.map((q) => (
                          <li key={q}>{q}</li>
                        ))}
                      </ul>
                    )}
                    {m.review && (
                      <ul className={styles.signs} aria-label="Белгілер">
                        {SIGNS.map((s) => (
                          <li key={s} data-ok={m.review!.signs[s]}>
                            {m.review!.signs[s] ? "✓" : "○"} {SIGN_LABEL[s]}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            <div ref={end} />
            {!done ? (
              <div className={styles.compose}>
                <label htmlFor="explain">{rounds === 0 ? "Сенің түсіндірмең" : "Толықтыр: Мустафаның сұрақтарына жауап қос"}</label>
                <textarea id="explain" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="Мысалы: «Бұл деген… Себебі… Мысалы…»" />
                <div className={styles.composeRow}>
                  <span className={styles.muted}>{text.trim() ? text.trim().split(/\s+/).length : 0} сөз</span>
                  <button type="button" className={styles.primary} disabled={text.trim().length < 10} onClick={send}>
                    Мустафаға айту
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.after}>
                {last && last.missed.length > 0 && (
                  <p>
                    Әлі айтылмаған ойлар: <b>{last.missed.slice(0, 4).map((k) => k.label).join(", ")}</b>
                  </p>
                )}
                <div className={styles.composeRow}>
                  <Link href={`/labs/${entry.labId}/${entry.lesson.id}`} className={styles.ghost}>
                    Сабақты қайта қарау
                  </Link>
                  <button type="button" className={styles.primary} onClick={() => setEntry(null)}>
                    Басқа тақырыпты түсіндіру
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
