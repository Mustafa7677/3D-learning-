"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CHARACTER_NAME, type Backdrop } from "@inside-tech/lesson-engine";
import { BOSS_HP, HEARTS, ISLANDS, XP_BOSS, buildWorld, fightOver, loadBeaten, markBeaten, seaRoutes, shipAt, type Fight, type IslandView } from "@/lib/world";
import { progressStore } from "@/lib/progress";
import { optionOrder } from "@/lib/shuffle";
import { queryParam } from "@/lib/nav";
import { BackdropArt, GadgetFace } from "../lab/Cast";
import { FilmHeader } from "../film/FilmHeader";
import film from "../film/film.module.css";
import styles from "./world.module.css";

const W = 1200;
const H = 760;

const ARENA: Record<string, Backdrop> = {
  arch: "circuit", net: "city", web: "room", ai: "classroom", sec: "night", db: "server-room",
  algo: "circuit", cloud: "server-room", game: "room", iot: "city", math: "space",
};

const STATE_WORD = { fog: "тұманда", explored: "зерттелуде", conquered: "бағындырылды" } as const;

/** A deterministic wobbly island outline around (cx, cy). */
function blob(cx: number, cy: number, r: number, seed: number, grow = 0): string {
  const n = 16;
  let s = seed;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const pts = Array.from({ length: n }, (_, k) => {
    const a = (k / n) * Math.PI * 2;
    const rr = (r + grow) * (0.78 + rnd() * 0.34);
    return [cx + Math.cos(a) * rr * 1.25, cy + Math.sin(a) * rr * 0.85] as const;
  });
  // Smooth closed curve through the points (midpoint quadratic splines).
  const mid = (i: number) => {
    const p = pts[i % n]!;
    const q = pts[(i + 1) % n]!;
    return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2] as const;
  };
  let d = `M${mid(0)[0].toFixed(1)} ${mid(0)[1].toFixed(1)}`;
  for (let i = 1; i <= n; i++) {
    const p = pts[i % n]!;
    const m = mid(i);
    d += ` Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)}`;
  }
  return d + "Z";
}
const seedOf = (t: string) => [...t].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 11);
const at = (v: IslandView) => [(v.island.x / 100) * W, (v.island.y / 100) * H] as const;

