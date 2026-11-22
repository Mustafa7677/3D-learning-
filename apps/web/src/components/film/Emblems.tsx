"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Group, Quaternion, Vector3 } from "three";

/** Film palette: silicon night, die, copper traces, cobalt for what is active, paper for text. */
export const FILM = {
  night: new Color("#090f1b"),
  die: new Color("#17233b"),
  dieEdge: new Color("#2a3a5e"),
  copper: new Color("#dda36e"),
  cobalt: new Color("#2f5bea"),
  glow: new Color("#7696ff"),
  paper: new Color("#f0eee8"),
  pin: new Color("#b9c0d4"),
};

const up = new Vector3(0, 1, 0);

function Rod({ a, b, r = 0.03, color = FILM.pin }: { a: [number, number, number]; b: [number, number, number]; r?: number; color?: Color }) {
  const va = new Vector3(...a);
  const vb = new Vector3(...b);
  const mid = va.clone().add(vb).multiplyScalar(0.5);
  const dir = vb.clone().sub(va);
  return (
    <mesh position={mid} quaternion={new Quaternion().setFromUnitVectors(up, dir.clone().normalize())}>
      <cylinderGeometry args={[r, r, dir.length(), 8]} />
      <meshStandardMaterial color={color} metalness={0.4} roughness={0.4} />
    </mesh>
  );
}

const M = ({ color, metal = 0.2, emissive }: { color: Color; metal?: number; emissive?: Color }) => (
  <meshStandardMaterial color={color} metalness={metal} roughness={0.45} emissive={emissive ?? new Color("#000")} emissiveIntensity={emissive ? 0.6 : 0} />
);

function Ai() {
  const layers = [[-0.6, 0, 0.6], [-0.9, -0.3, 0.3, 0.9], [0]];
  const pts = layers.map((ys, li) => ys.map((y) => [-0.7 + li * 0.7, 0.75 + y * 0.55, 0] as [number, number, number]));
  return (
    <group>
      {pts.slice(0, -1).flatMap((col, li) => col.flatMap((a, i) => pts[li + 1]!.map((b, j) => <Rod key={`${li}-${i}-${j}`} a={a} b={b} r={0.012} color={FILM.glow} />)))}
      {pts.flat().map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.11, 16, 12]} />
          <M color={i === pts.flat().length - 1 ? FILM.copper : FILM.cobalt} emissive={i === pts.flat().length - 1 ? FILM.copper : undefined} />
        </mesh>
      ))}
    </group>
  );
}

function Web() {
  return (
    <group position={[0, 0.8, 0]} rotation={[-0.15, 0, 0]}>
      <mesh>
        <boxGeometry args={[1.5, 1.05, 0.06]} />
        <M color={FILM.paper} />
      </mesh>
      <mesh position={[0, 0.43, 0.035]}>
        <boxGeometry args={[1.5, 0.18, 0.02]} />
        <M color={FILM.cobalt} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[-0.62 + i * 0.12, 0.43, 0.05]}>
          <sphereGeometry args={[0.035, 10, 8]} />
          <M color={FILM.copper} />
        </mesh>
      ))}
      {[0.6, 1.1, 0.9, 0.5].map((w, i) => (
        <mesh key={`l${i}`} position={[-0.6 + w / 2, 0.18 - i * 0.18, 0.04]}>
          <boxGeometry args={[w, 0.07, 0.02]} />
          <M color={i === 0 ? FILM.die : FILM.pin} />
        </mesh>
      ))}
    </group>
  );
}

function Game() {
  return (
    <group>
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[1.5, 0.1, 1.2]} />
        <M color={FILM.dieEdge} />
      </mesh>
      <mesh position={[-0.3, 0.45, 0]} rotation={[0.4, 0.6, 0]}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <M color={FILM.cobalt} />
      </mesh>
      <mesh position={[0.45, 0.95, 0.1]}>
        <sphereGeometry args={[0.2, 20, 16]} />
        <M color={FILM.copper} emissive={FILM.copper} />
      </mesh>
      <Rod a={[0.45, 0.3, 0.1]} b={[0.45, 0.7, 0.1]} r={0.015} color={FILM.copper} />
    </group>
  );
}

function Net() {
  const nodes: [number, number, number][] = Array.from({ length: 6 }, (_, i) => [Math.cos((i / 6) * Math.PI * 2) * 0.65, 0.7 + Math.sin((i / 6) * Math.PI * 2) * 0.55, 0]);
  const links = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [0, 3], [1, 4]];
  return (
    <group>
      {links.map(([a, b]) => (
        <Rod key={`${a}${b}`} a={nodes[a!]!} b={nodes[b!]!} r={0.018} color={FILM.glow} />
      ))}
      {nodes.map((p, i) => (
        <mesh key={i} position={p}>
          <boxGeometry args={[0.2, 0.2, 0.2]} />
          <M color={i === 0 ? FILM.copper : FILM.cobalt} />
        </mesh>
      ))}
    </group>
  );
}

function Db() {
  return (
    <group>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, 0.25 + i * 0.42, 0]}>
          <cylinderGeometry args={[0.55, 0.55, 0.34, 32]} />
          <M color={i === 2 ? FILM.copper : FILM.cobalt} metal={0.35} />
        </mesh>
      ))}
    </group>
  );
}

