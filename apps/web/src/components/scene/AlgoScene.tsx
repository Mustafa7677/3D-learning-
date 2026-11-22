"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Color, Quaternion, Vector3 } from "three";
import { GRAPHS, pathTo, type AlgoLabState } from "@inside-tech/lab-algo";
import { FitCamera } from "./FitCamera";
import { Label } from "./Label";
import { StageLook } from "./StageLook";
import { C0, C1 } from "./palette";
import { DpView, HashView, HeapView, TopoView, UfView } from "./AlgoDsViews";

export type AlgoFocus = "sort" | "search" | "graph" | "bench" | "hash" | "heap" | "dp" | "uf" | "topo";

const BASE = new Color("#9fb0d4");
const SWAP = new Color("#c23b3b");
const DONE = new Color("#17895c");
const PIVOT = new Color("#7c4ddb");
const DIM = new Color("#dfe4ee");
const WIDTH = 12;
const HEIGHT = 4;

function Bars({ values, colors, labels }: { values: number[]; colors: Color[]; labels?: (string | null)[] }) {
  const n = values.length;
  const max = Math.max(1, ...values);
  const step = WIDTH / Math.max(1, n);
  return (
    <group>
      {values.map((v, i) => {
        const h = 0.15 + (v / max) * HEIGHT;
        const x = -WIDTH / 2 + step * (i + 0.5);
        return (
          <group key={i} position={[x, 0, 0]}>
            <mesh position={[0, h / 2, 0]}>
              <boxGeometry args={[step * 0.78, h, step * 0.78]} />
              <meshStandardMaterial color={colors[i]} roughness={0.55} />
            </mesh>
            {labels?.[i] && <Label text={labels[i]!} position={[0, h + 0.35, 0]} size={Math.min(0.32, step * 0.9)} />}
          </group>
        );
      })}
    </group>
  );
}

function SortView({ state }: { state: AlgoLabState }) {
  const v = state.sort;
  const done = useMemo(() => new Set(v.done), [v.done]);
  const colors = v.arr.map((_, i) => {
    if (v.last?.k === "swap" && (v.last.i === i || v.last.j === i)) return SWAP;
    if (v.last?.k === "set" && v.last.i === i) return SWAP;
    if (v.last?.k === "cmp" && (v.last.i === i || v.last.j === i)) return C1;
    if (v.pivotAt === i) return PIVOT;
    if (done.has(i)) return DONE;
    if (v.range && (i < v.range[0] || i > v.range[1])) return DIM;
    return BASE;
  });
  const labels = v.arr.map((x) => (v.n <= 24 ? String(x) : null));
  return <Bars values={v.arr} colors={colors} labels={labels} />;
}

function SearchView({ state }: { state: AlgoLabState }) {
  const v = state.search;
  const last = v.probes[v.probes.length - 1];
  const probed = new Set(v.probes.map((p) => p.i));
  const colors = v.arr.map((_, i) => {
    if (v.found !== null && v.found === i) return DONE;
    if (last && last.i === i) return C1;
    if (probed.has(i)) return SWAP;
    if (v.kind === "binary" && last && (i < last.lo || i > last.hi)) return DIM;
    return BASE;
  });
  const labels = v.arr.map((x, i) => (probed.has(i) || v.n <= 32 ? String(x) : null));
  return (
    <group>
      <Bars values={v.arr} colors={colors} labels={labels} />
      <Label text={`Мақсат: ${v.target}${v.found === null ? "" : v.found >= 0 ? ": табылды" : ": жоқ"}`} position={[0, HEIGHT + 1.3, 0]} size={0.45} />
    </group>
  );
}

const up = new Vector3(0, 1, 0);

