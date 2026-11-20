"use client";

import { useEffect, useMemo, useState } from "react";
import { compileLesson, type LessonDefinition, type LessonSpec } from "@inside-tech/lesson-engine";
import type { Recording } from "@inside-tech/sim-core";
import { classSessions, errorText, getAuthored, sessionDetail, type SessionDetail, type SessionsReport } from "@/lib/api";
import { pluginFor } from "@/lib/labPort";
import { findLesson } from "@/lib/lessons";
import { replayFrames, type ReplayFrame } from "@/lib/replayFrames";
import panel from "./platform.module.css";

type AnyLesson = LessonDefinition<unknown, unknown>;

const minutes = (ms?: number) => (ms == null ? "-" : ms < 60_000 ? `${Math.round(ms / 1000)} с` : `${(ms / 60_000).toFixed(1)} мин`);

/** The lesson definition for a built-in or a teacher-made lesson. */
function useLessonDef(lessonId: string): AnyLesson | undefined {
  const builtIn = findLesson(lessonId)?.entry.lesson as AnyLesson | undefined;
  const [custom, setCustom] = useState<AnyLesson>();
  useEffect(() => {
    if (builtIn || !lessonId.startsWith("custom-")) return;
    getAuthored(lessonId).then((l) => setCustom(compileLesson(l.spec as LessonSpec) as AnyLesson), () => undefined);
  }, [lessonId, builtIn]);
  return builtIn ?? custom;
}

function questionText(lesson: AnyLesson | undefined, key: string): string {
  const [stepId, qid] = key.split("/");
  const step = lesson?.steps.find((s) => s.id === stepId);
  const q = step?.quiz?.find((x) => x.id === qid);
  return q ? `${step!.title}: ${q.question}` : key;
}

