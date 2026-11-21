"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { buildPassport, stampDate, type Passport as Data, type PassportLab } from "@/lib/passport";
import { progressStore } from "@/lib/progress";
import { XP_EVENT } from "@/lib/xp";
import { LOOK } from "../film/Atlas";
import { FilmHeader } from "../film/FilmHeader";
import film from "../film/film.module.css";
import landing from "../film/landing.module.css";
import styles from "./passport.module.css";

const CODE: Record<string, string> = { ai: "AI", web: "WEB", game: "GAME", net: "NET", db: "DB", arch: "ARCH", cloud: "CLOUD", sec: "SEC", algo: "ALGO", iot: "IOT" };

function Stamp({ lab }: { lab: PassportLab }) {
  if (!lab.stamp) {
    return (
      <span className={styles.stampEmpty} aria-hidden>
        мөр
        <br />
        жоқ
      </span>
    );
  }
  return (
    <span className={styles.stamp} aria-hidden>
      <span className={styles.stampCode}>{CODE[lab.id] ?? lab.id.toUpperCase()}</span>
      <span className={styles.stampWord}>АЯҚТАЛДЫ</span>
      <span className={styles.stampDate}>{stampDate(lab.stamp.at)}</span>
    </span>
  );
}

function Visa({ lab, n }: { lab: PassportLab; n: number }) {
  const look = LOOK[lab.id] ?? LOOK.arch!;
  const target = lab.next?.href ?? lab.href;
  const action = !lab.next ? "Барлығы аяқталды" : lab.next.started ? "Жалғастыру" : lab.done ? "Келесі сабақ" : "Бастау";
  const label = `${lab.title}: ${lab.done} / ${lab.total} сабақ аяқталды. ${lab.stamp ? `Мөр ${stampDate(lab.stamp.at)}, алғашқы аяқталған сабақ: ${lab.stamp.lesson.title}.` : "Мөр әлі жоқ."} ${action}${lab.next ? `: ${lab.next.title}` : ""}`;
  return (
    <li className={styles.visa} style={{ ["--accent" as string]: look.accent }} data-stamped={!!lab.stamp}>
      <Link href={target} className={styles.visaLink} aria-label={label}>
        <span className={styles.visaTop}>
          <svg className={styles.visaGlyph} viewBox="0 0 120 100" aria-hidden>
            {look.glyph}
          </svg>
          <span className={styles.visaNum}>
            {String(n).padStart(2, "0")} / {look.field}
          </span>
        </span>
        <strong className={styles.visaTitle}>{lab.title}</strong>
        <span className={styles.visaCount}>
          <b>{lab.done}</b> / {lab.total} сабақ
        </span>
        <span className={styles.bar} aria-hidden>
          <span style={{ width: `${Math.round((lab.done / Math.max(1, lab.total)) * 100)}%` }} />
        </span>
        <span className={styles.visaNext}>
          {action}
          {lab.next && <span>{lab.next.title}</span>}
        </span>
        <Stamp lab={lab} />
      </Link>
    </li>
  );
}

