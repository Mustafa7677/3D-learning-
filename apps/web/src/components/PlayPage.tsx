"use client";

import { useEffect, useState } from "react";
import { decodeLessonSpec, validateLessonSpec, type LessonSpec } from "@inside-tech/lesson-engine";
import Link from "next/link";
import { KIND_IDS } from "@/lib/creator";
import { SpecLessonView } from "./lab/LessonView";
import { SiteHeader } from "./SiteHeader";
import styles from "./home.module.css";
import panel from "./platform.module.css";
import css from "./creator.module.css";

/** Plays a lesson shared as a link. The lesson travels inside the URL fragment, so no server sees it. */
export function PlayPage({ code: given }: { code?: string }) {
  const [state, setState] = useState<{ spec?: LessonSpec; code?: string; error?: string }>();

  useEffect(() => {
    const code = given ?? /(?:^|[#&])l=([A-Za-z0-9_-]+)/.exec(window.location.hash)?.[1];
    if (!code) return setState({ error: "Сілтемеде сабақ жоқ." });
    const spec = decodeLessonSpec(code);
    const issues = validateLessonSpec(spec, KIND_IDS);
    setState(issues.length ? { error: `Сабақты ашу мүмкін емес: ${issues[0]?.message ?? "бүлінген сілтеме"}.` } : { spec: spec as LessonSpec, code });
  }, [given]);

  if (state?.spec) {
    return (
      <>
        <div className={css.playBar} role="note">
          <span>Мұғалім жасаған сабақ: <strong>{state.spec.title}</strong></span>
          <Link href={process.env.NEXT_PUBLIC_STANDALONE === "1" ? `#import=${state.code}` : `/create#import=${state.code}`} className="btn">
            Көшірмесін өңдеу
          </Link>
        </div>
        <SpecLessonView spec={state.spec} />
      </>
    );
  }
  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={panel.main}>
        <h1>Сабақ</h1>
        <p className={panel.lead}>{state?.error ?? "Жүктелуде…"}</p>
      </main>
    </div>
  );
}
