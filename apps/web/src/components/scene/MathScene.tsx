"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { BufferGeometry, CatmullRomCurve3, Color, Float32BufferAttribute, Quaternion, TubeGeometry, Vector3 } from "three";
import {
  BASIS_TARGET,
  CONE_H,
  CONE_HALF,
  CONIC_NAME,
  EIGEN_PRESETS,
  conicEccentricity,
  conicKind,
  ellipsePoint,
  focalDistances,
  sectionCurve,
  vertexLines,
  add,
  angleDeg,
  apply,
  apply2,
  combo,
  det,
  dirOf,
  dot,
  eigenFactor,
  inverse,
  isReduced,
  len,
  mul,
  projLen,
  scale,
  type M3,
  shown,
  type MathLabState,
  type MathMode,
  type V3,
} from "@inside-tech/lab-math";
import { FitCamera } from "./FitCamera";
import { Label } from "./Label";
import { StageLook } from "./StageLook";

export type MathFocus = MathMode;

const BLUE = new Color("#3d6bf2");
const GOLD = new Color("#e8a93a");
const GREEN = new Color("#1f9d6b");
const RED = new Color("#d4463d");
const VIOLET = new Color("#8b5cf6");
const CHALK = new Color("#dfe6f3");
const DIM = new Color("#9fb8ad");

/** Math coordinates (z up) to the scene's (y up). */
const W = (v: readonly number[]): [number, number, number] => [v[0] ?? 0, v[2] ?? 0, -(v[1] ?? 0)];

function Arrow({ from = [0, 0, 0], to, color, label, width = 0.06 }: { from?: V3; to: V3; color: Color; label?: string; width?: number }) {
  const a = new Vector3(...W(from));
  const b = new Vector3(...W(to));
  const d = b.clone().sub(a);
  const L = d.length();
  if (L < 1e-6) return null;
  const head = Math.min(0.35, L * 0.35);
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), d.clone().normalize());
  const shaft = a.clone().add(d.clone().multiplyScalar((L - head) / L / 2));
  const tip = a.clone().add(d.clone().multiplyScalar((L - head / 2) / L));
  return (
    <group>
      <mesh position={shaft} quaternion={q}>
        <cylinderGeometry args={[width, width, L - head, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} />
      </mesh>
      <mesh position={tip} quaternion={q}>
        <coneGeometry args={[width * 2.6, head, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} />
      </mesh>
      {label && <Label text={label} position={[b.x, b.y + 0.4, b.z]} size={0.36} />}
    </group>
  );
}

function Segment({ a, b, color, opacity = 1, width = 0.025 }: { a: V3; b: V3; color: Color; opacity?: number; width?: number }) {
  const p = new Vector3(...W(a));
  const d = new Vector3(...W(b)).sub(p);
  const L = d.length();
  if (L < 1e-6) return null;
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), d.clone().normalize());
  return (
    <mesh position={p.add(d.multiplyScalar(0.5))} quaternion={q}>
      <cylinderGeometry args={[width, width, L, 6]} />
      <meshStandardMaterial color={color} transparent={opacity < 1} opacity={opacity} />
    </mesh>
  );
}

