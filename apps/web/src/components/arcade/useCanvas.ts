"use client";

import { useEffect, useRef } from "react";

/**
 * A crisp canvas of a fixed logical size (W × H) that scales to its box, and a frame loop.
 * `frame(dt, ctx)` runs every animation frame with dt in seconds (capped, so a hidden tab
 * does not make the world jump).
 */
export function useCanvasLoop(W: number, H: number, frame: (dt: number, ctx: CanvasRenderingContext2D) => void) {
  const ref = useRef<HTMLCanvasElement>(null);
  const tick = useRef(frame);
  useEffect(() => {
    tick.current = frame;
  });

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth || W;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(((w * H) / W) * dpr);
      ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      tick.current(dt, ctx);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [W, H]);

  return ref;
}

/** A point from a pointer event in the canvas's logical coordinates. */
export function logicalPoint(e: { clientX: number; clientY: number }, canvas: HTMLCanvasElement, W: number, H: number): [number, number] {
  const r = canvas.getBoundingClientRect();
  return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

export function burst(list: Particle[], x: number, y: number, color: string, n = 14, speed = 220) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random());
    list.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.4, color, size: 2 + Math.random() * 4 });
  }
}

export function stepParticles(list: Particle[], dt: number, ctx: CanvasRenderingContext2D) {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i]!;
    p.life -= dt;
    if (p.life <= 0) {
      list.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.92;
    p.vy *= 0.92;
    ctx.globalAlpha = Math.min(1, p.life * 2);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}
