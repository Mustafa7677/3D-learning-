"use client";

import { useEffect, useMemo, useState } from "react";
import { findLab } from "@/lib/catalog";
import { optionOrder } from "@/lib/shuffle";
import { announceXp } from "@/lib/xp";
import { recordActivity } from "@/lib/activity";
import {
  PROBLEMS,
  XP_PER_STAR,
  bestStreak,
  checkStep,
  dailyProblem,
  loadProblems,
  markSolvedDay,
  problemStars,
  saveProblems,
  streakLength,
  week,
  type HardProblem,
  type ProblemsSave,
} from "@/lib/problems";
import { SolutionFilmPlayer } from "../lab/SolutionFilm";
import { OyuRule } from "../lab/Oyu";
import { FilmHeader } from "../film/FilmHeader";
import film from "../film/film.module.css";
import styles from "./problems.module.css";

const PHASES = ["Талдау", "Стратегия", "Өзің шығар"] as const;
const WEEKDAY = ["Жс", "Дс", "Сс", "Ср", "Бс", "Жм", "Сб"];

function Stars({ n, label }: { n: number; label?: string }) {
  return (
    <b className={styles.stars} aria-label={label ?? `${n} жұлдыз`}>
      {"★".repeat(n)}
      <span aria-hidden>{"★".repeat(3 - n)}</span>
    </b>
  );
}