function Dot({ at, color, r = 0.12 }: { at: V3; color: Color; r?: number }) {
  return (
    <mesh position={W(at)}>
      <sphereGeometry args={[r, 20, 14]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
    </mesh>
  );
}

function Axes({ size = 5, z = true }: { size?: number; z?: boolean }) {
  return (
    <group>
      <Segment a={[-size, 0, 0]} b={[size, 0, 0]} color={DIM} />
      <Segment a={[0, -size, 0]} b={[0, size, 0]} color={DIM} />
      {z && <Segment a={[0, 0, -0.01]} b={[0, 0, size * 0.8]} color={DIM} />}
      <Label text="x" position={W([size + 0.3, 0, 0])} size={0.32} />
      <Label text="y" position={W([0, size + 0.3, 0])} size={0.32} />
      {z && <Label text="z" position={W([0, 0, size * 0.8 + 0.3])} size={0.32} />}
    </group>
  );
}

/** Where the readout floats: up and to the left, clear of the z axis. */
const INFO: [number, number, number] = [2.6, 4.6, -2.6];
const fmt = (x: number) => (Math.abs(x - Math.round(x)) < 1e-6 ? String(Math.round(x)) : x.toFixed(2));
const vs = (v: readonly number[]) => `(${v.map(fmt).join(", ")})`;

// ---------------- lesson 1 and 2 ----------------

function VectorsView({ s }: { s: MathLabState }) {
  const sum = add(s.u, s.v);
  const ku = scale(s.k, s.u);
  return (
    <group>
      <Segment a={s.u} b={sum} color={GOLD} opacity={0.45} />
      <Segment a={s.v} b={sum} color={BLUE} opacity={0.45} />
      <Arrow to={s.u} color={BLUE} label={`u ${vs(s.u)}`} />
      <Arrow to={s.v} color={GOLD} label={`v ${vs(s.v)}`} />
      <Arrow to={sum} color={GREEN} label={`u + v ${vs(sum)}`} width={0.075} />
      {s.k !== 1 && <Arrow to={ku} color={VIOLET} label={`${fmt(s.k)}·u`} width={0.05} />}
      <Label text={`|v| = ${fmt(len(s.v))} · |u + v| = ${fmt(len(sum))}`} position={INFO} size={0.42} />
    </group>
  );
}

function DotView({ s }: { s: MathLabState }) {
  const lu = len(s.u);
  const p = lu > 1e-9 ? projLen(s.u, s.v) : 0;
  const foot = lu > 1e-9 ? scale(p / lu, s.u) : ([0, 0, 0] as V3);
  const d = dot(s.u, s.v);
  const ang = lu > 1e-9 && len(s.v) > 1e-9 ? angleDeg(s.u, s.v) : 0;
  return (
    <group>
      <Arrow to={s.u} color={BLUE} label={`u ${vs(s.u)}`} />
      <Arrow to={s.v} color={GOLD} label={`v ${vs(s.v)}`} />
      <Segment a={[0, 0, 0]} b={foot} color={RED} width={0.07} />
      <Segment a={foot} b={s.v} color={CHALK} opacity={0.5} />
      <Dot at={foot} color={RED} r={0.09} />
      <Label text={`u·v = ${fmt(d)} · бұрыш ${fmt(Math.round(ang * 10) / 10)}° · проекция ${fmt(p)}`} position={INFO} size={0.42} />
      <Label text={Math.abs(d) < 1e-6 ? "перпендикуляр" : d > 0 ? "сүйір бұрыш" : "доғал бұрыш"} position={[INFO[0], INFO[1] - 0.55, INFO[2]]} size={0.36} />
    </group>
  );
}

// ---------------- lesson 3 ----------------

const PLANE_COLORS = [BLUE, GOLD, GREEN];

function Plane({ n, d, color }: { n: V3; d: number; color: Color }) {
  const L = len(n);
  if (L < 1e-9) return null;
  const c = scale(d / (L * L), n);
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), new Vector3(...W(n)).normalize());
  return (
    <mesh position={W(c)} quaternion={q}>
      <planeGeometry args={[9, 9]} />
      <meshStandardMaterial color={color} transparent opacity={0.28} side={2} depthWrite={false} />
    </mesh>
  );
}

function GaussView({ s }: { s: MathLabState }) {
  const solved = isReduced(s.sys);
  return (
    <group>
      {s.sys.map((r, i) => (
        <Plane key={i} n={[r[0], r[1], r[2]]} d={r[3]} color={PLANE_COLORS[i]!} />
      ))}
      <Dot at={[1, 2, 3]} color={solved ? GREEN : CHALK} r={solved ? 0.2 : 0.12} />
      <Label text={solved ? "ортақ нүкте (1, 2, 3)" : "үш жазықтықтың ортақ нүктесі"} position={[W([1, 2, 3])[0], W([1, 2, 3])[1] + 0.55, W([1, 2, 3])[2]]} size={0.36} />
      <Label text="әр жол амалы жазықтықтарды бұрады, ал ортақ нүкте орнында" position={[0, 6.2, 0]} size={0.38} />
    </group>
  );
}

