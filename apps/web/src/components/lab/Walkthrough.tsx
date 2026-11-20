"use client";

import type { SampleWalkthrough } from "@inside-tech/lab-ai";
import styles from "./lab.module.css";

const f = (v: number, d = 3) => (Object.is(v, -0) ? 0 : v).toFixed(d);
/** Wrap negatives in parentheses inside formulas: 0.5·(−0.31). */
const pf = (v: number, d = 2) => (v < 0 ? `(${f(v, d).replace("-", "−")})` : f(v, d));
const m = (v: number, d = 3) => f(v, d).replace("-", "−");
const ACT: Record<string, string> = { sigmoid: "σ", tanh: "tanh", relu: "ReLU", step: "step", linear: "" };
const MAX_UNITS = 8;

/**
 * «Есептеу ішінен»: every number behind one prediction and one gradient step,
 * so the formulas in the lecture can be checked by hand on a real point.
 */
export function Walkthrough({ w, learningRate }: { w: SampleWalkthrough; learningRate: number }) {
  const single = w.layers.length === 1;
  return (
    <details className={styles.walk} open={single}>
      <summary>Есептеу ішінен</summary>
      {single ? <NeuronWalk w={w} lr={learningRate} /> : <NetworkWalk w={w} lr={learningRate} />}
    </details>
  );
}

function NeuronWalk({ w, lr }: { w: SampleWalkthrough; lr: number }) {
  const L = w.layers[0]!;
  const [w1, w2] = L.W[0]!;
  const [x1, x2] = w.x;
  const b = L.b[0]!;
  const z = L.z[0]!;
  const d = L.delta[0]!;
  const nl = w.next.layers[0]!;
  const step = L.act === "step";
  return (
    <ol className={styles.walkSteps}>
      <li>
        <b>Forward.</b>
        <code>
          z = {pf(w1!)}·{pf(x1!)} + {pf(w2!)}·{pf(x2!)} + {pf(b)} = {m(z)}
        </code>
        <code>
          p = {ACT[L.act]}({m(z)}) = {m(w.p)}
        </code>
      </li>
      <li>
        <b>Loss</b> (y = {w.y}):
        <code>
          L = −ln({w.y === 1 ? "p" : "1 − p"}) = {m(w.loss)}
        </code>
      </li>
      {step ? (
        <li>
          <b>Backprop мүмкін емес.</b>
          <span>
            step(z): баспалдақ: оның туындысы барлық жерде 0 (z = 0-де анықталмаған). Сондықтан ∂L/∂w = 0: gradient descent салмақты қай жаққа
            жылжытарын білмейді. Активацияны <b>sigmoid</b>-қа ауыстыр: оның туындысы σ(1 − σ) ешқашан 0 емес, және ∂L/∂z = p − y болады.
          </span>
        </li>
      ) : (
        <>
          <li>
            <b>Backprop.</b>
            <code>∂L/∂z = p − y = {m(d)}</code>
            <code>
              ∂L/∂w₁ = (p − y)·x₁ = {m(L.gW[0]![0]!)}
            </code>
            <code>
              ∂L/∂w₂ = (p − y)·x₂ = {m(L.gW[0]![1]!)}
            </code>
            <code>∂L/∂b = p − y = {m(L.gb[0]!)}</code>
          </li>
          <li>
            <b>Бір қадам</b> (η = {lr}):
            <code>
              w₁: {m(w1!)} → {m(nl.W[0]![0]!)}
            </code>
            <code>
              w₂: {m(w2!)} → {m(nl.W[0]![1]!)}
            </code>
            <code>
              b: {m(b)} → {m(nl.b[0]!)}
            </code>
            <span>
              Сонда p: {m(w.p)} → {m(w.nextP)}, L: {m(w.loss)} → <strong>{m(w.nextLoss)}</strong>
            </span>
          </li>
        </>
      )}
    </ol>
  );
}

function NetworkWalk({ w, lr }: { w: SampleWalkthrough; lr: number }) {
  const out = w.layers[w.layers.length - 1]!;
  return (
    <div className={styles.walkSteps}>
      <p className={styles.small}>
        Әр қабат: z = W·a + b, a = f(z). δ = ∂L/∂z: backprop шығыстан кері таратқан қате.
      </p>
      {w.layers.map((l, k) => (
        <table key={k} className={styles.walkTable}>
          <caption>
            {k === w.layers.length - 1 ? "Шығыс" : `${k + 1}-қабат`} · {ACT[l.act]}
            {l.z.length > MAX_UNITS ? ` · алғашқы ${MAX_UNITS} нейрон` : ""}
          </caption>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">z</th>
              <th scope="col">a</th>
              <th scope="col">δ</th>
            </tr>
          </thead>
          <tbody>
            {l.z.slice(0, MAX_UNITS).map((z, j) => (
              <tr key={j} data-dead={l.act === "relu" && z <= 0 ? "true" : undefined}>
                <td>{j + 1}</td>
                <td>{m(z, 2)}</td>
                <td>{m(l.a[j]!, 2)}</td>
                <td>{m(l.delta[j]!, 3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
      <p>
        Loss (y = {w.y}): L = {m(w.loss)}. Шығыс δ = p − y = {m(out.delta[0]!)}; әр шығыс салмағының градиенті ∂L/∂wᵢ = δ·aᵢ.
      </p>
      <p>
        Тек осы нүктемен бір қадам (η = {lr}): p {m(w.p)} → {m(w.nextP)}, L {m(w.loss)} → <strong>{m(w.nextLoss)}</strong>
      </p>
      {w.layers.some((l) => l.act === "relu" && l.z.some((z) => z <= 0)) && (
        <p className={styles.small}>Сұр жолдар: z ≤ 0 болған ReLU нейрондары: олардың δ-сы 0, бұл нүктеден ештеңе үйренбейді.</p>
      )}
    </div>
  );
}
