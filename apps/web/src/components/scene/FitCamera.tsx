"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { Vector3, type PerspectiveCamera } from "three";

interface Props {
  /** World-space width and height that must stay visible. */
  width: number;
  height: number;
  target: [number, number, number];
  /** Direction from the target towards the camera (normalised internally). */
  dir: [number, number, number];
  margin?: number;
}

/**
 * Places the camera so a width × height region around `target` fits the
 * viewport at any aspect ratio — portrait phones as well as wide desktops.
 * Re-fits on resize; OrbitControls (makeDefault) is retargeted too.
 */
export function FitCamera({ width, height, target, dir, margin = 1.1 }: Props) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const controls = useThree((s) => s.controls) as unknown as { target: Vector3; update(): void } | null;

  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    const vHalf = ((camera.fov ?? 45) / 2) * (Math.PI / 180);
    const hHalf = Math.atan(Math.tan(vHalf) * aspect);
    const dist = Math.max(width / 2 / Math.tan(hHalf), height / 2 / Math.tan(vHalf)) * margin;
    const t = new Vector3(...target);
    camera.position.copy(new Vector3(...dir).normalize().multiplyScalar(dist).add(t));
    camera.lookAt(t);
    if (controls) {
      controls.target.copy(t);
      controls.update();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, controls, size.width, size.height, width, height, target[0], target[1], target[2], dir[0], dir[1], dir[2], margin]);
  return null;
}
