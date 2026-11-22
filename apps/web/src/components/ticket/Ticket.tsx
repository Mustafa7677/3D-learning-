"use client";

import { useEffect, useState } from "react";
import { findLab } from "@/lib/catalog";
import { lessonEntries } from "@/lib/lessons";
import { progressStore } from "@/lib/progress";
import { optionOrder } from "@/lib/shuffle";
import { CONFIDENCE_WORD, calibration, calibrationVerdict, drawTicket, questionPool, type Confidence, type TicketAnswer, type TicketQuestion } from "@/lib/ticket";
import { OyuRule } from "../lab/Oyu";
import { FilmHeader } from "../film/FilmHeader";
import film from "../film/film.module.css";
import styles from "./ticket.module.css";

const LEVELS: Confidence[] = [0, 1, 2];
const VERDICT = {
  over: { title: "Сенім білімнен озып кетті", text: "«Сенімдімін» деген жерде қателестің. Бұл қауіпті белгі: нақты жұмыста дәл осындай сенімді қате ең қымбатқа түседі. Сенімді жауаптарыңды тексеріп үйрен." },
  under: { title: "Өзіңе тым аз сенесің", text: "«Болжаймын» деп белгілеп, бәрібір дұрыс таптың. Білімің сен ойлағаннан көп. Келесі билетте батылырақ бол." },
  good: { title: "Сенімің біліміңе сай", text: "Сенімді болғанда дұрыс, күмәнданғанда сақ болдың. Бұл маманның ең маңызды дағдыларының бірі: өз білімінің шекарасын білу." },
  unknown: { title: "Барлығы «шамамен»", text: "Келесі жолы сенімділігіңді батылырақ белгіле: сонда калибровка нақты көрінеді." },
} as const;

const todaySeed = () => {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
};

function Question({ q, n, onDone }: { q: TicketQuestion; n: number; onDone(a: TicketAnswer): void }) {
  const [conf, setConf] = useState<Confidence | null>(null);
  const [pick, setPick] = useState<number | null>(null);
  const right = pick === q.answer;
  return (
    <article className={styles.question} aria-label={`${n}-сұрақ`}>
      <p className={styles.meta}>
        {n}-сұрақ · {findLab(q.labId)?.title} · {q.lessonTitle}
      </p>
      <h2 className={styles.q}>{q.question}</h2>
      <div className={styles.confidence} role="group" aria-label="Сенімділік">
        <span>Жауап бермес бұрын: қаншалықты сенімдісің?</span>
        {LEVELS.map((c) => (
          <button key={c} type="button" aria-pressed={conf === c} disabled={pick !== null} data-level={c} onClick={() => setConf(c)}>
            {CONFIDENCE_WORD[c]}
          </button>
        ))}
      </div>
      <div className={styles.options} role="group" aria-label="Жауаптар">
        {optionOrder(q.question, q.options.length).map((i) => [q.options[i]!, i] as const).map(([o, i]) => (
          <button
            key={i}
            type="button"
            className={styles.option}
            disabled={conf === null || pick !== null}
            data-state={pick === null ? undefined : i === q.answer ? "right" : i === pick ? "wrong" : undefined}
            onClick={() => setPick(i)}
          >
            <b>{String.fromCharCode(1040 + i)}</b> {o}
          </button>
        ))}
      </div>
      {conf === null && <p className={styles.hint}>Алдымен сенімділігіңді белгіле: жауаптар сонда ашылады.</p>}
      {pick !== null && conf !== null && (
        <div className={styles.verdict} role="status">
          <strong>{right ? "Дұрыс." : "Қате."}</strong> <span>{right ? (conf === 0 ? " Болжам болса да, тап бастың." : "") : conf === 2 ? " Сенімді болған едің: осы жерді қайта қара." : ""}</span>
          <p>{q.explain}</p>
          <button type="button" className={styles.next} onClick={() => onDone({ confidence: conf, correct: right })}>
            Келесі
          </button>
        </div>
      )}
    </article>
  );
}

