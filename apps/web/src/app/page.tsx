import Link from "next/link";
import { HeroScene } from "@/components/HeroScene";
import { labs } from "@/lib/catalog";
import styles from "@/components/home.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <header className={styles.nav}>
        <Link href="/" className={styles.brand}>
          INSIDE TECH
        </Link>
        <Link href="/labs/ai" className="btn">
          AI зертханасы
        </Link>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={styles.heroText}>
            <h1>
              <span>Технологияның</span>
              <span>ішіне кір.</span>
            </h1>
            <p className={styles.lead}>
              Нейрондық желі қалай үйренетінін бейнеден көрме, өзің үйрет. Салмақты бұра, деректі өзгерт, қатені тап — бәрі браузерде, нақты есептеумен.
            </p>
            <div className={styles.cta}>
              <Link href="/labs/ai/ai-1-data" className="btn btn-primary">
                Бірінші сабақты бастау
              </Link>
              <Link href="/labs/ai" className="btn">
                Сабақтарды қарау
              </Link>
            </div>
          </div>
          <HeroScene />
        </section>

        <section className={styles.modes} aria-label="Қалай оқимыз">
          <div>
            <h2>Зертте</h2>
            <p>Технологияның ішін 3D-де көр: деректер, нейрондар, сигналдың жолы.</p>
          </div>
          <div>
            <h2>Өзгерт</h2>
            <p>Кез келген параметрді өзгерт те, симуляцияның қалай жауап беретінін бақыла. Қателесуден қорықпа — бір батырмамен артқа қайтасың.</p>
          </div>
          <div>
            <h2>Жаса</h2>
            <p>Әр сабақ өз қолыңмен жасаған нәтижемен аяқталады: үйретілген модель, жұмыс істейтін сайт, ойын.</p>
          </div>
        </section>

        <section className={styles.labsSection} aria-labelledby="labs-title">
          <div className={styles.labsInner}>
            <h2 id="labs-title">Он зертхана</h2>
            <p>AI зертханасы ашық. Қалғандары дәл сол симуляция қозғалтқышының үстіне кезекпен қосылады.</p>
            <ul className={styles.labs}>
              {labs.map((lab) => (
                <li key={lab.id}>
                  {lab.status === "open" && lab.href ? (
                    <Link href={lab.href} className={styles.lab}>
                      <h3>{lab.title}</h3>
                      <p>{lab.inside}</p>
                      <small>8 сабақ ашық</small>
                    </Link>
                  ) : (
                    <div className={styles.lab} aria-disabled="true">
                      <h3>{lab.title}</h3>
                      <p>{lab.inside}</p>
                      <small>Жақында</small>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>INSIDE TECH · 3D IT Learning Platform</footer>
    </div>
  );
}
