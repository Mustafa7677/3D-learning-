"use client";

import { Color } from "three";
import { CYCLE_EDGE, DP_ITEMS, TOPO_EDGES, TOPO_NODES, buckets, dpCells, knapsackChoice, knapsackTable, topoSort, type AlgoLabState } from "@inside-tech/lab-algo";
import { Label } from "./Label";

const GOLD = new Color("#c9a24a");
const COBALT = new Color("#4f74ff");
const RED = new Color("#c0352a");
const DIM = new Color("#2a3352");
const PAPER = new Color("#e9dfc4");

/** Buckets as columns along a shelf; each key a block; long chains turn red. */
export function HashView({ state }: { state: AlgoLabState }) {
  const h = state.ds.hash;
  const b = buckets(h);
  const step = Math.min(0.9, 14 / Math.max(1, b.length));
  const lookBucket = state.ds.lookup ? b.findIndex((c) => c.includes(state.ds.lookup!.key)) : -1;
  return (
    <group position={[-((b.length - 1) * step) / 2, 0, 0]}>
      {b.map((chain, i) => (
        <group key={i} position={[i * step, 0, 0]}>
          <mesh position={[0, 0.04, 0]}>
            <boxGeometry args={[step * 0.85, 0.08, 0.9]} />
            <meshStandardMaterial color={i === lookBucket ? COBALT : DIM} />
          </mesh>
          {chain.map((k, j) => (
            <mesh key={k} position={[0, 0.3 + j * 0.42, 0]}>
              <boxGeometry args={[step * 0.75, 0.36, 0.75]} />
              <meshStandardMaterial
                color={chain.length >= 4 ? RED : chain.length >= 3 ? GOLD : PAPER}
                emissive={chain.length >= 4 ? RED : new Color("#000")}
                emissiveIntensity={chain.length >= 4 ? 0.35 : 0}
              />
            </mesh>
          ))}
          {b.length <= 17 && <Label text={String(i)} position={[0, -0.35, 0.6]} size={0.22} />}
          {chain.length > 0 && b.length <= 17 && <Label text={chain.length > 1 ? `${chain.length}` : chain[0]!} position={[0, 0.55 + chain.length * 0.42, 0]} size={0.2} />}
        </group>
      ))}
      <Label text={`${h.fn === "sum" ? "Қосынды хэш" : "Полиномдық хэш"} · ${h.keys.length} кілт · ${h.capacity} шелек`} position={[((b.length - 1) * step) / 2, 4.6, 0]} size={0.36} />
    </group>
  );
}

/** The heap as a binary tree: node i sits at depth floor(log2(i+1)). */
export function HeapView({ state }: { state: AlgoLabState }) {
  const a = state.ds.heap.arr;
  const pos = a.map((_, i) => {
    const depth = Math.floor(Math.log2(i + 1));
    const first = 2 ** depth - 1;
    const slots = 2 ** depth;
    const x = ((i - first + 0.5) / slots - 0.5) * 12;
    return [x, 4 - depth * 1.3, 0] as [number, number, number];
  });
  return (
    <group>
      {a.map((_, i) => {
        if (i === 0) return null;
        const p = pos[(i - 1) >> 1]!;
        const c = pos[i]!;
        const mid: [number, number, number] = [(p[0] + c[0]) / 2, (p[1] + c[1]) / 2, 0];
        const len = Math.hypot(c[0] - p[0], c[1] - p[1]);
        const angle = Math.atan2(c[1] - p[1], c[0] - p[0]);
        return (
          <mesh key={`e${i}`} position={mid} rotation={[0, 0, angle]}>
            <boxGeometry args={[len, 0.04, 0.04]} />
            <meshStandardMaterial color={GOLD} />
          </mesh>
        );
      })}
      {a.map((v, i) => (
        <group key={i} position={pos[i]}>
          <mesh>
            <sphereGeometry args={[i === 0 ? 0.42 : 0.32, 24, 16]} />
            <meshStandardMaterial color={i === 0 ? RED : v <= 3 ? GOLD : PAPER} emissive={i === 0 ? RED : new Color("#000")} emissiveIntensity={i === 0 ? 0.4 : 0} />
          </mesh>
          <Label text={String(v)} position={[0, 0.62, 0]} size={0.3} />
        </group>
      ))}
      {!a.length && <Label text="Кезек бос" position={[0, 2.5, 0]} size={0.4} />}
    </group>
  );
}

