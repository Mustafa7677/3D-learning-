"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { prefersReducedMotion } from "@/lib/nav";
import {
  CARDS,
  FN_LEVELS,
  NAV_BOUND,
  NAV_LEVELS,
  REASONS,
  blocked,
  det2,
  evalFn,
  fnPar,
  fnStars,
  fnTarget,
  formula,
  navMoves,
  navPar,
  navStars,
  run,
  same,
  start,
  whyUnreachable,
  type Card,
  type Fn,
  type FnLevel,
  type NavLevel,
  type P2,
  type Reason,
} from "@/lib/tactics";
import { OyuRule } from "../lab/Oyu";
import { FilmHeader } from "../film/FilmHeader";
import film from "../film/film.module.css";
import styles from "./tactics.module.css";

const SAVE = "inside-tech:tactics";
type Results = Record<string, number>;
const ALL_IDS = [...NAV_LEVELS, ...FN_LEVELS].map((l) => l.id);

function load(): Results {
  try {
    const v = JSON.parse(localStorage.getItem(SAVE) ?? "{}");
    if (!v || typeof v !== "object") return {};
    return Object.fromEntries(Object.entries(v).filter(([k, n]) => ALL_IDS.includes(k) && typeof n === "number" && n >= 1 && n <= 3)) as Results;
  } catch {
    return {};
  }
}

const vec = (p: P2) => `(${p[0]}, ${p[1]})`;
function frac(n: number, d: number): string {
  if (d < 0) [n, d] = [-n, -d];
  const g = (a: number, b: number): number => (b === 0 ? Math.abs(a) : g(b, a % b));
  const k = g(n, d) || 1;
  return d / k === 1 ? `${n / k}` : `${n / k}/${d / k}`;
}

// ---------------------------------------------------------------- vector navigator

function NavField({ l, pos, path }: { l: NavLevel; pos: P2; path: P2[] }) {
  const B = NAV_BOUND + 0.6;
  const ticks = Array.from({ length: 2 * NAV_BOUND + 1 }, (_, i) => i - NAV_BOUND);
  const pts = [[0, 0] as P2, ...path].map((p) => `${p[0]},${-p[1]}`).join(" ");
  return (
    <svg className={styles.field} viewBox={`${-B} ${-B} ${2 * B} ${2 * B}`} role="img" aria-label={`Алаң: кеме ${vec(pos)} нүктесінде, нысана ${vec(l.target)}`}>
      {ticks.map((t) => (
        <g key={t} className={styles.grid}>
          <line x1={t} y1={-NAV_BOUND} x2={t} y2={NAV_BOUND} />
          <line x1={-NAV_BOUND} y1={t} x2={NAV_BOUND} y2={t} />
        </g>
      ))}
      <line className={styles.axis} x1={-NAV_BOUND} y1={0} x2={NAV_BOUND} y2={0} />
      <line className={styles.axis} x1={0} y1={-NAV_BOUND} x2={0} y2={NAV_BOUND} />
      {l.rocks.map((r) => (
        <g key={`${r[0]},${r[1]}`} transform={`translate(${r[0]} ${-r[1]})`} className={styles.rock}>
          <circle r={0.42} />
          <circle r={0.1} cx={-0.12} cy={-0.08} />
          <circle r={0.07} cx={0.15} cy={0.12} />
        </g>
      ))}
      <g transform={`translate(${l.target[0]} ${-l.target[1]})`} className={styles.target}>
        <circle r={0.45} />
        <circle r={0.22} />
      </g>
      <polyline className={styles.trail} points={pts} />
      {navMoves(l).map((m) => (
        <line key={m.label} className={styles.ghost} x1={pos[0]} y1={-pos[1]} x2={pos[0] + m.d[0]} y2={-(pos[1] + m.d[1])} />
      ))}
      <g transform={`translate(${pos[0]} ${-pos[1]})`} className={styles.ship}>
        <path d="M0 -0.42 L0.32 0.3 L0 0.16 L-0.32 0.3 Z" />
      </g>
    </svg>
  );
}

