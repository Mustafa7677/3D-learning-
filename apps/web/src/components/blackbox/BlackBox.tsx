"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BOXES,
  PART_TYPES,
  TASK,
  addPart,
  check,
  describeCounter,
  expression,
  findBox,
  lampOf,
  nodeValues,
  removePart,
  sourcesFor,
  type BoxId,
  type Build,
  type Counter,
  type PartType,
} from "@inside-tech/lab-arch";
import { emptySave, freshBox, loadBlackBox, markSolved, saveBlackBox, type BlackBoxSave, type BoxProgress } from "@/lib/blackbox";
import { FilmHeader } from "../film/FilmHeader";
import film from "../film/film.module.css";
import landing from "../film/landing.module.css";
import styles from "./blackbox.module.css";

const nodeName = (id: string) => (id === "A" || id === "B" ? id : id.replace("g", "Э"));

/** The parts of a circuit as readable rows: "Э1: A OR B = 1". */
function CircuitList({ build, a, b, caption }: { build: Build; a: number; b: number; caption: string }) {
  const v = nodeValues(build, a, b);
  return (
    <figure className={styles.circuit}>
      <figcaption>{caption}</figcaption>
      <ol>
        {build.parts.map((p) => (
          <li key={p.id} data-on={v[p.id] === 1}>
            <span className={styles.node}>{nodeName(p.id)}</span>
            <span>{p.type === "NOT" ? `NOT ${nodeName(p.in[0])}` : `${nodeName(p.in[0])} ${p.type} ${nodeName(p.in[1])}`}</span>
            <b>{v[p.id]}</b>
          </li>
        ))}
        <li className={styles.lampRow} data-on={lampOf(build, a, b) === 1}>
          <span className={styles.node}>Шам</span>
          <span>← {nodeName(build.out)}</span>
          <b>{lampOf(build, a, b)}</b>
        </li>
      </ol>
      <p className={styles.expr}>Шам = {expression(build).replace(/g(\d+)/g, "Э$1")}</p>
    </figure>
  );
}

