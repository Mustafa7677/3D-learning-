"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { recordActivity } from "@/lib/activity";
import {
  BREAK_MIN,
  DURATIONS,
  FOCUS_EVENT,
  clock,
  finish,
  focusWeek,
  loadActive,
  loadHistory,
  newSession,
  pause,
  remainingMs,
  resume,
  saveActive,
  saveToHistory,
  type FocusSession,
} from "@/lib/focus";
import { lessonEntries } from "@/lib/lessons";
import { dailyProblem } from "@/lib/problems";
import { progressStore } from "@/lib/progress";
import { nextLesson } from "@/lib/today";
import { FilmHeader } from "../film/FilmHeader";
import film from "../film/film.module.css";
import styles from "./focus.module.css";

type Phase = "setup" | "run" | "reflect" | "rest";
const RATINGS = ["Шашыраңқы", "Әлсіз", "Орташа", "Жақсы", "Терең"];

/** Brown noise made in the browser (no files): white noise run through a leaky integrator. */
function useBrownNoise(on: boolean) {
  const ctx = useRef<AudioContext | null>(null);
  useEffect(() => {
    if (!on) return;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ac = new Ctx();
    ctx.current = ac;
    const len = ac.sampleRate * 4;
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 3.5;
    }
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const gain = ac.createGain();
    gain.gain.value = 0.0001;
    gain.gain.exponentialRampToValueAtTime(0.35, ac.currentTime + 1.5);
    src.connect(gain).connect(ac.destination);
    src.start();
    return () => {
      void ac.close();
      ctx.current = null;
    };
  }, [on]);
}

/** A soft two-note bell at the end of a session. */
function chime() {
  try {
    const ac = new AudioContext();
    [523.25, 783.99].forEach((f, i) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.frequency.value = f;
      o.type = "sine";
      g.gain.setValueAtTime(0.0001, ac.currentTime + i * 0.35);
      g.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + i * 0.35 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + i * 0.35 + 1.6);
      o.connect(g).connect(ac.destination);
      o.start(ac.currentTime + i * 0.35);
      o.stop(ac.currentTime + i * 0.35 + 1.7);
    });
    setTimeout(() => void ac.close(), 2600);
  } catch {
    /* no audio */
  }
}

function BigRing({ left, total, paused, children }: { left: number; total: number; paused: boolean; children: React.ReactNode }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const f = total > 0 ? 1 - left / total : 1;
  return (
    <div className={styles.big} data-paused={paused || undefined}>
      <svg viewBox="0 0 100 100" aria-hidden>
        <circle cx="50" cy="50" r={r} className={styles.bigTrack} />
        <circle cx="50" cy="50" r={r} className={styles.bigBar} strokeDasharray={`${c * f} ${c}`} />
      </svg>
      <div className={styles.bigText}>{children}</div>
    </div>
  );
}

