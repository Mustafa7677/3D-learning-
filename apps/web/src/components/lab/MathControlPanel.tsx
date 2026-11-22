"use client";

import { useState } from "react";
import {
  BASIS_TARGET,
  EIGEN_PRESETS,
  angleDeg,
  apply2,
  combo,
  det,
  det2,
  dirOf,
  dot,
  eigenFactor,
  inverse,
  len,
  parseNumber,
  projLen,
  type EigenPreset,
  type MathLabAction,
  type MathLabState,
  type MathMode,
  type Preset,
  type RowOp,
  type V2,
  type V3,
} from "@inside-tech/lab-math";
import styles from "./lab.module.css";

type D = (a: MathLabAction) => void;
const fmt = (x: number) => (Math.abs(x - Math.round(x)) < 1e-6 ? String(Math.round(x)) : x.toFixed(3).replace(/0+$/, ""));
const AX = ["x", "y", "z"];

function Num({ label, value, step = 1, onChange, min = -10, max = 10 }: { label: string; value: number; step?: number; min?: number; max?: number; onChange(v: number): void }) {
  return (
    <label className={styles.mathNum}>
      <span>{label}</span>
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        aria-label={label}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (e.target.value !== "" && Number.isFinite(v)) onChange(v);
        }}
      />
    </label>
  );
}

function VecInput({ name, v, onChange }: { name: string; v: V3; onChange(v: V3): void }) {
  return (
    <div className={styles.mathVec} role="group" aria-label={`${name} векторы`}>
      <b>{name} =</b>
      {v.map((x, i) => (
        <Num key={i} label={`${name} ${AX[i]}`} value={x} step={0.5} onChange={(n) => onChange(v.map((y, j) => (j === i ? n : y)) as V3)} />
      ))}
    </div>
  );
}

function VectorsSection({ s, d }: { s: MathLabState; d: D }) {
  return (
    <fieldset className={styles.group}>
      <legend>Векторлар</legend>
      <VecInput name="u" v={s.u} onChange={(value) => d({ type: "vec/set", which: "u", value })} />
      <VecInput name="v" v={s.v} onChange={(value) => d({ type: "vec/set", which: "v", value })} />
      <label className={styles.row}>
        <span>k = {fmt(s.k)}</span>
        <input type="range" min={-3} max={3} step={0.5} value={s.k} aria-label="k көбейткіші" onChange={(e) => d({ type: "vec/k", k: Number(e.target.value) })} />
      </label>
      <div className={`${styles.metrics} ${styles.mathMetrics}`} role="status" aria-label="Векторлар нәтижесі">
        <div>
          <span>u + v</span>
          <strong>({s.u.map((x, i) => fmt(x + s.v[i]!)).join(", ")})</strong>
        </div>
        <div>
          <span>|v|</span>
          <strong>{fmt(len(s.v))}</strong>
        </div>
        <div>
          <span>k·u</span>
          <strong>({s.u.map((x) => fmt(s.k * x)).join(", ")})</strong>
        </div>
      </div>
    </fieldset>
  );
}

function DotSection({ s, d }: { s: MathLabState; d: D }) {
  const ok = len(s.u) > 1e-9 && len(s.v) > 1e-9;
  return (
    <fieldset className={styles.group}>
      <legend>Скаляр көбейтінді</legend>
      <VecInput name="u" v={s.u} onChange={(value) => d({ type: "vec/set", which: "u", value })} />
      <VecInput name="v" v={s.v} onChange={(value) => d({ type: "vec/set", which: "v", value })} />
      <div className={`${styles.metrics} ${styles.mathMetrics}`} role="status" aria-label="Скаляр көбейтінді нәтижесі">
        <div>
          <span>u·v</span>
          <strong>{fmt(dot(s.u, s.v))}</strong>
        </div>
        <div>
          <span>Бұрыш</span>
          <strong>{ok ? `${fmt(Math.round(angleDeg(s.u, s.v) * 10) / 10)}°` : "·"}</strong>
        </div>
        <div>
          <span>Проекция</span>
          <strong>{len(s.u) > 1e-9 ? fmt(projLen(s.u, s.v)) : "·"}</strong>
        </div>
        <div>
          <span>|v|</span>
          <strong>{fmt(len(s.v))}</strong>
        </div>
      </div>
    </fieldset>
  );
}

