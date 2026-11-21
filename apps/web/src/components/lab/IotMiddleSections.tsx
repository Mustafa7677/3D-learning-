"use client";

import { PWM_FREQS, SUPPLY_V, type IotLabAction, type IotLabState } from "@inside-tech/lab-iot";
import styles from "./lab.module.css";

type D = (a: IotLabAction) => void;
const hz = (f: number) => (f >= 1000 ? `${f / 1000} кГц` : `${f} Гц`);

export function PwmSection({ state, dispatch }: { state: IotLabState; dispatch: D }) {
  const p = state.pwm;
  return (
    <fieldset className={styles.group}>
      <legend>PWM · қорек {SUPPLY_V} В, мотор τ = 20 мс</legend>
      <div className={styles.slider}>
        <label htmlFor="duty">Толтыру (duty)</label>
        <output htmlFor="duty">{Math.round(p.duty * 100)}%</output>
        <input id="duty" type="range" min={0} max={1} step={0.05} value={p.duty} onChange={(e) => dispatch({ type: "pwm/set", duty: Number(e.target.value) })} />
      </div>
      <div className={styles.row} role="group" aria-label="PWM жиілігі">
        {PWM_FREQS.map((f) => (
          <button key={f} type="button" className="btn" aria-pressed={p.freq === f} onClick={() => dispatch({ type: "pwm/set", freq: f })}>
            {hz(f)}
          </button>
        ))}
      </div>
      <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "pwm/run" })}>
        Моторды іске қосу
      </button>
      {p.last && (
        <div className={styles.metrics} role="status" aria-label="PWM нәтижесі">
          <div>
            <span>Орташа кернеу</span>
            <strong>{p.last.avgV.toFixed(1)} В</strong>
          </div>
          <div>
            <span>Жылдамдық ырғағы</span>
            <strong>{(p.last.ripple * 100).toFixed(p.last.ripple < 0.01 ? 2 : 1)}%</strong>
          </div>
          <div>
            <span>Ызың</span>
            <strong>{p.last.audible ? "естіледі" : "жоқ"}</strong>
          </div>
        </div>
      )}
    </fieldset>
  );
}

export function SerialSection({ state, dispatch }: { state: IotLabState; dispatch: D }) {
  const s = state.serial;
  return (
    <>
      <fieldset className={styles.group}>
        <legend>UART · датчик «HELLO» жібереді</legend>
        {(
          [
            ["tx", "Датчик (TX)"],
            ["rx", "Микроконтроллер (RX)"],
          ] as const
        ).map(([side, label]) => (
          <div key={side} className={styles.row} role="group" aria-label={label}>
            <span>{label}</span>
            {[9600, 115200].map((b) => (
              <button key={b} type="button" className="btn" aria-pressed={s[side] === b} onClick={() => dispatch({ type: "uart/set", [side]: b })}>
                {b}
              </button>
            ))}
          </div>
        ))}
        <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "uart/send" })}>
          Қабылдау
        </button>
        {s.received !== null && (
          <p className={styles.small} role="status" aria-label="UART қабылдады">
            Оқылды: <code>{s.received.slice(0, 24)}</code> {s.received === "HELLO" ? "✓" : "⚠"}
          </p>
        )}
      </fieldset>
      <fieldset className={styles.group}>
        <legend>I2C · екі датчик, біреуі 0x76</legend>
        <div className={styles.row} role="group" aria-label="Екінші датчиктің адресі">
          {[0x76, 0x77].map((a) => (
            <button key={a} type="button" className="btn" aria-pressed={s.addrB === a} onClick={() => dispatch({ type: "i2c/address", addrB: a })}>
              Екінші датчик 0x{a.toString(16)}
            </button>
          ))}
        </div>
        <button type="button" className="btn" onClick={() => dispatch({ type: "i2c/read" })}>
          0x76-дан оқу
        </button>
        {s.i2c && (
          <p className={styles.small} role="status" aria-label="I2C нәтижесі">
            {s.i2c.ok ? "Бір датчик жауап берді ✓" : `${s.i2c.answered} датчик бір мезетте жауап берді: деректер бұзылды ⚠`}
          </p>
        )}
      </fieldset>
      <fieldset className={styles.group}>
        <legend>1 КБ жіберу</legend>
        <div className={styles.row}>
          {(
            [
              ["uart", "UART 9600"],
              ["i2c", "I2C 400 кГц"],
              ["spi", "SPI 8 МГц"],
            ] as const
          ).map(([b, label]) => (
            <button key={b} type="button" className="btn" onClick={() => dispatch({ type: "bus/send", bus: b })}>
              {label}
            </button>
          ))}
        </div>
        {s.ms !== null && (
          <p className={styles.small} role="status" aria-label="Жіберу уақыты">
            {s.bus.toUpperCase()}: {s.ms.toLocaleString("ru-RU")} мс
          </p>
        )}
      </fieldset>
    </>
  );
}

export function RtosSection({ state, dispatch }: { state: IotLabState; dispatch: D }) {
  const r = state.rtos;
  return (
    <fieldset className={styles.group}>
      <legend>Жоспарлау · 200 мс</legend>
      <p className={styles.small}>Басқару: әр 10 мс, 2 мс · датчик: әр 20 мс, 4 мс · лог: әр 100 мс</p>
      <div className={styles.row} role="group" aria-label="Жоспарлағыш">
        <button type="button" className="btn" aria-pressed={r.kind === "superloop"} onClick={() => dispatch({ type: "rtos/set", kind: "superloop" })}>
          Суперцикл
        </button>
        <button type="button" className="btn" aria-pressed={r.kind === "priority"} onClick={() => dispatch({ type: "rtos/set", kind: "priority" })}>
          RTOS басымдықтары
        </button>
      </div>
      <div className={styles.row} role="group" aria-label="Лог ұзақтығы">
        {[30, 70].map((ms) => (
          <button key={ms} type="button" className="btn" aria-pressed={r.logger === ms} onClick={() => dispatch({ type: "rtos/set", logger: ms })}>
            Лог {ms} мс
          </button>
        ))}
      </div>
      <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "rtos/run" })}>
        Жоспарлауды іске қосу
      </button>
      {r.last && (
        <div className={styles.metrics} role="status" aria-label="Жоспарлау нәтижесі">
          <div>
            <span>Жүктеме</span>
            <strong>{Math.round(r.last.utilization * 100)}%</strong>
          </div>
          <div>
            <span>Басқару өткізді</span>
            <strong>{r.last.misses.control}</strong>
          </div>
          <div>
            <span>Датчик / лог</span>
            <strong>
              {r.last.misses.sensor} / {r.last.misses.logger}
            </strong>
          </div>
        </div>
      )}
    </fieldset>
  );
}