export function BlackBox() {
  const [save, setSave] = useState<BlackBoxSave>(emptySave);
  const [loaded, setLoaded] = useState(false);
  const [a, setA] = useState(0);
  const [b, setB] = useState(0);
  const [flash, setFlash] = useState<number | null>(null);
  const [counter, setCounter] = useState<Counter | null>(null);
  const [justOpened, setJustOpened] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setSave(loadBlackBox());
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) saveBlackBox(save);
  }, [save, loaded]);

  const box = findBox(save.current)!;
  const prog = save.boxes[save.current];
  const solved = save.solved.includes(box.id);
  const lamp = box.rule(a, b);
  const mine = lampOf(prog.build, a, b);
  const values = useMemo(() => nodeValues(prog.build, a, b), [prog.build, a, b]);

  const update = (f: (p: BoxProgress) => BoxProgress) => setSave((s) => ({ ...s, boxes: { ...s.boxes, [s.current]: f(s.boxes[s.current]) } }));
  const setBuild = (f: (b: Build) => Build) => {
    setCounter(null);
    update((p) => ({ ...p, build: f(p.build) }));
  };

  const choose = (id: BoxId) => {
    setSave((s) => ({ ...s, current: id }));
    setA(0);
    setB(0);
    setCounter(null);
    setFlash(null);
    setJustOpened(false);
  };

  const record = () => {
    const i = prog.log.findIndex((r) => r.a === a && r.b === b);
    if (i >= 0) {
      setFlash(i);
    } else {
      update((p) => ({ ...p, log: [...p.log, { a, b, lamp }] }));
      setFlash(prog.log.length);
    }
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 1600);
  };

  const test = () => {
    const v = check(prog.build, box);
    if (v.ok) {
      setCounter(null);
      setJustOpened(true);
      setSave((s) => markSolved(s, box.id));
    } else {
      setCounter(v.counter);
    }
  };

  const next = BOXES[(BOXES.findIndex((x) => x.id === box.id) + 1) % BOXES.length]!;

  const toggle = (name: "A" | "B", on: number, set: (v: number) => void) => (
    <button type="button" role="switch" aria-checked={on === 1} className={styles.switch} onClick={() => set(1 - on)}>
      <span className={styles.lever} aria-hidden />
      <span className={styles.switchText}>
        <strong>
          {name} = {on}
        </strong>
        <span>{box.labels[name]}</span>
      </span>
    </button>
  );

  return (
    <div className={`${film.page} ${landing.landing}`}>
      <FilmHeader
        lead={
          <Link href="/labs/arch" className={film.menuLink}>
            Computer Architecture
          </Link>
        }
      />
      <main className={styles.page}>
        <header className={styles.head}>
          <p className={landing.micro}>ОЙЫН / ҚАРА ЖӘШІК</p>
          <h1 className={styles.title}>Қара жәшік</h1>
          <nav className={styles.boxes} aria-label="Жәшіктер">
            {BOXES.map((x, i) => (
              <button key={x.id} type="button" aria-pressed={x.id === box.id} onClick={() => choose(x.id)}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                {x.title}
                {x.id === "pair" && !save.solved.length && <em>бастау үшін</em>}
                {save.solved.includes(x.id) && <em>ашылды</em>}
              </button>
            ))}
          </nav>
          <p className={styles.story}>{box.story}</p>
          <p className={styles.task}>{TASK}</p>
        </header>

        <div className={styles.grid}>
          <section className={styles.device} aria-label="Құрылғы" data-open={solved} data-instant={!justOpened}>
            <div className={styles.switches}>
              {toggle("A", a, setA)}
              {toggle("B", b, setB)}
            </div>
            <div className={styles.wires} aria-hidden>
              <span data-on={a === 1} />
              <span data-on={b === 1} />
            </div>
            <div className={styles.box}>
              <div className={styles.lid} aria-hidden>
                <span>?</span>
              </div>
              <div className={styles.inside}>{solved ? <CircuitList build={box.inside} a={a} b={b} caption="Жәшіктің іші" /> : <p>Жабық</p>}</div>
            </div>
            <div className={styles.wireOut} data-on={lamp === 1} aria-hidden />
            <div className={styles.lamp} data-on={lamp === 1}>
              <span className={styles.bulb} aria-hidden />
              <span>{box.labels.lamp}</span>
            </div>
            <p className={styles.readout} aria-live="polite">
              A={a} · B={b} · Шам={lamp} ({lamp ? "жанып тұр" : "сөніп тұр"})
            </p>
          </section>

          <div className={styles.work}>
            <section className={styles.panel} aria-labelledby="bb-log">
              <div className={styles.panelHead}>
                <h2 id="bb-log">Тәжірибе кестесі</h2>
                <button type="button" className={landing.secondary} onClick={record}>
                  Нәтижені жазу
                </button>
              </div>
              {prog.log.length === 0 ? (
                <p className={styles.muted}>Қосқыштарды ауыстырып, байқағаныңды жаз. Төрт жолдың бәрі міндетті емес: ережені түсінсең, бірден сұлба құрастыр.</p>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">A</th>
                      <th scope="col">B</th>
                      <th scope="col">Шам</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prog.log.map((r, i) => (
                      <tr key={`${r.a}${r.b}`} data-flash={flash === i}>
                        <td>{r.a}</td>
                        <td>{r.b}</td>
                        <td>{r.lamp ? "жанды (1)" : "сөнді (0)"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section className={styles.panel} aria-labelledby="bb-build">
              <div className={styles.panelHead}>
                <h2 id="bb-build">Сенің сұлбаң</h2>
                <div className={styles.add}>
                  {PART_TYPES.map((t) => (
                    <button key={t} type="button" onClick={() => setBuild((bl) => addPart(bl, t as PartType))} aria-label={`${t} элементін қосу`}>
                      + {t}
                    </button>
                  ))}
                </div>
              </div>
              {prog.build.parts.length === 0 && <p className={styles.muted}>Элемент қос. Әр элементтің кірісін A, B немесе алдыңғы элементтен таңда.</p>}
              <ol className={styles.parts}>
                {prog.build.parts.map((p, i) => {
                  const srcs = sourcesFor(prog.build, i);
                  const pick = (k: 0 | 1, label: string) => (
                    <label className={styles.pick}>
                      <span className={styles.sr}>{label}</span>
                      <select
                        value={p.in[k]}
                        onChange={(e) =>
                          setBuild((bl) => ({
                            ...bl,
                            parts: bl.parts.map((q) => (q.id === p.id ? { ...q, in: (k === 0 ? [e.target.value, q.in[1]] : [q.in[0], e.target.value]) as [string, string] } : q)),
                          }))
                        }
                      >
                        {srcs.map((s) => (
                          <option key={s} value={s}>
                            {nodeName(s)}
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                  return (
                    <li key={p.id} data-on={values[p.id] === 1}>
                      <span className={styles.node}>{nodeName(p.id)}</span>
                      {p.type === "NOT" ? null : pick(0, `${nodeName(p.id)}: бірінші кіріс`)}
                      <label className={styles.pick}>
                        <span className={styles.sr}>{nodeName(p.id)}: элемент түрі</span>
                        <select
                          className={styles.type}
                          value={p.type}
                          onChange={(e) => setBuild((bl) => ({ ...bl, parts: bl.parts.map((q) => (q.id === p.id ? { ...q, type: e.target.value as PartType } : q)) }))}
                        >
                          {PART_TYPES.map((t) => (
                            <option key={t}>{t}</option>
                          ))}
                        </select>
                      </label>
                      {p.type === "NOT" ? pick(0, `${nodeName(p.id)}: кіріс`) : pick(1, `${nodeName(p.id)}: екінші кіріс`)}
                      <b className={styles.val} aria-label={`${nodeName(p.id)} мәні ${values[p.id]}`}>
                        {values[p.id]}
                      </b>
                      <button type="button" className={styles.remove} onClick={() => setBuild((bl) => removePart(bl, p.id))} aria-label={`${nodeName(p.id)} элементін өшіру`}>
                        ×
                      </button>
                    </li>
                  );
                })}
              </ol>
              <div className={styles.outRow}>
                <label className={styles.pick}>
                  <span>Шамға қосылған:</span>
                  <select value={prog.build.out} onChange={(e) => setBuild((bl) => ({ ...bl, out: e.target.value }))}>
                    {["A", "B", ...prog.build.parts.map((p) => p.id)].map((s) => (
                      <option key={s} value={s}>
                        {nodeName(s)}
                      </option>
                    ))}
                  </select>
                </label>
                <span className={styles.mine} data-on={mine === 1}>
                  Сенің шамың: {mine}
                </span>
              </div>
              <p className={styles.expr}>Сенің өрнегің: Шам = {expression(prog.build).replace(/g(\d+)/g, "Э$1")}</p>

              <div className={styles.actions}>
                <button type="button" className={landing.primary} onClick={test}>
                  Тексеру
                </button>
                {!solved && prog.hint < 2 && (
                  <button type="button" className={styles.link} onClick={() => update((p) => ({ ...p, hint: p.hint + 1 }))}>
                    {prog.hint === 0 ? "Ишара" : "Тағы бір ишара"}
                  </button>
                )}
              </div>
              {prog.hint > 0 && !solved && (
                <ol className={styles.hints}>
                  {box.hints.slice(0, prog.hint).map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ol>
              )}

              {counter && (
                <div className={styles.counter} role="alert">
                  <p>
                    <strong>Сәйкес келмеді.</strong> {describeCounter(counter)}
                  </p>
                  <button
                    type="button"
                    className={landing.secondary}
                    onClick={() => {
                      setA(counter.a);
                      setB(counter.b);
                    }}
                  >
                    Осы жағдайды құрылғыға қою
                  </button>
                  {a === counter.a && b === counter.b && <p className={styles.muted}>Құрылғы осы жағдайда. Әр элементтің мәніне қара: қай жерде шам басқа жаққа кетті?</p>}
                </div>
              )}
            </section>
          </div>
        </div>

        {solved && (
          <section className={styles.reveal} aria-labelledby="bb-reveal">
            <p className={landing.micro}>ЖӘШІК АШЫЛДЫ</p>
            <h2 id="bb-reveal" className={styles.formula}>
              {box.formula}
            </h2>
            <div className={styles.compare}>
              <CircuitList build={prog.build} a={a} b={b} caption="Сенің сұлбаң" />
              <CircuitList build={box.inside} a={a} b={b} caption="Жәшіктің іші" />
            </div>
            <p className={styles.conclusion}>{box.conclusion}</p>
            {save.solved.length < BOXES.length ? (
              <button type="button" className={landing.primary} onClick={() => choose(next.id)}>
                Келесі жәшік: {next.title}
              </button>
            ) : (
              <p className={styles.muted}>Үш жәшіктің бәрі ашылды.</p>
            )}
            <button
              type="button"
              className={styles.link}
              onClick={() => {
                update(() => freshBox());
                setSave((s) => ({ ...s, solved: s.solved.filter((x) => x !== box.id) }));
                setJustOpened(false);
              }}
            >
              Бұл жәшікті қайта бастау
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
