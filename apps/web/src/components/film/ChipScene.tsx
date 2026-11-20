"use client";

import { useMemo, useRef, useState, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Group, Mesh, MeshStandardMaterial, Vector3 } from "three";
import { Label } from "../scene/Label";
import { Emblem, FILM } from "./Emblems";

export interface ChipBlock {
  id: string;
  title: string;
  href: string;
}

/** Where block i sits on the die: two rows of five. */
export const blockPos = (i: number): [number, number, number] => [-2.6 + (i % 5) * 1.3, 0.32, i < 5 ? -1.05 : 1.05];

interface Shot {
  p: number;
  pos: [number, number, number];
  look: [number, number, number];
  /** Sideways shift on wide screens, so the die clears the text column. */
  side?: number;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Camera path keyed by scroll progress. Close-ups are on the AI, IoT and Game blocks. */
function shots(blocks: ChipBlock[]): Shot[] {
  const at = (id: string, fallback: number) => {
    const i = blocks.findIndex((b) => b.id === id);
    return blockPos(i >= 0 ? i : fallback);
  };
  const close = (id: string, i: number, p: number): Shot => {
    const b = at(id, i);
    return { p, pos: [b[0] + 0.9, b[1] + 1.55, b[2] + 2.3], look: [b[0], b[1] + 0.45, b[2]] };
  };
  return [
    { p: 0, pos: [0, 7.2, 12.5], look: [0, 0, 0], side: -3.4 },
    { p: 0.12, pos: [0, 8.2, 10], look: [0, 0, 0], side: -2.4 },
    { p: 0.26, pos: [0, 8.6, 6], look: [0, 0, 0.2], side: -1.4 },
    close("ai", 0, 0.4),
    close("iot", 9, 0.56),
    close("game", 2, 0.72),
    { p: 0.88, pos: [0, 9.6, 6.6], look: [0, 0, 0.3], side: -1.5 },
    { p: 1, pos: [0, 9.6, 6.6], look: [0, 0, 0.3], side: -1.5 },
  ];
}

function sample(path: Shot[], p: number): { pos: Vector3; look: Vector3; side: number } {
  let i = 0;
  while (i < path.length - 2 && p > path[i + 1]!.p) i++;
  const a = path[i]!;
  const b = path[i + 1]!;
  const t = smooth(Math.min(1, Math.max(0, (p - a.p) / Math.max(1e-6, b.p - a.p))));
  const lerp = (x: [number, number, number], y: [number, number, number]) => new Vector3(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
  return { pos: lerp(a.pos, b.pos), look: lerp(a.look, b.look), side: (a.side ?? 0) + ((b.side ?? 0) - (a.side ?? 0)) * t };
}

function Rig({ progress, blocks, still }: { progress: MutableRefObject<number>; blocks: ChipBlock[]; still: boolean }) {
  const path = useMemo(() => shots(blocks), [blocks]);
  const look = useRef(new Vector3());
  const { camera, size } = useThree();
  useFrame(({ clock }, dt) => {
    const s = sample(path, progress.current);
    // Narrow screens see less of the die: pull the camera back a little.
    const portrait = size.width < size.height;
    // The die is wide: on tall screens back off in proportion to the aspect ratio.
    s.pos.multiplyScalar(portrait ? Math.min(2.2, Math.max(1.3, (0.95 * size.height) / size.width)) : 1);
    if (!portrait) {
      s.pos.x += s.side;
      s.look.x += s.side;
    } else {
      // On a phone the text sits at the bottom: lift the picture into the top half.
      s.look.y -= 1.3;
    }
    if (!still && progress.current < 0.1) s.pos.x += Math.sin(clock.elapsedTime * 0.25) * 1.2;
    const k = still ? 1 : 1 - Math.exp(-dt * 4);
    camera.position.lerp(s.pos, k);
    look.current.lerp(s.look, k);
    camera.lookAt(look.current);
  });
  return null;
}

/** Copper bus along the middle of the die, with pulses running on it. */
function Traces({ blocks, still }: { blocks: ChipBlock[]; still: boolean }) {
  const pulses = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (still || !pulses.current) return;
    pulses.current.children.forEach((c, i) => {
      const t = (clock.elapsedTime * 0.35 + i / pulses.current!.children.length) % 1;
      c.position.x = -3 + t * 6;
    });
  });
  return (
    <group position={[0, 0.27, 0]}>
      <mesh>
        <boxGeometry args={[6.2, 0.02, 0.07]} />
        <meshStandardMaterial color={FILM.copper} metalness={0.7} roughness={0.3} />
      </mesh>
      {blocks.map((_, i) => {
        const [x, , z] = blockPos(i);
        return (
          <mesh key={i} position={[x, 0, z / 2]}>
            <boxGeometry args={[0.05, 0.02, Math.abs(z) - 0.75]} />
            <meshStandardMaterial color={FILM.copper} metalness={0.7} roughness={0.3} />
          </mesh>
        );
      })}
      <group ref={pulses}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[-3 + i * 2, 0.04, 0]}>
            <sphereGeometry args={[0.06, 12, 8]} />
            <meshStandardMaterial color={FILM.copper} emissive={FILM.copper} emissiveIntensity={1.4} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Package({ progress }: { progress: MutableRefObject<number> }) {
  const lid = useRef<Mesh>(null);
  useFrame(() => {
    if (!lid.current) return;
    // The lid lifts away between 6% and 26% of the scroll.
    const t = smooth(Math.min(1, Math.max(0, (progress.current - 0.06) / 0.2)));
    lid.current.position.y = 0.85 + t * 7;
    lid.current.rotation.x = -t * 0.5;
    const m = lid.current.material as MeshStandardMaterial;
    m.opacity = 1 - t;
    lid.current.visible = t < 0.98;
    lid.current.children.forEach((c) => (c.visible = t < 0.04));
  });
  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[7.6, 0.36, 5.4]} />
        <meshStandardMaterial color={FILM.night} metalness={0.2} roughness={0.8} />
      </mesh>
      {Array.from({ length: 14 }, (_, i) =>
        [-1, 1].map((s) => (
          <mesh key={`${i}${s}`} position={[-3.4 + i * 0.523, -0.1, s * 2.85]}>
            <boxGeometry args={[0.16, 0.08, 0.5]} />
            <meshStandardMaterial color={FILM.pin} metalness={0.8} roughness={0.3} />
          </mesh>
        )),
      )}
      <mesh position={[0, 0.22, 0]}>
        <boxGeometry args={[6.8, 0.08, 4.4]} />
        <meshStandardMaterial color={FILM.die} metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh ref={lid} position={[0, 0.85, 0]}>
        <boxGeometry args={[7.2, 1.1, 5]} />
        <meshStandardMaterial color="#8f97ad" metalness={0.85} roughness={0.35} transparent />
        {/* copper frame and the pin-1 dot engraved on the cap */}
        {[
          [0, 1.75, 6, 0.06],
          [0, -1.75, 6, 0.06],
          [3, 0, 0.06, 3.5],
          [-3, 0, 0.06, 3.5],
        ].map(([x, z, w, d], i) => (
          <mesh key={i} position={[x!, 0.56, z!]}>
            <boxGeometry args={[w!, 0.02, d!]} />
            <meshStandardMaterial color={FILM.copper} metalness={0.8} roughness={0.3} emissive={FILM.copper} emissiveIntensity={0.25} />
          </mesh>
        ))}
        <mesh position={[-2.6, 0.56, 1.35]}>
          <cylinderGeometry args={[0.16, 0.16, 0.02, 24]} />
          <meshStandardMaterial color={FILM.copper} emissive={FILM.copper} emissiveIntensity={0.6} />
        </mesh>
      </mesh>
    </group>
  );
}

