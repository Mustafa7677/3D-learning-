import Link from "next/link";
import styles from "./film.module.css";

const COLUMNS: { title: string; links: [string, string][] }[] = [
  { title: "Оқу", links: [["/", "Зертханалар"], ["/today", "Бүгін"], ["/tools", "Оқу құралдары"], ["/problems", "Есептер залы"], ["/focus", "Фокус бөлмесі"]] },
  { title: "Ойна", links: [["/arcade", "Ойын залы"], ["/world", "IT архипелагы"], ["/tactics", "Тактика алаңы"], ["/blackbox", "Қара жәшік"], ["/mission", "Миссия"]] },
  { title: "Оқы", links: [["/comics", "Комикс кітапханасы"], ["/learn", "Қалай оқу керек?"], ["/journey", "Бір басудың саяхаты"], ["/gazette", "Газет"]] },
  { title: "Сен", links: [["/passport", "Оқу паспорты"], ["/career", "Кім боламын?"], ["/sky", "Білім аспаны"], ["/account", "Аккаунт"]] },
  { title: "Мұғалімге", links: [["/teacher", "Мұғалім кабинеті"], ["/create", "Сабақ жасау"]] },
];

/** The end of a long page: the whole site on one map, so nothing is a dead end. */
export function SiteFooter() {
  return (
    <footer className={styles.siteFooter}>
      <div className={styles.footBrand}>
        <Link href="/" className={styles.brand} aria-label="INSIDE TECH, басты бет">
          INSIDE<span aria-hidden>/</span>TECH
        </Link>
        <p>Басқалар технологияны түсіндіреді. Біз сені оның ішіне кіргіземіз.</p>
      </div>
      <nav aria-label="Сайт картасы" className={styles.footMap}>
        {COLUMNS.map((c) => (
          <div key={c.title}>
            <h2>{c.title}</h2>
            <ul>
              {c.links.map(([href, label]) => (
                <li key={href}>
                  <Link href={href}>{label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </footer>
  );
}
