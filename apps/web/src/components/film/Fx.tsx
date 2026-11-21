"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Points, Vector2 } from "three";
import { FILM } from "./Emblems";

/** Glow on everything bright (copper pulses, emissive parts) and a soft frame. */
export function FilmFx({ strength = 1, bloom = true }: { strength?: number; bloom?: boolean }) {
  // Bloom only catches emissive, non-tone-mapped parts (energy traces, pulses): threshold above 1.
  if (!bloom)
    return (
      <EffectComposer multisampling={0}>
        <Vignette offset={0.25} darkness={0.7} />
      </EffectComposer>
    );
  return (
    <EffectComposer multisampling={0}>
      <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.1} intensity={1.3 * strength} radius={0.65} />
      <Vignette offset={0.25} darkness={0.7} />
    </EffectComposer>
  );
}

/** Specks of light drifting through the scene, like dust in a beam over a board. */
export function Dust({ count = 700, spread = [26, 10, 18] as [number, number, number], still = false }: { count?: number; spread?: [number, number, number]; still?: boolean }) {
  const ref = useRef<Points>(null);
  const geo = useMemo(() => {
    const g = new BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    // Seeded so every visit looks the same.
    let s = 1234567;
    const r = () => ((s = (s * 1103515245 + 12345) >>> 0) / 2 ** 32);
    const a = new Color(FILM.copper);
    const b = new Color(FILM.glow);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (r() - 0.5) * spread[0];
      pos[i * 3 + 1] = r() * spread[1] - 1;
      pos[i * 3 + 2] = (r() - 0.5) * spread[2];
      const c = r() < 0.35 ? a : b;
      const k = 0.5 + r() * 0.8;
      col[i * 3] = c.r * k;
      col[i * 3 + 1] = c.g * k;
      col[i * 3 + 2] = c.b * k;
    }
    g.setAttribute("position", new BufferAttribute(pos, 3));
    g.setAttribute("color", new BufferAttribute(col, 3));
    return g;
  }, [count, spread]);
  useFrame(({ clock }) => {
    if (still || !ref.current) return;
    ref.current.rotation.y = clock.elapsedTime * 0.012;
    ref.current.position.y = Math.sin(clock.elapsedTime * 0.2) * 0.15;
  });
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial size={0.05} vertexColors transparent opacity={0.85} blending={AdditiveBlending} depthWrite={false} sizeAttenuation />
    </points>
  );
}

/** Pointer position in -1..1, eased, for a little camera parallax. */
export function usePointerSway(still: boolean) {
  const sway = useRef(new Vector2());
  const { pointer } = useThree();
  useFrame((_, dt) => {
    if (still) return;
    const k = 1 - Math.exp(-dt * 2);
    sway.current.x += (pointer.x - sway.current.x) * k;
    sway.current.y += (pointer.y - sway.current.y) * k;
  });
  return sway;
}
