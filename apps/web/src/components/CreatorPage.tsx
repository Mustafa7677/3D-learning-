"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiEnabled, authoredHref, errorText, saveAuthored } from "@/lib/api";
import { decodeLessonSpec, encodeLessonSpec, validateLessonSpec, type LessonSpec, type ObjectiveSpec, type QuizQuestion, type StepSpec } from "@inside-tech/lesson-engine";
import {
  KINDS,
  KIND_IDS,
  freshId,
  hasSetup,
  kindInfo,
  loadCustomLessons,
  newSpec,
  playLink,
  presetOf,
  presetText,
  saveCustomLessons,
  toggleSetup,
} from "@/lib/creator";
import type { LabKind } from "@/lib/labPort";
import { Prose } from "./lab/Prose";
import { SpecLessonView } from "./lab/LessonView";
import { SiteHeader } from "./SiteHeader";
import styles from "./home.module.css";
import panel from "./platform.module.css";
import css from "./creator.module.css";

const STARTER_BODY = `## Идея
Оқушыға не болып жатқанын бір-екі сөйлеммен түсіндір.

## Есептеп көрейік
Нақты мысал: сандармен.

> ⚠ Жиі қате: оқушылар көбіне қай жерде шатасады?

## Енді сен
Не істеу керегін нақты айт.`;