function Room({ p, onSolved }: { p: HardProblem; onSolved(stars: number): void }) {
  const [phase, setPhase] = useState(0);
  const [watched, setWatched] = useState(false);
  const [picked, setPicked] = useState<number[]>([]);
  const [step, setStep] = useState(0);
  const [inputs, setInputs] = useState<string[]>(() => p.twin.steps.map(() => ""));
  const [verdicts, setVerdicts] = useState<(string | null)[]>(() => p.twin.steps.map(() => null));
  const [hinted, setHinted] = useState<boolean[]>(() => p.twin.steps.map(() => false));
  const [stars, setStars] = useState<number | null>(null);
  const order = useMemo(() => optionOrder(p.strategy.question, p.strategy.options.length), [p.strategy]);
  const chose = picked.includes(0);
  const misses = picked.filter((i) => i !== 0).length;

  const check = (i: number) => {
    const s = p.twin.steps[i]!;
    const v = checkStep(s, inputs[i]!);
    setVerdicts((x) => x.map((y, j) => (j === i ? v : y)));
    if (v !== "right") return;
    if (i + 1 < p.twin.steps.length) setStep(i + 1);
    else {
      const got = problemStars(hinted.filter(Boolean).length, misses);
      setStars(got);
      onSolved(got);
    }
  };

  return (
    <article className={styles.room} aria-label={`Есеп: ${p.title}`}>
      <ol className={styles.phases} aria-label="Есеп кезеңдері">
        {PHASES.map((x, i) => (
          <li key={x} data-state={i < phase ? "done" : i === phase ? "now" : undefined} aria-current={i === phase ? "step" : undefined}>
            <span>{i + 1}</span> {x}
          </li>
        ))}
      </ol>

      {phase === 0 && (
        <section aria-label="Талдау">
          <p className={styles.kicker}>МАМАН ШЫҒАРАДЫ</p>
          <p className={styles.statement}>{p.statement}</p>
          <SolutionFilmPlayer key={p.id} film={p.film} kicker="ТАЛДАУ · ШЕШІМ ФИЛЬМІ" note="Алдымен маман шығарады. Әр қадамның не үшін жасалғанына назар аудар: келесі есепті өзің шығарасың." onEnd={() => setWatched(true)} />
          {watched && (
            <div className={styles.idea} role="status">
              <p className={styles.kicker}>ТҮЙІН</p>
              <p>{p.idea}</p>
            </div>
          )}
          <div className={styles.row}>
            <button type="button" className={styles.primary} disabled={!watched} onClick={() => setPhase(1)}>
              Стратегияға өту
            </button>
            {!watched && (
              <button type="button" className={styles.ghost} onClick={() => setWatched(true)}>
                Фильмсіз түйінді көру
              </button>
            )}
          </div>
        </section>
      )}

      {phase === 1 && (
        <section aria-label="Стратегия">
          <p className={styles.kicker}>ҰҚСАС ЕСЕП: ЖОЛДЫ ТАҢДА</p>
          <p className={styles.statement}>{p.strategy.question}</p>
          <div className={styles.options} role="group" aria-label="Стратегиялар">
            {order.map((i) => (
              <button key={i} type="button" disabled={chose} data-state={picked.includes(i) ? (i === 0 ? "right" : "wrong") : undefined} onClick={() => setPicked((x) => (x.includes(i) ? x : [...x, i]))}>
                {p.strategy.options[i]}
              </button>
            ))}
          </div>
          {picked.length > 0 && (
            <p className={styles.note} role="status" data-right={chose}>
              {chose ? <>Дұрыс жол. {p.strategy.why}</> : "Бұл жол бұл есепке келмейді. Талдаудағы түйінді еске түсір."}
            </p>
          )}
          <div className={styles.row}>
            <button type="button" className={styles.primary} disabled={!chose} onClick={() => setPhase(2)}>
              Өзім шығарамын
            </button>
          </div>
        </section>
      )}

      {phase === 2 && (
        <section aria-label="Өзің шығар">
          <p className={styles.kicker}>ЕНДІ СЕН</p>
          <p className={styles.statement}>{p.twin.statement}</p>
          <ol className={styles.steps}>
            {p.twin.steps.slice(0, step + 1).map((s, i) => (
              <li key={i} data-state={verdicts[i] ?? undefined}>
                <label htmlFor={`${p.id}-s${i}`}>{s.prompt}</label>
                <div className={styles.answerRow}>
                  <input
                    id={`${p.id}-s${i}`}
                    inputMode="decimal"
                    autoComplete="off"
                    value={inputs[i]}
                    disabled={verdicts[i] === "right"}
                    onChange={(e) => {
                      const v = e.target.value;
                      setInputs((x) => x.map((y, j) => (j === i ? v : y)));
                      setVerdicts((x) => x.map((y, j) => (j === i && y !== "right" ? null : y)));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") check(i);
                    }}
                  />
                  {s.unit && <span className={styles.unit}>{s.unit}</span>}
                  <button type="button" className={styles.primary} disabled={verdicts[i] === "right"} aria-label={`Тексеру: ${s.prompt}`} onClick={() => check(i)}>
                    Тексеру
                  </button>
                  <button type="button" className={styles.ghost} disabled={hinted[i] || verdicts[i] === "right"} aria-label={`Кеңес (−1 ★): ${s.prompt}`} onClick={() => setHinted((x) => x.map((y, j) => (j === i ? true : y)))}>
                    Кеңес (−1 ★)
                  </button>
                </div>
                {hinted[i] && <p className={styles.hint}>{s.hint}</p>}
                {verdicts[i] === "wrong" && <p className={styles.wrong}>Әзірге емес. Түйінге қайта қара, есебіңді тексер.</p>}
                {verdicts[i] === "empty" && <p className={styles.wrong}>Сан жаз: мысалы 62,8 немесе 1/4.</p>}
              </li>
            ))}
          </ol>
          {stars !== null && (
            <div className={styles.win} role="status" aria-label="Нәтиже">
              <Stars n={stars} />
              <p>
                <strong>Өзің шығардың.</strong> {p.twin.closing}
              </p>
              <p className={styles.xp}>+{stars * XP_PER_STAR} XP · бүгінгі күн серияға қосылды</p>
            </div>
          )}
        </section>
      )}
    </article>
  );
}