function Arch() {
  return (
    <group position={[0, 0.2, 0]}>
      <mesh>
        <boxGeometry args={[1, 0.2, 1]} />
        <M color={FILM.die} />
      </mesh>
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[0.55, 0.06, 0.55]} />
        <M color={FILM.copper} metal={0.6} emissive={FILM.copper} />
      </mesh>
      {Array.from({ length: 6 }, (_, i) =>
        [0, 1, 2, 3].map((s) => {
          const t = -0.4 + i * 0.16;
          const pos: [number, number, number] = s === 0 ? [t, -0.05, 0.6] : s === 1 ? [t, -0.05, -0.6] : s === 2 ? [0.6, -0.05, t] : [-0.6, -0.05, t];
          return (
            <mesh key={`${i}-${s}`} position={pos}>
              <boxGeometry args={s < 2 ? [0.06, 0.04, 0.2] : [0.2, 0.04, 0.06]} />
              <M color={FILM.pin} metal={0.7} />
            </mesh>
          );
        }),
      )}
    </group>
  );
}

function Cloud() {
  return (
    <group>
      {[[-0.35, 1.0, 0, 0.32], [0.05, 1.12, 0, 0.4], [0.42, 0.98, 0, 0.3], [0, 0.9, 0.15, 0.3]].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x!, y!, z!]}>
          <sphereGeometry args={[r!, 20, 16]} />
          <M color={FILM.paper} />
        </mesh>
      ))}
      {[-0.4, 0, 0.4].map((x, i) => (
        <mesh key={`c${i}`} position={[x, 0.25, 0]}>
          <boxGeometry args={[0.3, 0.3, 0.3]} />
          <M color={i === 1 ? FILM.copper : FILM.cobalt} />
        </mesh>
      ))}
      {[-0.4, 0, 0.4].map((x) => (
        <Rod key={`r${x}`} a={[x, 0.42, 0]} b={[x * 0.6, 0.72, 0]} r={0.015} color={FILM.glow} />
      ))}
    </group>
  );
}

function Sec() {
  return (
    <group>
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[0.9, 0.7, 0.35]} />
        <M color={FILM.copper} metal={0.6} />
      </mesh>
      <mesh position={[0, 0.78, 0]}>
        <torusGeometry args={[0.3, 0.07, 12, 32, Math.PI]} />
        <M color={FILM.pin} metal={0.8} />
      </mesh>
      <mesh position={[0, 0.4, 0.18]}>
        <cylinderGeometry args={[0.07, 0.07, 0.02, 16]} />
        <M color={FILM.night} />
      </mesh>
    </group>
  );
}

function Algo() {
  const hs = [0.3, 0.55, 0.8, 1.05, 1.3];
  return (
    <group>
      {hs.map((h, i) => (
        <mesh key={i} position={[-0.6 + i * 0.3, h / 2, 0]}>
          <boxGeometry args={[0.22, h, 0.22]} />
          <M color={i === hs.length - 1 ? FILM.copper : FILM.cobalt} />
        </mesh>
      ))}
    </group>
  );
}

function Iot() {
  return (
    <group>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.35, 0.42, 0.2, 24]} />
        <M color={FILM.dieEdge} />
      </mesh>
      <Rod a={[0, 0.2, 0]} b={[0.3, 0.95, 0]} r={0.08} color={FILM.cobalt} />
      <Rod a={[0.3, 0.95, 0]} b={[0.8, 0.75, 0]} r={0.06} color={FILM.cobalt} />
      <mesh position={[0.3, 0.95, 0]}>
        <sphereGeometry args={[0.11, 16, 12]} />
        <M color={FILM.pin} metal={0.6} />
      </mesh>
      <mesh position={[0.82, 0.74, 0]}>
        <sphereGeometry args={[0.09, 16, 12]} />
        <M color={FILM.copper} emissive={FILM.copper} />
      </mesh>
    </group>
  );
}

function MathEmblem() {
  // Three axes and a sheared box: a matrix acting on space.
  return (
    <group>
      <Rod a={[-0.7, 0, 0]} b={[0.8, 0, 0]} r={0.035} color={FILM.dieEdge} />
      <Rod a={[0, 0, 0.6]} b={[0, 0, -0.8]} r={0.035} color={FILM.dieEdge} />
      <Rod a={[0, 0, 0]} b={[0, 1.2, 0]} r={0.035} color={FILM.dieEdge} />
      <Rod a={[0, 0, 0]} b={[0.6, 0.15, 0]} r={0.07} color={FILM.cobalt} />
      <Rod a={[0, 0, 0]} b={[0.35, 0.75, 0]} r={0.07} color={FILM.copper} />
      <mesh position={[0.32, 0.42, 0]} rotation={[0, 0, -0.45]}>
        <boxGeometry args={[0.5, 0.62, 0.35]} />
        <M color={FILM.cobalt} />
      </mesh>
    </group>
  );
}

const EMBLEMS: Record<string, () => React.JSX.Element> = { ai: Ai, web: Web, game: Game, net: Net, db: Db, arch: Arch, cloud: Cloud, sec: Sec, algo: Algo, iot: Iot, math: MathEmblem };

/** The 3D sign of a lab. `spin` turns it slowly (off for reduced motion). */
export function Emblem({ labId, spin = false, scale = 1 }: { labId: string; spin?: boolean; scale?: number }) {
  const g = useRef<Group>(null);
  useFrame((_, dt) => {
    if (spin && g.current) g.current.rotation.y += dt * 0.35;
  });
  const E = EMBLEMS[labId] ?? Arch;
  return (
    <group ref={g} scale={scale}>
      <E />
    </group>
  );
}