/** Lesson Creator: build, test-play and share lessons for any lab, without code. */
export function CreatorPage() {
  const [lessons, setLessons] = useState<LessonSpec[]>([]);
  const [current, setCurrent] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [status, setStatus] = useState("");
  const [newKind, setNewKind] = useState<LabKind>("classifier");
  const loaded = useRef(false);

  // Load saved lessons, plus one shared through "#import=<code>".
  useEffect(() => {
    const list = loadCustomLessons().filter((l) => l && l.format === "inside-tech/lesson@1" && Array.isArray(l.steps) && l.steps.length > 0);
    const m = /import=([A-Za-z0-9_-]+)/.exec(window.location.hash);
    if (m) {
      const spec = decodeLessonSpec(m[1]!);
      const issues = validateLessonSpec(spec, KIND_IDS);
      if (issues.length === 0) {
        const copy = { ...(spec as LessonSpec), id: `${(spec as LessonSpec).id.slice(0, 50)}-${Date.now().toString(36)}` };
        list.push(copy);
        setStatus(`«${copy.title}» сабағының көшірмесі қосылды.`);
      } else setStatus("Сілтемедегі сабақ бүлінген не дұрыс емес.");
    }
    setLessons(list);
    setCurrent(list.length ? list.length - 1 : -1);
    loaded.current = true;
  }, []);

  useEffect(() => {
    if (loaded.current && !saveCustomLessons(lessons)) setStatus("Браузер сақтауға рұқсат бермеді — JSON-ды жүктеп ал.");
  }, [lessons]);

  const spec = lessons[current];
  const issues = useMemo(() => (spec ? validateLessonSpec(spec, KIND_IDS) : []), [spec]);

  const update = (fn: (s: LessonSpec) => LessonSpec) => setLessons((list) => list.map((l, i) => (i === current ? fn(l) : l)));

  const create = () => {
    const s = newSpec(newKind);
    s.steps[0]!.body = STARTER_BODY;
    setLessons((l) => [...l, s]);
    setCurrent(lessons.length);
    setPlaying(false);
  };

  const importFile = async (file: File) => {
    try {
      const data: unknown = JSON.parse(await file.text());
      const found = validateLessonSpec(data, KIND_IDS);
      if (found.length) return setStatus(`Файлда ${found.length} қате: ${found[0]!.where} — ${found[0]!.message}`);
      setLessons((l) => [...l, data as LessonSpec]);
      setCurrent(lessons.length);
      setStatus(`«${(data as LessonSpec).title}» импортталды.`);
    } catch {
      setStatus("Файл JSON емес.");
    }
  };

  if (spec && playing) {
    return (
      <>
        <div className={css.playBar} role="region" aria-label="Сынақ режимі">
          <span>
            Сынақ режимі: <strong>{spec.title}</strong> — оқушы осылай көреді.
          </span>
          <button type="button" className="btn btn-primary" onClick={() => setPlaying(false)}>
            Редакторға қайту
          </button>
        </div>
        <SpecLessonView key={JSON.stringify(spec)} spec={spec} preview />
      </>
    );
  }

  return (
    <div className={styles.page}>
      <SiteHeader current="create" />
      <main className={panel.main}>
        <h1>Сабақ жасау</h1>
        <p className={panel.lead}>
          Кез келген зертханаға өз сабағыңды құр: мәтін, тапсырмалар, тексеру сұрақтары. Код керек емес — тапсырмалар симуляцияның өзінде автоматты тексеріледі.
        </p>
        {status && (
          <p className={panel.status} role="status">
            {status}
          </p>
        )}

        <section className={panel.card} aria-labelledby="my-lessons">
          <h2 id="my-lessons">Менің сабақтарым</h2>
          {lessons.length === 0 ? (
            <p className={panel.muted}>Әзірге сабақ жоқ. Симуляцияны таңда да, жаңасын баста.</p>
          ) : (
            <ul className={css.lessonList}>
              {lessons.map((l, i) => (
                <li key={`${l.id}-${i}`}>
                  <button type="button" className="btn" aria-pressed={i === current} onClick={() => setCurrent(i)}>
                    {l.title || "Атаусыз"}
                  </button>
                  <span className={panel.muted}>
                    {kindInfo(l.kind).title} · {l.steps.length} кезең
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className={panel.row}>
            <label htmlFor="new-kind">Симуляция</label>
            <select id="new-kind" className={panel.input} value={newKind} onChange={(e) => setNewKind(e.target.value as LabKind)}>
              {KINDS.map((k) => (
                <option key={k.kind} value={k.kind}>
                  {k.title}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-primary" onClick={create}>
              Жаңа сабақ
            </button>
            <label className="btn">
              JSON импорт
              <input type="file" accept="application/json,.json" className="visually-hidden" onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
            </label>
          </div>
        </section>

        {spec && (
          <LessonEditor
            spec={spec}
            issues={issues}
            update={update}
            onPlay={() => setPlaying(true)}
            onStatus={setStatus}
            onDelete={() => {
              if (!window.confirm(`«${spec.title}» сабағын өшіру керек пе?`)) return;
              setLessons((l) => l.filter((_, i) => i !== current));
              setCurrent(-1);
            }}
          />
        )}
      </main>
    </div>
  );
}

function LessonEditor(props: {
  spec: LessonSpec;
  issues: { where: string; message: string }[];
  update: (fn: (s: LessonSpec) => LessonSpec) => void;
  onPlay(): void;
  onStatus(s: string): void;
  onDelete(): void;
}) {
  const { spec, issues, update } = props;
  const [stepIndex, setStepIndex] = useState(0);
  const si = Math.min(stepIndex, spec.steps.length - 1);
  const step = spec.steps[si]!;
  const info = kindInfo(spec.kind);

  const setStep = (fn: (s: StepSpec) => StepSpec) => update((l) => ({ ...l, steps: l.steps.map((s, i) => (i === si ? fn(s) : s)) }));
  const move = (d: -1 | 1) => {
    const j = si + d;
    if (j < 0 || j >= spec.steps.length) return;
    update((l) => {
      const steps = [...l.steps];
      [steps[si], steps[j]] = [steps[j]!, steps[si]!];
      return { ...l, steps };
    });
    setStepIndex(j);
  };

  const share = async () => {
    const url = playLink(encodeLessonSpec(spec));
    try {
      await navigator.clipboard.writeText(url);
      props.onStatus("Оқушыларға арналған сілтеме көшірілді.");
    } catch {
      window.prompt("Сілтемені көшір:", url);
    }
  };
  /** Server copy: the local lesson id maps to the server id, so saving again updates it. */
  const SERVER_IDS = "inside-tech:authored-ids";
  const saveToServer = async () => {
    let ids: Record<string, string> = {};
    try {
      ids = JSON.parse(localStorage.getItem(SERVER_IDS) ?? "{}") as Record<string, string>;
    } catch {
      /* storage unavailable */
    }
    try {
      const saved = await saveAuthored(spec, ids[spec.id]);
      try {
        localStorage.setItem(SERVER_IDS, JSON.stringify({ ...ids, [spec.id]: saved.id }));
      } catch {
        /* storage unavailable */
      }
      const url = new URL(authoredHref(saved.id), window.location.href).toString();
      props.onStatus(`Серверге сақталды. Енді оны «Мұғалімге» бетінде сыныпқа тапсыра аласың. Сілтеме: ${url}`);
    } catch (e) {
      props.onStatus(errorText(e));
    }
  };
  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(spec, null, 2)], { type: "application/json" }));
    a.download = `${spec.id}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <section className={panel.card} aria-labelledby="editor-title">
      <h2 id="editor-title">Редактор · {info.title}</h2>
      <div className={css.meta}>
        <Field label="Сабақ атауы" value={spec.title} max={80} onChange={(v) => update((l) => ({ ...l, title: v }))} />
        <Field label="Қысқа сипаттама" value={spec.summary} max={200} onChange={(v) => update((l) => ({ ...l, summary: v }))} />
        <label className={css.field}>
          <span>Ұзақтығы (минут)</span>
          <input
            type="number"
            min={1}
            max={120}
            className={panel.input}
            value={spec.estimatedMinutes}
            onChange={(e) => update((l) => ({ ...l, estimatedMinutes: Math.max(1, Math.min(120, Number(e.target.value) || 1)) }))}
          />
        </label>
      </div>

      <div className={css.steps} role="tablist" aria-label="Кезеңдер">
        {spec.steps.map((s, i) => (
          <button key={s.id} type="button" role="tab" aria-selected={i === si} className="btn" onClick={() => setStepIndex(i)}>
            {i + 1}. {s.title || "Атаусыз"}
          </button>
        ))}
        <button
          type="button"
          className="btn"
          disabled={spec.steps.length >= 12}
          onClick={() => {
            const k = kindInfo(spec.kind);
            const c = k.conditions[0]!;
            update((l) => ({
              ...l,
              steps: [
                ...l.steps,
                {
                  id: freshId("step", l.steps.map((s) => s.id)),
                  title: `Кезең ${l.steps.length + 1}`,
                  body: STARTER_BODY,
                  focus: step.focus,
                  onEnter: [],
                  objectives: [{ id: "goal-1", text: presetText(c, c.value ?? 1), when: c.build(c.value ?? 1) }],
                },
              ],
            }));
            setStepIndex(spec.steps.length);
          }}
        >
          + Кезең
        </button>
      </div>

      <div className={css.stepTools}>
        <button type="button" className="btn" disabled={si === 0} onClick={() => move(-1)} aria-label="Кезеңді жоғары жылжыту">
          ↑
        </button>
        <button type="button" className="btn" disabled={si === spec.steps.length - 1} onClick={() => move(1)} aria-label="Кезеңді төмен жылжыту">
          ↓
        </button>
        <button
          type="button"
          className="btn"
          disabled={spec.steps.length === 1}
          onClick={() => {
            update((l) => ({ ...l, steps: l.steps.filter((_, i) => i !== si) }));
            setStepIndex(Math.max(0, si - 1));
          }}
        >
          Кезеңді өшіру
        </button>
      </div>

      <StepEditor key={`${spec.id}-${step.id}`} kind={spec.kind} step={step} setStep={setStep} />

      <div className={css.issues} aria-live="polite">
        {issues.length === 0 ? (
          <p className={css.ok}>✓ Сабақ дұрыс құрылған — оны сынап көруге және бөлісуге болады.</p>
        ) : (
          <>
            <p>Түзету керек ({issues.length}):</p>
            <ul>
              {issues.slice(0, 8).map((i, k) => (
                <li key={k}>
                  <code>{i.where}</code> — {i.message}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className={panel.row}>
        <button type="button" className="btn btn-primary" disabled={issues.length > 0} onClick={props.onPlay}>
          Сынап көру
        </button>
        <button type="button" className="btn" disabled={issues.length > 0} onClick={share}>
          Оқушыларға сілтеме
        </button>
        {apiEnabled && (
          <button type="button" className="btn" disabled={issues.length > 0} onClick={saveToServer}>
            Серверге сақтау
          </button>
        )}
        <button type="button" className="btn" onClick={download}>
          JSON жүктеп алу
        </button>
        <button type="button" className="btn" onClick={props.onDelete}>
          Сабақты өшіру
        </button>
      </div>
    </section>
  );
}

function Field({ label, value, max, onChange }: { label: string; value: string; max: number; onChange(v: string): void }) {
  return (
    <label className={css.field}>
      <span>{label}</span>
      <input className={panel.input} value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function StepEditor({ kind, step, setStep }: { kind: string; step: StepSpec; setStep: (fn: (s: StepSpec) => StepSpec) => void }) {
  const info = kindInfo(kind);
  const setObjective = (j: number, o: ObjectiveSpec) => setStep((s) => ({ ...s, objectives: s.objectives.map((x, k) => (k === j ? o : x)) }));
  const quiz = step.quiz ?? [];
  const setQuiz = (q: QuizQuestion[]) => setStep((s) => ({ ...s, quiz: q.length ? q : undefined }));

  return (
    <div className={css.stepEditor}>
      <div className={css.meta}>
        <Field label="Кезең атауы" value={step.title} max={80} onChange={(v) => setStep((s) => ({ ...s, title: v }))} />
        <label className={css.field}>
          <span>Камера қарайтын жер</span>
          <select className={panel.input} value={step.focus ?? ""} onChange={(e) => setStep((s) => ({ ...s, focus: e.target.value }))}>
            {info.focus.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className={css.group}>
        <legend>Кезең басталғанда</legend>
        <div className={panel.row}>
          {info.setups.map((setup) => (
            <label key={setup.id} className={css.check}>
              <input type="checkbox" checked={hasSetup(step.onEnter, setup)} onChange={() => setStep((s) => ({ ...s, onEnter: toggleSetup(s.onEnter, setup) }))} />
              {setup.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className={css.bodyGrid}>
        <label className={css.field}>
          <span>Лекция мәтіні (## тақырып, - тізім, **қалың**, `код`, &gt; ⚠ ескерту)</span>
          <textarea className={css.textarea} value={step.body} maxLength={4000} onChange={(e) => setStep((s) => ({ ...s, body: e.target.value }))} />
          <small className={panel.muted}>{step.body.length} / 4000</small>
        </label>
        <div className={css.preview} aria-label="Алдын ала қарау">
          <Prose text={step.body} />
        </div>
      </div>

      <fieldset className={css.group}>
        <legend>Тапсырмалар (симуляция автоматты тексереді)</legend>
        {step.objectives.map((o, j) => {
          const match = presetOf(kind, o.when);
          return (
            <div key={o.id} className={css.objective}>
              <select
                className={panel.input}
                aria-label={`${j + 1}-тапсырма шарты`}
                value={match?.preset.id ?? ""}
                onChange={(e) => {
                  const p = info.conditions.find((c) => c.id === e.target.value)!;
                  const v = p.value ?? 1;
                  setObjective(j, { ...o, text: presetText(p, v), when: p.build(v) });
                }}
              >
                {!match && <option value="">Өз шартың (JSON)</option>}
                {info.conditions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              {match?.preset.value !== undefined && (
                <input
                  type="number"
                  className={css.num}
                  aria-label={`${j + 1}-тапсырма саны`}
                  value={match.value}
                  onChange={(e) => {
                    const v = Number(e.target.value) || 0;
                    setObjective(j, { ...o, text: presetText(match.preset, v), when: match.preset.build(v) });
                  }}
                />
              )}
              <input className={panel.input} aria-label={`${j + 1}-тапсырма мәтіні`} value={o.text} maxLength={120} onChange={(e) => setObjective(j, { ...o, text: e.target.value })} />
              <button type="button" className="btn" disabled={step.objectives.length === 1} onClick={() => setStep((s) => ({ ...s, objectives: s.objectives.filter((_, k) => k !== j) }))}>
                Өшіру
              </button>
            </div>
          );
        })}
        <button
          type="button"
          className="btn"
          disabled={step.objectives.length >= 8}
          onClick={() => {
            const p = info.conditions[0]!;
            const v = p.value ?? 1;
            setStep((s) => ({ ...s, objectives: [...s.objectives, { id: freshId("goal", s.objectives.map((x) => x.id)), text: presetText(p, v), when: p.build(v) }] }));
          }}
        >
          + Тапсырма
        </button>
      </fieldset>

      <fieldset className={css.group}>
        <legend>Түсінігін тексеретін сұрақтар</legend>
        {quiz.map((q, j) => (
          <QuestionEditor
            key={q.id}
            n={j + 1}
            q={q}
            onChange={(nq) => setQuiz(quiz.map((x, k) => (k === j ? nq : x)))}
            onRemove={() => setQuiz(quiz.filter((_, k) => k !== j))}
          />
        ))}
        <button
          type="button"
          className="btn"
          disabled={quiz.length >= 6}
          onClick={() =>
            setQuiz([...quiz, { id: freshId("q", quiz.map((x) => x.id)), question: "", options: ["", "", ""], answer: 0, explain: "" }])
          }
        >
          + Сұрақ
        </button>
      </fieldset>

      <label className={css.field}>
        <span>Кеңестер (әр жолға біреу)</span>
        <textarea
          className={css.small}
          value={(step.hints ?? []).join("\n")}
          onChange={(e) => {
            const hints = e.target.value.split("\n").slice(0, 5);
            setStep((s) => ({ ...s, hints: hints.some((h) => h.trim()) ? hints : undefined }));
          }}
        />
      </label>
    </div>
  );
}

function QuestionEditor({ n, q, onChange, onRemove }: { n: number; q: QuizQuestion; onChange(q: QuizQuestion): void; onRemove(): void }) {
  return (
    <div className={css.question}>
      <div className={panel.row}>
        <input className={panel.input} aria-label={`${n}-сұрақ`} placeholder={`${n}-сұрақ`} value={q.question} maxLength={300} onChange={(e) => onChange({ ...q, question: e.target.value })} />
        <button type="button" className="btn" onClick={onRemove}>
          Өшіру
        </button>
      </div>
      {q.options.map((opt, k) => (
        <div key={k} className={css.option}>
          <input
            type="radio"
            name={`answer-${q.id}`}
            aria-label={`${k + 1}-нұсқа дұрыс`}
            checked={q.answer === k}
            onChange={() => onChange({ ...q, answer: k })}
          />
          <input
            className={panel.input}
            aria-label={`${n}-сұрақ, ${k + 1}-нұсқа`}
            placeholder={`${k + 1}-нұсқа`}
            value={opt}
            maxLength={200}
            onChange={(e) => onChange({ ...q, options: q.options.map((o, i) => (i === k ? e.target.value : o)) })}
          />
          <button
            type="button"
            className="btn"
            aria-label={`${k + 1}-нұсқаны өшіру`}
            disabled={q.options.length <= 2}
            onClick={() => onChange({ ...q, options: q.options.filter((_, i) => i !== k), answer: q.answer === k ? 0 : q.answer > k ? q.answer - 1 : q.answer })}
          >
            ×
          </button>
        </div>
      ))}
      <div className={panel.row}>
        <button type="button" className="btn" disabled={q.options.length >= 6} onClick={() => onChange({ ...q, options: [...q.options, ""] })}>
          + Нұсқа
        </button>
      </div>
      <input
        className={panel.input}
        aria-label={`${n}-сұрақ түсіндірмесі`}
        placeholder="Неге бұл жауап дұрыс? (дұрыс жауаптан кейін көрсетіледі)"
        value={q.explain}
        maxLength={400}
        onChange={(e) => onChange({ ...q, explain: e.target.value })}
      />
    </div>
  );
}