/** IT архипелагы: the labs as islands, guardians, bosses and treasures. */
export function World() {
  const [views, setViews] = useState<IslandView[]>(() => buildWorld([], []));
  const [ship, setShip] = useState(ISLANDS[0]!.lab);
  const [picked, setPicked] = useState<string>();
  const [battle, setBattle] = useState<string>();
  const [tries, setTries] = useState(0);

  const refresh = useCallback(() => {
    const beaten = loadBeaten();
    void progressStore()
      .list()
      .then(
        (all) => {
          setViews(buildWorld(all, beaten));
          setShip(shipAt(all));
        },
        () => setViews(buildWorld([], beaten)),
      );
  }, []);

  useEffect(() => {
    refresh();
    const asked = queryParam("i");
    if (asked && ISLANDS.some((i) => i.lab === asked)) setPicked(asked);
  }, [refresh]);

  const routes = useMemo(() => seaRoutes(), []);
  const current = views.find((v) => v.island.lab === (picked ?? ship)) ?? views[0]!;
  const conquered = views.filter((v) => v.state === "conquered").length;
  const shipView = views.find((v) => v.island.lab === ship);

  return (
    <div className={film.page}>
      <FilmHeader />
      <main className={styles.page}>
        <header className={styles.head}>
          <p className={styles.issue}>
            АРАЛДАР ӘЛЕМІ · {conquered} / {views.length} АРАЛ БАҒЫНДЫ
          </p>
          <h1 className={styles.title}>
            IT <span>архипелагы</span>
          </h1>
          <p className={styles.lede}>
            Әр зертхана бір арал. Аралдың қорғаушысы сені қарсы алады, сабақтар жолы ішке апарады, ал аралдың басында босс қазынаны күзетеді. Боссты жеңу үшін оның үш сұрағына дұрыс жауап бер: екі рет қателессең, кемеңе қайтасың.
          </p>
        </header>

        <ul className={styles.treasures} aria-label="Қазыналар">
          {views.map((v) => (
            <li key={v.island.lab} data-got={v.state === "conquered" || undefined} title={v.island.treasure.name}>
              <span aria-hidden>{v.state === "conquered" ? v.island.treasure.glyph : "?"}</span>
              <span className={styles.sr}>{v.state === "conquered" ? `${v.island.treasure.name}: табылды` : `${v.island.name}: қазына әлі табылмады`}</span>
            </li>
          ))}
        </ul>

        <div className={styles.layout}>
          <div className={styles.map}>
            <svg viewBox={`0 0 ${W} ${H}`} className={styles.sea} aria-hidden>
              <defs>
                <radialGradient id="sea" cx="50%" cy="45%" r="75%">
                  <stop offset="0%" stopColor="#1d5f7c" />
                  <stop offset="100%" stopColor="#0b2538" />
                </radialGradient>
                <pattern id="waves" width="90" height="46" patternUnits="userSpaceOnUse">
                  <path d="M6 24 q8 -7 16 0 t16 0" fill="none" stroke="#4f9cba" strokeOpacity="0.35" strokeWidth="2" />
                  <path d="M52 8 q6 -5 12 0 t12 0" fill="none" stroke="#4f9cba" strokeOpacity="0.25" strokeWidth="1.6" />
                </pattern>
              </defs>
              <rect width={W} height={H} fill="url(#sea)" />
              <rect width={W} height={H} fill="url(#waves)" />
              {/* Sea routes: one idea joins two islands. */}
              {routes.map((r) => {
                const a = views.find((v) => v.island.lab === r.a);
                const b = views.find((v) => v.island.lab === r.b);
                if (!a || !b) return null;
                const [x1, y1] = at(a);
                const [x2, y2] = at(b);
                const mx = (x1 + x2) / 2 + (y2 - y1) * 0.12;
                const my = (y1 + y2) / 2 - (x2 - x1) * 0.12;
                return (
                  <g key={r.a + r.b} className={styles.route}>
                    <path d={`M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}`} />
                  </g>
                );
              })}
              {views.map((v) => {
                const [cx, cy] = at(v);
                const seed = seedOf(v.island.lab);
                return (
                  <g key={v.island.lab} data-state={v.state} className={styles.island}>
                    <path d={blob(cx, cy, v.island.r, seed, 14)} fill="#2a7f9e" opacity="0.55" />
                    <path d={blob(cx, cy, v.island.r, seed, 6)} fill="#ecd9a4" />
                    <path d={blob(cx, cy, v.island.r, seed)} fill={v.island.land} />
                    <path d={blob(cx, cy - 6, v.island.r * 0.45, seed + 3)} fill="#000" opacity="0.08" />
                    {v.state === "fog" && (
                      <g className={styles.fog}>
                        <ellipse cx={cx - 40} cy={cy - 10} rx={70} ry={34} />
                        <ellipse cx={cx + 36} cy={cy + 8} rx={76} ry={36} />
                        <ellipse cx={cx} cy={cy - 30} rx={60} ry={28} />
                      </g>
                    )}
                    {v.state === "conquered" && (
                      <g transform={`translate(${cx + v.island.r * 0.9} ${cy - v.island.r * 0.9})`}>
                        <path d="M0 0 v-46" stroke="#3a2a1a" strokeWidth="4" />
                        <path d="M2 -46 h34 l-8 10 8 10 h-34 z" fill="#d8342a" stroke="#3a2a1a" strokeWidth="2" />
                      </g>
                    )}
                  </g>
                );
              })}
              {shipView && (
                <g transform={`translate(${at(shipView)[0] - shipView.island.r * 1.55} ${at(shipView)[1] + shipView.island.r * 0.55})`} className={styles.ship}>
                  <path d="M-30 0 h60 l-12 16 h-36 z" fill="#7a4b2a" stroke="#2a1a10" strokeWidth="2.5" />
                  <path d="M0 0 v-52" stroke="#2a1a10" strokeWidth="3" />
                  <path d="M3 -50 q26 20 0 44 z" fill="#f4ead2" stroke="#2a1a10" strokeWidth="2" />
                  <path d="M-3 -40 q-18 14 0 32 z" fill="#f4ead2" stroke="#2a1a10" strokeWidth="2" />
                </g>
              )}
              <g transform={`translate(${W - 70} ${H - 70})`} className={styles.compass}>
                <circle r="44" />
                <path d="M0 -40 L8 0 L0 40 L-8 0 Z" />
                <path d="M-40 0 L0 8 L40 0 L0 -8 Z" opacity="0.6" />
                <text y="-48">С</text>
              </g>
            </svg>

            {views.map((v) => (
              <button
                key={v.island.lab}
                type="button"
                className={styles.pin}
                style={{ left: `${v.island.x}%`, top: `${v.island.y}%` }}
                data-state={v.state}
                aria-pressed={current.island.lab === v.island.lab}
                aria-label={`${v.island.name}: ${v.title}, ${v.done}/${v.lessons.length} сабақ, ${STATE_WORD[v.state]}`}
                onClick={() => setPicked(v.island.lab)}
              >
                <GadgetFace who={v.island.guardian} mood={v.state === "fog" ? "think" : v.state === "conquered" ? "wow" : "smile"} />
                <span>{v.island.name}</span>
              </button>
            ))}
          </div>

          <IslandCard
            view={current}
            routes={routes.flatMap((r) => {
              const other = r.a === current.island.lab ? r.b : r.b === current.island.lab ? r.a : undefined;
              const to = other && views.find((v) => v.island.lab === other);
              return to ? [{ idea: r.idea, lab: to.island.lab, name: to.island.name }] : [];
            })}
            onSail={setPicked}
            onFight={() => setBattle(current.island.lab)}
          />
        </div>

        <section className={styles.how} aria-labelledby="how">
          <h2 id="how">Қалай ойнайды?</h2>
          <ol>
            <li>
              <b>Аралды таңда.</b> Тұмандағы арал: сен әлі бармаған зертхана. Бір сабақ бастасаң, тұман сейіледі.
            </li>
            <li>
              <b>Сабақтар жолымен жүр.</b> Әр аяқталған сабақ жолдағы бір тасты алтынға айналдырады.
            </li>
            <li>
              <b>Боссқа шабуыл жаса.</b> Ол аралдың алғашқы сабақтарынан сұрайды. Үш дұрыс жауап: босс құлайды. Екі қате: кемеге қайтасың, бірақ әр қатенің түсіндірмесін көресің.
            </li>
            <li>
              <b>Қазынаны жина.</b> Әр жеңіс +{XP_BOSS} XP, аралға жалау және сөреге бір қазына береді.
            </li>
          </ol>
        </section>
      </main>

      {battle && (
        <Battle
          key={`${battle}:${tries}`}
          view={views.find((v) => v.island.lab === battle)!}
          attempt={tries}
          onAgain={() => setTries((t) => t + 1)}
          onClose={() => {
            setBattle(undefined);
            setTries((t) => t + 1);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function IslandCard({ view, routes, onSail, onFight }: { view: IslandView; routes: { idea: string; lab: string; name: string }[]; onSail: (lab: string) => void; onFight: () => void }) {
  const { island } = view;
  return (
    <aside className={styles.card} aria-label={`Арал: ${island.name}`} aria-live="polite">
      <p className={styles.cardLab}>
        {view.title} · <span data-state={view.state}>{STATE_WORD[view.state]}</span>
      </p>
      <h2 className={styles.cardTitle}>{island.name}</h2>
      <div className={styles.guardian}>
        <GadgetFace who={island.guardian} mood="explain" className={styles.guardianFace} />
        <p className={styles.bubble}>{island.greeting}</p>
      </div>

      <p className={styles.pathHead}>
        Сабақтар жолы · {view.done}/{view.lessons.length}
      </p>
      <ol className={styles.path} aria-label="Сабақтар жолы">
        {view.lessons.map((l) => (
          <li key={l.id} data-done={l.done || undefined} title={`${l.order}. ${l.title}`}>
            <span className={styles.sr}>
              {l.order}. {l.title}: {l.done ? "аяқталды" : "әлі жоқ"}
            </span>
          </li>
        ))}
      </ol>
      {view.next && (
        <Link className={styles.next} href={`/labs/${island.lab}/${view.next.id}`}>
          Келесі сабақ: {view.next.title} →
        </Link>
      )}

      {routes.length > 0 && (
        <div className={styles.routes}>
          <p className={styles.pathHead}>Теңіз жолдары: бір идея екі аралда</p>
          <ul>
            {routes.map((r) => (
              <li key={r.idea + r.lab}>
                <button type="button" onClick={() => onSail(r.lab)}>
                  <b>{r.idea}</b> ⟶ {r.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={styles.bossCard} data-beaten={view.state === "conquered" || undefined}>
        <GadgetFace who={island.boss.who} mood={view.state === "conquered" ? "confused" : "smile"} className={styles.bossFace} />
        <div>
          <p className={styles.bossLabel}>{view.state === "conquered" ? "Жеңілген босс" : "Арал боссы"}</p>
          <h3>{island.boss.name}</h3>
          <p className={styles.treasureLine}>
            Қазына: <b>{island.treasure.glyph} {island.treasure.name}</b>
          </p>
          <button type="button" className={styles.fight} onClick={onFight}>
            {view.state === "conquered" ? "Қайта шайқасу" : "Боссқа шабуыл ⚔"}
          </button>
        </div>
      </div>
    </aside>
  );
}

function Battle({ view, attempt, onAgain, onClose }: { view: IslandView; attempt: number; onAgain: () => void; onClose: () => void }) {
  const { island } = view;
  // Each try starts on another question, so a retry is not the same fight.
  const questions = useMemo(() => {
    const qs = island.questions;
    const s = attempt % qs.length;
    return [...qs.slice(s), ...qs.slice(0, s)];
  }, [island, attempt]);
  const [fight, setFight] = useState<Fight>({ asked: 0, hits: 0, misses: 0 });
  const [answer, setAnswer] = useState<number>();
  const [firstWin, setFirstWin] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  const result = answer === undefined ? fightOver(fight, questions.length) : undefined;
  const q = questions[fight.asked];
  const order = useMemo(() => (q ? optionOrder(q.q, q.options.length) : []), [q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Each new question or result gets the focus, so a keyboard player never loses the place.
  useEffect(() => {
    heading.current?.focus();
  }, [fight.asked]);

  useEffect(() => {
    if (result === "won") setFirstWin(markBeaten(island.lab));
  }, [result, island.lab]);

  const pick = (k: number) => {
    if (answer !== undefined) return;
    setAnswer(k);
  };
  const next = () => {
    const right = answer === 0;
    setFight((f) => ({ asked: f.asked + 1, hits: f.hits + (right ? 1 : 0), misses: f.misses + (right ? 0 : 1) }));
    setAnswer(undefined);
  };

  const right = answer === 0;
  const bossMood = result === "won" ? "confused" : answer === undefined ? "smile" : right ? "confused" : "wow";
  const bossHp = BOSS_HP - fight.hits - (answer !== undefined && right ? 1 : 0);
  const hearts = HEARTS - fight.misses - (answer !== undefined && !right ? 1 : 0);

  return (
    <div className={styles.scrim}>
      <div className={styles.battle} role="dialog" aria-modal="true" aria-label={`Шайқас: ${island.boss.name}`}>
        <div className={styles.arena} data-hit={answer !== undefined ? (right ? "boss" : "you") : undefined}>
          <BackdropArt kind={ARENA[island.lab] ?? "night"} className={styles.arenaBg} />
          <div className={styles.fighter}>
            <GadgetFace who={island.boss.who} mood={bossMood} className={styles.bossBig} />
            <p className={styles.bossName}>{island.boss.name}</p>
            <p className={styles.hp} aria-label={`Босстың күші: ${Math.max(bossHp, 0)}/${BOSS_HP}`}>
              {Array.from({ length: BOSS_HP }, (_, k) => (
                <span key={k} data-on={k < bossHp || undefined}>◆</span>
              ))}
            </p>
          </div>
          <div className={styles.fighter} data-side="you">
            <GadgetFace who={island.guardian} mood={answer === undefined ? "think" : right ? "wow" : "confused"} className={styles.allyBig} />
            <p className={styles.bossName}>Сен және {CHARACTER_NAME[island.guardian]}</p>
            <p className={styles.hearts} aria-label={`Сенің жүрегің: ${Math.max(hearts, 0)}/${HEARTS}`}>
              {Array.from({ length: HEARTS }, (_, k) => (
                <span key={k} data-on={k < hearts || undefined}>♥</span>
              ))}
            </p>
          </div>
          {answer !== undefined && <span className={styles.boom} aria-hidden>{right ? "ТАРС!" : "ХА-ХА!"}</span>}
        </div>

        <div className={styles.console}>
          <h2 ref={heading} tabIndex={-1} className={styles.battleTitle}>
            {result === "won" ? "Жеңіс!" : result === "lost" ? "Кемеге шегіну" : `${fight.asked + 1}-сұрақ`}
          </h2>

          {!result && q && (
            <>
              {fight.asked === 0 && answer === undefined && <p className={styles.taunt}>«{island.boss.taunt}»</p>}
              <p className={styles.question}>{q.q}</p>
              <div className={styles.options}>
                {order.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => pick(k)}
                    disabled={answer !== undefined}
                    data-verdict={answer === undefined ? undefined : k === 0 ? "right" : k === answer ? "wrong" : undefined}
                  >
                    {q.options[k]}
                  </button>
                ))}
              </div>
              {answer !== undefined && (
                <div className={styles.feedback} data-right={right || undefined} role="status">
                  <b>{right ? "Дәл тиді! Босс әлсіреді." : "Қате. Босс күліп тұр."}</b> {q.explain}
                  <button type="button" className={styles.fight} onClick={next}>
                    Келесі →
                  </button>
                </div>
              )}
            </>
          )}

          {result === "won" && (
            <div className={styles.win} role="status">
              <p className={styles.taunt}>«{island.boss.defeat}»</p>
              <p className={styles.treasureBig}>
                <span aria-hidden>{island.treasure.glyph}</span> {island.treasure.name}
              </p>
              <p>{firstWin ? `Қазына сенікі! +${XP_BOSS} XP. Аралға жалау тігілді.` : "Бұл қазына бұрыннан сенде. Білімің берік екен!"}</p>
              <button type="button" className={styles.fight} onClick={onClose}>
                Картаға қайту
              </button>
            </div>
          )}

          {result === "lost" && (
            <div className={styles.win} role="status">
              <p>Босс бұл жолы мықты болды. Түсіндірмелерді есіңе сақта да, қайта кел: келесі шайқас басқа сұрақтан басталады.</p>
              <div className={styles.lostActions}>
                <button type="button" className={styles.fight} onClick={onAgain}>
                  Қайта шайқасу
                </button>
                <Link className={styles.next} href={`/labs/${island.lab}/${view.lessons[0]?.id ?? ""}`}>
                  Алдымен сабақты оқу →
                </Link>
              </div>
            </div>
          )}
        </div>

        <button type="button" className={styles.close} onClick={onClose} aria-label="Шайқастан шығу">
          ×
        </button>
      </div>
    </div>
  );
}