// ---------------- lessons 4, 5, 6 ----------------

const LATTICE: [V3, V3][] = (() => {
  const out: [V3, V3][] = [];
  const r = [-1, 0, 1];
  for (const a of r)
    for (const b of r) {
      out.push([[-1, a, b], [1, a, b]]);
      out.push([[a, -1, b], [a, 1, b]]);
      out.push([[a, b, -1], [a, b, 1]]);
    }
  return out;
})();

function Lattice({ m, color, opacity }: { m: M3; color: Color; opacity: number }) {
  return (
    <group>
      {LATTICE.map(([a, b], i) => (
        <Segment key={i} a={apply(m, a)} b={apply(m, b)} color={color} opacity={opacity} width={0.018} />
      ))}
    </group>
  );
}

function Basis({ m }: { m: M3 }) {
  return (
    <group>
      <Arrow to={[m[0][0], m[1][0], m[2][0]]} color={RED} label="A·e1" />
      <Arrow to={[m[0][1], m[1][1], m[2][1]]} color={GREEN} label="A·e2" />
      <Arrow to={[m[0][2], m[1][2], m[2][2]]} color={BLUE} label="A·e3" />
    </group>
  );
}

const I3: M3 = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

function MatrixView({ s }: { s: MathLabState }) {
  return (
    <group>
      <Lattice m={I3} color={DIM} opacity={0.35} />
      <Lattice m={s.A} color={GOLD} opacity={0.9} />
      <Basis m={s.A} />
      <Label text={`det A = ${fmt(det(s.A))}`} position={[-2.2, 3.2, 0]} size={0.42} />
    </group>
  );
}

function InverseView({ s }: { s: MathLabState }) {
  const inv = inverse(s.A);
  const tried = s.stats.inverseTries.at(-1);
  const failed = tried && !tried.ok;
  return (
    <group>
      <Lattice m={I3} color={DIM} opacity={0.3} />
      <Lattice m={s.A} color={GOLD} opacity={s.showInverse ? 0.25 : 0.9} />
      {s.showInverse && inv && <Lattice m={mul(inv, s.A)} color={GREEN} opacity={0.95} />}
      <Label text={s.showInverse ? "A⁻¹·A = I: тор орнына оралды" : failed ? `A⁻¹ жоқ: det A = ${fmt(det(s.A))}` : `A қолданылды · det A = ${fmt(det(s.A))}`} position={[-2.2, 3.2, 0]} size={0.42} />
    </group>
  );
}

const CORNERS: V3[] = [
  [0, 0, 0],
  [1, 0, 0],
  [1, 1, 0],
  [0, 1, 0],
  [0, 0, 1],
  [1, 0, 1],
  [1, 1, 1],
  [0, 1, 1],
];
const FACES = [
  [0, 1, 2, 0, 2, 3],
  [4, 6, 5, 4, 7, 6],
  [0, 4, 5, 0, 5, 1],
  [1, 5, 6, 1, 6, 2],
  [2, 6, 7, 2, 7, 3],
  [3, 7, 4, 3, 4, 0],
].flat();

function DetView({ s }: { s: MathLabState }) {
  const D = det(s.A);
  const geo = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(CORNERS.flatMap((c) => W(apply(s.A, c))), 3));
    g.setIndex(FACES);
    g.computeVertexNormals();
    return g;
  }, [s.A]);
  const color = Math.abs(D) < 1e-9 ? DIM : D < 0 ? RED : GREEN;
  return (
    <group>
      <Lattice m={[[0.5, 0, 0], [0, 0.5, 0], [0, 0, 0.5]]} color={DIM} opacity={0.15} />
      <mesh geometry={geo}>
        <meshStandardMaterial color={color} transparent opacity={0.55} side={2} />
      </mesh>
      {[
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 0],
        [4, 5],
        [5, 6],
        [6, 7],
        [7, 4],
        [0, 4],
        [1, 5],
        [2, 6],
        [3, 7],
      ].map(([a, b], i) => (
        <Segment key={i} a={apply(s.A, CORNERS[a!]!)} b={apply(s.A, CORNERS[b!]!)} color={CHALK} width={0.02} />
      ))}
      <Basis m={s.A} />
      <Label text={`көлем = |det A| = ${fmt(Math.abs(D))}${D < -1e-9 ? " · айнадай аударылған" : Math.abs(D) < 1e-9 ? " · жаншылды" : ""}`} position={[-2.2, 3.2, 0]} size={0.42} />
    </group>
  );
}

