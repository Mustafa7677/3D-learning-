"use client";

import { DH_LARGE, DH_SMALL, FORGED, PAYMENT, type MacScheme, type SecLabAction, type SecLabState } from "@inside-tech/lab-sec";
import styles from "./lab.module.css";

type D = (a: SecLabAction) => void;
const hex8 = (n: number) => n.toString(16).padStart(8, "0");

export function BlocksSection({ state, dispatch }: { state: SecLabState; dispatch: D }) {
  const b = state.blocks;
  const last = b.last;
  return (
    <fieldset className={styles.group}>
      <legend>Блоктық шифр режимі · 16×16 сурет, 64 блок</legend>
      <div className={styles.row} role="group" aria-label="Режим">
        {(
          [
            ["ecb", "ECB: әр блок бөлек"],
            ["cbc", "CBC: тізбек"],
          ] as const
        ).map(([m, label]) => (
          <button key={m} type="button" className="btn" aria-pressed={b.mode === m} onClick={() => dispatch({ type: "blocks/set", mode: m })}>
            {label}
          </button>
        ))}
      </div>
      {b.mode === "cbc" && (
        <div className={styles.row} role="group" aria-label="IV">
          {(
            [
              ["fixed", "Тұрақты IV"],
              ["random", "Әр жолы жаңа IV"],
            ] as const
          ).map(([v, label]) => (
            <button key={v} type="button" className="btn" aria-pressed={b.iv === v} onClick={() => dispatch({ type: "blocks/set", iv: v })}>
              {label}
            </button>
          ))}
        </div>
      )}
      <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "blocks/encrypt" })}>
        Суретті шифрлау
      </button>
      {last && (
        <dl className={styles.kv} role="status" aria-label="Шифрлау нәтижесі">
          <dt>Режим</dt>
          <dd>{last.mode.toUpperCase()}</dd>
          <dt>IV</dt>
          <dd>{last.mode === "cbc" ? hex8(last.iv) : "жоқ"}</dd>
          <dt>Әр түрлі шифр блоктары</dt>
          <dd>{new Set(last.cipher).size} / 64</dd>
          <dt>Алғашқы блоктар</dt>
          <dd>{last.cipher.slice(0, 3).map(hex8).join(" ")} …</dd>
        </dl>
      )}
    </fieldset>
  );
}

const SCHEMES: [MacScheme, string][] = [
  ["none", "Тегсіз"],
  ["hash", "SHA-256 тегі"],
  ["hmac", "HMAC-SHA256"],
];

export function MacSection({ state, dispatch }: { state: SecLabState; dispatch: D }) {
  const m = state.mac;
  const last = m.last;
  return (
    <fieldset className={styles.group}>
      <legend>Төлемнің тұтастығы</legend>
      <div className={styles.row} role="group" aria-label="Тег түрі">
        {SCHEMES.map(([s, label]) => (
          <button key={s} type="button" className="btn" aria-pressed={m.scheme === s} onClick={() => dispatch({ type: "mac/scheme", scheme: s })}>
            {label}
          </button>
        ))}
      </div>
      <p className={styles.small}>
        Қосымша жібереді: «{PAYMENT}». Шабуылшы оны «{FORGED}» етіп өзгерте алады.
      </p>
      <div className={styles.row}>
        <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "mac/send", tamper: false, recompute: false })}>
          Адал жіберу
        </button>
        <button type="button" className="btn" onClick={() => dispatch({ type: "mac/send", tamper: true, recompute: false })}>
          Шабуыл: тек соманы өзгерту
        </button>
        <button type="button" className="btn" disabled={m.scheme === "none"} onClick={() => dispatch({ type: "mac/send", tamper: true, recompute: true })}>
          Шабуыл: соманы өзгертіп, тегті қайта есептеу
        </button>
      </div>
      {last && (
        <dl className={styles.kv} role="status" aria-label="Банктің шешімі">
          <dt>Банкке келді</dt>
          <dd>{last.message}</dd>
          <dt>Тег</dt>
          <dd>{last.tag ? `${last.tag.slice(0, 16)}…` : "жоқ"}</dd>
          <dt>Банк</dt>
          <dd>{last.accepted ? (last.tampered ? "қабылдады ⚠ жалған төлем өтті" : "қабылдады ✓") : "қабылдамады: тег сәйкес емес ✓"}</dd>
        </dl>
      )}
    </fieldset>
  );
}

