"use client";

import { useState } from "react";
import {
  ARM_TARGETS,
  INTERVALS,
  RADIOS,
  aliasFrequency,
  batteryDays,
  fk,
  resolutionC,
  type IotLabAction,
  type IotLabState,
  type Radio,
} from "@inside-tech/lab-iot";
import type { IotFocus } from "../scene/IotScene";
import { FusionSection, PwmSection, RtosSection, SerialSection } from "./IotMiddleSections";
import styles from "./lab.module.css";

type D = (a: IotLabAction) => void;

function Slider({ id, label, value, shown, min, max, step = 1, onChange }: { id: string; label: string; value: number; shown?: string; min: number; max: number; step?: number; onChange(v: number): void }) {
  return (
    <div className={styles.slider}>
      <label htmlFor={id}>{label}</label>
      <output htmlFor={id}>{shown ?? value}</output>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AdcSection({ state, dispatch }: { state: IotLabState; dispatch: D }) {
  const last = state.stats.adcReads[state.stats.adcReads.length - 1];
  return (
    <fieldset className={styles.group}>
      <legend>АЦП</legend>
      <Slider id="bits" label="Разряд (бит)" value={state.adc.bits} min={4} max={16} onChange={(bits) => dispatch({ type: "adc/set", bits })} />
      <Slider id="temp" label="Шын температура, °C" value={state.adc.tempC} shown={state.adc.tempC.toFixed(2)} min={0} max={50} step={0.01} onChange={(tempC) => dispatch({ type: "adc/set", tempC })} />
      <p className={styles.small}>
        Ажыратымдылық: {resolutionC(state.adc.bits).toFixed(3)} °C (V_ref = 3.3 В, сенсор 10 мВ/°C)
      </p>
      <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "adc/read" })}>
        Оқу
      </button>
      {last && (
        <div className={styles.metrics} role="status">
          <Metric label="Разряд" value={`${last.bits} бит`} />
          <Metric label="Оқылды" value={`${(last.tempC - last.errorC).toFixed(2)} °C`} />
          <Metric label="Қате" value={`${last.errorC.toFixed(3)} °C`} />
        </div>
      )}
    </fieldset>
  );
}

function SamplingSection({ state, dispatch }: { state: IotLabState; dispatch: D }) {
  const { f, fs } = state.sampling;
  const fa = aliasFrequency(f, fs);
  return (
    <fieldset className={styles.group}>
      <legend>Дискреттеу</legend>
      <Slider id="fs" label="Дискреттеу жиілігі f_s, Гц" value={fs} min={10} max={400} onChange={(v) => dispatch({ type: "sampling/set", fs: v })} />
      <p className={styles.small}>Сигнал: {f} Гц синус. Найквист шегі: f_s &gt; {2 * f} Гц.</p>
      <div className={styles.metrics} role="status">
        <Metric label="Көрінетін жиілік" value={`${fa} Гц`} />
        <Metric label="Күй" value={fa === f && fs > 2 * f ? "дұрыс" : fa === f ? "шекарада" : "алиасинг"} />
      </div>
    </fieldset>
  );
}

function FilterSection({ state, dispatch }: { state: IotLabState; dispatch: D }) {
  const last = state.stats.filterRuns[state.stats.filterRuns.length - 1];
  return (
    <fieldset className={styles.group}>
      <legend>EMA сүзгісі</legend>
      <Slider id="alpha" label="α" value={state.filter.alpha} shown={state.filter.alpha.toFixed(2)} min={0.05} max={1} step={0.05} onChange={(alpha) => dispatch({ type: "filter/set", alpha })} />
      <code className={styles.code}>y = y + α · (x − y)</code>
      <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "filter/run" })}>
        Сүзу
      </button>
      {state.filter.ran && last && (
        <div className={styles.metrics} role="status">
          <Metric label="Шу (RMS)" value={`${last.noise.toFixed(2)} °C`} />
          <Metric label="Кешігу" value={`${last.lag} қадам`} />
        </div>
      )}
    </fieldset>
  );
}

function ThermoSection({ state, dispatch }: { state: IotLabState; dispatch: D }) {
  const last = state.stats.thermoRuns[state.stats.thermoRuns.length - 1];
  return (
    <fieldset className={styles.group}>
      <legend>Термостат (100 минут)</legend>
      <Slider id="hyst" label="Гистерезис h, °C" value={state.thermo.hysteresis} shown={state.thermo.hysteresis.toFixed(1)} min={0} max={3} step={0.1} onChange={(hysteresis) => dispatch({ type: "thermo/set", hysteresis })} />
      <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "thermo/run" })}>
        Жүргізу
      </button>
      {state.thermo.ran && last && (
        <div className={styles.metrics} role="status">
          <Metric label="Реле қосылды" value={`${last.switches} рет`} />
          <Metric label="Ең үлкен ауытқу" value={`${last.maxDev.toFixed(2)} °C`} />
        </div>
      )}
    </fieldset>
  );
}