function GaussSection({ s, d }: { s: MathLabState; d: D }) {
  const [kind, setKind] = useState<RowOp["kind"]>("add");
  const [i, setI] = useState(1);
  const [j, setJ] = useState(0);
  const [c, setC] = useState("-2");
  const [err, setErr] = useState("");
  const run = () => {
    const n = parseNumber(c);
    if (kind !== "swap" && (n === null || n === 0)) return setErr("Коэффициент: нөлден өзге сан, мысалы 2, -0.5 не 1/7");
    if (kind !== "scale" && i === j) return setErr("Екі түрлі жолды таңда");
    setErr("");
    d({ type: "gauss/op", op: kind === "swap" ? { kind, i, j } : kind === "scale" ? { kind, i, c: n! } : { kind, i, j, c: n! } });
  };
  return (
    <fieldset className={styles.group}>
      <legend>Кеңейтілген матрица [A | b]</legend>
      <table className={styles.mathMatrix} aria-label="Жүйенің матрицасы">
        <tbody>
          {s.sys.map((r, k) => (
            <tr key={k}>
              <th scope="row">R{k + 1}</th>
              {r.map((x, m) => (
                <td key={m} data-rhs={m === 3 || undefined}>
                  {fmt(x)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className={styles.row} role="group" aria-label="Жол амалы">
        <select value={kind} aria-label="Амал" onChange={(e) => setKind(e.target.value as RowOp["kind"])}>
          <option value="add">Ri ← Ri + c·Rj</option>
          <option value="scale">Ri ← c·Ri</option>
          <option value="swap">Ri ↔ Rj</option>
        </select>
        <select value={i} aria-label="i жолы" onChange={(e) => setI(Number(e.target.value))}>
          {[0, 1, 2].map((k) => (
            <option key={k} value={k}>
              i = R{k + 1}
            </option>
          ))}
        </select>
        {kind !== "scale" && (
          <select value={j} aria-label="j жолы" onChange={(e) => setJ(Number(e.target.value))}>
            {[0, 1, 2].map((k) => (
              <option key={k} value={k}>
                j = R{k + 1}
              </option>
            ))}
          </select>
        )}
        {kind !== "swap" && (
          <label className={styles.mathNum}>
            <span>c</span>
            <input value={c} aria-label="Коэффициент c" onChange={(e) => setC(e.target.value)} />
          </label>
        )}
      </div>
      <div className={styles.row}>
        <button type="button" className="btn btn-primary" onClick={run}>
          Амалды орындау
        </button>
        <button type="button" className="btn" onClick={() => d({ type: "gauss/reset" })}>
          Басынан
        </button>
      </div>
      {err && (
        <p className={styles.small} role="alert">
          {err}
        </p>
      )}
      {s.sysHistory.length > 0 && <p className={styles.small}>Амалдар: {s.sysHistory.join(" · ")}</p>}
    </fieldset>
  );
}

const PRESET_WORD: [Preset, string][] = [
  ["identity", "I"],
  ["rot90", "90° бұру"],
  ["shear", "Ығысу"],
  ["stretch", "x бойымен ×2"],
  ["flatten", "Жаншу"],
  ["mirror", "Айна"],
];

function MatrixEditor({ s, d }: { s: MathLabState; d: D }) {
  return (
    <table className={styles.mathMatrix} aria-label="A матрицасы">
      <tbody>
        {s.A.map((r, ri) => (
          <tr key={ri}>
            {r.map((x, ci) => (
              <td key={ci}>
                <input type="number" step={0.5} value={x} aria-label={`A ${ri + 1},${ci + 1}`} onChange={(e) => e.target.value !== "" && d({ type: "matrix/cell", r: ri, c: ci, value: Number(e.target.value) })} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MatrixSection({ s, d, mode }: { s: MathLabState; d: D; mode: MathMode }) {
  const D = det(s.A);
  const inv = inverse(s.A);
  const last = s.stats.inverseTries.at(-1);
  return (
    <fieldset className={styles.group}>
      <legend>{mode === "det" ? "Анықтауыш" : mode === "inverse" ? "Кері матрица" : "Матрица: кеңістікті түрлендіру"}</legend>
      <MatrixEditor s={s} d={d} />
      <div className={styles.row} role="group" aria-label="Дайын матрицалар">
        {PRESET_WORD.map(([k, label]) => (
          <button key={k} type="button" className="btn" onClick={() => d({ type: "matrix/preset", name: k })}>
            {label}
          </button>
        ))}
      </div>
      {mode === "matrix" && (
        <div className={styles.row} role="group" aria-label="Тағы біріктіру">
          <span className={styles.small}>A-дан кейін қолдану (B·A):</span>
          {PRESET_WORD.filter(([k]) => k !== "identity").map(([k, label]) => (
            <button key={k} type="button" className="btn" onClick={() => d({ type: "matrix/compose", name: k })}>
              + {label}
            </button>
          ))}
        </div>
      )}
      {mode === "inverse" && (
        <div className={styles.row}>
          <button type="button" className="btn btn-primary" onClick={() => d({ type: "inverse/toggle", on: true })}>
            A⁻¹ қолдану
          </button>
          <button type="button" className="btn" onClick={() => d({ type: "inverse/toggle", on: false })}>
            Тек A
          </button>
        </div>
      )}
      <div className={`${styles.metrics} ${styles.mathMetrics}`} role="status" aria-label="Матрица нәтижесі">
        <div>
          <span>det A</span>
          <strong>{fmt(D)}</strong>
        </div>
        <div>
          <span>A⁻¹</span>
          <strong>{inv ? "бар" : "жоқ"}</strong>
        </div>
        {mode === "inverse" && last && (
          <div>
            <span>Соңғы әрекет</span>
            <strong>{last.ok ? "орнына оралды" : "қайтару мүмкін емес"}</strong>
          </div>
        )}
      </div>
    </fieldset>
  );
}

function V2Input({ name, v, onChange }: { name: string; v: V2; onChange(v: V2): void }) {
  return (
    <div className={styles.mathVec} role="group" aria-label={`${name} векторы`}>
      <b>{name} =</b>
      {v.map((x, i) => (
        <Num key={i} label={`${name} ${AX[i]}`} value={x} step={0.5} onChange={(n) => onChange(v.map((y, j) => (j === i ? n : y)) as V2)} />
      ))}
    </div>
  );
}

function BasisSection({ s, d }: { s: MathLabState; d: D }) {
  const p = combo(s.a, s.b1, s.b, s.b2);
  return (
    <fieldset className={styles.group}>
      <legend>Базис және координаталар · t = ({BASIS_TARGET.join(", ")})</legend>
      <V2Input name="b1" v={s.b1} onChange={(b1) => d({ type: "basis/set", b1 })} />
      <V2Input name="b2" v={s.b2} onChange={(b2) => d({ type: "basis/set", b2 })} />
      <label className={styles.row}>
        <span>a = {fmt(s.a)}</span>
        <input type="range" min={-4} max={4} step={0.5} value={s.a} aria-label="a координатасы" onChange={(e) => d({ type: "basis/set", a: Number(e.target.value) })} />
      </label>
      <label className={styles.row}>
        <span>b = {fmt(s.b)}</span>
        <input type="range" min={-4} max={4} step={0.5} value={s.b} aria-label="b координатасы" onChange={(e) => d({ type: "basis/set", b: Number(e.target.value) })} />
      </label>
      <div className={`${styles.metrics} ${styles.mathMetrics}`} role="status" aria-label="Базис нәтижесі">
        <div>
          <span>a·b1 + b·b2</span>
          <strong>({p.map(fmt).join(", ")})</strong>
        </div>
        <div>
          <span>det [b1 b2]</span>
          <strong>{fmt(det2(s.b1, s.b2))}</strong>
        </div>
      </div>
    </fieldset>
  );
}

const EIGEN_WORD: [EigenPreset, string][] = [
  ["symmetric", "[[2, 1], [1, 2]]"],
  ["shear2", "Ығысу [[1, 1], [0, 1]]"],
  ["rotation2", "90° бұрылыс"],
];

function EigenSection({ s, d }: { s: MathLabState; d: D }) {
  const m = EIGEN_PRESETS[s.eigen];
  const v = dirOf(s.probe);
  const w = apply2(m, v);
  const lam = eigenFactor(m, v);
  return (
    <fieldset className={styles.group}>
      <legend>Меншікті бағыттарды ізде</legend>
      <div className={styles.row} role="group" aria-label="Матрица">
        {EIGEN_WORD.map(([k, label]) => (
          <button key={k} type="button" className="btn" aria-pressed={s.eigen === k} onClick={() => d({ type: "eigen/preset", name: k })}>
            {label}
          </button>
        ))}
      </div>
      <label className={styles.row}>
        <span>v бағыты: {s.probe}°</span>
        <input type="range" min={0} max={165} step={15} value={s.probe} aria-label="v бағыты, градус" onChange={(e) => d({ type: "eigen/probe", deg: Number(e.target.value) })} />
      </label>
      <div className={`${styles.metrics} ${styles.mathMetrics}`} role="status" aria-label="Меншікті нәтиже">
        <div>
          <span>v</span>
          <strong>({v.map(fmt).join(", ")})</strong>
        </div>
        <div>
          <span>A·v</span>
          <strong>({w.map(fmt).join(", ")})</strong>
        </div>
        <div>
          <span>λ</span>
          <strong>{lam === null ? "жоқ" : fmt(lam)}</strong>
        </div>
      </div>
    </fieldset>
  );
}

export function MathControlPanel({ state, focus, dispatch, canUndo, onUndo }: { state: MathLabState; focus: MathMode; dispatch: D; canUndo: boolean; onUndo(): void }) {
  return (
    <aside className={styles.controls} aria-label="Басқару панелі">
      {focus === "vectors" && <VectorsSection s={state} d={dispatch} />}
      {focus === "dot" && <DotSection s={state} d={dispatch} />}
      {focus === "gauss" && <GaussSection s={state} d={dispatch} />}
      {(focus === "matrix" || focus === "inverse" || focus === "det") && <MatrixSection s={state} d={dispatch} mode={focus} />}
      {focus === "basis" && <BasisSection s={state} d={dispatch} />}
      {focus === "eigen" && <EigenSection s={state} d={dispatch} />}
      <div className={styles.row}>
        <button type="button" className="btn" disabled={!canUndo} onClick={onUndo}>
          Соңғы әрекетті болдырмау
        </button>
      </div>
    </aside>
  );
}
