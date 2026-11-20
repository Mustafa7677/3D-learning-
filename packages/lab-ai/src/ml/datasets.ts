import { Rng } from "@inside-tech/sim-core";

export type DatasetKind = "blobs" | "xor" | "circles" | "spiral" | "moons";

export interface RawPoint {
  x: number;
  y: number;
  label: 0 | 1;
}

const clamp = (v: number) => Math.max(-1, Math.min(1, v));

/** Generators produce points in [-1, 1]². `noise` is in 0..1. */
export function generateDataset(kind: DatasetKind, count: number, noise: number, rng: Rng): RawPoint[] {
  const pts: RawPoint[] = [];
  const n = Math.max(2, Math.floor(count));
  const jitter = () => rng.normal() * noise * 0.25;
  for (let i = 0; i < n; i++) {
    const label: 0 | 1 = i % 2 === 0 ? 0 : 1;
    let x = 0;
    let y = 0;
    switch (kind) {
      case "blobs": {
        const c = label === 0 ? -0.45 : 0.45;
        x = c + rng.normal() * (0.15 + noise * 0.25);
        y = c + rng.normal() * (0.15 + noise * 0.25);
        break;
      }
      case "xor": {
        x = rng.range(-0.95, 0.95);
        y = rng.range(-0.95, 0.95);
        const pad = 0.05;
        if (Math.abs(x) < pad) x += x < 0 ? -pad : pad;
        if (Math.abs(y) < pad) y += y < 0 ? -pad : pad;
        const lbl: 0 | 1 = x * y >= 0 ? 0 : 1;
        pts.push({ x: clamp(x + jitter()), y: clamp(y + jitter()), label: lbl });
        continue;
      }
      case "circles": {
        const r = label === 0 ? rng.range(0, 0.4) : rng.range(0.6, 0.95);
        const t = rng.range(0, Math.PI * 2);
        x = r * Math.cos(t) + jitter();
        y = r * Math.sin(t) + jitter();
        break;
      }
      case "spiral": {
        const k = Math.floor(i / 2) / (n / 2);
        const r = 0.1 + k * 0.85;
        const t = 1.75 * k * 2 * Math.PI + (label === 1 ? Math.PI : 0);
        x = r * Math.sin(t) + jitter();
        y = r * Math.cos(t) + jitter();
        break;
      }
      case "moons": {
        const t = rng.range(0, Math.PI);
        if (label === 0) {
          x = Math.cos(t) * 0.6 - 0.25;
          y = Math.sin(t) * 0.6 - 0.15;
        } else {
          x = 0.35 - Math.cos(t) * 0.6;
          y = -Math.sin(t) * 0.6 + 0.15;
        }
        x += jitter();
        y += jitter();
        break;
      }
    }
    pts.push({ x: clamp(x), y: clamp(y), label });
  }
  return pts;
}