function PidSection({ state, dispatch }: { state: IotLabState; dispatch: D }) {
  const p = state.pid;
  const last = state.stats.pidRuns[state.stats.pidRuns.length - 1];
  return (
    <fieldset className={styles.group}>
      <legend>PID реттегіш</legend>
      <Slider id="kp" label="Kp" value={p.kp} min={0} max={40} step={0.5} onChange={(kp) => dispatch({ type: "pid/set", kp })} />
      <Slider id="ki" label="Ki" value={p.ki} min={0} max={20} step={0.5} onChange={(ki) => dispatch({ type: "pid/set", ki })} />
      <Slider id="kd" label="Kd" value={p.kd} min={0} max={15} step={0.5} onChange={(kd) => dispatch({ type: "pid/set", kd })} />
      <p className={styles.small}>{p.plant === "heavy" ? "Ауыр жүк: 3 кг, жүктеме 6 Н, шек ±20 Н" : "Лифт: 1 кг, жүктеме 2 Н, шек ±12 Н"} · мақсат 1 м</p>
      <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "pid/run" })}>
        Жүргізу
      </button>
      {p.ran && last && (
        <div className={styles.metrics} role="status">
          <Metric label="Асып кету" value={`${(last.overshoot * 100).toFixed(1)}%`} />
          <Metric label="Орнығу" value={Number.isFinite(last.settle) ? `${last.settle.toFixed(2)} с` : "жоқ"} />
          <Metric label="Тұрақты қате" value={`${last.ssError.toFixed(3)} м`} />
        </div>
      )}
    </fieldset>
  );
}

function ArmSection({ state, dispatch }: { state: IotLabState; dispatch: D }) {
  const { t1, t2, target } = state.arm;
  const tip = fk(t1, t2).tip;
  const [tx, ty] = ARM_TARGETS[target]!;
  return (
    <fieldset className={styles.group}>
      <legend>Екі буынды қол</legend>
      <div className={styles.row} role="group" aria-label="Нысана">
        {ARM_TARGETS.map((t, i) => (
          <button key={i} type="button" className="btn" aria-pressed={target === i} onClick={() => dispatch({ type: "arm/target", target: i })}>
            ({t[0]}; {t[1]})
          </button>
        ))}
      </div>
      <Slider id="t1" label="Иық θ₁, °" value={Math.round(t1)} min={-180} max={180} onChange={(v) => dispatch({ type: "arm/set", t1: v })} />
      <Slider id="t2" label="Шынтақ θ₂, °" value={Math.round(t2)} min={-170} max={170} onChange={(v) => dispatch({ type: "arm/set", t2: v })} />
      <div className={styles.row}>
        <button type="button" className="btn" onClick={() => dispatch({ type: "arm/ik", elbow: "up" })}>
          IK: шынтақ жоғары
        </button>
        <button type="button" className="btn" onClick={() => dispatch({ type: "arm/ik", elbow: "down" })}>
          IK: шынтақ төмен
        </button>
      </div>
      <div className={styles.metrics} role="status">
        <Metric label="Ұш" value={`(${tip[0].toFixed(2)}; ${tip[1].toFixed(2)})`} />
        <Metric label="Нысанаға дейін" value={Math.hypot(tip[0] - tx, tip[1] - ty).toFixed(2)} />
      </div>
      {state.arm.last && <p className={styles.small}>{state.arm.last}</p>}
    </fieldset>
  );
}

const Q_STEPS = [0.001, 0.003, 0.01, 0.02, 0.05, 0.1, 0.3, 1, 3, 10, 30, 100];
const R_STEPS = [0.1, 0.3, 1, 3, 9, 16, 25, 36, 49, 100, 300, 1000];
const idx = (xs: number[], v: number) => xs.reduce((best, x, i) => (Math.abs(Math.log(x / v)) < Math.abs(Math.log(xs[best]! / v)) ? i : best), 0);

function KalmanSection({ state, dispatch }: { state: IotLabState; dispatch: D }) {
  const k = state.kalman;
  const last = state.stats.kalmanRuns[state.stats.kalmanRuns.length - 1];
  return (
    <fieldset className={styles.group}>
      <legend>Калман сүзгісі</legend>
      <Slider id="q" label="q (одометрия белгісіздігі)" value={idx(Q_STEPS, k.q)} shown={String(k.q)} min={0} max={Q_STEPS.length - 1} onChange={(i) => dispatch({ type: "kalman/set", q: Q_STEPS[i]! })} />
      <Slider id="r" label="r (GPS дисперсиясы)" value={idx(R_STEPS, k.r)} shown={String(k.r)} min={0} max={R_STEPS.length - 1} onChange={(i) => dispatch({ type: "kalman/set", r: R_STEPS[i]! })} />
      <p className={styles.small}>GPS шуы: σ = {k.gpsNoise} м · одометрия 4% артық есептейді</p>
      <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "kalman/run" })}>
        Жүргізу
      </button>
      {k.ran && last && (
        <div className={styles.metrics} role="status">
          <Metric label="Одометрия" value={`${last.odo.toFixed(2)} м`} />
          <Metric label="GPS" value={`${last.gps.toFixed(2)} м`} />
          <Metric label="Калман" value={`${last.fused.toFixed(2)} м`} />
        </div>
      )}
    </fieldset>
  );
}

