"use client";

import { useEffect, useMemo } from "react";
import { BufferAttribute, BufferGeometry, Color } from "three";
import { Label } from "./Label";
import type { ForwardTrace, Network } from "@inside-tech/lab-ai";
import { NEG, NETWORK_ORIGIN, POS } from "./palette";

interface Props {
  network: Network;
  trace?: ForwardTrace;
  /** Show w/b numbers next to the single neuron. */
  annotate?: boolean;
}

const LAYER_GAP = 1.5;
const UNIT_GAP = 0.55;

function layout(sizes: number[]): [number, number, number][][] {
  const width = (sizes.length - 1) * LAYER_GAP;
  return sizes.map((n, l) =>
    Array.from({ length: n }, (_, i) => [l * LAYER_GAP - width / 2, ((n - 1) / 2 - i) * UNIT_GAP + 1, 0] as [number, number, number]),
  );
}

/** Activation → 0..1 brightness, independent of activation function range. */
const glow = (a: number) => Math.min(1, Math.abs(a));

/**
 * Neurons as spheres, weights as lines (amber = positive, cobalt = negative,
 * opacity = magnitude). With a trace, each neuron lights up by its activation:
 * this is forward propagation made visible.
 */
export function NetworkDiagram({ network, trace, annotate }: Props) {
  const sizes = useMemo(
    () => (network.layers.length ? [network.layers[0]!.W[0]?.length ?? 2, ...network.layers.map((l) => l.b.length)] : [2, 1]),
    [network],
  );
  const pos = useMemo(() => layout(sizes), [sizes]);

  const lines = useMemo(() => {
    let maxW = 1e-6;
    for (const l of network.layers) for (const r of l.W) for (const w of r) maxW = Math.max(maxW, Math.abs(w));
    const verts: number[] = [];
    const cols: number[] = [];
    const c = new Color();
    network.layers.forEach((layer, l) => {
      layer.W.forEach((row, j) => {
        row.forEach((w, i) => {
          const a = pos[l]![i]!;
          const b = pos[l + 1]![j]!;
          verts.push(...a, ...b);
          const k = Math.abs(w) / maxW;
          // Fade toward the background by lerping to white-ish; LineBasicMaterial has no per-vertex alpha.
          c.copy(w >= 0 ? POS : NEG).lerp(new Color("#d7dce6"), 1 - Math.max(0.12, k));
          cols.push(c.r, c.g, c.b, c.r, c.g, c.b);
        });
      });
    });
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(verts), 3));
    g.setAttribute("color", new BufferAttribute(new Float32Array(cols), 3));
    return g;
  }, [network, pos]);

  useEffect(() => () => lines.dispose(), [lines]);

  const single = network.layers.length === 1 ? network.layers[0] : undefined;

  return (
    <group position={NETWORK_ORIGIN} scale={single ? 1.7 : 1}>
      <lineSegments geometry={lines}>
        <lineBasicMaterial vertexColors />
      </lineSegments>
      {pos.map((layer, l) =>
        layer.map((p, i) => {
          const a = trace?.a[l]?.[i];
          const lit = a === undefined ? 0 : glow(a);
          const out = l === pos.length - 1;
          const color = out && a !== undefined ? (a >= 0.5 ? POS : NEG) : new Color("#ffffff");
          return (
            <mesh key={`${l}-${i}`} position={p}>
              <sphereGeometry args={[l === 0 || out ? 0.17 : 0.13, 20, 16]} />
              <meshStandardMaterial
                color={color}
                emissive={a === undefined ? new Color("#000000") : (a >= 0 ? POS : NEG)}
                emissiveIntensity={lit * 0.9}
                roughness={0.4}
              />
            </mesh>
          );
        }),
      )}
      {annotate && single && (
        <>
          <Label position={[pos[0]![0]![0] - 0.35, pos[0]![0]![1], 0]} text={`x₁`} />
          <Label position={[pos[0]![1]![0] - 0.35, pos[0]![1]![1], 0]} text={`x₂`} />
          <Label position={[0, pos[0]![0]![1] + 0.15, 0]} text={`w₁ = ${single.W[0]![0]!.toFixed(2)}`} />
          <Label position={[-0.25, pos[0]![1]![1] - 0.2, 0]} text={`w₂ = ${single.W[0]![1]!.toFixed(2)}`} />
          <Label position={[pos[1]![0]![0] + 0.15, pos[1]![0]![1] - 0.42, 0]} text={`b = ${single.b[0]!.toFixed(2)} · ${single.act}`} />
        </>
      )}
      {trace && (
        <Label position={[pos[pos.length - 1]![0]![0] + 0.6, pos[pos.length - 1]![0]![1], 0]} text={`P(1) = ${(trace.a[trace.a.length - 1]![0]! * 100).toFixed(0)}%`} />
      )}
    </group>
  );
}
