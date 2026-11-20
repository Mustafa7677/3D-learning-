"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { LessonProgress } from "@inside-tech/lesson-engine";
import { apiEnabled, checkout, classAssignments, errorText, getMe, joinClass, listClasses, logout, signInUrl, type AssignmentInfo, type ClassInfo, type Me, authoredHref } from "@/lib/api";
import { findLab, openLabs } from "@/lib/catalog";
import { findLesson, lessonsForLab } from "@/lib/lessons";
import { progressStore } from "@/lib/progress";
import { SiteHeader } from "./SiteHeader";
import styles from "./home.module.css";
import panel from "./platform.module.css";

const PLAN_TEXT = { free: "Тегін", premium: "Premium", classroom: "Classroom" } as const;
const ROLE_TEXT = { student: "Оқушы", teacher: "Мұғалім", admin: "Әкімші" } as const;

function LocalProgress() {
  const [all, setAll] = useState<LessonProgress[]>([]);
  useEffect(() => void progressStore().list().then(setAll), []);
  const done = new Set(all.filter((p) => p.completedAt).map((p) => p.lessonId));
  const started = new Set(all.map((p) => p.lessonId));
  return (
    <section className={panel.card} aria-labelledby="progress-title">
      <h2 id="progress-title">Менің прогресім</h2>
      <ul className={panel.labs}>
        {openLabs.map((lab) => {
          const lessons = lessonsForLab(lab.id);
          const n = lessons.filter((e) => done.has(e.lesson.id)).length;
          const s = lessons.filter((e) => started.has(e.lesson.id)).length;
          return (
            <li key={lab.id}>
              <Link href={lab.href!}>{lab.title}</Link>
              <span>
                {n} / {lessons.length} аяқталды{s > n ? ` · ${s - n} басталды` : ""}
              </span>
              <span className={styles.bar} aria-hidden>
                <span style={{ width: `${(n / lessons.length) * 100}%` }} />
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function AccountPage() {
  const [me, setMe] = useState<Me>();
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [assignments, setAssignments] = useState<Record<string, AssignmentInfo[]>>({});
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");

  const refresh = async () => {
    try {
      const m = await getMe();
      setMe(m);
      if (m.signedIn) {
        const c = await listClasses();
        setClasses(c.joined);
        const entries = await Promise.all(c.joined.map(async (k) => [k.id, await classAssignments(k.id)] as const));
        setAssignments(Object.fromEntries(entries));
      }
    } catch (e) {
      setMessage(errorText(e));
    }
  };

  useEffect(() => {
    if (apiEnabled) void refresh();
  }, []);

  const join = async (ev: React.FormEvent) => {
    ev.preventDefault();
    try {
      const c = await joinClass(code.trim());
      setMessage(`«${c.name}» сыныбына қосылдың.`);
      setCode("");
      await refresh();
    } catch (e) {
      setMessage(errorText(e));
    }
  };

  const upgrade = async (plan: "premium" | "classroom") => {
    try {
      window.location.href = (await checkout(plan)).url;
    } catch (e) {
      setMessage(errorText(e));
    }
  };

  return (
    <div className={styles.page}>
      <SiteHeader current="account" />
      <main className={panel.main}>
        <h1>Аккаунт</h1>
        {!apiEnabled ? (
          <section className={panel.card}>
            <h2>Сен серверсіз нұсқадасың</h2>
            <p>Бұл сайтта прогресің тек осы браузерде сақталады: аккаунт қажет емес. Аккаунттар, сыныптар және жоспарлар INSIDE TECH сервері (apps/api) қосылғанда жұмыс істейді.</p>
          </section>
        ) : !me ? (
          <p className={panel.muted}>{message || "Жүктелуде…"}</p>
        ) : (
          <>
            <section className={panel.card}>
              {me.signedIn ? (
                <>
                  <h2>{me.name ?? me.email}</h2>
                  <p>
                    {me.email} · {ROLE_TEXT[me.role]} · жоспар: <strong>{PLAN_TEXT[me.plan]}</strong>
                  </p>
                  <div className={panel.row}>
                    {me.plan === "free" && (
                      <>
                        <button type="button" className="btn btn-primary" onClick={() => upgrade("premium")}>
                          Premium-ға өту
                        </button>
                        <button type="button" className="btn" onClick={() => upgrade("classroom")}>
                          Мектепке: Classroom
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className="btn"
                      onClick={async () => {
                        await logout().catch(() => undefined);
                        setMe(undefined);
                        void refresh();
                      }}
                    >
                      Шығу
                    </button>
                  </div>
                  <p className={panel.muted}>Тегін жоспарда әр зертхананың алғашқы 4 сабағы ашық. Premium барлық сабақты ашады, Classroom мұғалім панелін қосады.</p>
                </>
              ) : (
                <>
                  <h2>Аккаунтқа кір</h2>
                  <p>Кіргенде осы браузердегі прогресің аккаунтқа көшеді, ал мұғалімің сенің нәтижеңді көре алады.</p>
                  <a className="btn btn-primary" href={signInUrl(window.location.href)}>
                    Кіру
                  </a>
                </>
              )}
            </section>
            {me.signedIn && (
              <section className={panel.card} aria-labelledby="classes-title">
                <h2 id="classes-title">Менің сыныптарым</h2>
                <form className={panel.row} onSubmit={join}>
                  <label htmlFor="join-code" className="visually-hidden">
                    Сынып коды
                  </label>
                  <input id="join-code" className={panel.input} placeholder="Мұғалім берген код, мысалы K7M2QX" value={code} maxLength={6} onChange={(e) => setCode(e.target.value)} />
                  <button type="submit" className="btn" disabled={code.trim().length !== 6}>
                    Сыныпқа қосылу
                  </button>
                </form>
                {classes.length === 0 ? (
                  <p className={panel.muted}>Әзірге сынып жоқ.</p>
                ) : (
                  classes.map((c) => (
                    <div key={c.id}>
                      <h3>{c.name}</h3>
                      <ul className={panel.list}>
                        {(assignments[c.id] ?? []).map((a) => {
                          const found = findLesson(a.lessonId);
                          return (
                            <li key={a.id}>
                              {found ? (
                                <Link href={`/labs/${found.entry.labId}/${a.lessonId}`}>
                                  {findLab(found.entry.labId)?.title} · {found.entry.lesson.order}. {found.entry.lesson.title}
                                </Link>
                              ) : a.lessonId.startsWith("custom-") ? (
                                <Link href={authoredHref(a.lessonId)}>Мұғалімнің сабағы</Link>
                              ) : (
                                a.lessonId
                              )}
                            </li>
                          );
                        })}
                        {(assignments[c.id] ?? []).length === 0 && <li className={panel.muted}>Тапсырма жоқ.</li>}
                      </ul>
                    </div>
                  ))
                )}
              </section>
            )}
          </>
        )}
        {message && apiEnabled && me && (
          <p role="status" className={panel.status}>
            {message}
          </p>
        )}
        <LocalProgress />
      </main>
    </div>
  );
}
