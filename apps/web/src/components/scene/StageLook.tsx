"use client";

import { ContactShadows, Environment, Lightformer } from "@react-three/drei";

/**
 * Studio look shared by the lab scenes, lit like a film set: a warm gold
 * key from behind (the rim that separates every object from the night),
 * a cool cobalt fill, soft reflections from a procedural light box (no
 * image download) and contact shadows that ground every object.
 */
export function StageLook({ size = 40, shadows = true }: { size?: number; shadows?: boolean }) {
  return (
    <>
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={2} color="#f3e6c8" position={[0, 6, 4]} scale={[12, 4, 1]} />
        <Lightformer form="rect" intensity={1.8} color="#c9a24a" position={[-8, 3, -2]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} />
        <Lightformer form="rect" intensity={1.1} color="#5d7bff" position={[8, 3, -2]} rotation-y={-Math.PI / 2} scale={[8, 3, 1]} />
        <Lightformer form="rect" intensity={1.4} color="#e0b860" position={[0, 4, -10]} scale={[16, 3, 1]} />
        <Lightformer form="circle" intensity={0.7} color="#ffffff" position={[0, 10, 0]} rotation-x={Math.PI / 2} scale={6} />
      </Environment>
      {/* the gold rim from behind and a low cobalt fill */}
      <directionalLight position={[-6, 6, -9]} intensity={1.1} color="#e0b860" />
      <directionalLight position={[7, 2, 6]} intensity={0.35} color="#7d97ff" />
      {shadows && <ContactShadows position={[0, -0.005, 0]} scale={size} blur={2.6} far={6} opacity={0.65} resolution={256} color="#05060c" />}
    </>
  );
}