function MqttSection({ state, dispatch }: { state: IotLabState; dispatch: D }) {
  const [filter, setFilter] = useState(state.mqtt.filter || "home/+/temp");
  const last = state.stats.subscriptions[state.stats.subscriptions.length - 1];
  return (
    <fieldset className={styles.group}>
      <legend>MQTT жазылымы</legend>
      <form
        className={styles.row}
        onSubmit={(e) => {
          e.preventDefault();
          dispatch({ type: "mqtt/subscribe", filter });
        }}
      >
        <label htmlFor="mqtt-filter">Сүзгі</label>
        <input id="mqtt-filter" className={styles.textInput} value={filter} onChange={(e) => setFilter(e.target.value)} />
        <button type="submit" className="btn btn-primary">
          Жазылу
        </button>
      </form>
      <p className={styles.small}>«+»: бір деңгей, «#»: қалғанның бәрі (тек соңында).</p>
      {state.mqtt.error ? (
        <p className={styles.small} role="status">
          {state.mqtt.error}
        </p>
      ) : (
        last && (
          <ul className={styles.notes} role="status">
            <li>
              {last.filter} → {last.matches.length} тақырып
            </li>
            {last.matches.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        )
      )}
    </fieldset>
  );
}

function PowerSection({ state, dispatch }: { state: IotLabState; dispatch: D }) {
  const { minutes, radio } = state.power;
  const days = batteryDays(minutes, radio);
  return (
    <fieldset className={styles.group}>
      <legend>Батарея бюджеті (2000 мА·сағ)</legend>
      <div className={styles.row} role="group" aria-label="Радио">
        {(Object.keys(RADIOS) as Radio[]).map((r) => (
          <button key={r} type="button" className="btn" aria-pressed={radio === r} onClick={() => dispatch({ type: "power/set", radio: r })}>
            {r === "wifi" ? "Wi-Fi" : "LoRa"} ({RADIOS[r].ma} мА × {RADIOS[r].seconds} с)
          </button>
        ))}
      </div>
      <div className={styles.row} role="group" aria-label="Аралық">
        {INTERVALS.map((m) => (
          <button key={m} type="button" className="btn" aria-pressed={minutes === m} onClick={() => dispatch({ type: "power/set", minutes: m })}>
            {m} мин
          </button>
        ))}
      </div>
      <div className={styles.metrics} role="status">
        <Metric label="Батарея" value={`${days.toFixed(0)} күн`} />
        <Metric label="Бір жыл" value={days >= 365 ? "жетеді" : "жетпейді"} />
      </div>
    </fieldset>
  );
}

export function IotControlPanel({ state, focus, dispatch, canUndo, onUndo }: { state: IotLabState; focus: IotFocus; dispatch: D; canUndo: boolean; onUndo(): void }) {
  return (
    <aside className={styles.controls} aria-label="Басқару панелі">
      {focus === "adc" && <AdcSection state={state} dispatch={dispatch} />}
      {focus === "sampling" && <SamplingSection state={state} dispatch={dispatch} />}
      {focus === "filter" && <FilterSection state={state} dispatch={dispatch} />}
      {focus === "thermo" && <ThermoSection state={state} dispatch={dispatch} />}
      {focus === "pid" && <PidSection state={state} dispatch={dispatch} />}
      {focus === "arm" && <ArmSection state={state} dispatch={dispatch} />}
      {focus === "kalman" && <KalmanSection state={state} dispatch={dispatch} />}
      {focus === "mqtt" && <MqttSection state={state} dispatch={dispatch} />}
      {focus === "power" && <PowerSection state={state} dispatch={dispatch} />}
      {focus === "pwm" && <PwmSection state={state} dispatch={dispatch} />}
      {focus === "serial" && <SerialSection state={state} dispatch={dispatch} />}
      {focus === "rtos" && <RtosSection state={state} dispatch={dispatch} />}
      {focus === "fusion" && <FusionSection state={state} dispatch={dispatch} />}
      <div className={styles.row}>
        <button type="button" className="btn" disabled={!canUndo} onClick={onUndo}>
          Соңғы әрекетті болдырмау
        </button>
      </div>
    </aside>
  );
}
