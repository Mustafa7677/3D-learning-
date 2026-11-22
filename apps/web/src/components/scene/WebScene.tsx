"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { BufferAttribute, BufferGeometry, Color, InstancedMesh, Mesh, Object3D } from "three";
import {
  PROGRAMS,
  boxSizes,
  computeFlex,
  parseHtml,
  runEventLoop,
  traceProgress,
  type DomNode,
  type NodeId,
  type WebLabState,
} from "@inside-tech/lab-web";
import { FitCamera } from "./FitCamera";
import { Label } from "./Label";
import { StageLook } from "./StageLook";
import { WebNetworkStage } from "./WebNetworkStage";
import { Dust, FilmFx } from "../film/Fx";
import { QUALITY, useQuality } from "@/lib/quality";
import { C0, C1 } from "./palette";

export type WebFocus = "network" | "dom" | "box" | "flex" | "loop" | "db";

interface Props {
  state: WebLabState;
  focus: WebFocus;
  onDomPick?: (id: number) => void;
}

const INK = new Color("#55649f");
const MUTED = new Color("#9aa6bd");
const RED = new Color("#c23b3b");
const GREEN = new Color("#17895c");
const WHITE = new Color("#ffffff");

// ---------------- network ----------------

const NODES: Record<NodeId, { pos: [number, number, number]; label: string; color: Color }> = {
  browser: { pos: [-4.2, 0.6, 0], label: "Браузер", color: C0 },
  dns: { pos: [-0.8, 2.3, -1.5], label: "DNS", color: MUTED },
  server: { pos: [2.4, 0.6, 0], label: "Сервер", color: INK },
  db: { pos: [4.6, 0.6, -2.2], label: "Дерекқор", color: C1 },
};

// ---------------- DOM tree ----------------

interface Placed {
  node: DomNode;
  x: number;
  y: number;
  parent?: Placed;
}

function layoutTree(root: DomNode): Placed[] {
  const out: Placed[] = [];
  let leaf = 0;
  const place = (n: DomNode, depth: number, parent?: Placed): Placed => {
    const p: Placed = { node: n, x: 0, y: -depth * 1.1, parent };
    out.push(p);
    const kids = n.children.slice(0, 24).map((c) => place(c, depth + 1, p));
    p.x = kids.length ? (kids[0]!.x + kids[kids.length - 1]!.x) / 2 : leaf++ * 1.25;
    return p;
  };
  place(root, 0);
  const minX = Math.min(...out.map((p) => p.x));
  const maxX = Math.max(...out.map((p) => p.x));
  const mid = (minX + maxX) / 2;
  for (const p of out) p.x -= mid;
  return out;
}

function DomView({ state, onDomPick }: Props) {
  const placed = useMemo(() => layoutTree(parseHtml(state.html).root), [state.html]);
  const lines = useMemo(() => {
    const v: number[] = [];
    for (const p of placed) if (p.parent) v.push(p.parent.x, p.parent.y + 2.5, 0, p.x, p.y + 2.5, 0);
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(v), 3));
    return g;
  }, [placed]);
  return (
    <group>
      <lineSegments geometry={lines}>
        <lineBasicMaterial color={MUTED} />
      </lineSegments>
      {placed.map((p) => {
        const sel = p.node.id === state.selectedDomId;
        const text = p.node.type === "text";
        const color = sel ? C1 : text ? WHITE : p.node.tag === "#document" ? INK : C0;
        const name = text ? `"${p.node.text.slice(0, 14)}${p.node.text.length > 14 ? "…" : ""}"` : p.node.tag === "#document" ? "document" : `<${p.node.tag}>`;
        return (
          <group key={p.node.id} position={[p.x, p.y + 2.5, 0]}>
            <mesh
              onClick={(e) => {
                e.stopPropagation();
                onDomPick?.(p.node.id);
              }}
              onPointerOver={() => (document.body.style.cursor = "pointer")}
              onPointerOut={() => (document.body.style.cursor = "")}
            >
              {text ? <boxGeometry args={[0.9, 0.36, 0.2]} /> : <boxGeometry args={[0.95, 0.5, 0.5]} />}
              <meshStandardMaterial color={color} roughness={0.5} />
            </mesh>
            <Label text={name} position={[0, 0.42, 0.3]} size={0.3} />
          </group>
        );
      })}
    </group>
  );
}

// ---------------- box model ----------------

