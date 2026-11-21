import Link from "next/link";
import styles from "./landing.module.css";

/** Other ways in: after the atlas, the formats beyond lessons, as covers on a shelf. */
const ITEMS = [
  { href: "/mission", kind: "МИССИЯ", title: "Бір қаланың интернеті", text: "Мектеп сайты неге баяулады? Өлшеп тап, түзет, қарсы сынақтан өткіз.", mark: "01" },
  { href: "/comic", kind: "КОМИКС", title: "Үш қол алысу", text: "Браузердің орнына сөйле: TCP, TLS, HTTP. Қате таңдасаң, салдарын көресің.", mark: "02" },
  { href: "/gazette", kind: "ГАЗЕТ", title: "INSIDE TECH газеті, № 1", text: "Бас мақала, он сөзден сөзжұмбақ, үш дерек. Басып шығаруға болады.", mark: "03" },
  { href: "/blackbox", kind: "ОЙЫН", title: "Қара жәшік", text: "Ішін көрмей сұлбасын тап: тәжірибе, болжам, қарсы мысал.", mark: "04" },
  { href: "/cards", kind: "КАРТОЧКА", title: "Есте сақтау", text: "Он зертханадан 20 карточка. Білгенің сирек қайтады, білмегенің бүгін қайта шығады.", mark: "05" },
  { href: "/journey", kind: "САЯХАТ", title: "Бір басудың 185 миллисекунды", text: "Enter басқаннан бет ашылғанға дейін: он курс бір сұраныстың ішінде.", mark: "06" },
];

export function FormatShelf() {
  return (
    <section className={styles.shelf} aria-labelledby="shelf-title">
      <div className={styles.shelfHead}>
        <p className={styles.micro}>ОҚУ СӨРЕСІ</p>
        <h2 id="shelf-title" className={styles.h2}>
          Сабақтан басқа да жол бар.
        </h2>
      </div>
      <ul className={styles.shelfList}>
        {ITEMS.map((x) => (
          <li key={x.href}>
            <Link href={x.href} className={styles.cover}>
              <span className={styles.coverKind}>
                <b>{x.mark}</b> {x.kind}
              </span>
              <strong>{x.title}</strong>
              <span className={styles.coverText}>{x.text}</span>
              <span className={styles.coverGo} aria-hidden>
                Ашу →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