/** Фокус бөлмесі: intention, a timer with a place for stray thoughts, one sentence learned, a break. */
export function Focus() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [s, setS] = useState<FocusSession | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [intention, setIntention] = useState("");
  const [minutes, setMinutes] = useState<number>(25);
  const [ideas, setIdeas] = useState<string[]>([]);
  const [noise, setNoise] = useState(false);
  const [thought, setThought] = useState("");
  const [learned, setLearned] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [short, setShort] = useState(false);
  const [rest, setRest] = useState<{ until: number; min: number } | null>(null);
  const [history, setHistory] = useState<FocusSession[]>([]);
  const rang = useRef(false);
  useBrownNoise(noise && phase === "run" && !s?.pausedAt);

  // Pick up a running session, and suggestions from today's plan.
  useEffect(() => {
    const a = loadActive();
    if (a) {
      setS(a);
      setPhase(a.endedAt ? "reflect" : "run");
    }
    setHistory(loadHistory());
    const t = new Date();
    void progressStore()
      .list()
      .catch(() => [])
      .then((progress) => {
        const n = nextLesson(lessonEntries, progress);
        setIdeas([...(n ? [`Сабақ: ${n.entry.lesson.title}`] : []), `Қиын есеп: ${dailyProblem(t).title}`, "Қателер дәптерін қайталау"]);
      });
    const sync = () => setHistory(loadHistory());
    window.addEventListener(FOCUS_EVENT, sync);
    return () => window.removeEventListener(FOCUS_EVENT, sync);
  }, []);

  useEffect(() => {
    if (phase !== "run" && phase !== "rest") return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [phase]);

  const update = useCallback((next: FocusSession) => {
    setS(next);
    saveActive(next);
  }, []);

  // Leaving the tab during focus is counted, gently: only a real absence (hidden for more than
  // a few seconds, then back). Going to a lesson to study unloads this page and is not counted.
  useEffect(() => {
    if (phase !== "run") return;
    let hiddenAt = 0;
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      const away = hiddenAt ? Date.now() - hiddenAt : 0;
      hiddenAt = 0;
      const cur = loadActive();
      if (away > 3000 && cur && !cur.pausedAt && !cur.endedAt) update({ ...cur, leaves: cur.leaves + 1 });
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [phase, update]);

  const left = s ? remainingMs(s, now) : 0;
  const end = useCallback(() => {
    if (!s) return;
    const done = finish(s, Date.now());
    update(done);
    setPhase("reflect");
  }, [s, update]);

  useEffect(() => {
    if (phase === "run" && s && !s.pausedAt && left === 0) {
      if (!rang.current) {
        rang.current = true;
        chime();
      }
      end();
    }
  }, [phase, s, left, end]);

  const start = () => {
    const n = newSession(intention || "Еркін оқу", minutes, Date.now());
    rang.current = false;
    setNow(Date.now());
    update(n);
    setPhase("run");
  };

  const save = () => {
    if (!s) return;
    if (learned.trim().length < 10) {
      setShort(true);
      return;
    }
    const done: FocusSession = { ...s, learned: learned.trim(), rating: rating ?? undefined };
    saveToHistory(done);
    saveActive(null);
    if ((done.focusedMin ?? 0) > 0) recordActivity("focus");
    const min = BREAK_MIN[done.plannedMin] ?? 5;
    setRest({ until: Date.now() + min * 60000, min });
    setNow(Date.now());
    setLearned("");
    setRating(null);
    setShort(false);
    setS(null);
    setPhase("rest");
  };

  const t = new Date(now);
  const week = focusWeek(history, t);
  const maxDay = Math.max(25, ...week.map((d) => d.min));
  const todayMin = week.at(-1)!.min;
  const log = history.filter((h) => h.learned).slice(-6).reverse();

  return (
    <div className={`${film.page} ${styles.room}`} data-phase={phase}>
      <FilmHeader />
      <main className={styles.page}>
        {phase === "setup" && (
          <section className={styles.setup} aria-label="Фокус дайындығы">
            <p className={styles.kicker}>ФОКУС БӨЛМЕСІ</p>
            <h1 className={styles.title}>Бір нәрсеге, толық.</h1>
            <p className={styles.lede}>Терең оқу бір мақсаттан басталады. Не үйренетініңді жаз, уақытты таңда, сосын тек соған бер. Басқа ой келсе, оны «тұраққа» қалдырып, жалғастыр.</p>
            <label className={styles.label} htmlFor="intention">
              Бұл сессияда не үйренемін?
            </label>
            <input id="intention" className={styles.intention} maxLength={140} placeholder="Мысалы: Гаусс әдісінің кері жүрісі" value={intention} onChange={(e) => setIntention(e.target.value)} />
            {ideas.length > 0 && (
              <div className={styles.ideas} role="group" aria-label="Бүгінгі жоспардан">
                {ideas.map((x) => (
                  <button key={x} type="button" onClick={() => setIntention(x)} aria-pressed={intention === x}>
                    {x}
                  </button>
                ))}
              </div>
            )}
            <p className={styles.label}>Ұзақтығы</p>
            <div className={styles.durations} role="group" aria-label="Ұзақтығы">
              {DURATIONS.map((d) => (
                <button key={d} type="button" aria-pressed={minutes === d} onClick={() => setMinutes(d)}>
                  <strong>{d}</strong> мин
                  <small>{d === 15 ? "жылыну" : d === 25 ? "классикалық" : "терең"}</small>
                </button>
              ))}
            </div>
            <button type="button" className={styles.startBtn} onClick={start}>
              Фокусты бастау
            </button>
          </section>
        )}

        {phase === "run" && s && (
          <section className={styles.run} aria-label="Фокус жүріп жатыр">
            <p className={styles.kicker}>ФОКУС · {s.plannedMin} МИН</p>
            <p className={styles.goal}>{s.intention}</p>
            <BigRing left={left} total={s.plannedMin * 60000} paused={!!s.pausedAt}>
              <span className={styles.clock} role="timer" aria-label="Қалған уақыт">
                {clock(left)}
              </span>
              <span className={styles.clockSub}>{s.pausedAt ? "кідірісте" : "қалды"}</span>
            </BigRing>
            <div className={styles.controls}>
              {s.pausedAt ? (
                <button type="button" className={styles.primary} onClick={() => update(resume(s, Date.now()))}>
                  Жалғастыру
                </button>
              ) : (
                <button type="button" className={styles.ghost} onClick={() => update(pause(s, Date.now()))}>
                  Кідірту
                </button>
              )}
              <button type="button" className={styles.ghost} aria-pressed={noise} onClick={() => setNoise((x) => !x)}>
                {noise ? "Қоңыр шу: қосулы" : "Қоңыр шу"}
              </button>
              <button type="button" className={styles.ghost} onClick={end}>
                Ертерек аяқтау
              </button>
            </div>
            <form
              className={styles.park}
              aria-label="Ойлар тұрағы"
              onSubmit={(e) => {
                e.preventDefault();
                const x = thought.trim();
                if (!x) return;
                update({ ...s, parked: [...s.parked, x].slice(0, 30) });
                setThought("");
              }}
            >
              <label htmlFor="park">Басқа ой келді ме? Осында қалдыр да, мақсатқа орал.</label>
              <div className={styles.parkRow}>
                <input id="park" maxLength={200} value={thought} onChange={(e) => setThought(e.target.value)} placeholder="Мысалы: анама қоңырау шалу" />
                <button type="submit" className={styles.ghost}>
                  Тұраққа қою
                </button>
              </div>
              {s.parked.length > 0 && (
                <ul aria-label="Тұрақтағы ойлар">
                  {s.parked.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              )}
            </form>
            <p className={styles.tip}>Кеңес: телефонды басқа бөлмеге қой. Тек осы бетті немесе сабақты аш: жоғарыдағы сағат сабақта да жүре береді.</p>
          </section>
        )}

        {phase === "reflect" && s && (
          <section className={styles.reflect} aria-label="Сессия қорытындысы">
            <p className={styles.kicker}>СЕССИЯ АЯҚТАЛДЫ</p>
            <h1 className={styles.title}>{s.focusedMin ?? 0} минут терең жұмыс.</h1>
            <p className={styles.stats}>
              Кідіріс: {s.pauses} · бетті тастап кету: {s.leaves} · тұрақтағы ой: {s.parked.length}
            </p>
            <label className={styles.label} htmlFor="learned">
              Бір сөйлеммен: не үйрендің?
            </label>
            <textarea id="learned" className={styles.learned} rows={3} maxLength={500} value={learned} onChange={(e) => (setLearned(e.target.value), setShort(false))} placeholder="Есте сақтаудың ең мықты тәсілі: өз сөзіңмен қайталау." />
            {short && <p className={styles.warn}>Кемінде бір толық сөйлем жаз: дәл осы қадам білімді бекітеді.</p>}
            <p className={styles.label}>Фокус қандай болды?</p>
            <div className={styles.rating} role="group" aria-label="Фокус бағасы">
              {RATINGS.map((x, i) => (
                <button key={x} type="button" aria-pressed={rating === i + 1} onClick={() => setRating(i + 1)}>
                  <span>{i + 1}</span>
                  {x}
                </button>
              ))}
            </div>
            {s.parked.length > 0 && (
              <div className={styles.parkedDone}>
                <p className={styles.label}>Тұрақта қалған ойлар: енді соларға уақыт бар.</p>
                <ul>
                  {s.parked.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </div>
            )}
            <button type="button" className={styles.startBtn} onClick={save}>
              Сақтап, демалуға
            </button>
          </section>
        )}

        {phase === "rest" && rest && (
          <section className={styles.rest} aria-label="Үзіліс">
            <p className={styles.kicker}>ҮЗІЛІС · {rest.min} МИН</p>
            <BigRing left={Math.max(0, rest.until - now)} total={rest.min * 60000} paused={false}>
              <span className={styles.clock} role="timer" aria-label="Үзіліске қалған уақыт">
                {clock(Math.max(0, rest.until - now))}
              </span>
              <span className={styles.clockSub}>демал</span>
            </BigRing>
            <p className={styles.tip}>
              Үзілістен кейін: <Link href="/recall">Бос парақта</Link> жаңа ғана оқығаныңды есіңнен жазып көр.
            </p>
            <ul className={styles.restTips}>
              <li>
                <b>20-20-20:</b> терезеден алысқа, кемінде 6 метрге 20 секунд қара.
              </li>
              <li>
                <b>Қозғал:</b> орныңнан тұр, иығыңды жаз, су іш.
              </li>
              <li>
                <b>Экранға қарама:</b> ми осы кезде жаңа білімді бекітеді.
              </li>
            </ul>
            <div className={styles.controls}>
              <button type="button" className={styles.primary} onClick={() => (setRest(null), setPhase("setup"))}>
                Тағы бір сессия
              </button>
              <Link href="/today" className={styles.ghost}>
                Бүгін бетіне
              </Link>
            </div>
          </section>
        )}

        <section className={styles.history} aria-label="Фокус тарихы">
          <div className={styles.week}>
            <p className={styles.label}>
              Бүгін: <b>{todayMin} мин</b> фокус
            </p>
            <ol className={styles.bars} aria-label="Соңғы жеті күндегі фокус минуттары">
              {week.map((d) => (
                <li key={d.key} data-today={d.today || undefined} title={`${d.key}: ${d.min} мин`}>
                  <span style={{ height: `${Math.round((d.min / maxDay) * 100)}%` }} />
                  <small>{d.min}</small>
                </li>
              ))}
            </ol>
          </div>
          {log.length > 0 && (
            <div className={styles.log}>
              <p className={styles.label}>Үйренгендерім журналы</p>
              <ul>
                {log.map((h) => (
                  <li key={h.id}>
                    <span className={styles.logMeta}>
                      {new Date(h.startedAt).toLocaleDateString("kk-KZ", { day: "numeric", month: "short" })} · {h.focusedMin} мин · {h.intention}
                    </span>
                    {h.learned}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
