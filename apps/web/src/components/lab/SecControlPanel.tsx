"use client";

import { useEffect, useState } from "react";
import {
  A,
  attempt,
  cipherText,
  escapeHtml,
  frequencies,
  humanTime,
  sha256,
  strength,
  toHex,
  utf8,
  xorBytes,
  type SecLabAction,
  type SecLabState,
  type Storage,
} from "@inside-tech/lab-sec";
import type { SecFocus } from "../scene/SecScene";
import styles from "./lab.module.css";

type D = (a: SecLabAction) => void;

function CipherSection({ state, dispatch }: { state: SecLabState; dispatch: D }) {
  const c = state.cipher;
  const own = c.source === "own";
  const freq = frequencies(cipherText(state));
  const top = freq.indexOf(Math.max(...freq));
  return (
    <fieldset className={styles.group}>
      <legend>{own ? "Цезарь шифры" : "Ұсталған хабар"}</legend>
      {own && (
        <>
          <label className={styles.small} htmlFor="own-text">
            Ашық мәтін
          </label>
          <textarea id="own-text" className={styles.code} rows={2} value={c.text} onChange={(e) => dispatch({ type: "cipher/text", text: e.target.value })} />
          <div className={styles.slider}>
            <label htmlFor="shift">Шифрлау кілті (жылжу)</label>
            <output htmlFor="shift">{c.shift}</output>
            <input id="shift" type="range" min={0} max={41} value={c.shift} onChange={(e) => dispatch({ type: "cipher/shift", shift: Number(e.target.value) })} />
          </div>
        </>
      )}
      <p className={styles.small}>Шифрмәтін:</p>
      <pre className={styles.cipherBox} aria-label="Шифрмәтін">
        {cipherText(state)}
      </pre>
      <div className={styles.slider}>
        <label htmlFor="guess">Кілт болжамы (дешифрлау)</label>
        <output htmlFor="guess">{c.guess}</output>
        <input id="guess" type="range" min={0} max={41} value={c.guess} onChange={(e) => dispatch({ type: "cipher/guess", guess: Number(e.target.value) })} />
      </div>
      <div className={styles.row}>
        <button type="button" className="btn" onClick={() => dispatch({ type: "cipher/guess", guess: c.guess - 1 })} aria-label="Болжамды азайту">
          −1
        </button>
        <button type="button" className="btn" onClick={() => dispatch({ type: "cipher/guess", guess: c.guess + 1 })} aria-label="Болжамды арттыру">
          +1
        </button>
        <button type="button" className="btn" aria-pressed={c.showFreq} onClick={() => dispatch({ type: "cipher/freq", on: !c.showFreq })}>
          Әріп жиілігі
        </button>
      </div>
      <p className={styles.small}>Дешифрланғаны:</p>
      <pre className={styles.cipherBox} aria-label="Дешифрланған мәтін">
        {attempt(state)}
      </pre>
      {c.showFreq && (
        <p className={styles.small} role="status">
          Ең жиі әріп: «{A[top]}» (әліпбидегі нөмірі {top}), {freq[top]} рет. «а» = 0.
        </p>
      )}
    </fieldset>
  );
}