function Replay({ classId, lessonId, learnerId, name, lesson, onClose }: { classId: string; lessonId: string; learnerId: string; name: string; lesson: AnyLesson; onClose(): void }) {
  const [detail, setDetail] = useState<SessionDetail>();
  const [error, setError] = useState("");
  const [at, setAt] = useState(0);
  useEffect(() => {
    sessionDetail(classId, lessonId, learnerId).then(setDetail, (e) => setError(errorText(e)));
  }, [classId, lessonId, learnerId]);

  const frames: ReplayFrame[] = useMemo(() => {
    const plugin = detail && pluginFor(detail.kind);
    if (!detail?.recording || !plugin) return [];
    try {
      return replayFrames(plugin, detail.recording as Recording<unknown>, lesson);
    } catch {
      return [];
    }
  }, [detail, lesson]);

  const objectiveTitle = (stepId: string, id: string) => lesson.steps.find((s) => s.id === stepId)?.objectives.find((o) => o.id === id)?.text ?? id;
  const firstHold = useMemo(() => {
    const out: { frame: number; text: string }[] = [];
    const seen = new Set<string>();
    frames.forEach((f, i) =>
      Object.entries(f.holds).forEach(([s, ids]) =>
        ids.forEach((id) => {
          const k = `${s}/${id}`;
          if (!seen.has(k)) {
            seen.add(k);
            out.push({ frame: i, text: objectiveTitle(s, id) });
          }
        }),
      ),
    );
    return out;
  }, [frames]); // eslint-disable-line react-hooks/exhaustive-deps

  const f = frames[at];
  const mistakes = (detail?.events ?? []).filter((e) => e.type === "wrong" || e.type === "undo" || e.type === "restart");
  return (
    <section className={panel.card} aria-label={`${name}: replay`}>
      <div className={panel.row}>
        <h3 style={{ margin: 0 }}>{name}: сессияны қайта көру</h3>
        <button type="button" className="btn" onClick={onClose}>
          Жабу
        </button>
      </div>
      {error && <p className={panel.status}>{error}</p>}
      {detail && frames.length === 0 && <p className={panel.muted}>Бұл сессияда симуляция журналы жоқ: тек оқиғалар бар.</p>}
      {frames.length > 0 && f && (
        <>
          <label htmlFor="replay-at">
            Әрекет {at + 1} / {frames.length} · {f.time.toFixed(1)} с
          </label>
          <input id="replay-at" type="range" min={0} max={frames.length - 1} value={at} onChange={(e) => setAt(Number(e.target.value))} style={{ width: "100%" }} />
          <p>
            <code>{JSON.stringify(f.action).slice(0, 160)}</code>
          </p>
          <p className={panel.muted}>Осы сәтте орындалып тұрған тапсырмалар:</p>
          <ul className={panel.list}>
            {Object.entries(f.holds).flatMap(([s, ids]) => ids.map((id) => <li key={`${s}/${id}`}>✓ {objectiveTitle(s, id)}</li>))}
            {Object.keys(f.holds).length === 0 && <li className={panel.muted}>Әзірге ешқайсысы</li>}
          </ul>
          <h4>Тапсырмалар қай әрекетте орындалды</h4>
          <ol className={panel.list}>
            {firstHold.map((h) => (
              <li key={h.text}>
                <button type="button" className="btn" onClick={() => setAt(h.frame)}>
                  {h.frame + 1}-әрекет
                </button>{" "}
                {h.text}
              </li>
            ))}
          </ol>
        </>
      )}
      {mistakes.length > 0 && (
        <>
          <h4>Қателер мен қайталаулар</h4>
          <ul className={panel.list}>
            {mistakes.map((e, i) => {
              const step = lesson.steps.find((s) => s.id === e.step);
              const q = step?.quiz?.find((x) => x.id === e.q);
              return (
                <li key={i}>
                  {minutes(e.t)}: {step?.title ?? e.step}:{" "}
                  {e.type === "wrong" ? `қате жауап «${q?.options[e.o ?? -1] ?? e.o}» (${q?.question ?? e.q})` : e.type === "undo" ? "әрекетті болдырмады" : "кезеңді қайта бастады"}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

/** Per assignment: who got stuck where, the class's hardest questions, and replays. */
export function AnalyticsPanel({ classId, lessonId, title, onClose }: { classId: string; lessonId: string; title: string; onClose(): void }) {
  const lesson = useLessonDef(lessonId);
  const [data, setData] = useState<SessionsReport>();
  const [error, setError] = useState("");
  const [replay, setReplay] = useState<{ id: string; name: string }>();
  useEffect(() => {
    classSessions(classId, lessonId).then(setData, (e) => setError(errorText(e)));
  }, [classId, lessonId]);

  const steps = lesson?.steps ?? [];
  return (
    <section className={panel.card} aria-labelledby={`an-${classId}-${lessonId}`}>
      <div className={panel.row}>
        <h3 id={`an-${classId}-${lessonId}`} style={{ margin: 0 }}>
          Талдау: {title}
        </h3>
        <button type="button" className="btn" onClick={onClose}>
          Жабу
        </button>
      </div>
      {error && <p className={panel.status}>{error}</p>}
      {data && (
        <>
          {data.hardest.length > 0 && (
            <>
              <h4>Ең көп қателескен сұрақтар</h4>
              <ol className={panel.list}>
                {data.hardest.map((h) => (
                  <li key={h.key}>
                    {questionText(lesson, h.key)}: {h.wrong} қате, {h.learners} оқушы
                  </li>
                ))}
              </ol>
            </>
          )}
          <div className={panel.tableWrap}>
            <table className={panel.table}>
              <thead>
                <tr>
                  <th scope="col">Оқушы</th>
                  {steps.map((s) => (
                    <th key={s.id} scope="col">
                      {s.title}
                    </th>
                  ))}
                  <th scope="col">Қате жауап</th>
                  <th scope="col">Болдырмау / қайта бастау</th>
                  <th scope="col">Replay</th>
                </tr>
              </thead>
              <tbody>
                {data.students.map((s) => (
                  <tr key={s.learnerId}>
                    <th scope="row">{s.name}</th>
                    {steps.map((st) => (
                      <td key={st.id} data-state={s.stepsDone?.includes(st.id) ? "done" : s.stepMs?.[st.id] ? "started" : "none"}>
                        {s.stepMs?.[st.id] ? minutes(s.stepMs[st.id]) : "-"}
                      </td>
                    ))}
                    <td>{s.started ? Object.values(s.wrong ?? {}).reduce((a, b) => a + b, 0) : "-"}</td>
                    <td>{s.started ? `${s.undos ?? 0} / ${s.restarts ?? 0}` : "-"}</td>
                    <td>
                      {s.started ? (
                        <button type="button" className="btn" onClick={() => setReplay({ id: s.learnerId, name: s.name })}>
                          Көру
                        </button>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={panel.muted}>Ұяшықтарда: кезеңде өткізген уақыт; жасыл: кезең аяқталған.</p>
        </>
      )}
      {replay && lesson && <Replay classId={classId} lessonId={lessonId} learnerId={replay.id} name={replay.name} lesson={lesson} onClose={() => setReplay(undefined)} />}
    </section>
  );
}