function BoxView({ state }: { state: WebLabState }) {
  const b = state.box;
  const sz = boxSizes(b);
  const S = 1 / 50; // 50px per world unit
  const layers = [
    { name: `margin ${b.margin}px`, w: sz.total, color: new Color("#f5ab3d"), opacity: 0.25, z: -0.9 },
    { name: `border ${b.border}px`, w: sz.borderBox, color: INK, opacity: 0.9, z: -0.3 },
    { name: `padding ${b.padding}px`, w: sz.borderBox - 2 * b.border, color: new Color("#7fd3a8"), opacity: 0.85, z: 0.3 },
    { name: `content ${Math.round(sz.content)}px`, w: sz.content, color: C0, opacity: 0.95, z: 0.9 },
  ];
  const h = (w: number) => Math.max(0.05, w * 0.55 * S);
  return (
    <group position={[0, 1.6, 0]}>
      {layers.map((l) => (
        <group key={l.name} position={[0, 0, l.z]}>
          <mesh>
            <boxGeometry args={[Math.max(0.02, l.w * S), h(l.w), 0.08]} />
            <meshStandardMaterial color={l.color} transparent opacity={l.opacity} />
          </mesh>
          <Label text={l.name} position={[(l.w * S) / 2 + 0.9, h(l.w) / 2 - 0.1, 0]} size={0.36} />
        </group>
      ))}
      <Label text={`Толық ені: ${sz.total}px · ${b.boxSizing}`} position={[0, h(sz.total) / 2 + 0.7, 0]} size={0.42} />
    </group>
  );
}

// ---------------- flexbox ----------------

function FlexView({ state }: { state: WebLabState }) {
  const f = state.flex;
  const { items, width, height } = computeFlex(f);
  const S = 1 / 70;
  const ox = -(width * S) / 2;
  const oy = (height * S) / 2 + 1.4;
  return (
    <group>
      <mesh position={[0, oy - (height * S) / 2, -0.15]}>
        <boxGeometry args={[width * S, Math.max(0.1, height * S), 0.05]} />
        <meshStandardMaterial color={MUTED} transparent opacity={0.35} />
      </mesh>
      {items.map((r, i) => (
        <group key={i} position={[ox + (r.x + r.w / 2) * S, oy - (r.y + r.h / 2) * S, 0]}>
          <mesh>
            <boxGeometry args={[Math.max(0.05, r.w * S - 0.02), Math.max(0.05, r.h * S - 0.02), 0.3]} />
            <meshStandardMaterial color={C0} />
          </mesh>
          <Label text={String(i + 1)} position={[0, 0, 0.3]} size={0.24} />
        </group>
      ))}
      <Label text={`${f.direction} · ${f.justify} · ${f.align}${f.wrap ? " · wrap" : ""} · ${f.containerWidth}px`} position={[0, oy + 0.5, 0]} size={0.26} />
    </group>
  );
}

// ---------------- event loop ----------------

function Column({ x, title, items, color }: { x: number; title: string; items: string[]; color: Color }) {
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, -0.05, 0]}>
        <boxGeometry args={[2.1, 0.1, 1]} />
        <meshStandardMaterial color={MUTED} />
      </mesh>
      {items.slice(0, 7).map((t, i) => (
        <group key={i} position={[0, 0.3 + i * 0.5, 0]}>
          <mesh>
            <boxGeometry args={[1.9, 0.42, 0.7]} />
            <meshStandardMaterial color={color} />
          </mesh>
          <Label text={t.length > 22 ? t.slice(0, 21) + "…" : t} position={[0, 0, 0.45]} size={0.2} />
        </group>
      ))}
      <Label text={title} position={[0, -0.45, 0.5]} size={0.26} />
    </group>
  );
}

function LoopView({ state }: { state: WebLabState }) {
  const program = PROGRAMS.find((p) => p.id === state.loop.programId) ?? PROGRAMS[0]!;
  const frames = useMemo(() => runEventLoop(program), [program]);
  const f = frames[Math.min(state.loop.frame, frames.length - 1)]!;
  return (
    <group position={[0, -0.6, 0]}>
      <Column x={-3.6} title="Call stack" items={f.stack} color={C0} />
      <Column x={-1.2} title="Web APIs" items={f.webApis} color={MUTED} />
      <Column x={1.2} title="Microtasks" items={f.microtasks} color={GREEN} />
      <Column x={3.6} title="Tasks" items={f.tasks} color={C1} />
      <Label text={`console: ${f.output.join("  ") || "-"}`} position={[0, 4.4, 0]} size={0.3} />
      <Label text={f.note} position={[0, 3.8, 0]} size={0.24} />
    </group>
  );
}

