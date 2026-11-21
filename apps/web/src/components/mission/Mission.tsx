"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { MISSION_SCHOOL as M, SCENARIOS, formatMs, runMission, slowestSegment, type MissionFix, type MissionRun, type MissionScenario, type SegmentId } from "@inside-tech/lab-web";
import { STAGES, finishMission, freshWork, loadWork, measureKey, saveWork, type Measure, type MissionWork } from "@/lib/mission";
import { prefersReducedMotion } from "@/lib/nav";
import { FilmHeader } from "../film/FilmHeader";
import film from "../film/film.module.css";
import landing from "../film/landing.module.css";
import styles from "./mission.module.css";

const SEG: Record<SegmentId, { name: string; node: string; term: string }> = {
  dns: { name: "DNS", node: "DNS", term: "DNS: сайттың атын IP мекенжайға айналдыру. Бұрын кірген телефон оны есте сақтайды." },
  connect: { name: "Байланыс", node: "Жол", term: "Байланыс орнату: телефон мен сервер TCP және TLS арқылы екі рет хабар алмасады." },
  server: { name: "Сервер", node: "Сервер", term: "Сервер: сұраныс кезекте тұрып, бетті дайындайды. Кезек ұзарса, кідіріс өседі." },
  download: { name: "Жүктеу", node: "Wi-Fi арнасы", term: "Жүктеу: бет пен суреттер мектептің ортақ Wi-Fi арнасы арқылы келеді. Арна бәріне бөлінеді." },
};
const SEG_IDS: SegmentId[] = ["dns", "connect", "server", "download"];
const FIX: Record<Exclude<MissionFix, "none">, { title: string; detail: string }> = {
  resize: { title: "Суреттерді кішірейту", detail: `Басты беттегі суреттер ${M.photosKB} КБ-тан ${M.photosSmallKB} КБ-қа дейін телефонға лайықталады.` },
  cache: { title: "Кэш қосу", detail: "Сайтқа бұрын кірген телефон суреттерді сақтап қалады және қайта жүктемейді." },
};
const FIX_NAME: Record<MissionFix, string> = { none: "түзетусіз", resize: "суреттер кішірейтілді", cache: "кэш қосулы" };
const STAGE_TITLE = ["Бір сұраныс", "Таңғы жүктеме", "Болжам", "Түзету", "Қарсы сынақ", "Инженерлік есеп"];
const QUESTION = [
  "Мектептің басты беті таңертең бір телефоннан қалай ашылады?",
  "Сабақ басталып, бүкіл сынып қатар кіргенде не өзгерді?",
  "Уақыт қай жерде жоғалып жатыр?",
  "Бюджет бір ғана жақсартуға жетеді. Қайсысын таңдайсың?",
  "Шешімің кімге көмектесті, ал кімге көмектеспеді?",
  "Таңдауыңды өлшеммен қорға.",
];
const scenarioById = (id: string) => Object.values(SCENARIOS).find((s) => s.id === id);
const measureLabel = (m: Measure) => `${scenarioById(m.scenario)?.title ?? m.scenario}, ${FIX_NAME[m.fix]}: ${formatMs(m.totalMs)}`;

