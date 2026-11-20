"use client";

import { useEffect, useRef, useState } from "react";
import type { AssessmentResult } from "@inside-tech/sim-core";
import {
  EOS,
  MAX_MERGES,
  attention,
  entropy,
  languageModels,
  nearest,
  nextTokens,
  sentenceWords,
  tokenize,
  type LangLabAction,
  type LangLabState,
} from "@inside-tech/lab-ai";
import styles from "./lab.module.css";
import lang from "./lang.module.css";

export type LangSection = "tokens" | "embedding" | "attention" | "llm";

interface Props {
  state: LangLabState;
  assessment: AssessmentResult;
  sections: LangSection[];
  dispatch(a: LangLabAction): void;
  canUndo: boolean;
  onUndo(): void;
}

/** Text input that dispatches after a short pause, so each keystroke is not an action. */
function DebouncedInput({ id, value, onCommit, label }: { id: string; value: string; onCommit(v: string): void; label: string }) {
  const [draft, setDraft] = useState(value);
  const commit = useRef(onCommit);
  commit.current = onCommit;
  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    if (draft === value) return;
    const t = setTimeout(() => commit.current(draft), 350);
    return () => clearTimeout(t);
  }, [draft, value]);
  return (
    <>
      <label htmlFor={id} className={styles.small}>
        {label}
      </label>
      <input id={id} className={lang.textInput} value={draft} maxLength={200} onChange={(e) => setDraft(e.target.value)} />
    </>
  );
}

function Range(props: { id: string; label: string; value: number; min: number; max: number; step: number; fmt?: (v: number) => string; onChange(v: number): void }) {
  return (
    <div className={styles.slider}>
      <label htmlFor={props.id}>{props.label}</label>
      <output htmlFor={props.id}>{props.fmt ? props.fmt(props.value) : props.value}</output>
      <input id={props.id} type="range" min={props.min} max={props.max} step={props.step} value={props.value} onChange={(e) => props.onChange(Number(e.target.value))} />
    </div>
  );
}

const QUICK_WORDS = ["мысық", "жылқы", "нан", "аспан", "компьютер", "оқушы"];

