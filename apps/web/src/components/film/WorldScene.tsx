"use client";

import { useMemo, useRef, useState, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { Group, Mesh, MeshStandardMaterial, QuadraticBezierCurve3, TubeGeometry, Vector3 } from "three";
import { Label } from "../scene/Label";
import { StageLook } from "../scene/StageLook";
import { Emblem, FILM } from "./Emblems";
import { Dust, FilmFx, usePointerSway } from "./Fx";
import { QUALITY, type Quality } from "@/lib/quality";

export interface WorldLab {
  id: string;
  title: string;
  href: string;
}

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const smooth = (t: number) => t * t * (3 - 2 * t);

/** District i sits on a ring around the core; AI (0) faces the camera at the start. */
export const districtPos = (i: number, n: number) => {
  const a = Math.PI / 2 - (i / n) * Math.PI * 2;
  const r = i % 2 === 0 ? 6.2 : 7.4;
  return new Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
};
/** Camera pull-back: 0 at the AI district, 1 over the whole world. */
export const pullAt = (p: number) => smooth(clamp01(p / 0.55));
/** How far the districts have joined the core (traces lit), district i of n. */
export const uniteAt = (p: number, i: number) => smooth(clamp01((p - 0.3 - i * 0.035) / 0.18));

function Trace({ to, i, progress }: { to: Vector3; i: number; progress: MutableRefObject<number> }) {
  const curve = useMemo(() => {
    const a = new Vector3(0, 0.12, 0);
    const b = to.clone().setY(0.12);
    const mid = a.clone().lerp(b, 0.5).add(new Vector3(0, 1.1, 0));
    return new QuadraticBezierCurve3(a, mid, b);
  }, [to]);
  const geo = useMemo(() => new TubeGeometry(curve, 48, 0.045, 6, false), [curve]);
  const mat = useMemo(() => new MeshStandardMaterial({ color: FILM.copper, emissive: FILM.copper, emissiveIntensity: 0, toneMapped: false, metalness: 0.6, roughness: 0.3 }), []);
  const pulse = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    const u = uniteAt(progress.current, i);
    mat.emissiveIntensity = 0.15 + u * 1.7;
    if (pulse.current) {
      pulse.current.visible = u > 0.6;
      pulse.current.position.copy(curve.getPointAt((clock.elapsedTime * 0.35 + i * 0.1) % 1));
    }
  });
  return (
    <>
      <mesh geometry={geo} material={mat} />
      <mesh ref={pulse}>
        <sphereGeometry args={[0.09, 10, 8]} />
        <meshStandardMaterial color="#fff3dc" emissive={FILM.copper} emissiveIntensity={5} toneMapped={false} />
      </mesh>
    </>
  );
}

function District({ lab, i, n, progress, onOpen, still }: { lab: WorldLab; i: number; n: number; progress: MutableRefObject<number>; onOpen(href: string): void; still: boolean }) {
  const g = useRef<Group>(null);
  const ring = useRef<MeshStandardMaterial>(null);
  const [hover, setHover] = useState(false);
  const p = useMemo(() => districtPos(i, n), [i, n]);
  useFrame(({ clock }, dt) => {
    const u = uniteAt(progress.current, i);
    if (ring.current) ring.current.emissiveIntensity = (hover ? 3.2 : 0.4) + u * 1.6;
    if (g.current) {
      const y = (hover ? 0.35 : 0) + (still ? 0 : Math.sin(clock.elapsedTime * 0.8 + i) * 0.06);
      g.current.position.y += (y - g.current.position.y) * (still ? 1 : 1 - Math.exp(-dt * 8));
    }
  });
  return (
    <group position={p}>
      <group
        ref={g}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = "";
        }}
        onClick={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "";
          onOpen(lab.href);
        }}
      >
        <mesh position={[0, -0.55, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[1.05, 1.1, 6]} />
          <meshStandardMaterial color="#141d33" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[1.15, 1.15, 0.14, 6]} />
          <meshStandardMaterial color={FILM.dieEdge} metalness={0.55} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.08, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.22, 0.03, 8, 6]} />
          <meshStandardMaterial ref={ring} color={FILM.glow} emissive={FILM.glow} emissiveIntensity={0.4} toneMapped={false} />
        </mesh>
        <group position={[0, 0.08, 0]}>
          <Emblem labId={lab.id} scale={0.7} spin={hover && !still} />
        </group>
        <Label text={lab.title} position={[0, 1.85, 0]} size={hover ? 0.4 : 0.32} />
      </group>
    </group>
  );
}