/** The knapsack table: a cell rises with its best value once it is filled; the optimum's path glows. */
export function DpView({ state }: { state: AlgoLabState }) {
  const d = state.ds.dp;
  const p = DP_ITEMS[d.preset];
  const table = knapsackTable(p.items, p.capacity);
  const cols = p.capacity + 1;
  const done = d.filled >= dpCells(d.preset);
  const max = Math.max(1, table.at(-1)!.at(-1)!);
  const chosen = new Set(done ? knapsackChoice(p.items, table) : []);
  const cell = Math.min(0.9, 11 / cols);
  return (
    <group position={[-((cols - 1) * cell) / 2, 0, -((p.items.length - 1) * cell) / 2]}>
      {p.items.map((it, r) =>
        Array.from({ length: cols }, (_, c) => {
          const k = r * cols + c;
          const filled = k < d.filled;
          const v = table[r + 1]![c]!;
          const h = filled ? 0.08 + (v / max) * 2.4 : 0.05;
          const hot = done && chosen.has(it.name) && c === p.capacity;
          return (
            <group key={`${r}-${c}`} position={[c * cell, 0, r * cell]}>
              <mesh position={[0, h / 2, 0]}>
                <boxGeometry args={[cell * 0.86, h, cell * 0.86]} />
                <meshStandardMaterial color={!filled ? DIM : k === d.filled - 1 ? COBALT : hot ? RED : GOLD} />
              </mesh>
              {filled && cols <= 11 && <Label text={String(v)} position={[0, h + 0.25, 0]} size={0.2} />}
            </group>
          );
        }),
      )}
      {p.items.map((it, r) => (
        <Label key={it.name} text={`${it.name} (${it.w} кг, ${it.v})`} position={[-1.4, 0.3, r * cell]} size={0.22} />
      ))}
      <Label text={done ? `Ең жақсы: ${table.at(-1)!.at(-1)}${d.greedy ? ` · ашкөз: ${d.greedy.value}` : ""}` : `Сыйымдылық 0..${p.capacity} кг`} position={[((cols - 1) * cell) / 2, 3.6, 0]} size={0.36} />
    </group>
  );
}

export function UfView({ state }: { state: AlgoLabState }) {
  const last = state.uf?.last;
  if (!last) return <Label text="Біріктіріп, ізде" position={[0, 2, 0]} size={0.6} />;
  const h = Math.max(1, last.height);
  const sy = Math.min(0.42, 6 / h);
  const pos = (i: number): [number, number, number] => [-6 + (i / 15) * 12, 0.4 + (h - last.depth[i]!) * sy, 0];
  return (
    <group>
      {last.parent.map((p, i) => {
        if (p === i) return null;
        const a = pos(i);
        const b = pos(p);
        const mx = (a[0] + b[0]) / 2;
        const my = (a[1] + b[1]) / 2;
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
        return (
          <mesh key={`e${i}`} position={[mx, my, -0.05]} rotation={[0, 0, ang]}>
            <boxGeometry args={[len, 0.05, 0.05]} />
            <meshStandardMaterial color={new Color("#c9a24a")} />
          </mesh>
        );
      })}
      {last.parent.map((p, i) => (
        <group key={i} position={pos(i)}>
          <mesh>
            <sphereGeometry args={[0.26, 16, 12]} />
            <meshStandardMaterial color={p === i ? new Color("#c23b3b") : new Color("#3d5bd9")} />
          </mesh>
          <Label text={String(i)} position={[0, 0.45, 0]} size={0.3} />
        </group>
      ))}
      <Label text={`биіктік ${last.height} · іздеу: ${last.firstPass}, сосын ${last.secondPass} секіріс`} position={[0, 0.9 + h * sy, 0]} size={0.5} />
    </group>
  );
}