// ---------------- lesson 7 ----------------

function BasisView({ s }: { s: MathLabState }) {
  const b1: V3 = [s.b1[0], s.b1[1], 0];
  const b2: V3 = [s.b2[0], s.b2[1], 0];
  const p = combo(s.a, s.b1, s.b, s.b2);
  const reached = Math.abs(p[0] - BASIS_TARGET[0]) < 1e-6 && Math.abs(p[1] - BASIS_TARGET[1]) < 1e-6;
  const lines: [V3, V3][] = [];
  for (let i = -4; i <= 4; i++) {
    lines.push([add(scale(i, b1), scale(-4, b2)), add(scale(i, b1), scale(4, b2))]);
    lines.push([add(scale(-4, b1), scale(i, b2)), add(scale(4, b1), scale(i, b2))]);
  }
  const step1 = scale(s.a, b1);
  return (
    <group>
      {lines.map(([a, b], i) => (
        <Segment key={i} a={a} b={b} color={VIOLET} opacity={0.35} width={0.015} />
      ))}
      <Arrow to={b1} color={BLUE} label="b1" />
      <Arrow to={b2} color={GOLD} label="b2" />
      <Arrow to={step1} color={BLUE} width={0.04} />
      <Arrow from={step1} to={[p[0], p[1], 0]} color={GOLD} width={0.04} />
      <Dot at={[BASIS_TARGET[0], BASIS_TARGET[1], 0]} color={reached ? GREEN : RED} r={0.16} />
      <Label text={`t ${vs(BASIS_TARGET)}`} position={W([BASIS_TARGET[0], BASIS_TARGET[1], 0.7])} size={0.36} />
      <Label text={`${fmt(s.a)}·b1 + ${fmt(s.b)}·b2 = ${vs(p)}${reached ? " = t" : ""}`} position={[1, 0.3, 4.4]} size={0.42} />
    </group>
  );
}

// ---------------- lesson 8 ----------------

function EigenView({ s }: { s: MathLabState }) {
  const m = EIGEN_PRESETS[s.eigen];
  const probe = dirOf(s.probe);
  const img = apply2(m, probe);
  const lam = eigenFactor(m, probe);
  return (
    <group>
      {Array.from({ length: 24 }, (_, i) => {
        const v = dirOf(i * 15);
        const w = apply2(m, v);
        return (
          <group key={i}>
            <Segment a={[0, 0, 0]} b={[v[0] * 1.5, v[1] * 1.5, 0]} color={DIM} opacity={0.5} width={0.015} />
            <Segment a={[v[0] * 1.5, v[1] * 1.5, 0]} b={[w[0] * 1.5, w[1] * 1.5, 0]} color={VIOLET} opacity={0.35} width={0.012} />
          </group>
        );
      })}
      <Segment a={[-probe[0] * 5, -probe[1] * 5, 0]} b={[probe[0] * 5, probe[1] * 5, 0]} color={lam !== null ? GREEN : CHALK} opacity={0.5} width={0.02} />
      <Arrow to={[probe[0] * 1.5, probe[1] * 1.5, 0]} color={BLUE} label={`v (${s.probe}°)`} />
      <Arrow to={[img[0] * 1.5, img[1] * 1.5, 0]} color={lam !== null ? GREEN : GOLD} label="A·v" width={0.07} />
      <Label text={lam !== null ? `A·v = ${fmt(lam)}·v: өз түзуінде қалды` : "A·v бұрылып кетті"} position={[0, 0.3, 3.9]} size={0.42} />
    </group>
  );
}

// ---------------- analytic geometry ----------------

