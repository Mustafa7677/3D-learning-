"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { Color, Group, Mesh, MeshStandardMaterial, QuadraticBezierCurve3, TubeGeometry, Vector3 } from "three";
import { traceProgress, type NodeId, type WebLabState } from "@inside-tech/lab-web";
import { Label } from "./Label";

/**
 * "Сұраудың саяхаты" as a film set: each machine is a recognisable object
 * on a gold-rimmed plinth, the wires are arcs that light only while the
 * request travels them, and the packet leaves a trail.
 */

export const NET_POS: Record<NodeId, [number, number, number]> = {
  browser: [-4.2, 0, 0.4],
  dns: [-0.8, 0, -2.4],
  server: [2.4, 0, 0.4],
  db: [5, 0, -2],
};
const LABEL: Record<NodeId, string> = { browser: "Браузер", dns: "DNS", server: "Сервер", db: "Дерекқор" };
const GOLD = new Color("#c9a24a");
const COBALT = new Color("#4f74ff");
const EMBER = new Color("#ff9a3c");
const RED = new Color("#e04a3b");
const METAL = new Color("#2a3147");
const DARK = new Color("#141826");
const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Height where wires attach to each machine. */
const PORT_Y: Record<NodeId, number> = { browser: 0.7, dns: 1.4, server: 1.1, db: 0.9 };
const port = (id: NodeId) => new Vector3(NET_POS[id][0], PORT_Y[id], NET_POS[id][2]);

function curveBetween(a: NodeId, b: NodeId) {
  const p = port(a);
  const q = port(b);
  const mid = p.clone().lerp(q, 0.5).add(new Vector3(0, 1.4, 0));
  return new QuadraticBezierCurve3(p, mid, q);
}

