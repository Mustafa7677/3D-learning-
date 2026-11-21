"use client";

import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { BufferAttribute, BufferGeometry, Color, Group, LineDashedMaterial, Line as ThreeLine, MeshStandardMaterial, Vector3 } from "three";
import type { Bridge, Constellation, Star } from "@/lib/sky";
import { Label } from "../scene/Label";
import { Dust, FilmFx } from "../film/Fx";
import { QUALITY, type Quality } from "@/lib/quality";

const GOLD = new Color("#e0b860");
const COBALT = new Color("#6f8fff");
const DIM = new Color("#46507a");
const NORTH = new Color("#fff3d6");
const NORTH_POS = new Vector3(0, 5, 0);

function lineGeo(points: [number, number, number][]) {
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(points.flat()), 3));
  return g;
}

function StarMesh({ s, still, selected, onPick, onHover }: { s: Star; still: boolean; selected: boolean; onPick(s: Star): void; onHover(s: Star | null): void }) {
  const mat = useRef<MeshStandardMaterial>(null);
  const seed = useMemo(() => s.id.length * 1.37, [s.id]);
  useFrame(({ clock }) => {
    const m = mat.current;
    if (!m) return;
    const base = s.state === "done" ? 3.2 : s.state === "started" ? 2.2 : 0.6;
    const twinkle = still ? 1 : s.state === "started" ? 0.6 + 0.4 * Math.sin(clock.elapsedTime * 4 + seed) : 0.9 + 0.1 * Math.sin(clock.elapsedTime * 1.3 + seed);
    m.emissiveIntensity = (selected ? base + 2 : base) * twinkle;
  });
  const color = s.state === "done" ? GOLD : s.state === "started" ? COBALT : DIM;
  const r = s.state === "done" ? 0.22 : s.state === "started" ? 0.19 : 0.13;
  return (
    <group position={s.pos}>
      <mesh>
        <sphereGeometry args={[(selected ? 1.6 : 1) * r * 1.4, 16, 12]} />
        <meshStandardMaterial ref={mat} color={color} emissive={color} emissiveIntensity={1} toneMapped={false} />
      </mesh>
      {/* a larger invisible target, so small stars are easy to hit */}
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(s);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          onHover(null);
          document.body.style.cursor = "";
        }}
        onClick={(e) => {
          e.stopPropagation();
          onPick(s);
        }}
      >
        <sphereGeometry args={[0.55, 8, 6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

function ConstellationView({ c, still, selected, onPick, onHover }: { c: Constellation; still: boolean; selected?: string; onPick(s: Star): void; onHover(s: Star | null): void }) {
  const geo = useMemo(() => {
    const pts: [number, number, number][] = [];
    c.stars.forEach((s, i) => i > 0 && pts.push(c.stars[i - 1]!.pos, s.pos));
    return lineGeo(pts);
  }, [c]);
  const lit = c.done > 0;
  return (
    <group>
      <lineSegments geometry={geo}>
        <lineBasicMaterial color={lit ? GOLD : DIM} transparent opacity={lit ? 0.7 : 0.35} />
      </lineSegments>
      {c.stars.map((s) => (
        <StarMesh key={s.id} s={s} still={still} selected={selected === s.id} onPick={onPick} onHover={onHover} />
      ))}
      <Label text={`${c.title} · ${c.done}/${c.stars.length}`} position={[c.center[0], c.center[1] + 3.2, c.center[2]]} size={0.85} />
    </group>
  );
}

function BridgeView({ from, to }: { from: Star; to: Star }) {
  const line = useMemo(() => {
    const g = lineGeo([from.pos, to.pos]);
    const l = new ThreeLine(g, new LineDashedMaterial({ color: COBALT, dashSize: 0.35, gapSize: 0.5, transparent: true, opacity: 0.22 }));
    l.computeLineDistances();
    return l;
  }, [from, to]);
  return <primitive object={line} />;
}

/** Темірқазық: the bright star in the middle, with a beam to the lesson it points at. */
function NorthStar({ target, still }: { target?: Star; still: boolean }) {
  const g = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (g.current && !still) {
      g.current.rotation.z = clock.elapsedTime * 0.3;
      g.current.scale.setScalar(1 + 0.08 * Math.sin(clock.elapsedTime * 2));
    }
  });
  const beam = useMemo(() => (target ? lineGeo([[NORTH_POS.x, NORTH_POS.y, NORTH_POS.z], target.pos]) : undefined), [target]);
  return (
    <group>
      <group ref={g} position={NORTH_POS}>
        <mesh>
          <octahedronGeometry args={[0.6, 0]} />
          <meshStandardMaterial color={NORTH} emissive={NORTH} emissiveIntensity={4} toneMapped={false} />
        </mesh>
        {[0, 1].map((k) => (
          <mesh key={k} rotation={[0, 0, (k * Math.PI) / 4]}>
            <boxGeometry args={[2.4, 0.05, 0.05]} />
            <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={3} toneMapped={false} />
          </mesh>
        ))}
        <pointLight color={NORTH} intensity={20} distance={18} />
      </group>
      {beam && (
        <lineSegments geometry={beam}>
          <lineBasicMaterial color={NORTH} transparent opacity={0.8} />
        </lineSegments>
      )}
      <Label text="Темірқазық" position={[0, 6.8, 0]} size={0.8} />
    </group>
  );
}

export default function SkyScene({
  constellations,
  bridges,
  north,
  selected,
  onPick,
  onHover,
  still,
  quality,
}: {
  constellations: Constellation[];
  bridges: (Bridge & { from: Star; to: Star })[];
  north?: Star;
  selected?: string;
  onPick(s: Star): void;
  onHover(s: Star | null): void;
  still: boolean;
  quality: Quality;
}) {
  const q = QUALITY[quality];
  const [dragging, setDragging] = useState(false);
  return (
    <Canvas camera={{ position: [0, 24, 44], fov: 42, near: 0.1, far: 300 }} dpr={q.dpr} gl={{ antialias: true, alpha: true }} aria-hidden>
      <ambientLight intensity={0.3} />
      <fog attach="fog" args={["#05060c", 45, 95]} />
      <Dust still={still} count={q.dust * 2} spread={[90, 50, 90]} />
      {bridges.map((b) => (
        <BridgeView key={`${b.a}-${b.b}`} from={b.from} to={b.to} />
      ))}
      {constellations.map((c) => (
        <ConstellationView key={c.lab} c={c} still={still} selected={selected} onPick={onPick} onHover={onHover} />
      ))}
      <NorthStar target={north} still={still} />
      <OrbitControls
        makeDefault
        enableDamping
        enablePan={false}
        minDistance={14}
        maxDistance={70}
        autoRotate={!still && !dragging}
        autoRotateSpeed={0.35}
        onStart={() => setDragging(true)}
        onEnd={() => setTimeout(() => setDragging(false), 4000)}
      />
      <FilmFx bloom={q.bloom} />
    </Canvas>
  );
}