function XorSection({ state, dispatch }: { state: SecLabState; dispatch: D }) {
  const x = state.xor;
  const c = xorBytes(utf8(x.message), utf8(x.key || " "));
  return (
    <fieldset className={styles.group}>
      <legend>XOR шифры</legend>
      <div className={styles.row}>
        <label htmlFor="xor-m">Хабар</label>
        <input id="xor-m" className={styles.textInput} value={x.message} onChange={(e) => dispatch({ type: "xor/set", message: e.target.value })} />
      </div>
      <div className={styles.row}>
        <label htmlFor="xor-k">Кілт</label>
        <input id="xor-k" className={styles.textInput} value={x.key} onChange={(e) => dispatch({ type: "xor/set", key: e.target.value })} />
      </div>
      <p className={styles.small}>
        Хабар {utf8(x.message).length} байт, кілт {utf8(x.key).length} байт
        {utf8(x.key).length < utf8(x.message).length ? ": кілт қайталанады, бұл one-time pad емес!" : ": one-time pad шарты орындалды"}
      </p>
      <p className={styles.small}>Шифр (hex):</p>
      <pre className={styles.cipherBox}>{toHex(c)}</pre>
      <div className={styles.row}>
        <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "xor/encrypt" })}>
          Шифрлау
        </button>
      </div>
      {state.stats.xorRuns.length > 0 && (
        <ul className={styles.notes}>
          {state.stats.xorRuns.slice(-3).map((r, i) => (
            <li key={i}>
              «{r.message}» ⊕ «{r.key}» = {toHex(xorBytes(utf8(r.message), utf8(r.key))).slice(0, 24)}…
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}

function HashSection({ state, dispatch }: { state: SecLabState; dispatch: D }) {
  const [text, setText] = useState(state.hash.input);
  useEffect(() => setText(state.hash.input), [state.hash.input]);
  return (
    <fieldset className={styles.group}>
      <legend>SHA-256</legend>
      <label className={styles.small} htmlFor="hash-in">
        Кіріс
      </label>
      <textarea
        id="hash-in"
        className={styles.code}
        rows={2}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          dispatch({ type: "hash/input", text: e.target.value });
        }}
      />
      <pre className={styles.cipherBox} aria-label="Хэш">
        {sha256(state.hash.input)}
      </pre>
      <p className={styles.small}>Хэштелген мәтіндер: {state.stats.hashes.length}</p>
    </fieldset>
  );
}

const STORAGE: [Storage, string][] = [
  ["plain", "Ашық мәтін"],
  ["hash", "SHA-256"],
  ["salted", "Тұз + SHA-256"],
  ["slow", "Тұз + 1000 раунд"],
];

function PasswordsSection({ state, dispatch }: { state: SecLabState; dispatch: D }) {
  const p = state.passwords;
  return (
    <fieldset className={styles.group}>
      <legend>Ұрланған дерекқор</legend>
      <div className={styles.row} role="group" aria-label="Сақтау тәсілі">
        {STORAGE.map(([s, label]) => (
          <button key={s} type="button" className="btn" aria-pressed={p.storage === s} onClick={() => dispatch({ type: "pw/storage", storage: s })}>
            {label}
          </button>
        ))}
      </div>
      <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "pw/crack" })}>
        Сөздік шабуылы (50 сөз)
      </button>
      {p.lastCrack && (
        <div role="status">
          <div className={styles.metrics}>
            <div>
              <span>Бұзылды</span>
              <strong>{p.lastCrack.cracked.length}/5</strong>
            </div>
            <div>
              <span>Хэш есептеулері</span>
              <strong>{p.lastCrack.work.toLocaleString("ru-RU")}</strong>
            </div>
          </div>
          {p.lastCrack.same.length > 0 && <p className={styles.small}>Бірдей хэш: {p.lastCrack.same.map((g) => g.join(" = ")).join("; ")}: құпиясөздері бірдей!</p>}
        </div>
      )}
    </fieldset>
  );
}

function StrengthSection({ state, dispatch }: { state: SecLabState; dispatch: D }) {
  const [pw, setPw] = useState("");
  const s = pw ? strength(pw) : null;
  return (
    <fieldset className={styles.group}>
      <legend>Құпиясөз күші</legend>
      <form
        className={styles.row}
        onSubmit={(e) => {
          e.preventDefault();
          dispatch({ type: "pw/test", password: pw });
        }}
      >
        <label htmlFor="pw-test">Құпиясөз</label>
        <input id="pw-test" className={styles.textInput} value={pw} autoComplete="off" onChange={(e) => setPw(e.target.value)} />
        <button type="submit" className="btn btn-primary">
          Тексеру
        </button>
      </form>
      {s && (
        <div className={styles.metrics} role="status">
          <div>
            <span>Ұзындық</span>
            <strong>{s.length}</strong>
          </div>
          <div>
            <span>Әліпби</span>
            <strong>{s.pool}</strong>
          </div>
          <div>
            <span>Энтропия</span>
            <strong>{s.bits.toFixed(1)} бит</strong>
          </div>
          <div>
            <span>Brute force</span>
            <strong>{humanTime(s.seconds)}</strong>
          </div>
        </div>
      )}
      {s?.inDictionary && <p className={styles.small}>Бұл құпиясөз шабуылшының сөздігінде бар!</p>}
      <p className={styles.small}>Бағалау: L · log₂(әліпби), секундына 10¹⁰ болжам. Құпиясөз сақталмайды: тек оның биті.</p>
    </fieldset>
  );
}