export function DhSection({ state, dispatch }: { state: SecLabState; dispatch: D }) {
  const d = state.dh;
  const { p, g } = d.big ? DH_LARGE : DH_SMALL;
  const x = d.last;
  return (
    <fieldset className={styles.group}>
      <legend>Diffie-Hellman · p = {p.toLocaleString("ru-RU")}, g = {g}</legend>
      <div className={styles.row} role="group" aria-label="Топ">
        <button type="button" className="btn" aria-pressed={!d.big} onClick={() => dispatch({ type: "dh/set", big: false })}>
          Кішкентай топ (p = 23)
        </button>
        <button type="button" className="btn" aria-pressed={d.big} onClick={() => dispatch({ type: "dh/set", big: true })}>
          Үлкен топ (p = 2³¹ − 1)
        </button>
      </div>
      <form
        className={styles.row}
        key={`${d.big}-${d.a}-${d.b}`}
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          dispatch({ type: "dh/set", a: Number(f.get("a")), b: Number(f.get("b")) });
        }}
      >
        <label htmlFor="dh-a">Әлияның құпиясы a</label>
        <input id="dh-a" className={styles.numInput} type="number" name="a" defaultValue={d.a} />
        <label htmlFor="dh-b">Бекзаттың құпиясы b</label>
        <input id="dh-b" className={styles.numInput} type="number" name="b" defaultValue={d.b} />
        <button type="submit" className="btn">
          Құпияларды сақтау
        </button>
      </form>
      <div className={styles.row}>
        <label className={styles.row}>
          <input type="checkbox" checked={d.mitm} onChange={(e) => dispatch({ type: "dh/set", mitm: e.target.checked })} /> Мәлік ортада
        </label>
        <label className={styles.row}>
          <input type="checkbox" checked={d.signed} onChange={(e) => dispatch({ type: "dh/set", signed: e.target.checked })} /> Ашық кілттерге қолтаңба
        </label>
      </div>
      <div className={styles.row}>
        <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "dh/exchange" })}>
          Кілт алмасу
        </button>
        <button type="button" className="btn" disabled={!x || d.mitm} onClick={() => dispatch({ type: "dh/eve" })}>
          Ева: дискретті логарифм іздеу
        </button>
      </div>
      {x && (
        <dl className={styles.kv} role="status" aria-label="Алмасу нәтижесі">
          <dt>Арнада</dt>
          <dd>
            A = {x.A.toLocaleString("ru-RU")}, B = {x.B.toLocaleString("ru-RU")}
          </dd>
          {x.aborted ? (
            <>
              <dt>Нәтиже</dt>
              <dd>Қолтаңба сәйкес емес: алмасу тоқтатылды ✓</dd>
            </>
          ) : (
            <>
              <dt>Әлияның кілті</dt>
              <dd>{x.alice.toLocaleString("ru-RU")}</dd>
              <dt>Бекзаттың кілті</dt>
              <dd>
                {x.bob.toLocaleString("ru-RU")} {x.alice === x.bob ? "✓ бірдей" : "⚠ әр түрлі"}
              </dd>
              {x.mallory && (
                <>
                  <dt>Мәлік біледі</dt>
                  <dd>
                    {x.mallory[0]} (Әлиямен) және {x.mallory[1]} (Бекзатпен)
                  </dd>
                </>
              )}
            </>
          )}
          {d.eve && (
            <>
              <dt>Ева</dt>
              <dd>{d.eve.found !== null ? `a = ${d.eve.found} табылды, ${d.eve.tries} әрекет` : `${d.eve.tries.toLocaleString("ru-RU")} әрекеттен кейін табылмады`}</dd>
            </>
          )}
        </dl>
      )}
    </fieldset>
  );
}