export function LangControlPanel({ state, assessment, sections, dispatch, canUndo, onUndo }: Props) {
  const has = (s: LangSection) => sections.includes(s);
  const m = assessment.metrics;
  const ws = sentenceWords(state);

  return (
    <aside className={styles.controls} aria-label="Басқару панелі">
      <div className={styles.metrics} role="status" aria-live="off">
        {has("llm") ? (
          <>
            <div>
              <span>Токендер</span>
              <strong>{state.lm.generated.length}</strong>
            </div>
            <div>
              <span>Temp.</span>
              <strong>{state.lm.temperature.toFixed(1)}</strong>
            </div>
            <div>
              <span>Top-k</span>
              <strong>{state.lm.topK}</strong>
            </div>
            <div>
              <span>P(1-ші)</span>
              <strong>{Math.round((m.topP ?? 0) * 100)}%</strong>
            </div>
          </>
        ) : (
          <>
            <div>
              <span>Сөздер</span>
              <strong>{m.words ?? 0}</strong>
            </div>
            <div>
              <span>Токендер</span>
              <strong>{m.tokens ?? 0}</strong>
            </div>
            <div>
              <span>Сөздік</span>
              <strong>{m.vocabSize ?? 0}</strong>
            </div>
            <div>
              <span>Энтропия</span>
              <strong>{(m.entropy ?? -1) < 0 ? "—" : (m.entropy ?? 0).toFixed(2)}</strong>
            </div>
          </>
        )}
      </div>

      {has("tokens") && (
        <fieldset className={styles.group}>
          <legend>Токенизатор (BPE)</legend>
          <DebouncedInput id="lang-text" label="Сөйлем" value={state.text} onCommit={(text) => dispatch({ type: "text/set", text })} />
          <Range id="merges" label="Merge саны" value={state.merges} min={0} max={MAX_MERGES} step={1} onChange={(v) => dispatch({ type: "bpe/setMerges", merges: v })} />
          <div className={lang.tokens} aria-label="Токендер">
            {tokenize(state).map((toks, i) => (
              <span key={i} className={lang.word}>
                {toks.map((t, j) => (
                  <span key={j} className={lang.tok}>
                    {t}
                  </span>
                ))}
              </span>
            ))}
          </div>
          <p className={styles.small}>«▁» — сөздің соңы. Корпуста жоқ сөздер ұсақ бөліктерге бөлінеді.</p>
        </fieldset>
      )}

      {has("embedding") && (
        <fieldset className={styles.group}>
          <legend>Embedding</legend>
          <div className={lang.chips}>
            {[...new Set([...QUICK_WORDS, ...ws.filter((w) => languageModels().emb.index.has(w))])].map((w) => (
              <button key={w} type="button" className="btn" aria-pressed={state.selectedWord === w} onClick={() => dispatch({ type: "word/select", word: w })}>
                {w}
              </button>
            ))}
          </div>
          {state.selectedWord ? (
            <>
              <p className={styles.small}>«{state.selectedWord}» сөзінің ең жақын көршілері (косинус ұқсастығы):</p>
              <ul className={lang.bars}>
                {nearest(languageModels().emb, state.selectedWord, 6).map((n) => (
                  <li key={n.word}>
                    <span>{n.word}</span>
                    <span className={lang.bar}>
                      <i style={{ width: `${Math.max(0, n.sim) * 100}%` }} />
                    </span>
                    <span>{n.sim.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className={styles.small}>Сөзді таңда немесе 3D кеңістіктегі нүктені бас.</p>
          )}
        </fieldset>
      )}

      {has("attention") && <AttentionControls state={state} dispatch={dispatch} />}
      {has("llm") && <LlmControls state={state} dispatch={dispatch} />}

      <div className={styles.row}>
        <button type="button" className="btn" disabled={!canUndo} onClick={onUndo}>
          Соңғы әрекетті болдырмау
        </button>
      </div>
    </aside>
  );
}

function AttentionControls({ state, dispatch }: { state: LangLabState; dispatch(a: LangLabAction): void }) {
  const a = attention(state);
  const sel = state.selectedToken;
  return (
    <fieldset className={styles.group}>
      <legend>Self-attention</legend>
      <p className={styles.small}>Жолды таңда: бұл токен қай сөздерге назар аударады? Әр жолдың қосындысы 100%.</p>
      <div className={lang.heatWrap}>
        <table className={lang.heat}>
          <thead>
            <tr>
              <th scope="col">
                <span className="visually-hidden">Сұрақ қоятын токен</span>
              </th>
              {a.tokens.map((t, j) => (
                <th key={j} scope="col" title={t}>
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {a.weights.map((row, i) => (
              <tr key={i} data-selected={sel === i}>
                <th scope="row">
                  <button type="button" className={lang.rowBtn} aria-pressed={sel === i} onClick={() => dispatch({ type: "token/select", index: i })} title={a.tokens[i]}>
                    {a.tokens[i]}
                  </button>
                </th>
                {row.map((w, j) => (
                  <td
                    key={j}
                    style={{ background: `color-mix(in srgb, var(--c1) ${Math.round(w * 100)}%, transparent)` }}
                    aria-label={`${a.tokens[i]} → ${a.tokens[j]}: ${Math.round(w * 100)}%`}
                  >
                    {w >= 0.005 ? Math.round(w * 100) : ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sel !== null && a.weights[sel] && (
        <p className={styles.small}>
          «{a.tokens[sel]}» назарының энтропиясы: <strong>{entropy(a.weights[sel]!).toFixed(2)}</strong>
        </p>
      )}
      <Range id="sharp" label="Өткірлік (1/T)" value={state.attn.sharpness} min={0} max={100} step={1} onChange={(v) => dispatch({ type: "attn/set", params: { sharpness: v } })} />
      <Range id="pos" label="Позициялық кодтау" value={state.attn.posWeight} min={0} max={2} step={0.1} fmt={(v) => v.toFixed(1)} onChange={(v) => dispatch({ type: "attn/set", params: { posWeight: v } })} />
      <div className={styles.row}>
        <button type="button" className="btn" aria-pressed={state.attn.causal} onClick={() => dispatch({ type: "attn/set", params: { causal: !state.attn.causal } })}>
          Causal mask
        </button>
        <button type="button" className="btn" aria-pressed={state.attn.maskSelf} onClick={() => dispatch({ type: "attn/set", params: { maskSelf: !state.attn.maskSelf } })}>
          Өзіне назарды жасыру
        </button>
      </div>
      {a.known.some((k) => !k) && <p className={styles.small}>Корпуста жоқ сөздердің векторы нөл: модель олардың мағынасын білмейді.</p>}
    </fieldset>
  );
}

function LlmControls({ state, dispatch }: { state: LangLabState; dispatch(a: LangLabAction): void }) {
  const { shaped } = nextTokens(state);
  const visible = shaped.slice(0, 10);
  return (
    <fieldset className={styles.group}>
      <legend>Тілдік модель</legend>
      <DebouncedInput id="prompt" label="Prompt (бастама)" value={state.lm.prompt} onCommit={(prompt) => dispatch({ type: "lm/setPrompt", prompt })} />
      <div className={lang.generated} aria-live="polite">
        {state.lm.prompt}{" "}
        {state.lm.generated.map((t, i) =>
          t === EOS ? (
            <span key={i} className={lang.end}>
              {" "}
              [соңы]
            </span>
          ) : (
            <span key={i} className={lang.gen}>
              {t}{" "}
            </span>
          ),
        )}
      </div>
      <div className={styles.row}>
        <button type="button" className="btn btn-primary" disabled={state.lm.done} onClick={() => dispatch({ type: "lm/step" })}>
          Келесі токен
        </button>
        <button type="button" className="btn" disabled={state.lm.done} onClick={() => dispatch({ type: "lm/generate", max: 12 })}>
          Сөйлемді аяқта
        </button>
        <button type="button" className="btn" onClick={() => dispatch({ type: "lm/clear" })}>
          Тазалау
        </button>
      </div>
      <p className={styles.small}>Келесі токеннің ықтималдығы (temperature мен top-k қолданылғаннан кейін):</p>
      <ul className={lang.bars}>
        {visible.map((t) => (
          <li key={t.token}>
            <span>{t.token === EOS ? "[соңы]" : t.token}</span>
            <span className={lang.bar}>
              <i style={{ width: `${t.p * 100}%` }} />
            </span>
            <span>{(t.p * 100).toFixed(t.p < 0.1 ? 1 : 0)}%</span>
          </li>
        ))}
      </ul>
      <Range id="temp" label="Temperature" value={state.lm.temperature} min={0} max={3} step={0.1} fmt={(v) => v.toFixed(1)} onChange={(v) => dispatch({ type: "lm/set", params: { temperature: v } })} />
      <Range id="topk" label="Top-k" value={state.lm.topK} min={1} max={30} step={1} onChange={(v) => dispatch({ type: "lm/set", params: { topK: v } })} />
    </fieldset>
  );
}