/** A smooth chalk curve through points in math coordinates. */
function Curve({ pts, color, r = 0.05 }: { pts: V3[]; color: Color; r?: number }) {
  const geo = useMemo(() => new TubeGeometry(new CatmullRomCurve3(pts.map((p) => new Vector3(...W(p)))), Math.max(16, pts.length), r, 8, false), [pts, r]);
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.45} />
    </mesh>
  );
}

function EllipseView({ s }: { s: MathLabState }) {
  const { a, c, t } = s.ell;
  const ring = useMemo(() => Array.from({ length: 121 }, (_, i) => { const [x, y] = ellipsePoint({ a, c }, i * 3); return [x, y, 0] as V3; }), [a, c]);
  const [px, py] = ellipsePoint({ a, c }, t);
  const P: V3 = [px, py, 0];
  const F1: V3 = [-c, 0, 0];
  const F2: V3 = [c, 0, 0];
  const [d1, d2] = focalDistances({ a, c }, t);
  return (
    <group>
      <Curve pts={ring} color={CHALK} r={0.04} />
      <Segment a={[-a, 0, 0]} b={[a, 0, 0]} color={VIOLET} opacity={0.6} width={0.02} />
      <Segment a={F1} b={P} color={BLUE} width={0.045} />
      <Segment a={F2} b={P} color={GOLD} width={0.045} />
      <Dot at={F1} color={RED} r={0.16} />
      <Dot at={F2} color={RED} r={0.16} />
      <Dot at={P} color={GREEN} r={0.2} />
      <Label text="F₁" position={W([-c, -0.7, 0])} size={0.5} />
      <Label text="F₂" position={W([c, -0.7, 0])} size={0.5} />
      <Label text={`d₁ = ${d1.toFixed(2)}`} position={W([(px - c) / 2 - 0.6, py / 2 + 0.6, 0])} size={0.5} />
      <Label text={`d₂ = ${d2.toFixed(2)}`} position={W([(px + c) / 2 + 0.6, py / 2 + 0.6, 0])} size={0.5} />
      <Label text={`d₁ + d₂ = ${(d1 + d2).toFixed(2)} = 2a`} position={W([0, -Math.max(2.4, a * 0.9), 0])} size={0.6} />
    </group>
  );
}

function ConicView({ s }: { s: MathLabState }) {
  const { tilt, d } = s.cut;
  const kind = conicKind(s.cut);
  const runs = useMemo(() => sectionCurve({ tilt, d }), [tilt, d]);
  const lines = useMemo(() => (Math.abs(d) < 1e-9 ? vertexLines({ tilt, d }) : []), [tilt, d]);
  const R = CONE_H * Math.tan((CONE_HALF * Math.PI) / 180);
  const b = (tilt * Math.PI) / 180;
  const n: V3 = [0, -Math.sin(b), Math.cos(b)];
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), new Vector3(...W(n)).normalize());
  const gens = Array.from({ length: 12 }, (_, i) => {
    const phi = (i * Math.PI) / 6;
    return [Math.cos(phi) * R, Math.sin(phi) * R] as const;
  });
  return (
    // The vertex floats above the floor so both nappes show.
    <group position={[0, CONE_H, 0]}>
      <mesh position={[0, CONE_H / 2, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[R, CONE_H, 48, 1, true]} />
        <meshStandardMaterial color={BLUE} transparent opacity={0.16} side={2} depthWrite={false} />
      </mesh>
      <mesh position={[0, -CONE_H / 2, 0]}>
        <coneGeometry args={[R, CONE_H, 48, 1, true]} />
        <meshStandardMaterial color={BLUE} transparent opacity={0.16} side={2} depthWrite={false} />
      </mesh>
      {gens.map(([x, y], i) => (
        <Segment key={i} a={[-x, -y, -CONE_H]} b={[x, y, CONE_H]} color={DIM} opacity={0.35} width={0.01} />
      ))}
      <mesh position={W([n[0] * d, n[1] * d, n[2] * d])} quaternion={q}>
        <planeGeometry args={[6.5, 6.5]} />
        <meshStandardMaterial color={GOLD} transparent opacity={0.2} side={2} depthWrite={false} />
      </mesh>
      {runs.map((run, i) => (
        <Curve key={`${tilt}-${d}-${i}`} pts={run} color={GOLD} r={0.055} />
      ))}
      {lines.map(([p, q2], i) => (
        <Segment key={i} a={p!} b={q2!} color={GOLD} width={0.05} />
      ))}
      {kind === "point" && <Dot at={[0, 0, 0]} color={GOLD} r={0.14} />}
      <Label text={`${CONIC_NAME[kind]} · β = ${tilt}° · e = ${conicEccentricity(s.cut).toFixed(2)}`} position={[0, CONE_H + 0.9, 0]} size={0.42} />
    </group>
  );
}