function Plinth({ lit, down }: { lit: boolean; down?: boolean }) {
  const rim = useRef<MeshStandardMaterial>(null);
  useFrame((_, dt) => {
    const m = rim.current;
    if (!m) return;
    const want = down ? 2.2 : lit ? 3 : 0.5;
    m.emissiveIntensity += (want - m.emissiveIntensity) * Math.min(1, dt * 6);
  });
  return (
    <group>
      <mesh position={[0, -0.12, 0]}>
        <cylinderGeometry args={[1.05, 1.15, 0.24, 6]} />
        <meshStandardMaterial color={DARK} metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.005, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.02, 0.025, 8, 6]} />
        <meshStandardMaterial ref={rim} color={down ? RED : GOLD} emissive={down ? RED : GOLD} emissiveIntensity={0.5} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Laptop({ lit }: { lit: boolean }) {
  return (
    <group position={[0, 0.02, 0]}>
      <RoundedBox args={[1.3, 0.06, 0.9]} radius={0.03} position={[0, 0.03, 0.1]}>
        <meshStandardMaterial color={METAL} metalness={0.8} roughness={0.3} />
      </RoundedBox>
      <group position={[0, 0.06, -0.33]} rotation={[-0.32, 0, 0]}>
        <RoundedBox args={[1.3, 0.85, 0.05]} radius={0.03} position={[0, 0.42, 0]}>
          <meshStandardMaterial color={METAL} metalness={0.8} roughness={0.3} />
        </RoundedBox>
        <mesh position={[0, 0.43, 0.03]}>
          <planeGeometry args={[1.16, 0.72]} />
          <meshStandardMaterial color="#0b1430" emissive={COBALT} emissiveIntensity={lit ? 1.6 : 0.7} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

function DnsTower({ lit }: { lit: boolean }) {
  const rings = useRef<Group>(null);
  useFrame((_, dt) => {
    if (rings.current && !reduced()) rings.current.rotation.y += dt * (lit ? 1.6 : 0.3);
  });
  return (
    <group>
      <mesh position={[0, 0.75, 0]}>
        <cylinderGeometry args={[0.16, 0.32, 1.5, 6]} />
        <meshStandardMaterial color={METAL} metalness={0.7} roughness={0.35} />
      </mesh>
      <group ref={rings} position={[0, 1.35, 0]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} rotation={[Math.PI / 2 + i * 0.5, i * 1.1, 0]}>
            <torusGeometry args={[0.42 - i * 0.06, 0.018, 8, 32]} />
            <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={lit ? 2.6 : 0.6} toneMapped={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function ServerRack({ lit, down }: { lit: boolean; down: boolean }) {
  const leds = useRef<Group>(null);
  useFrame(({ clock }) => {
    leds.current?.children.forEach((c, i) => {
      const m = (c as Mesh).material as MeshStandardMaterial;
      const blink = reduced() ? 1 : 0.5 + 0.5 * Math.sin(clock.elapsedTime * (lit ? 14 : 3) + i * 1.7);
      m.emissiveIntensity = down ? 1.2 : (lit ? 2.4 : 0.8) * blink;
    });
  });
  return (
    <group>
      <RoundedBox args={[0.95, 1.5, 0.8]} radius={0.05} position={[0, 0.75, 0]}>
        <meshStandardMaterial color={DARK} metalness={0.6} roughness={0.4} />
      </RoundedBox>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[0, 0.3 + i * 0.32, 0.41]}>
          <boxGeometry args={[0.8, 0.22, 0.02]} />
          <meshStandardMaterial color={METAL} metalness={0.7} roughness={0.3} />
        </mesh>
      ))}
      <group ref={leds}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[0.3, 0.3 + i * 0.32, 0.43]}>
            <boxGeometry args={[0.08, 0.05, 0.01]} />
            <meshStandardMaterial color={down ? RED : "#7dffb0"} emissive={down ? RED : new Color("#3fd39a")} emissiveIntensity={1} toneMapped={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Database({ lit }: { lit: boolean }) {
  return (
    <group>
      {[0, 1, 2].map((i) => (
        <group key={i} position={[0, 0.2 + i * 0.36, 0]}>
          <mesh>
            <cylinderGeometry args={[0.5, 0.5, 0.3, 32]} />
            <meshStandardMaterial color={METAL} metalness={0.75} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.16, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.5, 0.015, 8, 40]} />
            <meshStandardMaterial color={EMBER} emissive={EMBER} emissiveIntensity={lit ? 2.6 : 0.7} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Wire({ a, b, lit }: { a: NodeId; b: NodeId; lit: boolean }) {
  const geo = useMemo(() => new TubeGeometry(curveBetween(a, b), 48, 0.03, 6, false), [a, b]);
  const mat = useRef<MeshStandardMaterial>(null);
  useFrame((_, dt) => {
    const m = mat.current;
    if (!m) return;
    const want = lit ? 2.6 : 0.25;
    m.emissiveIntensity += (want - m.emissiveIntensity) * Math.min(1, dt * 5);
  });
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial ref={mat} color={GOLD} emissive={GOLD} emissiveIntensity={0.25} metalness={0.6} roughness={0.35} toneMapped={false} />
    </mesh>
  );
}

const WIRES: [NodeId, NodeId][] = [
  ["browser", "dns"],
  ["browser", "server"],
  ["server", "db"],
];
const wireKey = (a: NodeId, b: NodeId) => [a, b].sort().join("-");

function Packet({ state }: { state: WebLabState }) {
  const head = useRef<Group>(null);
  const trail = useRef<Group>(null);
  const history = useRef<Vector3[]>([]);
  const tr = state.trace;
  const at = tr ? traceProgress(tr) : undefined;
  const stage = tr && at ? tr.stages[at.index] : undefined;
  const curve = useMemo(() => (stage && stage.from !== stage.to ? curveBetween(stage.from, stage.to) : undefined), [stage]);

  useFrame(({ clock }) => {
    const g = head.current;
    if (!g || !stage || !at) return;
    if (curve) {
      g.position.copy(curve.getPoint(Math.min(1, Math.max(0, at.progress))));
      g.scale.setScalar(1);
    } else {
      const p = port(stage.from);
      g.position.set(p.x, p.y + 0.6, p.z);
      g.scale.setScalar(reduced() ? 1 : 1 + 0.25 * Math.sin(clock.elapsedTime * 10));
    }
    history.current.unshift(g.position.clone());
    history.current.length = Math.min(history.current.length, 14);
    trail.current?.children.forEach((c, i) => {
      const h = history.current[i + 1];
      c.visible = !!h;
      if (h) c.position.copy(h);
    });
  });

  if (!tr || !stage) return null;
  const color = !stage.ok ? RED : stage.kind === "response" || stage.kind === "render" ? EMBER : COBALT;
  return (
    <group>
      {!tr.done && (
        <>
          <group ref={head}>
            <mesh>
              <icosahedronGeometry args={[0.17, 2]} />
              <meshStandardMaterial color="#ffffff" emissive={color} emissiveIntensity={4} toneMapped={false} />
            </mesh>
            <pointLight color={color} intensity={6} distance={4} />
          </group>
          <group ref={trail}>
            {Array.from({ length: 12 }, (_, k) => (
              <mesh key={k} visible={false}>
                <sphereGeometry args={[0.11 * (1 - k / 13), 10, 8]} />
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.5 * (1 - k / 12)} toneMapped={false} transparent opacity={1 - k / 12} />
              </mesh>
            ))}
          </group>
        </>
      )}
      <Label text={tr.done ? (tr.response.status ? `${tr.response.status} · ${Math.round(tr.response.ms)} мс` : "Қате") : stage.title} position={[0.4, 3.6, -0.6]} size={0.46} />
    </group>
  );
}

export function WebNetworkStage({ state }: { state: WebLabState }) {
  const active = state.trace && !state.trace.done ? state.trace.stages[traceProgress(state.trace).index] : undefined;
  const serverUp = state.world.servers.every((s) => s.up);
  const lit = (id: NodeId) => !!active && (active.from === id || active.to === id);
  const activeWire = active && active.from !== active.to ? wireKey(active.from, active.to) : undefined;
  return (
    <group>
      <fog attach="fog" args={["#0a0d1a", 12, 30]} />
      {/* the floor: dark stone with a gold compass ring */}
      <mesh position={[0.4, -0.25, -0.8]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[9, 64]} />
        <meshStandardMaterial color="#0e1222" metalness={0.4} roughness={0.55} />
      </mesh>
      <mesh position={[0.4, -0.24, -0.8]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[7.6, 7.66, 96]} />
        <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={0.6} toneMapped={false} />
      </mesh>
      {WIRES.map(([a, b]) => (
        <Wire key={wireKey(a, b)} a={a} b={b} lit={activeWire === wireKey(a, b)} />
      ))}
      {(Object.keys(NET_POS) as NodeId[]).map((id) => (
        <group key={id} position={NET_POS[id]}>
          <Plinth lit={lit(id)} down={id === "server" && !serverUp} />
          {id === "browser" && <Laptop lit={lit(id)} />}
          {id === "dns" && <DnsTower lit={lit(id)} />}
          {id === "server" && <ServerRack lit={lit(id)} down={!serverUp} />}
          {id === "db" && <Database lit={lit(id)} />}
          <Label text={LABEL[id]} position={[0, id === "dns" ? 2.2 : 1.95, 0]} size={0.4} />
        </group>
      ))}
      <Packet state={state} />
    </group>
  );
}