function Core({ progress }: { progress: MutableRefObject<number> }) {
  const mat = useRef<MeshStandardMaterial>(null);
  useFrame(() => {
    if (mat.current) mat.current.emissiveIntensity = 0.3 + uniteAt(progress.current, 9) * 2.2;
  });
  return (
    <group>
      <RoundedBox args={[2.2, 0.36, 2.2]} radius={0.08} smoothness={3} position={[0, 0.1, 0]}>
        <meshStandardMaterial color="#1a2238" metalness={0.5} roughness={0.35} />
      </RoundedBox>
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[1.2, 0.04, 1.2]} />
        <meshStandardMaterial ref={mat} color={FILM.cobalt} emissive={FILM.glow} emissiveIntensity={0.3} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Rig({ progress, n, still }: { progress: MutableRefObject<number>; n: number; still: boolean }) {
  const { camera, size } = useThree();
  const look = useRef(new Vector3());
  const sway = usePointerSway(still);
  useFrame((_, dt) => {
    const t = pullAt(progress.current);
    const d0 = districtPos(0, n);
    const close = { pos: d0.clone().add(new Vector3(1.4, 1.5, 3.2)), at: d0.clone().add(new Vector3(0, 0.6, 0)) };
    const wide = { pos: new Vector3(0, 17, 18), at: new Vector3(0, -0.8, 0.8) };
    const pos = close.pos.clone().lerp(wide.pos, t);
    const at = close.at.clone().lerp(wide.at, t);
    if (size.width < size.height) {
      pos.multiplyScalar(1 + t * 0.55);
      at.y -= 1.5;
    } else {
      // Keep the world right of the text column.
      const s = 2 + t * 1.8;
      pos.x -= s;
      at.x -= s;
    }
    pos.x += sway.current.x * 0.8;
    pos.y += sway.current.y * 0.5;
    const k = still ? 1 : 1 - Math.exp(-dt * 3);
    camera.position.lerp(pos, k);
    look.current.lerp(at, k);
    camera.lookAt(look.current);
  });
  return null;
}

/** ACT III: the camera pulls back from the AI block and the ten labs join into one world. */
export default function WorldScene({
  progress,
  labs,
  onOpen,
  still,
  quality,
  active,
}: {
  progress: MutableRefObject<number>;
  labs: WorldLab[];
  onOpen(href: string): void;
  still: boolean;
  quality: Quality;
  active: boolean;
}) {
  const q = QUALITY[quality];
  const n = labs.length;
  return (
    <Canvas camera={{ position: [2, 3, 10], fov: 40, near: 0.1, far: 120 }} dpr={q.dpr} frameloop={active ? "always" : "never"} gl={{ antialias: true, alpha: true }} aria-hidden>
      <ambientLight intensity={0.35} />
      <directionalLight position={[6, 12, 6]} intensity={1.4} />
      <directionalLight position={[-8, 5, -4]} intensity={0.5} color="#7696ff" />
      <pointLight position={[0, 2.5, 0]} intensity={12} distance={14} color={FILM.copper} />
      <StageLook shadows={false} />
      <mesh position={[0, -1.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[30, 64]} />
        <meshStandardMaterial color={FILM.night} roughness={1} />
      </mesh>
      <Core progress={progress} />
      {labs.map((l, i) => (
        <Trace key={`t${l.id}`} to={districtPos(i, n)} i={i} progress={progress} />
      ))}
      {labs.map((l, i) => (
        <District key={l.id} lab={l} i={i} n={n} progress={progress} onOpen={onOpen} still={still} />
      ))}
      <Dust still={still} count={q.dust} spread={[34, 12, 34]} />
      <Rig progress={progress} n={n} still={still} />
      <FilmFx bloom={q.bloom} />
    </Canvas>
  );
}