const FRAMES: Record<MathFocus, { w: number; h: number; t: [number, number, number]; d: [number, number, number] }> = {
  vectors: { w: 11, h: 7, t: [1.5, 1, -1.5], d: [0.35, 0.8, 1] },
  dot: { w: 11, h: 7, t: [1.5, 1, -1.5], d: [0.35, 0.8, 1] },
  gauss: { w: 13, h: 10, t: [1, 2, -1.5], d: [1, 0.7, 1] },
  matrix: { w: 7.5, h: 6, t: [0, 0.6, 0], d: [0.8, 0.6, 1] },
  inverse: { w: 7.5, h: 6, t: [0, 0.6, 0], d: [0.8, 0.6, 1] },
  det: { w: 9, h: 6.5, t: [0.6, 0.8, -0.6], d: [0.9, 0.7, 1] },
  basis: { w: 12, h: 8, t: [1, 0.5, -0.5], d: [0, 1.6, 1] },
  eigen: { w: 9, h: 7, t: [0, 0.5, 0], d: [0, 1.8, 0.8] },
  ellipse: { w: 16, h: 10, t: [0, 0, 0], d: [0, 1.6, 1] },
  conic: { w: 9, h: 8.5, t: [0, 3, 0], d: [1, 0.35, 1] },
};

function Contents({ state: learner, focus }: { state: MathLabState; focus: MathFocus }) {
  // A solution film draws over the learner's own state while it plays.
  const state = shown(learner);
  const f = FRAMES[focus] ?? FRAMES.vectors;
  return (
    <>
      <ambientLight intensity={0.75} />
      <directionalLight position={[5, 9, 6]} intensity={1.2} />
      <directionalLight position={[-6, 4, -4]} intensity={0.35} />
      {/* A chalkboard, not a stage: dark green, chalk-white lines. */}
      <color attach="background" args={["#142a23"]} />
      <gridHelper args={[12, 12, "#7f9c8f", "#2f4a40"]} position={[0, -0.005, 0]} />
      <StageLook />
      {focus !== "conic" && <Axes z={focus !== "basis" && focus !== "eigen" && focus !== "ellipse"} size={focus === "ellipse" ? 7.5 : 5} />}
      {focus === "vectors" && <VectorsView s={state} />}
      {focus === "dot" && <DotView s={state} />}
      {focus === "gauss" && <GaussView s={state} />}
      {focus === "matrix" && <MatrixView s={state} />}
      {focus === "inverse" && <InverseView s={state} />}
      {focus === "det" && <DetView s={state} />}
      {focus === "basis" && <BasisView s={state} />}
      {focus === "eigen" && <EigenView s={state} />}
      {focus === "ellipse" && <EllipseView s={state} />}
      {focus === "conic" && <ConicView s={state} />}
      <FitCamera width={f.w} height={f.h} target={f.t} dir={f.d} />
      <OrbitControls makeDefault enableDamping minDistance={3} maxDistance={40} />
    </>
  );
}

export default function MathScene({ state, focus }: { state: MathLabState; focus: MathFocus }) {
  return (
    <Canvas camera={{ position: [6, 7, 10], fov: 45, near: 0.1, far: 200 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }} role="img" aria-label="3D көрініс: математика">
      <Contents state={state} focus={focus} />
    </Canvas>
  );
}
