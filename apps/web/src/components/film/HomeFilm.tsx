"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { openLabs } from "@/lib/catalog";
import { lessonsForLab } from "@/lib/lessons";
import { go, prefersReducedMotion } from "@/lib/nav";
import { useScrollProgress } from "@/lib/useScrollProgress";
import { useWebGL } from "@/lib/useWebGL";
import type { ChipBlock } from "./ChipScene";
import { FilmHeader } from "./FilmHeader";
import { BootIntro, WorldCard } from "./Game";
import { usePlayer } from "@/lib/xp";
import styles from "./film.module.css";

const ChipScene = dynamic(() => import("./ChipScene"), { ssr: false });

const CHAPTERS = 6;

function scrollToEl(el: Element | null) {
  el?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
}

/** The 3D-free stand-in: the same die, drawn with CSS perspective. */
function CssDie({ blocks }: { blocks: ChipBlock[] }) {
  return (
    <div className={styles.cssStage} aria-hidden>
      <div className={styles.cssDie}>
        {blocks.map((b) => (
          <span key={b.id} className={styles.cssBlock}>
            {b.title}
          </span>
        ))}
      </div>
    </div>
  );
}

export function HomeFilm() {
  const film = useRef<HTMLDivElement>(null);
  const courses = useRef<HTMLElement>(null);
  const chapters = useRef<(HTMLElement | null)[]>([]);
  const { progress, chapter } = useScrollProgress(film, CHAPTERS);
  const webgl = useWebGL();
  const [still, setStill] = useState(false);
  useEffect(() => setStill(prefersReducedMotion()), []);

  const blocks: ChipBlock[] = useMemo(() => openLabs.map((l) => ({ id: l.id, title: l.title, href: l.href! })), []);
  const player = usePlayer();
  const lessonCount = useMemo(() => openLabs.reduce((t, l) => t + lessonsForLab(l.id).length, 0), []);

  return (
    <div className={styles.page}>
      <BootIntro />
      <FilmHeader
        lead={
          <button type="button" className={styles.menuLink} onClick={() => scrollToEl(courses.current)}>
            Курстар
          </button>
        }
      />

      <div ref={film} className={styles.film} style={{ height: `${CHAPTERS * 100}vh` }}>
        <div className={styles.stage}>
          {webgl === false ? <CssDie blocks={blocks} /> : webgl && <ChipScene progress={progress} blocks={blocks} interactive={chapter === CHAPTERS - 1} onOpen={go} still={still} />}
          <div className={styles.vignette} aria-hidden />
          <ol className={styles.reel} aria-label="Кинотаспа бөлімдері">
            {Array.from({ length: CHAPTERS }, (_, i) => (
              <li key={i}>
                <button type="button" aria-current={chapter === i ? "step" : undefined} onClick={() => scrollToEl(chapters.current[i] ?? null)}>
                  <span className="visually-hidden">{i + 1}-бөлім</span>
                </button>
              </li>
            ))}
          </ol>
        </div>

        <div className={styles.chapters}>
          <section ref={(n) => void (chapters.current[0] = n)} className={`${styles.chapter} ${styles.hero}`}>
            <h1 className={styles.title}>
              <span>Технологияның</span>
              <span>ішіне кір.</span>
            </h1>
            <p className={styles.lead}>Он курс: бір чиптің он блогы. Әр блоктың ішінде нақты есептейтін симуляция бар: нейрон үйренеді, пакет жолын іздейді, лифт тербеліп барып тоқтайды.</p>
            <div className={styles.actions}>
              <button type="button" className={styles.enter} onClick={() => scrollToEl(chapters.current[1] ?? null)}>
                Кіру
              </button>
              <button type="button" className={styles.ghost} onClick={() => scrollToEl(courses.current)}>
                Курстарды көру
              </button>
            </div>
            <p className={styles.scrollHint} aria-hidden>
              Төмен айналдыр: қақпақ ашылады
            </p>
          </section>

          <section ref={(n) => void (chapters.current[1] = n)} className={styles.chapter}>
            <div className={styles.card}>
              <h2>Қақпақтың астында</h2>
              <p>Әр курс: кристалдағы бір блок. Блоктар бір шинамен жалғанған: алгоритмдер нейрон желісінде, желі хаттамалары бұлтта, сенсорлар контроллерде қайта кездеседі. Бір курста үйренгенің келесісінде керек болады.</p>
            </div>
          </section>

          <section ref={(n) => void (chapters.current[2] = n)} className={styles.chapter}>
            <div className={styles.card}>
              <h2>Ішін көр</h2>
              <p>Нейрондық желі сенің көзіңше үйренеді. Әр салмақ, әр градиент, әр қате кеңістікте тұр: оны айналдырып, жақындап, кез келген нүктесін бас.</p>
              <Link href="/labs/ai" className={styles.inline}>
                AI курсын ашу
              </Link>
            </div>
          </section>

          <section ref={(n) => void (chapters.current[3] = n)} className={styles.chapter}>
            <div className={styles.card}>
              <h2>Бұрап көр</h2>
              <p>PID коэффициентін өзгерт: лифт тербеледі, асып кетеді, сосын дәл 1 метрде тоқтайды. Қателесуден қорықпа: кез келген әрекет бір батырмамен кері қайтады.</p>
              <Link href="/labs/iot" className={styles.inline}>
                Robotics & IoT курсын ашу
              </Link>
            </div>
          </section>

          <section ref={(n) => void (chapters.current[4] = n)} className={styles.chapter}>
            <div className={styles.card}>
              <h2>Өзің жаса</h2>
              <p>Әр курс өз қолыңмен жасалған нәтижемен аяқталады: үйретілген модель, жұмыс істейтін сайт, өз ойын деңгейің. Есептер жиынын автотексеруші тексереді.</p>
              <Link href="/labs/game" className={styles.inline}>
                Game курсын ашу
              </Link>
            </div>
          </section>

          <section ref={(n) => void (chapters.current[5] = n)} className={styles.chapter}>
            <div className={styles.card}>
              <h2>
                {openLabs.length} курс, {lessonCount} сабақ
              </h2>
              <p>{webgl === false ? "Төмендегі тізімнен курсты таңда." : "Кез келген блокты бас: курс ашылады. Немесе төмендегі тізімнен таңда."}</p>
              <button type="button" className={styles.inline} onClick={() => scrollToEl(courses.current)}>
                Тізімге өту
              </button>
            </div>
          </section>
        </div>
      </div>

      <section ref={courses} id="courses" className={styles.courses} aria-labelledby="courses-title">
        <h2 id="courses-title">Курстар</h2>
        <p className={styles.coursesLead}>Он әлем. Әр сабақ +100 XP береді, әр орындалған тапсырма +10 XP.</p>
        <ul className={styles.grid}>
          {openLabs.map((lab, i) => (
            <li key={lab.id}>
              <WorldCard href={lab.href!} index={i + 1} title={lab.title} inside={lab.inside} done={player?.doneByLab[lab.id] ?? 0} total={lessonsForLab(lab.id).length} />
            </li>
          ))}
        </ul>
      </section>

      <footer className={styles.footer}>INSIDE TECH: технологияны ішінен үйрену</footer>
    </div>
  );
}
