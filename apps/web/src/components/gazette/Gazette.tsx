"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { SCENARIOS, formatMs, runMission } from "@inside-tech/lab-web";
import { findLab } from "@/lib/catalog";
import { solveChallenge } from "@/lib/challenges";
import { ISSUE_1, buildBoard, cellsOf, check, key, normalizeLetter, sanitizeLetters, solvedEntries, type Dir } from "@/lib/crossword";
import { JOURNEY_TOTAL } from "@/lib/journey";
import { OyuRule } from "../lab/Oyu";
import { FilmHeader } from "../film/FilmHeader";
import film from "../film/film.module.css";
import styles from "./gazette.module.css";

const SAVE = "inside-tech:gazette:1";
const board = buildBoard(ISSUE_1);

/** The newspaper of the platform, issue 1: a lead story, a crossword, a column of facts. */
export function Gazette() {
  const [letters, setLetters] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [hints, setHints] = useState(0);
  const [at, setAt] = useState<{ r: number; c: number; dir: Dir }>({ r: 0, c: 2, dir: "across" });
  const [checked, setChecked] = useState<string[] | null>(null);
  const inputs = useRef(new Map<string, HTMLInputElement>());

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(SAVE) ?? "null") as { letters?: unknown; hints?: unknown } | null;
      setLetters(sanitizeLetters(board, raw?.letters));
      setHints(typeof raw?.hints === "number" && raw.hints >= 0 ? Math.floor(raw.hints) : 0);
    } catch {
      /* a fresh sheet */
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(SAVE, JSON.stringify({ letters, hints }));
    } catch {
      /* storage unavailable */
    }
  }, [letters, hints, loaded]);

  const result = check(board, letters);
  const done = solvedEntries(board, letters);
  useEffect(() => {
    if (result.solved) solveChallenge("gazette-1");
  }, [result.solved]);

  // The word under the cursor, in the current direction (or the other one if none runs that way).
  const current = useMemo(() => {
    const has = (dir: Dir) => board.entries.findIndex((e) => e.dir === dir && cellsOf(e).some(([r, c]) => r === at.r && c === at.c));
    const i = has(at.dir);
    return i >= 0 ? i : has(at.dir === "across" ? "down" : "across");
  }, [at]);
  const currentCells = new Set(current >= 0 ? cellsOf(board.entries[current]!).map(([r, c]) => key(r, c)) : []);
  const dir = current >= 0 ? board.entries[current]!.dir : at.dir;

  const focus = (r: number, c: number, d: Dir = dir) => {
    if (!board.cells.has(key(r, c))) return false;
    setAt({ r, c, dir: d });
    inputs.current.get(key(r, c))?.focus();
    return true;
  };
  const step = (r: number, c: number, d: Dir, by: number) => (d === "across" ? focus(r, c + by, d) : focus(r + by, c, d));

  const type = (r: number, c: number, raw: string) => {
    const ch = normalizeLetter(raw);
    if (!ch) return;
    setChecked(null);
    setLetters((x) => ({ ...x, [key(r, c)]: ch }));
    step(r, c, dir, 1);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>, r: number, c: number) => {
    const moves: Record<string, [number, number, Dir]> = { ArrowRight: [0, 1, "across"], ArrowLeft: [0, -1, "across"], ArrowDown: [1, 0, "down"], ArrowUp: [-1, 0, "down"] };
    const m = moves[e.key];
    if (m) {
      e.preventDefault();
      focus(r + m[0], c + m[1], m[2]);
      return;
    }
    if (e.key === "Backspace") {
      e.preventDefault();
      setChecked(null);
      if (letters[key(r, c)]) setLetters((x) => ({ ...x, [key(r, c)]: "" }));
      else step(r, c, dir, -1);
    }
  };

  const reveal = () => {
    const k = key(at.r, at.c);
    const cell = board.cells.get(k);
    if (!cell || letters[k] === cell.answer) return;
    setHints((h) => h + 1);
    setLetters((x) => ({ ...x, [k]: cell.answer }));
  };

  // The lead story's numbers come from the mission model, not from the page.
  const morning = runMission(SCENARIOS.single, "none").totalMs;
  const lesson = runMission(SCENARIOS.class, "none").totalMs;

  const grid = [];
  for (let r = 0; r < board.rows; r++)
    for (let c = 0; c < board.cols; c++) {
      const k = key(r, c);
      const cell = board.cells.get(k);
      if (!cell) {
        grid.push(<span key={k} className={styles.block} aria-hidden />);
        continue;
      }
      grid.push(
        <span key={k} className={styles.cell} data-word={currentCells.has(k)} data-at={at.r === r && at.c === c} data-wrong={checked?.includes(k) ?? false}>
          {cell.num && <i aria-hidden>{cell.num}</i>}
          <input
            ref={(n) => void (n ? inputs.current.set(k, n) : inputs.current.delete(k))}
            value={letters[k] ?? ""}
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-label={`${r + 1}-жол, ${c + 1}-баған${cell.num ? `, ${cell.num}-сөздің басы` : ""}`}
            onFocus={() => setAt((a) => ({ r, c, dir: a.r === r && a.c === c ? a.dir : a.dir }))}
            onClick={() => at.r === r && at.c === c && setAt((a) => ({ ...a, dir: a.dir === "across" ? "down" : "across" }))}
            onChange={(e) => type(r, c, e.target.value)}
            onKeyDown={(e) => onKey(e, r, c)}
          />
        </span>,
      );
    }

  const clueList = (d: Dir, title: string) => (
    <div className={styles.clues}>
      <h3>{title}</h3>
      <ol>
        {board.entries.map((e, i) =>
          e.dir !== d ? null : (
            <li key={`${e.num}${d}`} data-current={i === current} data-done={done.has(i)}>
              <button type="button" onClick={() => focus(e.row, e.col, d)}>
                <b>{e.num}.</b> {e.clue} <span className={styles.len}>({[...e.word].length})</span>
              </button>
            </li>
          ),
        )}
      </ol>
    </div>
  );

  return (
    <div className={film.page}>
      <FilmHeader />
      <main className={styles.page}>
        <article className={styles.sheet} aria-labelledby="gz-title">
          <header className={styles.mast}>
            <p className={styles.dateline}>
              <span>№ 1</span>
              <span>Технология туралы апталық</span>
              <span>Бағасы: бір сабақ</span>
            </p>
            <h1 id="gz-title" className={styles.title}>
              INSIDE TECH газеті
            </h1>
            <OyuRule className={styles.rule} />
          </header>

          <div className={styles.columns}>
            <section className={styles.lead} aria-labelledby="gz-lead">
              <p className={styles.kicker}>Бас мақала</p>
              <h2 id="gz-lead">Мектеп сайты неге баяулады?</h2>
              <p className={styles.dropcap}>
                Таңертең бір телефоннан мектептің басты беті {formatMs(morning)} ішінде ашылады. Сабақ басталып, бүкіл сынып бірге кіргенде дәл сол бет {formatMs(lesson)} күттіреді.
              </p>
              <p>Сервер өзгерген жоқ, бет те өзгерген жоқ. Өзгерген жалғыз нәрсе: бір Wi-Fi арнасы арқылы бір мезгілде өтуге тырысқан суреттердің көлемі.</p>
              <p>Кэш қосу шешім сияқты көрінеді. Бірақ жаңа сынып алғаш кіргенде не болады? Жауабын өзің өлшеп көр.</p>
              <Link href="/mission" className={styles.more}>
                Миссияда тексеру →
              </Link>
            </section>

            <section className={styles.puzzle} aria-labelledby="gz-xw">
              <p className={styles.kicker}>Сөзжұмбақ</p>
              <h2 id="gz-xw">Он зертхананың он сөзі</h2>
              <div className={styles.status} role="status">
                {result.solved ? (
                  <span className={styles.stamp}>ШЕШІЛДІ</span>
                ) : (
                  <span>
                    {result.filled} / {result.total} әріп · {done.size} / {board.entries.length} сөз
                  </span>
                )}
                {hints > 0 && <span className={styles.hints}>ашылған әріп: {hints}</span>}
              </div>
              <div className={styles.gridWrap}>
                <div className={styles.grid} style={{ gridTemplateColumns: `repeat(${board.cols}, 1fr)` }} role="group" aria-label="Сөзжұмбақ торы">
                  {grid}
                </div>
              </div>
              {current >= 0 && (
                <p className={styles.now}>
                  <b>
                    {board.entries[current]!.num} {board.entries[current]!.dir === "across" ? "көлденеңінен" : "тігінен"}:
                  </b>{" "}
                  {board.entries[current]!.clue}
                </p>
              )}
              <div className={styles.actions}>
                <button type="button" onClick={() => setChecked(result.wrong)}>
                  Тексеру
                </button>
                <button type="button" onClick={reveal}>
                  Бір әріп ашу
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLetters({});
                    setHints(0);
                    setChecked(null);
                  }}
                >
                  Тазалау
                </button>
                <button type="button" onClick={() => window.print()}>
                  Басып шығару
                </button>
              </div>
              {checked && (
                <p className={styles.verdict} role="status">
                  {checked.length === 0 ? (result.solved ? "Бәрі дұрыс." : "Қате жоқ. Бос ұяшықтар қалды.") : `${checked.length} әріп қате: олар қызылмен белгіленді.`}
                </p>
              )}
              <div className={styles.clueCols}>
                {clueList("across", "Көлденеңінен")}
                {clueList("down", "Тігінен")}
              </div>
              {result.solved && (
                <p className={styles.learn}>
                  Әр сөздің зертханасы:{" "}
                  {board.entries.map((e, i) => (
                    <span key={e.word}>
                      {i > 0 && " · "}
                      <Link href={`/labs/${e.lab}`}>
                        {e.word.charAt(0) + e.word.slice(1).toLocaleLowerCase("kk-KZ")} ({findLab(e.lab)?.title})
                      </Link>
                    </span>
                  ))}
                </p>
              )}
            </section>

            <aside className={styles.facts} aria-labelledby="gz-facts">
              <p className={styles.kicker}>Білесің бе?</p>
              <h2 id="gz-facts">Үш дерек</h2>
              <div className={styles.fact}>
                <b>{JOURNEY_TOTAL} мс</b>
                <p>Enter басқаннан бет ашылғанға дейін: пернетақта, DNS, TCP, TLS, сервер, дерекқор және экранға салу.</p>
                <Link href="/journey">Саяхатты көру →</Link>
              </div>
              <div className={styles.fact}>
                <b>42 әріп</b>
                <p>Цезарь шифрын біз қазақ әліпбиінің 42 әрпімен айналдырамыз. Сондықтан кілт те 0-ден 41-ге дейін.</p>
                <Link href="/labs/sec">Шифрды бұзу →</Link>
              </div>
              <div className={styles.fact}>
                <b>≈ жартысы</b>
                <p>SHA-256 хэшінде бір таңбаны өзгертсең, нәтиженің шамамен жарты биті ауысады. Бұл лавина әсері.</p>
                <Link href="/labs/sec">Хэшті сынау →</Link>
              </div>
            </aside>
          </div>
          <footer className={styles.foot}>
            <span>INSIDE TECH · Технологияны ішінен үйрену</span>
            <Link href="/comic" className={styles.next}>
              Жаңа комикс: «Үш қол алысу» →
            </Link>
          </footer>
        </article>
      </main>
    </div>
  );
}
