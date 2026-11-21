"use client";

import { ContactShadows, Environment, Lightformer } from "@react-three/drei";

/**
 * Studio look shared by the lab scenes: soft reflections from a procedural
 * light box (no image download) and contact shadows that ground every object.
 */
export function StageLook({ size = 40, shadows = true }: { size?: number; shadows?: boolean }) {
  return (
    <>
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={2.2} color="#dfe6ff" position={[0, 6, 4]} scale={[12, 4, 1]} />
        <Lightformer form="rect" intensity={1.4} color="#e3a04f" position={[-8, 3, -2]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#6d8cff" position={[8, 3, -2]} rotation-y={-Math.PI / 2} scale={[8, 3, 1]} />
        <Lightformer form="circle" intensity={0.8} color="#ffffff" position={[0, 10, 0]} rotation-x={Math.PI / 2} scale={6} />
      </Environment>
      {shadows && <ContactShadows position={[0, -0.005, 0]} scale={size} blur={2.6} far={6} opacity={0.6} resolution={256} color="#05081a" />}
    </>
  );
}
