"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { buildSky, type Star } from "@/lib/sky";
import { progressStore } from "@/lib/progress";
import { prefersReducedMotion } from "@/lib/nav";
import { useQuality } from "@/lib/quality";
import { useWebGL } from "@/lib/useWebGL";
import { findLab } from "@/lib/catalog";
import { OyuRule } from "../lab/Oyu";
import { FilmHeader } from "../film/FilmHeader";
import film from "../film/film.module.css";
import styles from "./sky.module.css";

const SkyScene = dynamic(() => import("./SkyScene"), { ssr: false });

const STATE_WORD = { done: "аяқталды", started: "басталды", dark: "әлі жанбаған" } as const;

/** Білім аспаны: your lessons as stars; the North Star points at what to do next. */
export function Sky() {
  const [sky, setSky] = useState(() => buildSky([]));
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<Star>();
  const [hover, setHover] = useState<Star | null>(null);
  const [still, setStill] = useState(false);
  const webgl = useWebGL();
  const quality = useQuality();

  useEffect(() => {
    setStill(prefersReducedMotion());
    void progressStore()
      .list()
      .then(
        (all) => setSky(buildSky(all)),
        () => undefined,
      )
      .finally(() => setLoaded(true));
  }, []);

  const total = useMemo(() => sky.constellations.reduce((n, c) => n + c.stars.length, 0), [sky]);
  const lit = useMemo(() => sky.constellations.reduce((n, c) => n + c.done, 0), [sky]);
  const shown = hover ?? selected;

  return (
    <div className={film.page}>
      <FilmHeader />
      <main className={styles.page}>
        <header className={styles.head}>
          <p className={styles.issue}>БІЛІМ АСПАНЫ · {lit} / {total} ЖҰЛДЫЗ ЖАНДЫ</p>
          <h1 className={styles.title}>Сенің аспаның</h1>
          <OyuRule className={styles.rule} />
          <p className={styles.lede}>Әр сабақ бір жұлдыз, әр зертхана бір шоқжұлдыз. Аяқтаған сабағың алтынмен жанады. Ортадағы Темірқазық келесі қадамыңды көрсетеді: ата-бабамыз жолды осы жұлдызбен тапқан.</p>
        </header>

        <div className={styles.observatory}>
          <div className={styles.dome}>
            {webgl && loaded ? (
              <SkyScene
                constellations={sky.constellations}
                bridges={sky.bridges}
                north={sky.north}
                selected={selected?.id}
                onPick={setSelected}
                onHover={setHover}
                still={still}
                quality={quality}
              />
            ) : (
              <div className={styles.noGl} aria-hidden>
                {webgl === false ? "Аспан тізім түрінде төменде." : null}
              </div>
            )}
          </div>

          <aside className={styles.card} aria-label="Таңдалған жұлдыз" aria-live="polite">
            {shown ? (
              <>
                <p className={styles.cardLab}>{findLab(shown.lab)?.title}</p>
                <p className={styles.cardTitle}>
                  {shown.order}. {shown.title}
                </p>
                <p className={styles.cardState} data-state={shown.state}>
                  {STATE_WORD[shown.state]}
                </p>
                <Link href={`/labs/${shown.lab}/${shown.id}`} className={styles.open}>
                  {shown.state === "done" ? "Қайта ашу" : shown.state === "started" ? "Жалғастыру" : "Жұлдызды жағу"}
                </Link>
              </>
            ) : (
              <p className={styles.hint}>Жұлдызды бас: сабақтың аты шығады. Аспанды тышқанмен не саусақпен айналдыр.</p>
            )}
            {sky.north && (
              <div className={styles.north}>
                <p className={styles.northKicker}>ТЕМІРҚАЗЫҚ КӨРСЕТЕДІ</p>
                <p className={styles.northTitle}>
                  {findLab(sky.north.lab)?.title}: {sky.north.title}
                </p>
                <Link href={`/labs/${sky.north.lab}/${sky.north.id}`} className={styles.go}>
                  Сол жаққа бару →
                </Link>
              </div>
            )}
            <ul className={styles.legend}>
              <li data-state="done">аяқталған</li>
              <li data-state="started">басталған</li>
              <li data-state="dark">әлі жанбаған</li>
              <li data-state="bridge">бір ұғымның көпірі</li>
            </ul>
          </aside>
        </div>

        <section className={styles.atlas} aria-labelledby="sky-list">
          <h2 id="sky-list" className={styles.listTitle}>
            Шоқжұлдыздар
          </h2>
          <div className={styles.groups}>
            {sky.constellations.map((c) => (
              <details key={c.lab} className={styles.group} open={c.done > 0}>
                <summary>
                  <span>{c.title}</span>
                  <b>
                    {c.done} / {c.stars.length}
                  </b>
                </summary>
                <ol>
                  {c.stars.map((s) => (
                    <li key={s.id} data-state={s.state}>
                      <Link href={`/labs/${s.lab}/${s.id}`}>
                        {s.order}. {s.title}
                      </Link>
                      <span>{STATE_WORD[s.state]}</span>
                    </li>
                  ))}
                </ol>
              </details>
            ))}
          </div>
          <h3 className={styles.bridgesTitle}>Ұғым көпірлері</h3>
          <ul className={styles.bridges}>
            {sky.bridges.map((b) => (
              <li key={`${b.a}-${b.b}`}>
                <b>{b.idea}</b>: <Link href={`/labs/${b.from.lab}/${b.from.id}`}>{b.from.title}</Link> ({findLab(b.from.lab)?.title}) және{" "}
                <Link href={`/labs/${b.to.lab}/${b.to.id}`}>{b.to.title}</Link> ({findLab(b.to.lab)?.title})
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
