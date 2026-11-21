"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { openLabs } from "@/lib/catalog";
import { lessonsForLab } from "@/lib/lessons";
import { usePlayer } from "@/lib/xp";
import { KeyArt, hasKeyArt } from "./KeyArt";
import styles from "./landing.module.css";

/** Each lab's own identity: a field, an accent and a line glyph. */
export const LOOK: Record<string, { field: string; accent: string; glyph: ReactNode }> = {
  ai: {
    field: "MACHINE LEARNING",
    accent: "#7696ff",
    glyph: (
      <g>
        {[20, 50, 80].map((y) => [30, 45, 60, 75].map((y2) => <line key={`${y}-${y2}`} x1={20} y1={y} x2={60} y2={y2} />))}
        {[30, 45, 60, 75].map((y) => <line key={`o${y}`} x1={60} y1={y} x2={100} y2={50} />)}
        {[20, 50, 80].map((y) => <circle key={`a${y}`} cx={20} cy={y} r={5} />)}
        {[30, 45, 60, 75].map((y) => <circle key={`b${y}`} cx={60} cy={y} r={5} />)}
        <circle cx={100} cy={50} r={7} className={styles.glyphHot} />
      </g>
    ),
  },
  web: {
    field: "WEB SYSTEMS",
    accent: "#5fd0c5",
    glyph: (
      <g>
        <rect x={12} y={18} width={96} height={64} rx={6} />
        <line x1={12} y1={32} x2={108} y2={32} />
        <circle cx={22} cy={25} r={2.5} className={styles.glyphHot} />
        <line x1={24} y1={46} x2={70} y2={46} />
        <line x1={24} y1={58} x2={92} y2={58} />
        <line x1={24} y1={70} x2={60} y2={70} />
      </g>
    ),
  },
  game: {
    field: "REAL-TIME 3D",
    accent: "#3fd39a",
    glyph: (
      <g>
        <path d="M30 40 L55 28 L80 40 L55 52 Z M30 40 L30 66 L55 78 L55 52 M80 40 L80 66 L55 78" />
        <circle cx={92} cy={24} r={7} className={styles.glyphHot} />
        <line x1={92} y1={34} x2={92} y2={56} strokeDasharray="3 4" />
      </g>
    ),
  },
  net: {
    field: "NETWORKS",
    accent: "#8fa8ff",
    glyph: (
      <g>
        <path d="M20 50 L45 22 L80 30 L100 60 L70 80 L35 74 Z M45 22 L70 80 M20 50 L100 60" />
        {[
          [20, 50],
          [45, 22],
          [80, 30],
          [100, 60],
          [70, 80],
          [35, 74],
        ].map(([x, y], i) => (
          <rect key={i} x={x! - 5} y={y! - 5} width={10} height={10} className={i === 0 ? styles.glyphHot : undefined} />
        ))}
      </g>
    ),
  },
  db: {
    field: "DATA",
    accent: "#e0b36a",
    glyph: (
      <g>
        {[24, 44, 64].map((y) => (
          <g key={y}>
            <ellipse cx={60} cy={y} rx={34} ry={9} />
            <path d={`M26 ${y} L26 ${y + 14} A34 9 0 0 0 94 ${y + 14} L94 ${y}`} />
          </g>
        ))}
      </g>
    ),
  },
  arch: {
    field: "HARDWARE",
    accent: "#dda36e",
    glyph: (
      <g>
        <rect x={34} y={24} width={52} height={52} rx={4} />
        <rect x={48} y={38} width={24} height={24} className={styles.glyphHot} />
        {[32, 44, 56, 68].map((p) => (
          <g key={p}>
            <line x1={p} y1={14} x2={p} y2={24} />
            <line x1={p} y1={76} x2={p} y2={86} />
            <line x1={24} y1={p} x2={34} y2={p} />
            <line x1={86} y1={p} x2={96} y2={p} />
          </g>
        ))}
      </g>
    ),
  },
  cloud: {
    field: "INFRASTRUCTURE",
    accent: "#a9c3ff",
    glyph: (
      <g>
        <path d="M32 52 A14 14 0 0 1 40 26 A20 20 0 0 1 76 24 A16 16 0 0 1 90 52 Z" />
        {[34, 54, 74].map((x, i) => (
          <rect key={x} x={x} y={64} width={14} height={14} className={i === 1 ? styles.glyphHot : undefined} />
        ))}
        {[41, 61, 81].map((x) => (
          <line key={x} x1={x} y1={52} x2={x} y2={64} />
        ))}
      </g>
    ),
  },
  sec: {
    field: "SECURITY",
    accent: "#b07cff",
    glyph: (
      <g>
        <rect x={34} y={44} width={52} height={40} rx={5} />
        <path d="M44 44 L44 34 A16 16 0 0 1 76 34 L76 44" />
        <circle cx={60} cy={62} r={5} className={styles.glyphHot} />
        <line x1={60} y1={67} x2={60} y2={74} />
      </g>
    ),
  },
  algo: {
    field: "ALGORITHMS",
    accent: "#f08a7a",
    glyph: (
      <g>
        {[18, 30, 44, 58, 72].map((h, i) => (
          <rect key={i} x={22 + i * 16} y={84 - h} width={10} height={h} className={i === 4 ? styles.glyphHot : undefined} />
        ))}
      </g>
    ),
  },
  iot: {
    field: "ROBOTICS",
    accent: "#f2c14e",
    glyph: (
      <g>
        <rect x={34} y={76} width={30} height={8} rx={2} />
        <path d="M49 76 L58 40 L92 30" />
        <circle cx={58} cy={40} r={5} />
        <circle cx={92} cy={30} r={6} className={styles.glyphHot} />
      </g>
    ),
  },
};

