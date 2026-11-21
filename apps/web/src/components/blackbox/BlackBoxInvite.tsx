import Link from "next/link";
import landing from "../film/landing.module.css";
import styles from "./invite.module.css";

/** On the Computer Architecture page: the way into the black box game. */
export function BlackBoxInvite() {
  return (
    <section className={styles.invite} aria-labelledby="bb-invite">
      <div>
        <p className={landing.micro}>ОЙЫН / ҚАРА ЖӘШІК</p>
        <h2 id="bb-invite" className={landing.h2}>
          Ішін көрмей, сұлбасын тап.
        </h2>
        <p className={landing.line}>Екі қосқыш, жабық жәшік, бір шам. Тәжірибе жаса, AND, OR, NOT элементтерінен сұлба құрастыр да, жәшікті аш. Үш жәшік.</p>
      </div>
      <Link href="/blackbox" className={landing.primary}>
        Қара жәшікті ашу
      </Link>
    </section>
  );
}