/** Есептер залы: hard problems analysed, then solved by the learner; a problem a day and a streak. */
export function Problems() {
  const [save, setSave] = useState<ProblemsSave>({ stars: {}, streak: { days: [] } });
  const [today, setToday] = useState<Date | null>(null);
  const [current, setCurrent] = useState(PROBLEMS[0]!.id);
  useEffect(() => {
    const now = new Date();
    setToday(now);
    setSave(loadProblems());
    const asked = new URLSearchParams(window.location.search).get("p");
    setCurrent(PROBLEMS.some((p) => p.id === asked) ? asked! : dailyProblem(now).id);
  }, []);
  const daily = today ? dailyProblem(today) : null;
  const p = PROBLEMS.find((x) => x.id === current)!;
  const streak = today ? streakLength(save.streak, today) : 0;
  const days = today ? week(save.streak, today) : [];
  const total = Object.values(save.stars).reduce((a, b) => a + b, 0);

  const solved = (id: string) => (stars: number) => {
    const now = new Date();
    setSave((s) => {
      const next = { stars: { ...s.stars, [id]: Math.max(stars, s.stars[id] ?? 0) }, streak: markSolvedDay(s.streak, now) };
      saveProblems(next);
      return next;
    });
    recordActivity("problem");
    setTimeout(announceXp, 0);
  };

  return (
    <div className={film.page}>
      <FilmHeader />
      <main className={styles.page}>
        <header className={styles.head}>
          <p className={styles.issue}>ЕСЕПТЕР ЗАЛЫ · ҚИЫН ЕСЕПТЕР</p>
          <h1 className={styles.title}>Есептер залы</h1>
          <OyuRule className={styles.rule} />
          <p className={styles.lede}>Әр қиын есеп үш қадаммен: маманның шешімін фильм сияқты талдайсың, ұқсас есепке жолды таңдайсың, сосын оны өзің шығарасың. Күн сайын бір есеп: серияңды үзбе.</p>
        </header>

        <section className={styles.streak} aria-label="Серия">
          <div className={styles.flame} aria-hidden>
            <span />
          </div>
          <div>
            <p className={styles.streakNum} aria-label="Серия ұзындығы">
              {streak} күн қатарынан
            </p>
            <p className={styles.streakSub}>
              Ең ұзын серия: {bestStreak(save.streak)} күн · {total}/{PROBLEMS.length * 3} жұлдыз
            </p>
            <ol className={styles.week} aria-label="Соңғы жеті күн">
              {days.map((d) => {
                const [y, m, dd] = d.key.split("-").map(Number);
                return (
                  <li key={d.key} data-solved={d.solved} data-today={d.today || undefined} title={d.key}>
                    <span>{WEEKDAY[new Date(y!, m! - 1, dd!).getDay()]}</span>
                    <i role="img" aria-label={d.solved ? "шешілді" : "бос"} />
                  </li>
                );
              })}
            </ol>
          </div>
          {daily && (
            <button type="button" className={styles.dailyBtn} onClick={() => setCurrent(daily.id)} aria-pressed={current === daily.id}>
              <small>БҮГІНГІ ЕСЕП</small>
              {daily.title}
            </button>
          )}
        </section>

        <nav className={styles.list} aria-label="Есептер">
          {PROBLEMS.map((x) => (
            <button key={x.id} type="button" aria-current={x.id === current ? "true" : undefined} onClick={() => setCurrent(x.id)}>
              <span className={styles.lab}>{findLab(x.labId)?.title}</span>
              <strong>{x.title}</strong>
              <span className={styles.tags}>{x.tags.join(" · ")}</span>
              {daily?.id === x.id && <span className={styles.today}>Бүгін</span>}
              {save.stars[x.id] ? <Stars n={save.stars[x.id]!} /> : null}
            </button>
          ))}
        </nav>

        <Room key={p.id} p={p} onSolved={solved(p.id)} />
      </main>
    </div>
  );
}