function NavBoard({ l, onDone }: { l: NavLevel; onDone(stars: number): void }) {
  const par = useMemo(() => navPar(l), [l]);
  const truth = useMemo(() => whyUnreachable(l), [l]);
  const [draft, setDraft] = useState(3);
  const [plan, setPlan] = useState<number | null>(null);
  const [path, setPath] = useState<P2[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [reason, setReason] = useState<Reason | null>(null);
  const [wrong, setWrong] = useState(0);
  const [won, setWon] = useState<{ stars: number; text: string } | null>(null);
  const pos = path.at(-1) ?? ([0, 0] as P2);

  const finish = (stars: number, text: string) => {
    const s = Math.max(1, stars - Math.min(wrong, 1));
    setWon({ stars: s, text });
    onDone(s);
  };

  const step = (d: P2) => {
    const q: P2 = [pos[0] + d[0], pos[1] + d[1]];
    if (blocked(l, q)) {
      setNote(Math.abs(q[0]) > NAV_BOUND || Math.abs(q[1]) > NAV_BOUND ? `${vec(q)} алаңнан тыс.` : `${vec(q)} нүктесінде астероид тұр.`);
      return;
    }
    setNote(null);
    const next = [...path, q];
    setPath(next);
    if (q[0] === l.target[0] && q[1] === l.target[1]) {
      const n = next.length;
      const planLine = plan === n ? "Жоспарың дәл болды." : `Жоспарың ${plan} еді, ${n > plan! ? "асып кеттің" : "қысқа шықты"}.`;
      finish(navStars(n, par!), `Нысанаға ${n} жүрісте жеттің. ${planLine} Ең қысқа жол: ${par} жүріс.`);
    }
  };

  const claim = () => {
    if (!reason) return;
    if (truth === null) {
      setWrong((w) => w + 1);
      setNote("Жоқ, бұл нүктеге жетуге болады. a·u + b·v = нысана теңдеуін шешіп көр: a мен b бүтін бе?");
      return;
    }
    if (reason !== truth) {
      setWrong((w) => w + 1);
      setNote("Нүктеге шынымен жете алмайсың, бірақ себебі басқа. Анықтауыштан баста.");
      return;
    }
    const d = det2(l.u, l.v);
    const proof =
      truth === "line"
        ? `det = ${l.u[0]}·${l.v[1]} − ${l.u[1]}·${l.v[0]} = 0, ал ${vec(l.target)} ол түзуде жатпайды.`
        : truth === "lattice"
          ? `det = ${d}. Крамер ережесі: a = ${frac(det2(l.target, l.v), d)}, b = ${frac(det2(l.u, l.target), d)}. Бүтін емес, демек жүріспен жету мүмкін емес.`
          : `Коэффициенттер бүтін, нүкте торда. Бірақ оның төрт көршісінің бәрі тас: кірер есік жоқ.`;
    setClaiming(false);
    setNote(null);
    finish(3, `Дұрыс дәлелдедің. ${proof}`);
  };

  const done = won !== null;
  return (
    <article className={styles.board} aria-label={`Навигатор: ${l.title}`}>
      <header className={styles.boardHead}>
        <h2>{l.title}</h2>
        <p>{l.brief}</p>
        <p className={styles.data}>
          u = {vec(l.u)} · v = {vec(l.v)} · нысана {vec(l.target)}
        </p>
      </header>
      <div className={styles.split}>
        <NavField l={l} pos={pos} path={path} />
        <div className={styles.side}>
          {plan === null ? (
            <section className={styles.planBox} aria-label="Жоспар">
              <h3>1. Жоспарла</h3>
              <p>Ұшпас бұрын ойлан: нысанаға неше жүріс керек? Сандар мен векторлардан есепте.</p>
              <div className={styles.stepper}>
                <button type="button" aria-label="Азайту" onClick={() => setDraft((x) => Math.max(1, x - 1))}>
                  −
                </button>
                <span className={styles.count} aria-label="Жоспарланған жүріс">{draft}</span>
                <button type="button" aria-label="Көбейту" onClick={() => setDraft((x) => Math.min(20, x + 1))}>
                  +
                </button>
              </div>
              <button type="button" className={styles.primary} disabled={done} onClick={() => setPlan(draft)}>
                Жоспарды бекіту
              </button>
            </section>
          ) : (
            <section className={styles.planBox} aria-label="Басқару">
              <h3>2. Ұш</h3>
              <p className={styles.data}>
                Жоспар {plan} · жүріс {path.length} · кеме {vec(pos)}
              </p>
              <div className={styles.moves}>
                {navMoves(l).map((m) => (
                  <button key={m.label} type="button" disabled={done} onClick={() => step(m.d)} aria-label={`Жүріс ${m.label}`}>
                    <b>{m.label}</b> {vec(m.d)}
                  </button>
                ))}
              </div>
              <div className={styles.row}>
                <button type="button" className={styles.ghostBtn} disabled={done || path.length === 0} onClick={() => setPath(path.slice(0, -1))}>
                  Бір жүріс артқа
                </button>
                <button type="button" className={styles.ghostBtn} disabled={done || path.length === 0} onClick={() => setPath([])}>
                  Басынан
                </button>
              </div>
            </section>
          )}

          {!done && (
            <section className={styles.claimBox} aria-label="Мүмкін емес деп дәлелдеу">
              {!claiming ? (
                <button type="button" className={styles.ghostBtn} onClick={() => setClaiming(true)}>
                  Жету мүмкін емес деп дәлелдеу
                </button>
              ) : (
                <fieldset>
                  <legend>Неге жетуге болмайды?</legend>
                  {(Object.keys(REASONS) as Reason[]).map((r) => (
                    <label key={r}>
                      <input type="radio" name={`why-${l.id}`} checked={reason === r} onChange={() => setReason(r)} /> {REASONS[r]}
                    </label>
                  ))}
                  <button type="button" className={styles.primary} disabled={!reason} onClick={claim}>
                    Дәлелдеу
                  </button>
                </fieldset>
              )}
            </section>
          )}

          <div role="status" className={styles.status} data-kind={won ? "win" : note ? "warn" : undefined}>
            {won ? (
              <>
                <strong aria-label={`${won.stars} жұлдыз`}>{"★".repeat(won.stars)}</strong> {won.text}
              </>
            ) : (
              note
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------- function marksman

const X0 = -5;
const X1 = 5;
const Y = 7;
function curve(f: Fn): string {
  const out: string[] = [];
  for (let i = 0; i <= 200; i++) {
    const x = X0 + ((X1 - X0) * i) / 200;
    const y = Math.max(-Y - 1, Math.min(Y + 1, evalFn(f, x)));
    out.push(`${x.toFixed(3)},${(-y).toFixed(3)}`);
  }
  return out.join(" ");
}

function FnPlot({ target, base, current, label }: { target: Fn; base: Fn; current: Fn | null; label: string }) {
  const ticks = Array.from({ length: 11 }, (_, i) => i - 5);
  const yt = Array.from({ length: 2 * Y + 1 }, (_, i) => i - Y);
  return (
    <svg className={styles.plot} viewBox={`${X0 - 0.3} ${-Y - 0.3} ${X1 - X0 + 0.6} ${2 * Y + 0.6}`} role="img" aria-label={label}>
      <defs>
        <clipPath id="fn-clip">
          <rect x={X0} y={-Y} width={X1 - X0} height={2 * Y} />
        </clipPath>
      </defs>
      {ticks.map((t) => (
        <line key={`x${t}`} className={styles.grid} x1={t} y1={-Y} x2={t} y2={Y} />
      ))}
      {yt.map((t) => (
        <line key={`y${t}`} className={styles.grid} x1={X0} y1={t} x2={X1} y2={t} />
      ))}
      <line className={styles.axis} x1={X0} y1={0} x2={X1} y2={0} />
      <line className={styles.axis} x1={0} y1={-Y} x2={0} y2={Y} />
      <g clipPath="url(#fn-clip)">
        <polyline className={styles.baseCurve} points={curve(base)} />
        <polyline className={styles.targetCurve} points={curve(target)} />
        {current && <polyline className={styles.currentCurve} points={curve(current)} />}
      </g>
    </svg>
  );
}

function FnBoard({ l, onDone }: { l: FnLevel; onDone(stars: number): void }) {
  const par = useMemo(() => fnPar(l), [l]);
  const target = useMemo(() => fnTarget(l), [l]);
  const base = start(l.base);
  const [plan, setPlan] = useState<Card[]>([]);
  const [peek, setPeek] = useState(false);
  const [running, setRunning] = useState<number | null>(null);
  const [shot, setShot] = useState<Fn | null>(null);
  const [verdict, setVerdict] = useState<{ win: boolean; stars?: number; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  const won = verdict?.win === true;
  const slots = par + 3;

  const fire = () => {
    setVerdict(null);
    const end = () => {
      const f = run(base, plan);
      setRunning(null);
      setShot(f);
      if (same(f, target)) {
        const stars = fnStars(plan.length, par, peek);
        setVerdict({ win: true, stars, text: `Дәл нысанада! Бағдарлама ${plan.length} карта, ең қысқасы ${par}.${peek ? " Тірі көрініс қолданылды." : ""}` });
        onDone(stars);
      } else {
        setVerdict({ win: false, text: `Мүлт кетті. Шыққаны: ${formula(f)}. Нысана: ${formula(target)}. Бағдарламаны түзе де, қайта іске қос.` });
      }
    };
    if (prefersReducedMotion() || plan.length === 0) return end();
    let i = 0;
    setRunning(0);
    setShot(base);
    const tick = () => {
      i += 1;
      setRunning(i);
      setShot(run(base, plan.slice(0, i)));
      timer.current = i < plan.length ? setTimeout(tick, 550) : setTimeout(end, 550);
    };
    timer.current = setTimeout(tick, 400);
  };

  const editing = running === null && !won;
  const edit = (next: Card[]) => {
    setPlan(next);
    setShot(null);
    setVerdict(null);
  };
  const live = peek && running === null && !shot ? run(base, plan) : shot;

  return (
    <article className={styles.board} aria-label={`Мерген: ${l.title}`}>
      <header className={styles.boardHead}>
        <h2>{l.title}</h2>
        <p>{l.brief}</p>
        <p className={styles.data}>
          Бастапқы: {formula(base)} · нысана: <b>{formula(target)}</b>
        </p>
      </header>
      <div className={styles.split}>
        <div>
          <FnPlot target={target} base={base} current={live} label={`График: нысана ${formula(target)}${live ? `, қазіргі ${formula(live)}` : ""}`} />
          <p className={styles.legend}>
            <span data-k="base">бастапқы</span> <span data-k="target">нысана</span> <span data-k="current">снаряд</span>
          </p>
        </div>
        <div className={styles.side}>
          <section className={styles.planBox} aria-label="Карталар">
            <h3>1. Бағдарлама жаз</h3>
            <p>Карталарды ретімен таңда. Графикті көрмей жоспарла: әр картаның формулаға не істейтінін ойла.</p>
            <div className={styles.cards}>
              {l.cards.map((c) => (
                <button key={c} type="button" disabled={!editing || plan.length >= slots} onClick={() => edit([...plan, c])} aria-label={`Бағдарламаға: ${CARDS[c].label}`}>
                  <b>{CARDS[c].label}</b>
                  <small>{CARDS[c].rule}</small>
                </button>
              ))}
            </div>
          </section>
          <section className={styles.planBox} aria-label="Бағдарлама">
            <h3>
              2. Бағдарлама ({plan.length}/{slots})
            </h3>
            {plan.length === 0 ? (
              <p className={styles.empty}>Бос</p>
            ) : (
              <ol className={styles.program}>
                {plan.map((c, i) => (
                  <li key={i} aria-current={running !== null && running === i + 1 ? "step" : undefined}>
                    <span>{CARDS[c].label}</span>
                    <button type="button" disabled={!editing} onClick={() => edit(plan.filter((_, j) => j !== i))} aria-label={`Алып тастау: ${i + 1}. ${CARDS[c].label}`}>
                      ×
                    </button>
                  </li>
                ))}
              </ol>
            )}
            <div className={styles.row}>
              <button type="button" className={styles.primary} disabled={!editing || plan.length === 0} onClick={fire}>
                Атқару
              </button>
              <button type="button" className={styles.ghostBtn} disabled={!editing || plan.length === 0} onClick={() => edit([])}>
                Тазалау
              </button>
            </div>
            <label className={styles.peek}>
              <input type="checkbox" checked={peek} disabled={won} onChange={(e) => setPeek(e.target.checked)} /> Тірі көрініс (бір жұлдыз кемиді)
            </label>
          </section>
          <div role="status" className={styles.status} data-kind={verdict ? (verdict.win ? "win" : "warn") : undefined}>
            {verdict && (
              <>
                {verdict.stars && <strong aria-label={`${verdict.stars} жұлдыз`}>{"★".repeat(verdict.stars)}</strong>} {verdict.text}
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------- page

type Game = "nav" | "fn";

/** Тактика алаңы: plan first, then act. Two games on vectors and on graphs of functions. */
export function Tactics() {
  const [game, setGame] = useState<Game>("nav");
  const [navId, setNavId] = useState(NAV_LEVELS[0]!.id);
  const [fnId, setFnId] = useState(FN_LEVELS[0]!.id);
  const [results, setResults] = useState<Results>({});
  useEffect(() => setResults(load()), []);
  const total = Object.values(results).reduce((a, b) => a + b, 0);

  const done = (id: string) => (stars: number) =>
    setResults((r) => {
      const next = { ...r, [id]: Math.max(stars, r[id] ?? 0) };
      try {
        localStorage.setItem(SAVE, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });

  const levels = game === "nav" ? NAV_LEVELS : FN_LEVELS;
  const current = game === "nav" ? navId : fnId;
  const pick = game === "nav" ? setNavId : setFnId;
  const idx = levels.findIndex((x) => x.id === current);
  const nav = NAV_LEVELS.find((x) => x.id === navId)!;
  const fn = FN_LEVELS.find((x) => x.id === fnId)!;

  return (
    <div className={film.page}>
      <FilmHeader />
      <main className={styles.page}>
        <header className={styles.head}>
          <p className={styles.issue}>ТАКТИКА АЛАҢЫ · ШТАБ КАРТАСЫ</p>
          <h1 className={styles.title}>Тактика алаңы</h1>
          <OyuRule className={styles.rule} />
          <p className={styles.lede}>
            Мұнда алдымен ойлайсың, сосын әрекет етесің. Навигаторда жүріс санын алдын ала жоспарлайсың және кейде «жету мүмкін емес» деп дәлелдейсің. Мергенде бүкіл бағдарламаны графикті көрмей жазып, бір-ақ рет атқарасың.
          </p>
        </header>

        <div className={styles.tabs} role="group" aria-label="Ойындар">
          <button type="button" aria-pressed={game === "nav"} onClick={() => setGame("nav")}>
            Векторлық навигатор
          </button>
          <button type="button" aria-pressed={game === "fn"} onClick={() => setGame("fn")}>
            Функция мергені
          </button>
        </div>

        <nav className={styles.picker} aria-label="Деңгейлер">
          {levels.map((x, i) => (
            <button key={x.id} type="button" aria-current={x.id === current ? "true" : undefined} onClick={() => pick(x.id)}>
              <span>{i + 1}</span> {x.title}
              {results[x.id] ? <b aria-label={`${results[x.id]} жұлдыз`}>{"★".repeat(results[x.id]!)}</b> : null}
            </button>
          ))}
        </nav>
        <p className={styles.tally} aria-label="Жұлдыздар">
          {total}/{ALL_IDS.length * 3} жұлдыз
        </p>

        {game === "nav" ? <NavBoard key={nav.id} l={nav} onDone={done(nav.id)} /> : <FnBoard key={fn.id} l={fn} onDone={done(fn.id)} />}

        <div className={styles.navRow}>
          <button type="button" className={styles.ghostBtn} disabled={idx === 0} onClick={() => pick(levels[idx - 1]!.id)}>
            Алдыңғы деңгей
          </button>
          <button type="button" className={styles.ghostBtn} disabled={idx === levels.length - 1} onClick={() => pick(levels[idx + 1]!.id)}>
            Келесі деңгей
          </button>
        </div>

        <aside className={styles.method} aria-label="Әдіс">
          <h2>Неге бұлай?</h2>
          <ul>
            <li>
              <b>Алдымен жоспар.</b> Жүріс санын болжау сені векторларды есептеуге мәжбүрлейді: кездейсоқ басудан гөрі a·u + b·v теңдеуі жылдамырақ.
            </li>
            <li>
              <b>Мүмкін еместі дәлелдеу.</b> Математикада «жоқ» деп айту да жауап, бірақ оның себебі болу керек: анықтауыш, тор немесе кедергі.
            </li>
            <li>
              <b>Бағдарлама, сосын атқару.</b> Түрлендірулер ретін алдын ала ойлау функциялар композициясын түсінудің ең тура жолы: «жоғары, сосын шағылу» мен «шағылу, сосын жоғары» әртүрлі.
            </li>
          </ul>
        </aside>
      </main>
    </div>
  );
}