function Blocks({ blocks, interactive, onOpen, still }: { blocks: ChipBlock[]; interactive: boolean; onOpen(href: string): void; still: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  return (
    <group>
      {blocks.map((b, i) => {
        const pos = blockPos(i);
        const lit = hover === i;
        return (
          <group
            key={b.id}
            position={pos}
            onPointerOver={(e) => {
              if (!interactive) return;
              e.stopPropagation();
              setHover(i);
              document.body.style.cursor = "pointer";
            }}
            onPointerOut={() => {
              setHover((h) => (h === i ? null : h));
              document.body.style.cursor = "";
            }}
            onClick={(e) => {
              if (!interactive) return;
              e.stopPropagation();
              onOpen(b.href);
            }}
          >
            <mesh position={[0, lit ? 0.08 : 0, 0]}>
              <boxGeometry args={[1.12, 0.1, 1.5]} />
              <meshStandardMaterial color={lit ? FILM.cobalt : FILM.dieEdge} metalness={0.3} roughness={0.5} emissive={lit ? FILM.cobalt : FILM.night} emissiveIntensity={lit ? 0.4 : 0} />
            </mesh>
            <group position={[0, lit ? 0.14 : 0.06, 0]}>
              <Emblem labId={b.id} scale={0.5} spin={lit && !still} />
            </group>
            {interactive && <Label text={b.title} position={[0, 1.2, 0.2]} size={0.2} />}
          </group>
        );
      })}
    </group>
  );
}

export default function ChipScene({ progress, blocks, interactive, onOpen, still }: { progress: MutableRefObject<number>; blocks: ChipBlock[]; interactive: boolean; onOpen(href: string): void; still: boolean }) {
  return (
    <Canvas camera={{ position: [0, 6.5, 10.5], fov: 40, near: 0.1, far: 100 }} dpr={[1, 1.75]} gl={{ antialias: true, alpha: true }} aria-hidden>
      <ambientLight intensity={0.55} />
      <directionalLight position={[5, 10, 6]} intensity={1.4} />
      <pointLight position={[-4, 3, 3]} intensity={18} color={FILM.copper} distance={14} />
      <Package progress={progress} />
      <Traces blocks={blocks} still={still} />
      <Blocks blocks={blocks} interactive={interactive} onOpen={onOpen} still={still} />
      <Rig progress={progress} blocks={blocks} still={still} />
    </Canvas>
  );
}
