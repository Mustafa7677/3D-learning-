"use client";

import { useMemo, useState } from "react";
import { exportModel, exportedModelRunner, type AiLabState } from "@inside-tech/lab-ai";
import styles from "./lab.module.css";
import lang from "./lang.module.css";

/** Trained weights as JSON plus the 10-line function that runs them anywhere. */
export function ExportPanel({ state, onExported }: { state: AiLabState; onExported(): void }) {
  const json = useMemo(() => JSON.stringify(exportModel(state), null, 1), [state]);
  const [status, setStatus] = useState("");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setStatus("JSON көшірілді.");
    } catch {
      const area = document.getElementById("export-json") as HTMLTextAreaElement | null;
      area?.select();
      setStatus("Мәтін белгіленді: Ctrl+C басып көшір.");
    }
    onExported();
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `inside-tech-model-${state.datasetKind}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus("Файл жүктелді.");
    onExported();
  };

  return (
    <fieldset className={styles.group}>
      <legend>Экспорт</legend>
      <label className={styles.small} htmlFor="export-json">
        Модель ({(json.length / 1024).toFixed(1)} KB)
      </label>
      <textarea id="export-json" className={lang.code} readOnly value={json} rows={6} />
      <div className={styles.row}>
        <button type="button" className="btn btn-primary" onClick={copy}>
          JSON-ды көшіру
        </button>
        <button type="button" className="btn" onClick={download}>
          Файл ретінде жүктеу
        </button>
      </div>
      <p className={styles.small} role="status">
        {status}
      </p>
      <label className={styles.small} htmlFor="export-runner">
        Модельді іске қосатын JavaScript функциясы
      </label>
      <textarea id="export-runner" className={lang.code} readOnly value={exportedModelRunner} rows={8} />
    </fieldset>
  );
}