function Ring({ done, total }: { done: number; total: number }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <svg className={styles.ring} viewBox="0 0 36 36" aria-hidden>
      <circle cx={18} cy={18} r={r} className={styles.ringTrack} />
      <circle cx={18} cy={18} r={r} className={styles.ringFill} strokeDasharray={`${(c * done) / Math.max(1, total)} ${c}`} />
    </svg>
  );
}

/** The ten labs as an editorial atlas: AI is the featured story, the rest are modules of different sizes. */
export function Atlas({ id = "labs" }: { id?: string }) {
  const player = usePlayer();
  return (
    <section className={styles.atlas} aria-labelledby="atlas-title" id={id}>
      <div className={styles.atlasHead}>
        <p className={styles.micro}>10 ЗЕРТХАНА</p>
        <h2 id="atlas-title" className={styles.h2}>
          Зертханалар атласы
        </h2>
        <p className={styles.line}>Әр зертханада Junior деңгейінің 8 сабағы, есептер жиыны және нақты есептейтін симуляция. Middle және Senior деңгейлері қосылып жатыр.</p>
      </div>
      <ul className={styles.bento}>
        {openLabs.map((lab, i) => {
          const look = LOOK[lab.id] ?? LOOK.arch!;
          const total = lessonsForLab(lab.id).length;
          const done = player?.doneByLab[lab.id] ?? 0;
          return (
            <li key={lab.id} className={styles[`tile_${lab.id}`]} style={{ ["--accent" as string]: look.accent }}>
              <Link href={lab.href!} className={styles.tile} data-art={hasKeyArt(lab.id) || undefined} aria-label={`${lab.title}: ${done} сабақ аяқталды, барлығы ${total}`}>
                <KeyArt labId={lab.id} />
                <span className={styles.tileTop}>
                  <span className={styles.tileNum}>
                    {String(i + 1).padStart(2, "0")} / {look.field}
                  </span>
                  <Ring done={done} total={total} />
                </span>
                <svg className={styles.glyph} viewBox="0 0 120 100" aria-hidden>
                  {look.glyph}
                </svg>
                <span className={styles.tileBody}>
                  <strong>{lab.title}</strong>
                  <span>{lab.inside}</span>
                  {lab.id === "ai" && <span className={styles.tileCta}>AI LAB-ты ашу</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
