"use client";

import { useMemo, useRef, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { CatmullRomCurve3, Group, Mesh, TubeGeometry, Vector3 } from "three";
import { Label } from "../scene/Label";
import { StageLook } from "../scene/StageLook";
import { Emblem, FILM } from "./Emblems";
import { Dust, FilmFx, usePointerSway } from "./Fx";
import { QUALITY, useQuality } from "@/lib/quality";

/** Island i floats along a rising, winding road. */
export const islandPos = (i: number) => new Vector3(i * 4.2, Math.sin(i * 0.8) * 0.9 + i * 0.35, Math.sin(i * 1.1) * 2.6);

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Where the packet is for a scroll progress: rests on each island, then glides to the next. */
function packetT(progress: number, n: number): number {
  const f = Math.min(n - 1, Math.max(0, progress * n - 0.35));
  const i = Math.floor(f);
  return i + smooth(Math.min(1, (f - i) * 1.6));
}

function Road({ curve }: { curve: CatmullRomCurve3 }) {
  const geo = useMemo(() => new TubeGeometry(curve, 400, 0.07, 8, false), [curve]);
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color={FILM.cobalt} emissive={FILM.glow} emissiveIntensity={1.4} toneMapped={false} />
    </mesh>
  );
}

function Island({ i, labId, title, visited, active }: { i: number; labId: string; title: string; visited: boolean; active: boolean }) {
  const ring = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (ring.current) ring.current.rotation.z = clock.elapsedTime * (active ? 1.2 : 0.2);
  });
  const p = islandPos(i);
  return (
    <group position={p}>
      {/* the floating rock under the platform */}
      <mesh position={[0, -0.75, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[1.35, 1.4, 6]} />
        <meshStandardMaterial color="#1b2244" roughness={0.9} />
      </mesh>
      <mesh position={[0, -0.04, 0]}>
        <cylinderGeometry args={[1.45, 1.45, 0.16, 6]} />
        <meshStandardMaterial color={FILM.dieEdge} metalness={0.5} roughness={0.35} />
      </mesh>
      <mesh ref={ring} position={[0, 0.06, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.55, 0.035, 8, 6]} />
        <meshStandardMaterial
          color={visited ? FILM.copper : FILM.glow}
          emissive={visited ? FILM.copper : FILM.glow}
          emissiveIntensity={active ? 4 : visited ? 2 : 0.6}
          toneMapped={false}
        />
      </mesh>
      <group position={[0, 0.06, 0]}>
        <Emblem labId={labId} scale={0.85} spin={active} />
      </group>
      <Label text={`${i + 1}. ${title}`} position={[0, 2.1, 0]} size={active ? 0.3 : 0.22} />
    </group>
  );
}

function Packet({ curve, progress, n, still }: { curve: CatmullRomCurve3; progress: MutableRefObject<number>; n: number; still: boolean }) {
  const g = useRef<Group>(null);
  const trail = useRef<Group>(null);
  const tNow = useRef(0);
  useFrame(({ clock }, dt) => {
    const target = packetT(progress.current, n) / (n - 1);
    tNow.current += (target - tNow.current) * (still ? 1 : 1 - Math.exp(-dt * 5));
    const pos = curve.getPointAt(Math.min(1, Math.max(0, tNow.current)));
    if (g.current) {
      g.current.position.copy(pos).add(new Vector3(0, 0.55 + (still ? 0 : Math.sin(clock.elapsedTime * 3) * 0.06), 0));
    }
    // A short trail of fading sparks behind the packet.
    trail.current?.children.forEach((c, k) => {
      const back = Math.max(0, tNow.current - (k + 1) * 0.004);
      c.position.copy(curve.getPointAt(back)).add(new Vector3(0, 0.55, 0));
    });
  });
  return (
    <>
      <group ref={g}>
        <mesh>
          <icosahedronGeometry args={[0.22, 2]} />
          <meshStandardMaterial color="#fff3dc" emissive={FILM.copper} emissiveIntensity={6} toneMapped={false} />
        </mesh>
        <pointLight color={FILM.copper} intensity={8} distance={5} />
      </group>
      <group ref={trail}>
        {Array.from({ length: 12 }, (_, k) => (
          <mesh key={k}>
            <sphereGeometry args={[0.12 * (1 - k / 13), 10, 8]} />
            <meshStandardMaterial color={FILM.copper} emissive={FILM.copper} emissiveIntensity={3 * (1 - k / 12)} toneMapped={false} transparent opacity={1 - k / 12} />
          </mesh>
        ))}
      </group>
    </>
  );
}

function Rig({ curve, progress, n, still }: { curve: CatmullRomCurve3; progress: MutableRefObject<number>; n: number; still: boolean }) {
  const { camera, size } = useThree();
  const look = useRef(new Vector3());
  const sway = usePointerSway(still);
  useFrame((_, dt) => {
    const t = packetT(progress.current, n) / (n - 1);
    const at = curve.getPointAt(Math.min(1, Math.max(0, t)));
    const portrait = size.width < size.height;
    const back = portrait ? 1.7 : 1;
    const pos = at.clone().add(new Vector3((portrait ? 0 : -1.5) - 1.5 * back, 3.2 * back, 7 * back));
    pos.x += sway.current.x * 0.9;
    pos.y += sway.current.y * 0.5;
    const target = at.clone().add(new Vector3(portrait ? 0 : -2.6, portrait ? -1.2 : 0.4, 0));
    const k = still ? 1 : 1 - Math.exp(-dt * 3);
    camera.position.lerp(pos, k);
    look.current.lerp(target, k);
    camera.lookAt(look.current);
  });
  return null;
}

export default function JourneyScene({ progress, stops, active, still }: { progress: MutableRefObject<number>; stops: { lab: string; title: string }[]; active: number; still: boolean }) {
  const q = QUALITY[useQuality()];
  const n = stops.length;
  const curve = useMemo(() => new CatmullRomCurve3(stops.map((_, i) => islandPos(i).add(new Vector3(0, 0.1, 0))), false, "centripetal"), [stops]);
  return (
    <Canvas camera={{ position: [-4, 4, 8], fov: 45, near: 0.1, far: 200 }} dpr={q.dpr} gl={{ antialias: true, alpha: true }} aria-hidden>
      <ambientLight intensity={0.45} />
      <directionalLight position={[6, 12, 8]} intensity={1.2} />
      <StageLook shadows={false} />
      <Road curve={curve} />
      {stops.map((s, i) => (
        <Island key={i} i={i} labId={s.lab} title={s.title} visited={i < active} active={i === active} />
      ))}
      <Packet curve={curve} progress={progress} n={n} still={still} />
      <Dust still={still} count={900} spread={[n * 4.2 + 20, 12, 18]} />
      <Rig curve={curve} progress={progress} n={n} still={still} />
      <FilmFx bloom={q.bloom} />
    </Canvas>
  );
}