/** The city: phone at the school, the shared Wi-Fi uplink, DNS and the server. */
function CityMap({ selected, onSelect, lit }: { selected?: SegmentId; onSelect(s: SegmentId): void; lit?: SegmentId }) {
  const node = (id: SegmentId, x: number, y: number, w: number) => (
    <g className={styles.node} data-selected={selected === id} data-lit={lit === id}>
      <rect x={x} y={y} width={w} height={40} rx={10} />
      <text x={x + w / 2} y={y + 25}>
        {SEG[id].node}
      </text>
    </g>
  );
  return (
    <div className={styles.map}>
      <svg viewBox="0 0 360 230" role="img" aria-label="Қала картасы: мектептегі телефон, Wi-Fi арнасы, DNS және сервер">
        <rect x={8} y={60} width={128} height={150} rx={14} className={styles.school} />
        <text x={72} y={82} className={styles.label}>
          Мектеп
        </text>
        <g className={styles.phone}>
          <rect x={30} y={98} width={30} height={50} rx={6} />
          <text x={45} y={168} className={styles.small}>
            Телефон
          </text>
        </g>
        <path d="M60 123 C 120 123, 150 160, 214 160" className={styles.wire} data-lit={lit === "download" || lit === "connect"} />
        <path d="M60 116 C 120 100, 160 52, 214 40" className={styles.wire} data-lit={lit === "dns"} />
        <path d="M296 160 C 320 160, 330 120, 296 108" className={styles.wire} data-lit={lit === "server" || lit === "connect"} />
        {node("dns", 214, 20, 100)}
        {node("download", 84, 172, 130)}
        {node("server", 232, 88, 110)}
        {node("connect", 214, 140, 82)}
      </svg>
      <div className={styles.mapButtons} role="group" aria-label="Картадағы нысанды таңдау">
        {SEG_IDS.map((s) => (
          <button key={s} type="button" aria-pressed={selected === s} onClick={() => onSelect(s)}>
            {SEG[s].node}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Timeline bars for one or two runs on a shared scale; the earlier run is dashed. */
function Timeline({ runs, selected, onSelect, shown = 4 }: { runs: { run: MissionRun; label: string; before?: boolean }[]; selected?: SegmentId; onSelect(s: SegmentId): void; shown?: number }) {
  const scale = Math.max(...runs.map((r) => r.run.totalMs), 1);
  return (
    <div className={styles.timeline}>
      {runs.map(({ run, label, before }) => (
        <div key={label} className={styles.row} data-before={!!before}>
          <p className={styles.rowLabel}>
            <span>{label}</span>
            <b>{formatMs(run.totalMs)}</b>
          </p>
          <div className={styles.bar}>
            {run.segments.slice(0, shown).map((s) => (
              <button
                key={s.id}
                type="button"
                className={styles.seg}
                data-seg={s.id}
                data-selected={selected === s.id}
                style={{ width: `${Math.max(0.8, (s.ms / scale) * 100)}%` }}
                onClick={() => onSelect(s.id)}
                aria-label={`${label}: ${SEG[s.id].name}, ${formatMs(s.ms)}`}
              />
            ))}
          </div>
        </div>
      ))}
      <ul className={styles.legend}>
        {SEG_IDS.map((s) => (
          <li key={s} data-seg={s} data-selected={selected === s}>
            <i aria-hidden /> {SEG[s].name}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Metrics({ run, selected }: { run?: MissionRun; selected?: SegmentId }) {
  if (!run) return <p className={styles.muted}>Сұраныс жіберілгенде өлшемдер осында шығады.</p>;
  const seg = selected && run.segments.find((s) => s.id === selected);
  return (
    <dl className={styles.metrics}>
      {seg ? (
        <div className={styles.metricHot}>
          <dt>{SEG[seg.id].name}</dt>
          <dd>{formatMs(seg.ms)}</dd>
        </div>
      ) : null}
      <div>
        <dt>Барлығы</dt>
        <dd>{formatMs(run.totalMs)}</dd>
      </div>
      <div>
        <dt>Бір телефон жүктеген</dt>
        <dd>{run.observedKB} КБ</dd>
      </div>
      <div>
        <dt>Арна арқылы барлығы</dt>
        <dd>{(Math.round(run.allKB / 100) / 10).toFixed(1).replace(".", ",")} МБ</dd>
      </div>
      <div>
        <dt>Сервер кезегінде алда</dt>
        <dd>{run.queueAhead} сұраныс</dd>
      </div>
      {seg && <p className={styles.term}>{SEG[seg.id].term}</p>}
    </dl>
  );
}

export function Mission() {
  const [w, setW] = useState<MissionWork>(freshWork);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<SegmentId>();
  const [view, setView] = useState<"map" | "time">("map");
  const [shown, setShown] = useState(4);
  const [lit, setLit] = useState<SegmentId>();
  const [stepMode, setStepMode] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    setW(loadWork());
    setLoaded(true);
    setStepMode(prefersReducedMotion());
    return () => clearInterval(timer.current);
  }, []);
  useEffect(() => {
    if (loaded) saveWork(w);
  }, [w, loaded]);

  const measured = (s: MissionScenario, fix: MissionFix) => w.measures.some((m) => m.scenario === s.id && m.fix === fix);
  const record = (s: MissionScenario, fix: MissionFix) => {
    const run = runMission(s, fix);
    setW((x) => (x.measures.some((m) => measureKey(m) === measureKey({ scenario: s.id, fix })) ? x : { ...x, measures: [...x.measures, { scenario: s.id, fix, totalMs: run.totalMs }] }));
    return run;
  };
  const go = (stage: number) => {
    setSelected(undefined);
    setW((x) => ({ ...x, stage, reached: Math.max(x.reached, stage) }));
  };

  // Stage 1: send one request, segment by segment (or one step at a time).
  const single = useMemo(() => runMission(SCENARIOS.single, "none"), []);
  const send = () => {
    record(SCENARIOS.single, "none");
    clearInterval(timer.current);
    if (stepMode) {
      setShown(1);
      setLit("dns");
      return;
    }
    setShown(0);
    let i = 0;
    timer.current = setInterval(() => {
      i++;
      setShown(i);
      setLit(SEG_IDS[i - 1]);
      if (i >= 4) {
        clearInterval(timer.current);
        setTimeout(() => setLit(undefined), 700);
      }
    }, 450);
  };
  const stepOnce = () => {
    const next = Math.min(4, shown + 1);
    setShown(next);
    setLit(SEG_IDS[next - 1]);
  };

  const cls = runMission(SCENARIOS.class, "none");
  const fixed = w.fix && runMission(SCENARIOS.class, w.fix);
  const counter = w.fix && {
    repeat: [runMission(SCENARIOS.repeatClass, "none"), runMission(SCENARIOS.repeatClass, w.fix)] as const,
    fresh: [runMission(SCENARIOS.newClass, "none"), runMission(SCENARIOS.newClass, w.fix)] as const,
  };
  const failedFresh = counter && counter.fresh[1].totalMs > counter.fresh[0].totalMs * 0.5;

  const stage = w.stage;
  const current: MissionRun | undefined =
    stage === 0 ? (measured(SCENARIOS.single, "none") ? single : undefined) : stage === 1 ? (measured(SCENARIOS.class, "none") ? cls : single) : stage === 2 ? cls : stage === 3 ? (fixed ?? cls) : counter ? counter.fresh[1] : cls;

  const sel = (s: SegmentId) => {
    setSelected(s);
    if (stage === 2) setW((x) => ({ ...x, hypothesis: s }));
  };

  const views = (runs: { run: MissionRun; label: string; before?: boolean }[], timelineShown = 4) => (
    <div className={styles.views} data-view={view}>
      <div className={styles.tabs} role="tablist" aria-label="Көрініс">
        <button type="button" role="tab" aria-selected={view === "map"} onClick={() => setView("map")}>
          Карта
        </button>
        <button type="button" role="tab" aria-selected={view === "time"} onClick={() => setView("time")}>
          Уақыт
        </button>
      </div>
      <section className={styles.mapPane} aria-label="Карта">
        <CityMap selected={selected} onSelect={sel} lit={lit} />
      </section>
      <section className={styles.timePane} aria-label="Уақыт жолағы">
        {runs.length ? <Timeline runs={runs} selected={selected} onSelect={sel} shown={timelineShown} /> : <p className={styles.muted}>Әзірге сұраныс жоқ.</p>}
      </section>
      <section className={styles.metricsPane} aria-label="Көрсеткіштер">
        <Metrics run={current} selected={selected} />
      </section>
    </div>
  );

  const reportReady = !!w.report.before && !!w.report.after && w.report.before !== w.report.after && w.report.text.trim().length >= 40;

  return (
    <div className={`${film.page} ${landing.landing}`}>
      <FilmHeader />
      <main className={styles.page}>
        <header className={styles.head}>
          <p className={landing.micro}>МИССИЯ 01 / БІР ҚАЛАНЫҢ ИНТЕРНЕТІ</p>
          <ol className={styles.stepper} aria-label="Миссия кезеңдері">
            {STAGE_TITLE.map((t, i) => (
              <li key={t}>
                <button type="button" aria-current={stage === i ? "step" : undefined} disabled={i > w.reached} onClick={() => go(i)}>
                  <span>{i + 1}</span>
                  <em>{t}</em>
                </button>
              </li>
            ))}
          </ol>
          <h1 className={styles.question}>{QUESTION[stage]}</h1>
        </header>

        {stage === 0 && (
          <>
            {views(measured(SCENARIOS.single, "none") ? [{ run: single, label: SCENARIOS.single.title }] : [], shown)}
            <div className={styles.actions}>
              <button type="button" className={landing.primary} onClick={send}>
                Сұраныс жіберу
              </button>
              {stepMode && measured(SCENARIOS.single, "none") && shown < 4 && (
                <button type="button" className={landing.secondary} onClick={stepOnce}>
                  Келесі қадам
                </button>
              )}
              <label className={styles.check}>
                <input type="checkbox" checked={stepMode} onChange={(e) => setStepMode(e.target.checked)} /> Қадамдап жүргізу
              </label>
              {measured(SCENARIOS.single, "none") && shown >= 4 && (
                <button type="button" className={landing.secondary} onClick={() => go(1)}>
                  Сабақ басталды →
                </button>
              )}
            </div>
            {measured(SCENARIOS.single, "none") && shown >= 4 && (
              <p className={styles.note}>
                Төрт аралық, төрт түрлі жұмыс. Бәрі қосылып {formatMs(single.totalMs)} болды. Таңертең сайт жылдам.
              </p>
            )}
          </>
        )}

        {stage === 1 && (
          <>
            {views([{ run: single, label: SCENARIOS.single.title, before: true }, ...(measured(SCENARIOS.class, "none") ? [{ run: cls, label: SCENARIOS.class.title }] : [])])}
            <div className={styles.actions}>
              <button type="button" className={landing.primary} onClick={() => record(SCENARIOS.class, "none")}>
                Бір сынып қатар кірсін
              </button>
              {measured(SCENARIOS.class, "none") && (
                <button type="button" className={landing.secondary} onClick={() => go(2)}>
                  Себебін іздеу →
                </button>
              )}
            </div>
            {measured(SCENARIOS.class, "none") && (
              <p className={styles.note}>
                Сол бет, сол сервер. Бір телефонда {formatMs(single.totalMs)}, ал {M.classSize} телефон бірге кіргенде {formatMs(cls.totalMs)}. Жеке сұраныстың жылдамдығы мен жүйенің жүктемеге төзімділігі екі түрлі қасиет.
              </p>
            )}
          </>
        )}

        {stage === 2 && (
          <>
            {views([{ run: cls, label: SCENARIOS.class.title }])}
            <p className={styles.note}>Картадан нысанды не уақыт жолағынан аралықты таңда: болжамың сол болады.</p>
            {w.hypothesis && (
              <div className={styles.verdict} data-ok={w.hypothesis === slowestSegment(cls)} role="status">
                {w.hypothesis === slowestSegment(cls) ? (
                  <p>
                    Дәлел табылды. {SEG.download.name} {formatMs(cls.segments[3]!.ms)} алады, қалғаны бірге {formatMs(cls.totalMs - cls.segments[3]!.ms)}. {M.classSize} телефон бір арнамен {Math.round(cls.allKB / 1000)} МБ тартып жатыр.
                  </p>
                ) : (
                  <p>
                    {SEG[w.hypothesis].name}: {formatMs(cls.segments.find((s) => s.id === w.hypothesis)!.ms)}. Бұл жүйенің баяулауын түсіндіре ме? Ең ұзын аралықты тап.
                  </p>
                )}
              </div>
            )}
            <div className={styles.actions}>
              {w.hypothesis === slowestSegment(cls) && (
                <button type="button" className={landing.primary} onClick={() => go(3)}>
                  Түзетуді таңдау →
                </button>
              )}
            </div>
          </>
        )}

        {stage === 3 && (
          <>
            <fieldset className={styles.fixes}>
              <legend>Бір жақсарту</legend>
              {(Object.keys(FIX) as (keyof typeof FIX)[]).map((f) => (
                <label key={f} className={styles.fix} data-on={w.fix === f}>
                  <input
                    type="radio"
                    name="fix"
                    checked={w.fix === f}
                    onChange={() => {
                      record(SCENARIOS.class, f);
                      setW((x) => ({ ...x, fix: f }));
                    }}
                  />
                  <span>
                    <strong>{FIX[f].title}</strong>
                    <span>{FIX[f].detail}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            {views([{ run: cls, label: `${SCENARIOS.class.title}: бұрын`, before: true }, ...(fixed ? [{ run: fixed, label: `${FIX[w.fix!].title}: кейін` }] : [])])}
            {fixed && (
              <>
                <p className={styles.note}>
                  {formatMs(cls.totalMs)} → {formatMs(fixed.totalMs)}. Шешілді ме? Тексеріп көрейік.
                </p>
                <div className={styles.actions}>
                  <button type="button" className={landing.primary} onClick={() => go(4)}>
                    Қарсы сынақ →
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {stage === 4 && counter && w.fix && (
          <>
            <div className={styles.pair}>
              <div>
                <h2 className={styles.h3}>{SCENARIOS.repeatClass.title}</h2>
                <Timeline
                  runs={[
                    { run: counter.repeat[0], label: "Бұрын", before: true },
                    { run: counter.repeat[1], label: FIX[w.fix].title },
                  ]}
                  selected={selected}
                  onSelect={setSelected}
                />
              </div>
              <div>
                <h2 className={styles.h3}>{SCENARIOS.newClass.title}</h2>
                <Timeline
                  runs={[
                    { run: counter.fresh[0], label: "Бұрын", before: true },
                    { run: counter.fresh[1], label: FIX[w.fix].title },
                  ]}
                  selected={selected}
                  onSelect={setSelected}
                />
              </div>
            </div>
            <div className={styles.verdict} data-ok={!failedFresh} role="status">
              {failedFresh ? (
                <p>
                  <strong>Қарсы мысал.</strong> Кэш кеше кірген сыныпқа көмектесті ({formatMs(counter.repeat[0].totalMs)} → {formatMs(counter.repeat[1].totalMs)}), бірақ жаңа сынып бірінші кіргенде {formatMs(counter.fresh[1].totalMs)} күтеді. Олардың телефонында сақталған сурет жоқ: ірі файл мәселесі сол күйі қалды.
                </p>
              ) : (
                <p>
                  Кішірейтілген суреттер екі жағдайда да көмектесті: кеше кірген сынып {formatMs(counter.repeat[1].totalMs)}, жаңа сынып {formatMs(counter.fresh[1].totalMs)}. Арнамен өтетін байттың өзі азайды.
                </p>
              )}
            </div>
            <div className={styles.actions}>
              {failedFresh && (
                <button
                  type="button"
                  className={landing.secondary}
                  onClick={() => {
                    record(SCENARIOS.newClass, "none");
                    record(SCENARIOS.newClass, w.fix!);
                    setW((x) => ({ ...x, tried: x.tried.includes(x.fix!) ? x.tried : [...x.tried, x.fix!], stage: 3 }));
                  }}
                >
                  Басқа түзетуді сынау
                </button>
              )}
              <button
                type="button"
                className={landing.primary}
                onClick={() => {
                  record(SCENARIOS.repeatClass, w.fix!);
                  record(SCENARIOS.newClass, "none");
                  record(SCENARIOS.newClass, w.fix!);
                  go(5);
                }}
              >
                Есеп жазу →
              </button>
            </div>
          </>
        )}

        {stage === 5 && (
          <section className={styles.report} aria-labelledby="report-title">
            <h2 id="report-title" className={styles.h3}>
              Инженерлік есеп
            </h2>
            <label className={styles.field}>
              <span>Бастапқы өлшем</span>
              <select value={w.report.before ?? ""} onChange={(e) => setW((x) => ({ ...x, done: false, report: { ...x.report, before: e.target.value || undefined } }))}>
                <option value="">таңда</option>
                {w.measures.map((m) => (
                  <option key={measureKey(m)} value={measureKey(m)}>
                    {measureLabel(m)}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Кейінгі өлшем</span>
              <select value={w.report.after ?? ""} onChange={(e) => setW((x) => ({ ...x, done: false, report: { ...x.report, after: e.target.value || undefined } }))}>
                <option value="">таңда</option>
                {w.measures.map((m) => (
                  <option key={measureKey(m)} value={measureKey(m)}>
                    {measureLabel(m)}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Қорытынды: не өзгерттің, кімге көмектесті, кімге көмектеспеді?</span>
              <textarea rows={5} value={w.report.text} onChange={(e) => setW((x) => ({ ...x, done: false, report: { ...x.report, text: e.target.value } }))} />
              <small>{w.report.text.trim().length < 40 ? `Тағы кемінде ${40 - w.report.text.trim().length} таңба` : "Жеткілікті"}</small>
            </label>
            <div className={styles.actions}>
              <button
                type="button"
                className={landing.primary}
                disabled={!reportReady}
                onClick={() => {
                  finishMission();
                  setW((x) => ({ ...x, done: true }));
                }}
              >
                Есепті сақтау
              </button>
            </div>
            {w.done && (
              <article className={styles.card} aria-label="Сақталған есеп">
                <p className={landing.micro}>ЕСЕП САҚТАЛДЫ</p>
                <p>
                  <b>Дейін:</b> {measureLabel(w.measures.find((m) => measureKey(m) === w.report.before)!)}
                </p>
                <p>
                  <b>Кейін:</b> {measureLabel(w.measures.find((m) => measureKey(m) === w.report.after)!)}
                </p>
                <p className={styles.cardText}>{w.report.text}</p>
                <Link href="/passport">Паспортқа өту</Link>
              </article>
            )}
          </section>
        )}

        <p className={styles.model}>
          Модель v0, жеңілдетілген: сыныптың бәрі бір сәтте кіреді, Wi-Fi арнасы ({(M.uplinkKBps * 8) / 1000} Мбит/с) жүктеулерге тең бөлінеді, серверде {M.workers} жұмысшы бар, бақыланатын телефон кезектің ортасында тұр.
        </p>
      </main>
    </div>
  );
}