function RsaSection({ state, dispatch }: { state: SecLabState; dispatch: D }) {
  const r = state.rsa;
  const [p, setP] = useState(String(r.p));
  const [q, setQ] = useState(String(r.q));
  const [e, setE] = useState(String(r.e));
  const [m, setM] = useState(String(r.message));
  const [c, setC] = useState("");
  return (
    <fieldset className={styles.group}>
      <legend>RSA</legend>
      <form
        className={styles.row}
        onSubmit={(ev) => {
          ev.preventDefault();
          dispatch({ type: "rsa/keys", p: Number(p), q: Number(q), e: Number(e) });
        }}
      >
        <label htmlFor="rsa-p">p</label>
        <input id="rsa-p" className={styles.numInput} type="number" value={p} onChange={(ev) => setP(ev.target.value)} />
        <label htmlFor="rsa-q">q</label>
        <input id="rsa-q" className={styles.numInput} type="number" value={q} onChange={(ev) => setQ(ev.target.value)} />
        <label htmlFor="rsa-e">e</label>
        <input id="rsa-e" className={styles.numInput} type="number" value={e} onChange={(ev) => setE(ev.target.value)} />
        <button type="submit" className="btn btn-primary">
          Кілт жасау
        </button>
      </form>
      {r.error && (
        <p className={styles.small} role="alert">
          {r.error}
        </p>
      )}
      {r.keys && (
        <p className={styles.small} role="status">
          n = {r.keys.n}, φ = {r.keys.phi}, d = {r.keys.d}
        </p>
      )}
      <div className={styles.row}>
        <label htmlFor="rsa-m">m</label>
        <input id="rsa-m" className={styles.numInput} type="number" value={m} onChange={(ev) => setM(ev.target.value)} />
        <button type="button" className="btn" disabled={!r.keys} onClick={() => dispatch({ type: "rsa/encrypt", m: Number(m) })}>
          Шифрлау
        </button>
        <button type="button" className="btn" disabled={!r.keys} onClick={() => dispatch({ type: "rsa/sign", m: Number(m) })}>
          Қол қою
        </button>
      </div>
      <div className={styles.row}>
        <label htmlFor="rsa-c">c</label>
        <input id="rsa-c" className={styles.numInput} type="number" value={c} onChange={(ev) => setC(ev.target.value)} />
        <button type="button" className="btn" disabled={!r.keys} onClick={() => dispatch({ type: "rsa/decrypt", c: Number(c) })}>
          Ашу
        </button>
      </div>
      {r.cipher !== null && (
        <p className={styles.small}>
          c = {r.cipher}, ашылғаны: {r.decrypted}
        </p>
      )}
      {r.signature !== null && (
        <p className={styles.small}>
          Қолтаңба s = {r.signature}; sᵉ mod n = {r.verified} {r.verified === r.message ? "✓ жарамды" : "✗"}
        </p>
      )}
    </fieldset>
  );
}

function AttackSection({ state, dispatch }: { state: SecLabState; dispatch: D }) {
  const a = state.attack;
  return (
    <>
      <fieldset className={styles.group}>
        <legend>Кіру формасы</legend>
        <div className={styles.row}>
          <label htmlFor="atk-user">Логин</label>
          <input id="atk-user" className={styles.textInput} value={a.user} autoComplete="off" onChange={(e) => dispatch({ type: "attack/fields", user: e.target.value })} />
        </div>
        <div className={styles.row}>
          <label htmlFor="atk-pass">Құпиясөз</label>
          <input id="atk-pass" className={styles.textInput} value={a.pass} autoComplete="off" onChange={(e) => dispatch({ type: "attack/fields", pass: e.target.value })} />
        </div>
        <div className={styles.row}>
          <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "attack/login" })}>
            Кіру
          </button>
          <button type="button" className="btn" aria-pressed={a.parameterized} onClick={() => dispatch({ type: "attack/param", on: !a.parameterized })}>
            Параметрленген сұраныс
          </button>
        </div>
        {a.last && (
          <div role="status">
            <pre className={styles.cipherBox}>{a.last.query}</pre>
            <p className={styles.small}>{a.last.ok ? `Кірді: ${a.last.as}${a.last.injected ? ": құпиясөзсіз (injection)!" : ""}` : "Кіру сәтсіз."}</p>
          </div>
        )}
      </fieldset>
      <fieldset className={styles.group}>
        <legend>Пікірлер</legend>
        <div className={styles.row}>
          <label htmlFor="atk-comment">Пікір</label>
          <input id="atk-comment" className={styles.textInput} value={a.comment} onChange={(e) => dispatch({ type: "attack/comment", text: e.target.value })} />
          <button type="button" className="btn" onClick={() => dispatch({ type: "attack/post" })}>
            Жариялау
          </button>
        </div>
        <button type="button" className="btn" aria-pressed={a.escape} onClick={() => dispatch({ type: "attack/escape", on: !a.escape })}>
          HTML экрандау
        </button>
        {a.posted.length > 0 && (
          <ul className={styles.notes}>
            {a.posted.map((p, i) => (
              <li key={i}>
                <code>{p.escaped ? escapeHtml(p.text) : p.text}</code>: {p.escaped ? "мәтін ретінде көрсетілді" : "HTML ретінде қосылды"}
              </li>
            ))}
          </ul>
        )}
      </fieldset>
    </>
  );
}

export function SecControlPanel({ state, focus, dispatch, canUndo, onUndo }: { state: SecLabState; focus: SecFocus; dispatch: D; canUndo: boolean; onUndo(): void }) {
  return (
    <aside className={styles.controls} aria-label="Басқару панелі">
      {focus === "cipher" && <CipherSection state={state} dispatch={dispatch} />}
      {focus === "xor" && <XorSection state={state} dispatch={dispatch} />}
      {focus === "hash" && <HashSection state={state} dispatch={dispatch} />}
      {focus === "passwords" && <PasswordsSection state={state} dispatch={dispatch} />}
      {focus === "strength" && <StrengthSection state={state} dispatch={dispatch} />}
      {focus === "rsa" && <RsaSection state={state} dispatch={dispatch} />}
      {focus === "attack" && <AttackSection state={state} dispatch={dispatch} />}
      <div className={styles.row}>
        <button type="button" className="btn" disabled={!canUndo} onClick={onUndo}>
          Соңғы әрекетті болдырмау
        </button>
      </div>
    </aside>
  );
}