function Edge({ a, b, color, thick }: { a: Vector3; b: Vector3; color: Color; thick: boolean }) {
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const dir = b.clone().sub(a);
  const q = new Quaternion().setFromUnitVectors(up, dir.clone().normalize());
  return (
    <mesh position={mid} quaternion={q}>
      <cylinderGeometry args={[thick ? 0.09 : 0.04, thick ? 0.09 : 0.04, dir.length(), 10]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function GraphView({ state }: { state: AlgoLabState }) {
  const v = state.graph;
  const g = GRAPHS[v.preset];
  const pos = useMemo(() => Object.fromEntries(g.nodes.map((n) => [n.id, new Vector3(n.x, 0.4, n.z)])), [g]);
  const visited = new Set(v.visited);
  const finished = v.cursor >= v.total && v.total > 0;
  const path = finished ? pathTo(v.prev, v.goal) : [];
  const onPath = (a: string, b: string) => path.some((p, i) => i > 0 && ((path[i - 1] === a && p === b) || (path[i - 1] === b && p === a)));
  const tree = (a: string, b: string) => v.prev[b] === a || v.prev[a] === b;
  return (
    <group>
      {g.edges.map((e, i) => {
        const hot = onPath(e.a, e.b);
        const mid = pos[e.a]!.clone().add(pos[e.b]!).multiplyScalar(0.5);
        return (
          <group key={i}>
            <Edge a={pos[e.a]!} b={pos[e.b]!} color={hot ? C0 : tree(e.a, e.b) ? C1 : new Color("#b7c0d3")} thick={hot} />
            {g.weighted && <Label text={String(e.w)} position={[mid.x, 0.75, mid.z]} size={0.32} />}
          </group>
        );
      })}
      {g.nodes.map((n) => {
        const isVisited = visited.has(n.id);
        const inFrontier = !isVisited && n.id in v.dist;
        const color = isVisited ? DONE : inFrontier ? C1 : BASE;
        const d = v.dist[n.id];
        const tag = n.id === v.start ? " (старт)" : n.id === v.goal ? " (мақсат)" : "";
        return (
          <group key={n.id} position={pos[n.id]}>
            <mesh>
              <sphereGeometry args={[n.id === v.start || n.id === v.goal ? 0.42 : 0.34, 24, 16]} />
              <meshStandardMaterial color={color} emissive={n.id === v.goal ? C0 : new Color("#000")} emissiveIntensity={n.id === v.goal ? 0.25 : 0} />
            </mesh>
            <Label text={`${n.id}${d === undefined ? "" : ` · ${d}`}${tag}`} position={[0, 0.8, 0]} size={0.32} />
          </group>
        );
      })}
    </group>
  );
}

function Contents({ state, focus }: { state: AlgoLabState; focus: AlgoFocus }) {
  const mode = focus === "bench" ? "sort" : focus;
  const graph = mode === "graph";
  const ds = mode === "hash" || mode === "heap" || mode === "dp" || mode === "uf" || mode === "topo";
  const frame = mode === "topo" ? { w: 17, h: 9, t: [0.5, 0.5, 0.3] as [number, number, number], d: [0, 1.4, 1] as [number, number, number] } : mode === "uf" ? { w: 14, h: 8, t: [0, 3.4, 0] as [number, number, number], d: [0, 0.15, 1] as [number, number, number] } : mode === "hash" ? { w: 15, h: 6, t: [0, 2.2, 0] as [number, number, number], d: [0, 0.35, 1] as [number, number, number] } : mode === "heap" ? { w: 13, h: 6, t: [0, 2.2, 0] as [number, number, number], d: [0, 0.1, 1] as [number, number, number] } : { w: 13, h: 7, t: [0, 0.8, 0] as [number, number, number], d: [0, 1.1, 1] as [number, number, number] };
  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[4, 9, 6]} intensity={1.3} />
      <directionalLight position={[-6, 4, -4]} intensity={0.35} />
      <gridHelper args={[16, 16, "#36427a", "#232c55"]} />
      <StageLook />
      {mode === "sort" && <SortView state={state} />}
      {mode === "search" && <SearchView state={state} />}
      {graph && <GraphView state={state} />}
      {mode === "hash" && <HashView state={state} />}
      {mode === "heap" && <HeapView state={state} />}
      {mode === "dp" && <DpView state={state} />}
      {mode === "uf" && <UfView state={state} />}
      {mode === "topo" && <TopoView state={state} />}
      <FitCamera
        key={mode}
        width={ds ? frame.w : graph ? 10.5 : WIDTH + 1}
        height={ds ? frame.h : graph ? 8 : HEIGHT + 2.5}
        target={ds ? frame.t : graph ? [0, 0, 0] : [0, HEIGHT / 2, 0]}
        dir={ds ? frame.d : graph ? [0, 1.6, 1] : [0, 0.45, 1]}
      />
      <OrbitControls makeDefault enableDamping minDistance={3} maxDistance={40} maxPolarAngle={Math.PI / 2.05} />
    </>
  );
}

export default function AlgoScene({ state, focus }: { state: AlgoLabState; focus: AlgoFocus }) {
  return (
    <Canvas camera={{ position: [0, 6, 14], fov: 45, near: 0.1, far: 200 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }} role="img" aria-label="3D көрініс: алгоритм қадамдары">
      <Contents state={state} focus={focus} />
    </Canvas>
  );
}
