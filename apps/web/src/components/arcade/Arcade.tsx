"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GAMES, MEDAL_WORD, loadBest, medalOf, saveScore, type GameId, type GameInfo } from "@/lib/arcade";
import { recordActivity } from "@/lib/activity";
import { queryParam } from "@/lib/nav";
import { lessonEntries } from "@/lib/lessons";
import { FilmHeader } from "../film/FilmHeader";
import film from "../film/film.module.css";
import { BitMeteor } from "./BitMeteor";
import { GateRush } from "./GateRush";
import { PhishFilter } from "./PhishFilter";
import { CacheKeeper } from "./CacheKeeper";
import { PacketSurfer } from "./PacketSurfer";
import { BugHunt } from "./BugHunt";
import { FirewallDefense } from "./FirewallDefense";
import { setSound, soundOn } from "@/lib/sfx";
import styles from "./arcade.module.css";

const MEDAL_GLYPH = ["", "🥉", "🥈", "🥇"] as const;

/** Ойын залы: four arcade cabinets, each a fast drill of one idea. */
export function Arcade() {
  const [best, setBest] = useState<Partial<Record<GameId, number>>>({});
  const [playing, setPlaying] = useState<GameId>();
  const [round, setRound] = useState(0);
  const [result, setResult] = useState<{ score: number; record: boolean }>();
  const [sound, setSoundState] = useState(false);

  useEffect(() => {
    setBest(loadBest());
    setSoundState(soundOn());
    const g = queryParam("g");
    if (GAMES.some((x) => x.id === g)) setPlaying(g as GameId);
  }, []);

  const game = GAMES.find((g) => g.id === playing);

  const finish = (score: number) => {
    if (!game) return;
    const record = saveScore(game.id, score);
    recordActivity("problem");
    setBest(loadBest());
    setResult({ score, record });
  };
  const again = () => {
    setResult(undefined);
    setRound((r) => r + 1);
  };
  const leave = () => {
    setResult(undefined);
    setPlaying(undefined);
  };

  return (
    <div className={film.page}>
      <FilmHeader />
      <main className={styles.page}>
        {!game ? (
          <>
            <header className={styles.head}>
              <p className={styles.issue}>ОЙЫН ЗАЛЫ · {GAMES.length} ОЙЫН</p>
              <h1 className={styles.title}>
                Ойна да <span>үйрен</span>
              </h1>
              <p className={styles.lede}>Экшн ойындарда сен пакет, баг аулаушы және сервердің қорғаушысысың. Жылдам жаттығуларда екілік сандар, қақпалар, фишинг пен кэшті қолың өзі білетіндей етесің. Медаль жина, өз рекордыңды жаң.</p>
            </header>
            <h2 className={styles.shelf}>Экшн ойындар</h2>
            <ul className={styles.cabinets}>
              {GAMES.filter((g) => g.kind === "action").map((g) => (
                <Cabinet key={g.id} game={g} best={best[g.id]} onPlay={() => setPlaying(g.id)} />
              ))}
            </ul>
            <h2 className={styles.shelf}>Жылдам жаттығулар</h2>
            <ul className={styles.cabinets}>
              {GAMES.filter((g) => g.kind === "drill").map((g) => (
                <Cabinet key={g.id} game={g} best={best[g.id]} onPlay={() => setPlaying(g.id)} />
              ))}
            </ul>
          </>
        ) : (
          <section className={styles.stage} aria-labelledby="game-title">
            <div className={styles.stageHead}>
              <div className={styles.stageBar}>
                <button type="button" className={styles.back} onClick={leave}>
                  ← Залға қайту
                </button>
                <button
                  type="button"
                  className={styles.back}
                  aria-pressed={sound}
                  onClick={() => {
                    setSound(!sound);
                    setSoundState(!sound);
                  }}
                >
                  {sound ? "🔊 Дыбыс қосулы" : "🔇 Дыбыс өшірулі"}
                </button>
              </div>
              <h1 id="game-title" className={styles.gameTitle}>
                <span aria-hidden>{game.glyph}</span> {game.title}
              </h1>
              <p className={styles.how}>{game.how}</p>
            </div>
            <div className={styles.screen} data-game={game.id}>
              {!result && (
                <>
                  {game.id === "surf" && <PacketSurfer key={round} onEnd={finish} />}
                  {game.id === "bughunt" && <BugHunt key={round} onEnd={finish} />}
                  {game.id === "defense" && <FirewallDefense key={round} onEnd={finish} />}
                  {game.id === "bits" && <BitMeteor key={round} onEnd={finish} />}
                  {game.id === "gates" && <GateRush key={round} onEnd={finish} />}
                  {game.id === "phish" && <PhishFilter key={round} onEnd={finish} />}
                  {game.id === "cache" && <CacheKeeper key={round} onEnd={finish} />}
                </>
              )}
              {result && <GameOver game={game} score={result.score} record={result.record} best={best[game.id] ?? result.score} onAgain={again} onLeave={leave} />}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function Cabinet({ game, best, onPlay }: { game: GameInfo; best?: number; onPlay: () => void }) {
  const medal = best === undefined ? 0 : medalOf(game, best);
  return (
    <li className={styles.cabinet} data-game={game.id}>
      <div className={styles.marquee}>
        <span className={styles.glyph} aria-hidden>
          {game.glyph}
        </span>
        <p>{game.topic}</p>
      </div>
      <h2>{game.title}</h2>
      <p className={styles.pitch}>{game.pitch}</p>
      <p className={styles.best}>
        {best === undefined ? "Әлі ойналмаған" : `Рекорд: ${best}${game.id === "cache" ? "%" : ""}`}
        {medal > 0 && (
          <span className={styles.medal} data-medal={medal}>
            {MEDAL_GLYPH[medal]} {MEDAL_WORD[medal]}
          </span>
        )}
      </p>
      <button type="button" className={styles.play} onClick={onPlay} aria-label={`Ойнау: ${game.title}`}>
        ▶ Ойнау
      </button>
    </li>
  );
}

function GameOver({ game, score, record, best, onAgain, onLeave }: { game: GameInfo; score: number; record: boolean; best: number; onAgain: () => void; onLeave: () => void }) {
  const medal = medalOf(game, score);
  const next = game.medals.find((m) => m > score);
  const unit = game.id === "cache" ? "%" : "";
  const lesson = lessonEntries.find((e) => e.lesson.id === game.lesson);
  return (
    <div className={styles.over} role="status">
      <p className={styles.overLabel}>ОЙЫН БІТТІ</p>
      <p className={styles.bigScore}>
        {score}
        {unit}
      </p>
      {record && <p className={styles.record}>★ Жаңа рекорд!</p>}
      {medal > 0 ? (
        <p className={styles.medal} data-medal={medal}>
          {MEDAL_GLYPH[medal]} {MEDAL_WORD[medal]} медаль
        </p>
      ) : (
        <p>Медальға аз қалды.</p>
      )}
      {next !== undefined && (
        <p className={styles.note}>
          Келесі медальға: {next}
          {unit}. Рекордың: {best}
          {unit}.
        </p>
      )}
      <div className={styles.overActions}>
        <button type="button" className={styles.play} onClick={onAgain}>
          ↻ Тағы ойнау
        </button>
        <button type="button" className={styles.back} onClick={onLeave}>
          Басқа ойын
        </button>
        {lesson && (
          <Link className={styles.lessonLink} href={`/labs/${game.lab}/${lesson.lesson.id}`}>
            Тақырыпты оқу: {lesson.lesson.title} →
          </Link>
        )}
      </div>
    </div>
  );
}