// ---------------- database ----------------

const dummy = new Object3D();
const tmp = new Color();

function DbView({ state }: { state: WebLabState }) {
  const table = state.world.db[state.sql.lastTable ?? "users"] ?? state.world.db.users!;
  const ref = useRef<InstancedMesh>(null);
  const touched = useMemo(() => new Set(state.sql.last?.ok ? state.sql.last.touched : []), [state.sql.last]);
  const n = table.rows.length;
  const cols = Math.ceil(Math.sqrt(n * 1.6));
  const cell = Math.min(0.5, 8 / cols);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    for (let i = 0; i < n; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      dummy.position.set((c - cols / 2) * cell, 0, (r - n / cols / 2) * cell);
      const hit = touched.has(i);
      dummy.scale.set(1, hit ? 3 : 1, 1);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      m.setColorAt(i, tmp.copy(hit ? C1 : C0));
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [n, cols, cell, touched]);
  const last = state.sql.last;
  return (
    <group position={[0, 0.3, 0]}>
      <instancedMesh key={n} ref={ref} args={[undefined, undefined, Math.max(1, n)]}>
        <boxGeometry args={[cell * 0.8, cell * 0.4, cell * 0.8]} />
        <meshStandardMaterial roughness={0.6} />
      </instancedMesh>
      <Label text={`${table.name}: ${n} жол${table.indexed.length ? ` · индекс: ${table.indexed.join(", ")}` : ""}`} position={[0, 2.2, 0]} size={0.32} />
      {last && <Label text={last.ok ? `Қаралды: ${last.scanned} жол${last.usedIndex ? ` (индекс ${last.usedIndex})` : ""}` : "SQL қатесі"} position={[0, 1.6, 0]} size={0.28} />}
    </group>
  );
}

/** Region each view must keep visible (world units), framed for the viewport aspect. */
const FRAME: Record<WebFocus, { width: number; height: number; target: [number, number, number]; dir: [number, number, number] }> = {
  network: { width: 11.5, height: 5.5, target: [0.4, 1, -0.6], dir: [0.15, 0.42, 1] },
  dom: { width: 10, height: 7, target: [0, 0, 0], dir: [0, 0.05, 1] },
  box: { width: 12, height: 6, target: [1.2, 1.4, 0], dir: [0.6, 0.45, 1] },
  flex: { width: 11, height: 6, target: [0, 1.4, 0], dir: [0, 0.2, 1] },
  loop: { width: 10.5, height: 6, target: [0, 1.7, 0], dir: [0, 0.25, 1] },
  db: { width: 9.5, height: 6, target: [0, 0.6, 0], dir: [0, 1, 0.9] },
};

export default function WebScene(props: Props) {
  const fr = FRAME[props.focus] ?? FRAME.network;
  const q = QUALITY[useQuality()];
  const film = props.focus === "network";
  return (
    <Canvas key={props.focus} camera={{ position: [0, 3, 12], fov: 45, near: 0.1, far: 100 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }} role="img" aria-label="3D көрініс: веб технологиялары">
      <ambientLight intensity={film ? 0.35 : 0.8} />
      <directionalLight position={[4, 8, 6]} intensity={film ? 1.1 : 1.3} />
      {film && (
        <>
          <directionalLight position={[-7, 4, -6]} intensity={1.2} color="#c9a24a" />
          <StageLook shadows={false} />
          <WebNetworkStage state={props.state} />
          <Dust count={Math.round(q.dust / 2)} spread={[20, 7, 14]} />
          <FilmFx bloom={q.bloom} />
        </>
      )}
      {props.focus === "dom" && <DomView {...props} />}
      {props.focus === "box" && <BoxView state={props.state} />}
      {props.focus === "flex" && <FlexView state={props.state} />}
      {props.focus === "loop" && <LoopView state={props.state} />}
      {props.focus === "db" && <DbView state={props.state} />}
      <OrbitControls makeDefault enableDamping minDistance={3} maxDistance={30} />
      <FitCamera width={fr.width} height={fr.height} target={fr.target} dir={fr.dir} />
    </Canvas>
  );
}
