"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Group } from "three";
import { prefersReducedMotion } from "@/lib/nav";
import { Emblem, FILM } from "./Emblems";

function Field({ index, count }: { index: number; count: number }) {
  const g = useRef<Group>(null);
  const still = useMemo(() => prefersReducedMotion(), []);
  // Copper dots on a grid, like vias on a board; the board slides with the pages.
  const dots = useMemo(() => {
    const out: [number, number][] = [];
    for (let x = -12; x <= 12; x += 1.5) for (let z = -8; z <= 2; z += 1.5) out.push([x, z]);
    return out;
  }, []);
  useFrame((_, dt) => {
    if (!g.current) return;
    const target = -(index / Math.max(1, count - 1)) * 6 + 3;
    const k = still ? 1 : 1 - Math.exp(-dt * 2.5);
    g.current.position.x += (target - g.current.position.x) * k;
  });
  return (
    <group ref={g}>
      {dots.map(([x, z], i) => (
        <mesh key={i} position={[x, -2.2, z]}>
          <cylinderGeometry args={[0.07, 0.07, 0.02, 10]} />
          <meshStandardMaterial color={FILM.copper} emissive={FILM.copper} emissiveIntensity={0.3} />
        </mesh>
      ))}
    </group>
  );
}

export default function LectureBackdrop({ labId, index, count }: { labId: string; index: number; count: number }) {
  const still = useMemo(() => prefersReducedMotion(), []);
  return (
    <div style={{ position: "absolute", inset: 0 }} aria-hidden>
      <Canvas camera={{ position: [0, 1.5, 9], fov: 45 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[4, 8, 6]} intensity={1.2} />
        <Field index={index} count={count} />
        <group position={[5.2, -1.6, -3]}>
          <Emblem labId={labId} scale={2.2} spin={!still} />
        </group>
      </Canvas>
    </div>
  );
}
