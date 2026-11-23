import Link from "next/link";
import { TOOL_GROUPS } from "@/lib/tools";
import { CAREERS } from "@/lib/careers";
import { BackdropArt, GadgetFace } from "../lab/Cast";
import styles from "./landing.module.css";

/**
 * Act IV, after the atlas: four worlds beyond the lessons, each tile a small window into its own
 * page (the arcade glows, the archipelago is a sea, the comics are a panel, the careers are a
 * crowd of faces). Everything else follows as a quiet index, grouped by what it does.
 */
const PORTALS = new Set(["/arcade", "/world", "/comics", "/career"]);

function ArcadeArt() {
  const cabinets = [
    { glyph: "✈", c: "#32e0ff" },
    { glyph: "🐞", c: "#ff9f1c" },
    { glyph: "🛡", c: "#ff3d7f" },
    { glyph: "☄", c: "#b6ff3d" },
  ];
  return (
    <div className={styles.arcadeArt} aria-hidden>
      {cabinets.map((x) => (
        <span key={x.glyph} style={{ ["--c" as string]: x.c }}>
          <i>{x.glyph}</i>
        </span>
      ))}
    </div>
  );
}

function SeaArt() {
  const isles = [
    { x: 60, y: 50, r: 26, c: "#8fbf6a" },
    { x: 150, y: 34, r: 20, c: "#7fb6a8" },
    { x: 230, y: 70, r: 28, c: "#d2b06a" },
    { x: 110, y: 112, r: 22, c: "#a39ad0" },
    { x: 205, y: 140, r: 18, c: "#c9a27a" },
    { x: 280, y: 128, r: 16, c: "#9cb6d6" },
  ];
  return (
    <svg viewBox="0 0 320 170" className={styles.seaArt} aria-hidden>
      <rect width="320" height="170" fill="#0f3a52" />
      <path d="M60 50 Q105 20 150 34 T230 70 Q180 110 110 112 T205 140 Q250 150 280 128" fill="none" stroke="#f3e7c8" strokeOpacity="0.5" strokeWidth="2" strokeDasharray="2 8" strokeLinecap="round" />
      {isles.map((i) => (
        <g key={i.x}>
          <ellipse cx={i.x} cy={i.y} rx={i.r * 1.3 + 5} ry={i.r * 0.85 + 4} fill="#ecd9a4" />
          <ellipse cx={i.x} cy={i.y} rx={i.r * 1.3} ry={i.r * 0.85} fill={i.c} />
        </g>
      ))}
      <path d="M38 78 h22 l-4 6 h-14 z" fill="#7a4b2a" />
      <path d="M49 78 v-18 q10 8 0 16" fill="#f4ead2" />
      <path d="M226 52 v-16 h14 l-3 4 3 4 h-14" fill="#d8342a" stroke="#3a2a1a" strokeWidth="1.5" />
    </svg>
  );
}

function ComicArt() {
  return (
    <div className={styles.comicArt} aria-hidden>
      <BackdropArt kind="room" className={styles.comicBg} />
      <GadgetFace who="laptop" mood="wow" className={styles.comicActor} />
      <p className={styles.comicBubble}>Кім мені оятты? Ток келді!</p>
    </div>
  );
}

function CrowdArt() {
  return (
    <ul className={styles.crowdArt} aria-hidden>
      {CAREERS.map((c) => (
        <li key={c.id} style={{ ["--c" as string]: c.color }}>
          <GadgetFace who={c.who} mood="smile" />
        </li>
      ))}
    </ul>
  );
}

export function FormatShelf() {
  const index = TOOL_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => !PORTALS.has(i.href)) })).filter((g) => g.items.length);
  return (
    <section className={styles.shelf} aria-labelledby="shelf-title">
      <div className={styles.shelfHead}>
        <p className={styles.micro}>АКТ IV / САБАҚТАН ТЫС</p>
        <h2 id="shelf-title" className={styles.h2}>
          Оқу тек сабақ емес.
        </h2>
        <p className={styles.shelfLede}>Ойна, саяхатта, комикс оқы, болашақ мамандығыңды таңда. Бәрі сол бір білімге апарады.</p>
      </div>

      <ul className={styles.portals}>
        <li className={styles.portalArcade}>
          <Link href="/arcade" className={styles.portal}>
            <ArcadeArt />
            <span className={styles.portalText}>
              <strong>Ойын залы</strong>
              <span>Пакет болып кабельмен ұш, бағтарды жой, серверді вирустан қорға. Жеті ойын, медаль мен рекорд.</span>
            </span>
          </Link>
        </li>
        <li className={styles.portalSea}>
          <Link href="/world" className={styles.portal}>
            <SeaArt />
            <span className={styles.portalText}>
              <strong>IT архипелагы</strong>
              <span>Он бір арал, әрқайсысында қорғаушы, босс және қазына.</span>
            </span>
          </Link>
        </li>
        <li className={styles.portalComic}>
          <Link href="/comics" className={styles.portal}>
            <ComicArt />
            <span className={styles.portalText}>
              <strong>Комикс кітапханасы</strong>
              <span>Ноутбук оянады, пакет саяхаттайды, сервер шаршайды. Әр оқиғаның артында бір сабақ.</span>
            </span>
          </Link>
        </li>
        <li className={styles.portalCareer}>
          <Link href="/career" className={styles.portal}>
            <CrowdArt />
            <span className={styles.portalText}>
              <strong>Кім боламын?</strong>
              <span>Сегіз IT мамандық және әрқайсысына осы сайттан жол.</span>
            </span>
          </Link>
        </li>
      </ul>

      <div className={styles.indexHead}>
        <h3>Тағы құралдар</h3>
        <Link href="/tools" className={styles.shelfAll}>
          Құралдар бетіне өту
        </Link>
      </div>
      <div className={styles.index}>
        {index.map((g) => (
          <div key={g.id} className={styles.indexGroup}>
            <h4>{g.title}</h4>
            <ul>
              {g.items.map((i) => (
                <li key={i.href}>
                  <Link href={i.href}>
                    <span className={styles.indexGlyph} aria-hidden>
                      {i.glyph}
                    </span>
                    <b>{i.title}</b>
                    <span className={styles.indexText}>{i.text}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
