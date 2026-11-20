"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { Color, InstancedMesh, Object3D } from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { DataPoint } from "@inside-tech/lab-ai";
import { C0, C1, H, toWorld } from "./palette";

interface Props {
  points: DataPoint[];
  selectedId: number | null;
  onPick?: (id: number) => void;
}

const dummy = new Object3D();
const tmp = new Color();

/**
 * One instanced draw call for the whole dataset. Class 1 floats at height H,
 * class 0 rests on the floor, so a correct model's surface wraps the points.
 * Test-set points are rendered smaller and paler.
 */
export function DataPoints({ points, selectedId, onPick }: Props) {
  const ref = useRef<InstancedMesh>(null);
  const capacity = useMemo(() => Math.max(64, Math.ceil(points.length / 64) * 64), [points.length]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    points.forEach((p, i) => {
      const [wx, wz] = toWorld(p.x, p.y);
      dummy.position.set(wx, p.label === 1 ? H : 0.06, wz);
      const sel = p.id === selectedId;
      const scale = (p.split === "test" ? 0.7 : 1) * (sel ? 1.9 : 1);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      tmp.copy(p.label === 1 ? C1 : C0);
      if (p.split === "test") tmp.lerp(new Color("#ffffff"), 0.45);
      mesh.setColorAt(i, tmp);
    });
    mesh.count = points.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [points, selectedId, capacity]);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.instanceId === undefined || !onPick) return;
    e.stopPropagation();
    const p = points[e.instanceId];
    if (p) onPick(p.id);
  };

  return (
    <instancedMesh
      key={capacity}
      ref={ref}
      args={[undefined, undefined, capacity]}
      onClick={handleClick}
      onPointerOver={(e) => {
        if (onPick) {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }
      }}
      onPointerOut={() => (document.body.style.cursor = "")}
      castShadow
    >
      <sphereGeometry args={[0.07, 16, 12]} />
      <meshStandardMaterial roughness={0.35} metalness={0.05} />
    </instancedMesh>
  );
}