export function TopoView({ state }: { state: AlgoLabState }) {
  const cycle = state.topo?.cycle ?? false;
  const r = state.topo?.last ?? topoSort(cycle ? [...TOPO_EDGES, CYCLE_EDGE] : TOPO_EDGES);
  const shown = !!state.topo?.last;
  const edges = cycle ? [...TOPO_EDGES, CYCLE_EDGE] : TOPO_EDGES;
  const column = (i: number) => (r.semester[i]! > 0 ? r.semester[i]! : 0);
  const byCol = new Map<number, number[]>();
  TOPO_NODES.forEach((_, i) => byCol.set(column(i), [...(byCol.get(column(i)) ?? []), i]));
  const pos = (i: number): [number, number, number] => {
    const c = column(i);
    const list = byCol.get(c)!;
    const k = list.indexOf(i);
    return [c === 0 ? 7 : -6 + (c - 1) * 3.6, 0.5, (k - (list.length - 1) / 2) * 2.2];
  };
  return (
    <group>
      {edges.map(([a, b], k) => {
        const p = pos(a);
        const q = pos(b);
        const len = Math.hypot(q[0] - p[0], q[2] - p[2]);
        const ang = Math.atan2(q[2] - p[2], q[0] - p[0]);
        const bad = shown && (r.stuck.includes(a) && r.stuck.includes(b));
        return (
          <mesh key={k} position={[(p[0] + q[0]) / 2, 0.35, (p[2] + q[2]) / 2]} rotation={[0, -ang, 0]}>
            <boxGeometry args={[len, 0.06, 0.06]} />
            <meshStandardMaterial color={bad ? new Color("#c23b3b") : new Color("#c9a24a")} />
          </mesh>
        );
      })}
      {TOPO_NODES.map((name, i) => {
        const stuck = shown && r.stuck.includes(i);
        return (
          <group key={name} position={pos(i)}>
            <mesh>
              <boxGeometry args={[2.4, 0.7, 1]} />
              <meshStandardMaterial color={stuck ? new Color("#c23b3b") : new Color("#3d5bd9")} />
            </mesh>
            <Label text={name} position={[0, 0.8, 0]} size={0.58} />
          </group>
        );
      })}
      {shown &&
        Array.from({ length: r.semesters }, (_, c) => <Label key={c} text={`${c + 1}-семестр`} position={[-6 + c * 3.6, 0.1, 4.2]} size={0.42} />)}
      <Label text={shown ? (r.stuck.length ? "цикл: қызыл курстар бірін-бірі күтеді" : `${r.semesters} семестр`) : "Оқу жоспарын құр"} position={[0, 2.4, -3.2]} size={0.6} />
    </group>
  );
}

export function AmortView({ state }: { state: AlgoLabState }) {
  const last = state.amort?.last;
  const w = 15 / 65;
  const k = 5 / 65;
  return (
    <group>
      {last?.costs.map((c, i) => (
        <mesh key={i} position={[-7.5 + i * w + w / 2, (c * k) / 2 + 0.02, 0]}>
          <boxGeometry args={[w * 0.8, Math.max(0.04, c * k), 0.8]} />
          <meshStandardMaterial color={c > 1 ? new Color("#c23b3b") : new Color("#3d5bd9")} />
        </mesh>
      ))}
      {last && (
        <mesh position={[0, last.average * k, -0.5]}>
          <boxGeometry args={[15.2, 0.05, 0.05]} />
          <meshStandardMaterial color={new Color("#c9a24a")} emissive={new Color("#c9a24a")} emissiveIntensity={0.5} />
        </mesh>
      )}
      {last && <Label text={`орташа ${last.average}`} position={[6.2, last.average * k + 0.35, -0.5]} size={0.4} />}
      <Label text={last ? `көшіру ${last.copies} · ең қымбат push ${last.maxCost} · бос орын ${last.unused}` : "Массивке push жаса"} position={[0, 6, 0]} size={0.6} />
      <Label text="баған: бір push-тың бағасы · қызыл: массив толып, бәрі көшірілді" position={[0, 5.4, 0]} size={0.42} />
    </group>
  );
}
