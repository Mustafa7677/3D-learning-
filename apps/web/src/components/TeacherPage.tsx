"use client";

import { useEffect, useState } from "react";
import { apiEnabled, assignLesson, classReport, createClass, errorText, getMe, listClasses, myLessons, signInUrl, type AuthoredInfo, type ClassInfo, type Me, type Report } from "@/lib/api";
import { AnalyticsPanel } from "./AnalyticsPanel";
import { findLab } from "@/lib/catalog";
import { findLesson, lessonEntries } from "@/lib/lessons";
import { SiteHeader } from "./SiteHeader";
import styles from "./home.module.css";
import panel from "./platform.module.css";

const lessonLabel = (id: string, mine: AuthoredInfo[] = []) => {
  const f = findLesson(id);
  if (f) return `${findLab(f.entry.labId)?.title.split(" ")[0]} ${f.entry.lesson.order}. ${f.entry.lesson.title}`;
  const own = mine.find((l) => l.id === id);
  return own ? `Менің сабағым: ${own.title}` : id;
};

function ClassReport({ cls, mine }: { cls: ClassInfo; mine: AuthoredInfo[] }) {
  const [analysis, setAnalysis] = useState<string>();
  const [report, setReport] = useState<Report>();
  const [lessonId, setLessonId] = useState(lessonEntries[0]!.lesson.id);
  const [message, setMessage] = useState("");
  const load = () => classReport(cls.id).then(setReport, (e) => setMessage(errorText(e)));
  useEffect(() => void load(), [cls.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const assign = async (ev: React.FormEvent) => {
    ev.preventDefault();
    try {
      await assignLesson(cls.id, lessonId);
      setMessage(`Тапсырма берілді: ${lessonLabel(lessonId, mine)}`);
      await load();
    } catch (e) {
      setMessage(errorText(e));
    }
  };

  return (
    <section className={panel.card} aria-labelledby={`class-${cls.id}`}>
      <h2 id={`class-${cls.id}`}>{cls.name}</h2>
      <p>
        Қосылу коды: <strong className={panel.code}>{cls.code}</strong>: оқушылар оны «Аккаунт» бетінде енгізеді.
      </p>
      <form className={panel.row} onSubmit={assign}>
        <label htmlFor={`assign-${cls.id}`} className="visually-hidden">
          Сабақ
        </label>
        <select id={`assign-${cls.id}`} className={panel.input} value={lessonId} onChange={(e) => setLessonId(e.target.value)}>
          {mine.length > 0 && (
            <optgroup label="Менің сабақтарым">
              {mine.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label="Курс сабақтары">
            {lessonEntries.map((e) => (
              <option key={e.lesson.id} value={e.lesson.id}>
                {lessonLabel(e.lesson.id)}
              </option>
            ))}
          </optgroup>
        </select>
        <button type="submit" className="btn">
          Тапсырма беру
        </button>
      </form>
      {message && (
        <p role="status" className={panel.status}>
          {message}
        </p>
      )}
      {report && report.students.length === 0 && <p className={panel.muted}>Әзірге оқушы қосылмаған.</p>}
      {report && report.students.length > 0 && (
        <div className={panel.tableWrap}>
          <table className={panel.table}>
            <thead>
              <tr>
                <th scope="col">Оқушы</th>
                {report.assignments.map((a) => (
                  <th key={a.id} scope="col">
                    {lessonLabel(a.lessonId, mine)}{" "}
                    <button type="button" className="btn" aria-pressed={analysis === a.lessonId} onClick={() => setAnalysis((v) => (v === a.lessonId ? undefined : a.lessonId))}>
                      Талдау
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.students.map((s) => (
                <tr key={s.id}>
                  <th scope="row">{s.name}</th>
                  {report.assignments.map((a) => {
                    const p = s.lessons[a.lessonId];
                    return (
                      <td key={a.id} data-state={p?.completed ? "done" : p?.started ? "started" : "none"}>
                        {p?.completed ? "Аяқтады" : p?.started ? `${p.objectivesDone} тапсырма` : "-"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {analysis && <AnalyticsPanel classId={cls.id} lessonId={analysis} title={lessonLabel(analysis, mine)} onClose={() => setAnalysis(undefined)} />}
    </section>
  );
}

export function TeacherPage() {
  const [me, setMe] = useState<Me>();
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [mine, setMine] = useState<AuthoredInfo[]>([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  const refresh = async () => {
    try {
      const m = await getMe();
      setMe(m);
      if (m.signedIn && m.role !== "student") {
        setClasses((await listClasses()).teaching);
        setMine(await myLessons().catch(() => []));
      }
    } catch (e) {
      setMessage(errorText(e));
    }
  };
  useEffect(() => {
    if (apiEnabled) void refresh();
  }, []);

  const create = async (ev: React.FormEvent) => {
    ev.preventDefault();
    try {
      await createClass(name.trim());
      setName("");
      await refresh();
    } catch (e) {
      setMessage(errorText(e));
    }
  };

  return (
    <div className={styles.page}>
      <SiteHeader current="teacher" />
      <main className={panel.main}>
        <h1>Мұғалім панелі</h1>
        <p className={panel.lead}>Сынып құр, оқушыларға курс сабағын не өзің жасаған сабақты тапсыр, кім қай жерде тұрып қалғанын талдап, сессиясын қайта көр.</p>
        {!apiEnabled ? (
          <section className={panel.card}>
            <h2>Сервер қажет</h2>
            <p>Мұғалім панелі INSIDE TECH сервері (apps/api) қосылған нұсқада жұмыс істейді: сыныптар мен оқушылардың прогресі сонда сақталады.</p>
          </section>
        ) : !me ? (
          <p className={panel.muted}>{message || "Жүктелуде…"}</p>
        ) : !me.signedIn ? (
          <section className={panel.card}>
            <h2>Алдымен кір</h2>
            <a className="btn btn-primary" href={signInUrl(window.location.href)}>
              Кіру
            </a>
          </section>
        ) : me.role === "student" ? (
          <section className={panel.card}>
            <h2>Мұғалім рөлі жоқ</h2>
            <p>Мұғалім рөлі Classroom жоспарымен немесе мектеп әкімшісі арқылы беріледі.</p>
          </section>
        ) : (
          <>
            <form className={`${panel.card} ${panel.row}`} onSubmit={create}>
              <label htmlFor="class-name" className="visually-hidden">
                Сынып атауы
              </label>
              <input id="class-name" className={panel.input} placeholder="Сынып атауы, мысалы 8Б информатика" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
              <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
                Сынып құру
              </button>
            </form>
            {message && (
              <p role="status" className={panel.status}>
                {message}
              </p>
            )}
            {classes.map((c) => (
              <ClassReport key={c.id} cls={c} mine={mine} />
            ))}
          </>
        )}
      </main>
    </div>
  );
}
