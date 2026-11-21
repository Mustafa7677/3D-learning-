"use client";

import { useMemo, useRef, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Group, Quaternion, Vector3 } from "three";
import { Label } from "../scene/Label";
import { Emblem, FILM } from "./Emblems";
import { StageLook } from "../scene/StageLook";
import { Dust, FilmFx, usePointerSway } from "./Fx";


/** Station i of n along an S-shaped copper trace leaving the lab's block. */
export function stationPos(i: number): Vector3 {
  return new Vector3(2.6 + i * 2.5, 0, Math.sin(i * 0.85) * 1.7);
}

function Segment({ a, b }: { a: Vector3; b: Vector3 }) {
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const dir = b.clone().sub(a);
  return (
    <mesh position={[mid.x, 0.03, mid.z]} quaternion={new Quaternion().setFromUnitVectors(new Vector3(1, 0, 0), dir.clone().normalize())}>
      <boxGeometry args={[dir.length(), 0.03, 0.09]} />
      <meshStandardMaterial color={FILM.copper} metalness={0.75} roughness={0.3} emissive={FILM.copper} emissiveIntensity={1.5} toneMapped={false} />
    </mesh>
  );
}

function Rig({ progress, count, still }: { progress: MutableRefObject<number>; count: number; still: boolean }) {
  const look = useRef(new Vector3());
  const { camera, size } = useThree();
  const sway = usePointerSway(still);
  useFrame((_, dt) => {
    // f = 0 is the lab's block; f = i + 1 is station i.
    const f = Math.min(count, Math.max(0, progress.current * (count + 1) - 0.5));
    const i = Math.floor(f);
    const t = f - i;
    const at = (k: number) => (k <= 0 ? new Vector3(0, 0.6, 0) : stationPos(k - 1));
    const target = at(i).lerp(at(Math.min(count, i + 1)), t * t * (3 - 2 * t));
    const portrait = size.width < size.height;
    const back = portrait ? 1.6 : 1;
    const pos = target.clone().add(new Vector3(-1.8 * back, 4.2 * back, 5.4 * back));
    // On wide screens keep the subject right of the text column.
    const lookAt = target.clone().add(new Vector3(portrait ? 0 : -2.2, portrait ? -1.2 : 0, 0));
    if (!portrait) pos.x -= 2.2;
    pos.x += sway.current.x * 0.7;
    pos.y += sway.current.y * 0.4;
    const k = still ? 1 : 1 - Math.exp(-dt * 3.5);
    camera.position.lerp(pos, k);
    look.current.lerp(lookAt, k);
    camera.lookAt(look.current);
  });
  return null;
}

function Beam({ at }: { at: Vector3 }) {
  const g = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (g.current) g.current.scale.y = 1 + Math.sin(clock.elapsedTime * 2) * 0.08;
  });
  return (
    <group ref={g} position={[at.x, 0, at.z]}>
      <mesh position={[0, 1.1, 0]}>
        <cylinderGeometry args={[0.32, 0.5, 2.2, 24, 1, true]} />
        <meshStandardMaterial color={FILM.glow} transparent opacity={0.18} emissive={FILM.glow} emissiveIntensity={0.9} depthWrite={false} />
      </mesh>
    </group>
  );
}

export default function TraceScene({
  labId,
  progress,
  titles,
  done,
  active,
  still,
}: {
  labId: string;
  progress: MutableRefObject<number>;
  titles: string[];
  done: boolean[];
  active: number;
  still: boolean;
}) {
  const pts = useMemo(() => titles.map((_, i) => stationPos(i)), [titles]);
  const n = titles.length;
  return (
    <Canvas camera={{ position: [-4, 3, 6], fov: 42, near: 0.1, far: 120 }} dpr={[1, 1.75]} gl={{ antialias: true, alpha: true }} aria-hidden>
      <ambientLight intensity={0.55} />
      <directionalLight position={[5, 10, 6]} intensity={1.3} />
      <pointLight position={[0, 3, 2]} intensity={14} color={FILM.copper} distance={10} />
      {/* the substrate the trace runs on */}
      <mesh position={[n * 1.25, -0.06, 0]}>
        <boxGeometry args={[n * 2.5 + 40, 0.1, 40]} />
        <meshStandardMaterial color={FILM.die} metalness={0.2} roughness={0.7} />
      </mesh>
      {/* the lab's block */}
      <mesh position={[0, 0.08, 0]}>
        <boxGeometry args={[2.6, 0.16, 2.6]} />
        <meshStandardMaterial color={FILM.dieEdge} metalness={0.3} roughness={0.5} />
      </mesh>
      <group position={[0, 0.16, 0]}>
        <Emblem labId={labId} scale={1.2} spin={!still} />
      </group>
      <Segment a={new Vector3(1.3, 0, 0)} b={pts[0] ?? new Vector3(2.6, 0, 0)} />
      {pts.slice(1).map((p, i) => (
        <Segment key={i} a={pts[i]!} b={p} />
      ))}
      {pts.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]}>
          <mesh position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.42, 0.42, 0.14, 32]} />
            <meshStandardMaterial
              color={done[i] ? FILM.copper : i === active ? FILM.cobalt : FILM.dieEdge}
              metalness={done[i] ? 0.8 : 0.3}
              roughness={0.35}
              emissive={i === active ? FILM.glow : done[i] ? FILM.copper : FILM.night}
              emissiveIntensity={i === active ? 2.2 : done[i] ? 0.8 : 0}
            />
          </mesh>
          <Label text={i === n - 1 && titles[i]!.startsWith("Problem Set") ? "Есептер" : String(i + 1)} position={[0, 0.7, 0]} size={0.32} />
          {i === active && <Label text={titles[i]!} position={[0, 1.45, 0]} size={0.34} />}
        </group>
      ))}
      {active >= 0 && active < n && <Beam at={pts[active]!} />}
      <StageLook shadows={false} />
      <Dust still={still} spread={[n * 2.5 + 16, 8, 14]} />
      <Rig progress={progress} count={n} still={still} />
      <FilmFx />
    </Canvas>
  );
}