/** The learning passport: where to continue, a stamp per lab, every finished lesson. */
export function Passport() {
  const [data, setData] = useState<Data>();
  useEffect(() => {
    const load = () =>
      void progressStore()
        .list()
        .then(
          (all) => setData(buildPassport(all)),
          () => setData(buildPassport([])),
        );
    load();
    window.addEventListener(XP_EVENT, load);
    return () => window.removeEventListener(XP_EVENT, load);
  }, []);

  return (
    <div className={`${film.page} ${landing.landing}`}>
      <FilmHeader />
      <main className={styles.page}>
        {!data ? (
          <p className={styles.loading} role="status">
            Паспорт ашылып жатыр…
          </p>
        ) : (
          <>
            <div className={styles.spread}>
              <section className={styles.holder} aria-labelledby="pp-title">
                <p className={styles.issuer}>INSIDE TECH · ЗЕРТХАНАЛАР ОДАҒЫ</p>
                <h1 id="pp-title" className={styles.title}>
                  Оқу паспорты
                </h1>
                <dl className={styles.facts}>
                  <div>
                    <dt>Аяқталған сабақ</dt>
                    <dd>
                      <b>{data.lessonsDone}</b> / {data.lessonsTotal}
                    </dd>
                  </div>
                  <div>
                    <dt>Мөр</dt>
                    <dd>
                      <b>{data.stamps}</b> / {data.labs.length}
                    </dd>
                  </div>
                  <div>
                    <dt>Соңғы мөр</dt>
                    <dd>{data.finished[0] ? stampDate(data.finished[0].at) : "әлі жоқ"}</dd>
                  </div>
                </dl>

                <div className={styles.next}>
                  {data.resume ? (
                    <>
                      <p className={styles.nextKicker}>Тоқтаған жерің</p>
                      <p className={styles.nextTitle}>{data.resume.lesson.title}</p>
                      <p className={styles.nextMeta}>
                        {data.labs.find((l) => l.id === data.resume!.lesson.labId)?.title} · {data.resume.step} / {data.resume.steps} кезең
                      </p>
                      <Link href={data.resume.lesson.href} className={landing.primary}>
                        Сабақты жалғастыру
                      </Link>
                    </>
                  ) : data.empty ? (
                    <>
                      <p className={styles.nextKicker}>Паспорт әлі таза</p>
                      <p className={styles.nextTitle}>Алғашқы мөрді бір сабақ береді.</p>
                      <p className={styles.nextMeta}>Сабақты аяқтасаң, сол зертхананың ұяшығына мөр басылады.</p>
                      <Link href={data.first.href} className={landing.primary}>
                        Алғашқы сабақты бастау: {data.first.title}
                      </Link>
                    </>
                  ) : (
                    (() => {
                      const lab = data.labs.find((l) => l.done > 0 && l.next) ?? data.labs.find((l) => l.next);
                      return lab?.next ? (
                        <>
                          <p className={styles.nextKicker}>Келесі қадам</p>
                          <p className={styles.nextTitle}>{lab.next.title}</p>
                          <p className={styles.nextMeta}>{lab.title}</p>
                          <Link href={lab.next.href} className={landing.primary}>
                            Келесі сабақты ашу
                          </Link>
                        </>
                      ) : (
                        <p className={styles.nextTitle}>Барлық сабақ аяқталды.</p>
                      );
                    })()
                  )}
                </div>
                <p className={styles.mrz} aria-hidden>
                  {`P<KAZ<INSIDE<TECH<<${data.lessonsDone}<${data.lessonsTotal}<<${data.stamps}<10`.padEnd(44, "<").slice(0, 44)}
                </p>
              </section>

              <section className={styles.visas} aria-labelledby="pp-visas">
                <h2 id="pp-visas" className={styles.visasTitle}>
                  Зертхана мөрлері
                </h2>
                <ol className={styles.grid}>
                  {data.labs.map((lab, i) => (
                    <Visa key={lab.id} lab={lab} n={i + 1} />
                  ))}
                </ol>
              </section>
            </div>

            <section className={styles.log} aria-labelledby="pp-log">
              <h2 id="pp-log" className={styles.logTitle}>
                Аяқталған сабақтар
              </h2>
              <p className={styles.logEmpty}>
                <Link href="/sky">Осы прогресті жұлдызды аспан ретінде көру →</Link>
              </p>
              {data.finished.length === 0 ? (
                <p className={styles.logEmpty}>Әзірге бос. Аяқталған әр сабақ осында күнімен жазылады.</p>
              ) : (
                <ol className={styles.logList}>
                  {data.finished.map((f) => (
                    <li key={f.id}>
                      <time dateTime={new Date(f.at).toISOString()}>{stampDate(f.at)}</time>
                      <span className={styles.logLab}>{data.labs.find((l) => l.id === f.labId)?.title}</span>
                      <Link href={f.href}>{f.title}</Link>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