function Result({ answers, onAgain }: { answers: TicketAnswer[]; onAgain(): void }) {
  const c = calibration(answers);
  const v = VERDICT[calibrationVerdict(answers)];
  const score = answers.filter((a) => a.correct).length;
  return (
    <section className={styles.result} aria-label="Билет нәтижесі">
      <p className={styles.grade}>
        <b>{score}</b>/{answers.length}
      </p>
      <table className={styles.calib}>
        <caption>Сенім мен шындық</caption>
        <thead>
          <tr>
            <th scope="col">Белгің</th>
            <th scope="col">Жауап</th>
            <th scope="col">Дұрысы</th>
            <th scope="col">Дәлдік</th>
          </tr>
        </thead>
        <tbody>
          {LEVELS.map((l) => (
            <tr key={l}>
              <th scope="row">{CONFIDENCE_WORD[l]}</th>
              <td>{c[l].total}</td>
              <td>{c[l].right}</td>
              <td>
                <span className={styles.bar} aria-hidden>
                  <i style={{ width: `${c[l].total ? (c[l].right / c[l].total) * 100 : 0}%` }} data-level={l} />
                </span>
                {c[l].total ? `${Math.round((c[l].right / c[l].total) * 100)}%` : "·"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2 className={styles.vtitle}>{v.title}</h2>
      <p className={styles.vtext}>{v.text}</p>
      <button type="button" className={styles.next} onClick={onAgain}>
        Жаңа билет
      </button>
    </section>
  );
}

/** Емтихан билеті: five mixed questions from different labs, each answered with a stated confidence. */
export function Ticket() {
  const [pool, setPool] = useState<TicketQuestion[] | null>(null);
  const [seed, setSeed] = useState(todaySeed);
  const [answers, setAnswers] = useState<TicketAnswer[]>([]);

  useEffect(() => {
    let alive = true;
    progressStore()
      .list()
      .then((list) => alive && setPool(questionPool(lessonEntries, list)))
      .catch(() => alive && setPool(questionPool(lessonEntries, [])));
    return () => {
      alive = false;
    };
  }, []);

  const ticket = pool ? drawTicket(pool, seed) : [];
  const current = ticket[answers.length];
  const number = (seed % 97) + 1;

  return (
    <div className={film.page}>
      <FilmHeader />
      <main className={styles.page}>
        <header className={styles.head}>
          <p className={styles.issue}>АРАЛАС ЖАТТЫҒУ · СЕНІМДІ БАҒАЛАУ</p>
          <h1 className={styles.title}>Емтихан билеті</h1>
          <OyuRule className={styles.rule} />
          <p className={styles.lede}>Бес сұрақ, әрқайсысы басқа зертханадан. Тақырыптар араласқанда ми әр жолы «бұл қай білім?» деп іздейді: дәл осы ізденіс есте ұзақ сақтайды. Әр жауап алдында сенімділігіңді белгіле, соңында сенімің біліміңе сай ма, көресің.</p>
        </header>

        {pool && (
          <div className={styles.ticket}>
            <div className={styles.stamp} aria-hidden>
              INSIDE
              <br />
              TECH
            </div>
            <p className={styles.number}>БИЛЕТ № {number}</p>
            <ol className={styles.dots} aria-label="Билет барысы">
              {ticket.map((t, i) => (
                <li key={t.key} data-state={i < answers.length ? (answers[i]!.correct ? "right" : "wrong") : i === answers.length ? "now" : undefined}>
                  {findLab(t.labId)?.title}
                </li>
              ))}
            </ol>
            {current ? (
              <Question key={`${seed}-${answers.length}`} q={current} n={answers.length + 1} onDone={(a) => setAnswers((x) => [...x, a])} />
            ) : (
              <Result
                answers={answers}
                onAgain={() => {
                  setSeed((s) => s + 1);
                  setAnswers([]);
                }}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
