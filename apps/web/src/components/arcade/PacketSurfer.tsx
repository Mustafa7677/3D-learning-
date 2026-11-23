"use client";

import { useEffect, useRef, useState } from "react";
import { RUN_H, RUN_LABELS, RUN_W, circleHitsRect, dist, runSpeed, wallGap } from "@/lib/games";
import { play } from "@/lib/sfx";
import { burst, logicalPoint, stepParticles, useCanvasLoop, type Particle } from "./useCanvas";
import styles from "./arcade.module.css";

interface Wall {
  x: number;
  gapY: number;
  gap: number;
  label: string;
  passed: boolean;
}
interface Virus {
  x: number;
  y: number;
  base: number;
  phase: number;
  amp: number;
}
interface Pickup {
  x: number;
  y: number;
  kind: "bit" | "shield";
  glyph: string;
}

const PX = 150;
const PR = 15;
const WALL_W = 48;
const START = 1.6;

/** Пакет-серфер: fly a packet down a fibre cable, past firewalls and viruses, picking up bits. */
export function PacketSurfer({ onEnd }: { onEnd: (score: number) => void }) {
  const s = useRef({
    t: -START,
    y: RUN_H / 2,
    target: undefined as number | undefined,
    up: false,
    down: false,
    dist: 0,
    bits: 0,
    shield: false,
    hurt: 0,
    shake: 0,
    over: false,
    nextSpawn: 300,
    walls: [] as Wall[],
    viruses: [] as Virus[],
    pickups: [] as Pickup[],
    parts: [] as Particle[],
    trail: [] as [number, number][],
    lines: Array.from({ length: 26 }, (_, i) => ({ y: (i * 97) % RUN_H, x: (i * 211) % RUN_W, len: 40 + ((i * 37) % 120), speed: 0.4 + ((i * 13) % 10) / 10 })),
  });
  const [hud, setHud] = useState({ score: 0, shield: false });
  const end = useRef(onEnd);
  const hudAt = useRef(0);
  useEffect(() => {
    end.current = onEnd;
  });

  useEffect(() => {
    const key = (down: boolean) => (e: KeyboardEvent) => {
      const g = s.current;
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
        g.up = down;
        g.target = undefined;
        e.preventDefault();
      }
      if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
        g.down = down;
        g.target = undefined;
        e.preventDefault();
      }
    };
    const kd = key(true);
    const ku = key(false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
  }, []);

  const spawn = (g: typeof s.current) => {
    const r = Math.random();
    const x = RUN_W + 60;
    if (r < 0.42) {
      const gap = wallGap(Math.max(0, g.t));
      g.walls.push({ x, gap, gapY: 40 + Math.random() * (RUN_H - gap - 80), label: RUN_LABELS[Math.floor(Math.random() * RUN_LABELS.length)]!, passed: false });
      // A bit sits in the gap, as a reward for threading it.
      const w = g.walls[g.walls.length - 1]!;
      g.pickups.push({ x: x + WALL_W / 2, y: w.gapY + w.gap / 2, kind: "bit", glyph: Math.random() < 0.5 ? "1" : "0" });
    } else if (r < 0.72) {
      const n = g.t > 25 ? 3 : 2;
      for (let k = 0; k < n; k++) {
        const base = 60 + Math.random() * (RUN_H - 120);
        g.viruses.push({ x: x + k * 140, y: base, base, phase: Math.random() * 6, amp: 30 + Math.random() * 60 });
      }
    } else if (r < 0.95) {
      const y0 = 70 + Math.random() * (RUN_H - 140);
      for (let k = 0; k < 6; k++) g.pickups.push({ x: x + k * 42, y: y0 + Math.sin(k / 1.6) * 50, kind: "bit", glyph: k % 2 ? "1" : "0" });
    } else {
      g.pickups.push({ x, y: 80 + Math.random() * (RUN_H - 160), kind: "shield", glyph: "TLS" });
    }
    g.nextSpawn = 300 + Math.random() * 160 - Math.min(120, g.t * 2);
  };

  const hit = (g: typeof s.current) => {
    if (g.hurt > 0 || g.over) return;
    if (g.shield) {
      g.shield = false;
      g.hurt = 1;
      g.shake = 8;
      burst(g.parts, PX, g.y, "#32e0ff", 18);
      play("hit");
      return;
    }
    g.over = true;
    g.shake = 18;
    burst(g.parts, PX, g.y, "#ff3d7f", 40, 320);
    burst(g.parts, PX, g.y, "#ffd23d", 20, 200);
    play("lose");
    const score = Math.floor(g.dist / 10) + g.bits * 10;
    setHud({ score, shield: false });
    window.setTimeout(() => end.current(score), 1100);
  };

  const ref = useCanvasLoop(RUN_W, RUN_H, (dt, ctx) => {
    const g = s.current;
    const speed = g.over ? 0 : runSpeed(Math.max(0, g.t));
    g.t += dt;
    const live = g.t > 0 && !g.over;

    // ---- update
    if (live) {
      g.dist += speed * dt;
      if (g.target !== undefined) g.y += Math.sign(g.target - g.y) * Math.min(Math.abs(g.target - g.y), 560 * dt);
      else g.y += ((g.down ? 1 : 0) - (g.up ? 1 : 0)) * 400 * dt;
      g.y = Math.max(PR + 4, Math.min(RUN_H - PR - 4, g.y));
      g.hurt = Math.max(0, g.hurt - dt);
      g.nextSpawn -= speed * dt;
      if (g.nextSpawn <= 0) spawn(g);
      for (const w of g.walls) {
        w.x -= speed * dt;
        if (circleHitsRect(PX, g.y, PR, w.x, 0, WALL_W, w.gapY) || circleHitsRect(PX, g.y, PR, w.x, w.gapY + w.gap, WALL_W, RUN_H)) hit(g);
        if (!w.passed && w.x + WALL_W < PX) w.passed = true;
      }
      for (const v of g.viruses) {
        v.x -= speed * dt * 1.08;
        v.phase += dt * 2.4;
        v.y = v.base + Math.sin(v.phase) * v.amp;
        if (dist(PX, g.y, v.x, v.y) < PR + 17) hit(g);
      }
      for (let i = g.pickups.length - 1; i >= 0; i--) {
        const p = g.pickups[i]!;
        p.x -= speed * dt;
        if (dist(PX, g.y, p.x, p.y) < PR + 14) {
          g.pickups.splice(i, 1);
          if (p.kind === "shield") {
            g.shield = true;
            play("power");
            burst(g.parts, p.x, p.y, "#32e0ff", 20);
          } else {
            g.bits++;
            play("coin");
            burst(g.parts, p.x, p.y, "#ffd23d", 8, 140);
          }
        }
      }
      g.walls = g.walls.filter((w) => w.x > -WALL_W - 10);
      g.viruses = g.viruses.filter((v) => v.x > -40);
      g.pickups = g.pickups.filter((p) => p.x > -30);
      g.trail.unshift([PX, g.y]);
      if (g.trail.length > 18) g.trail.pop();
    }
    g.shake = Math.max(0, g.shake - dt * 40);

    // ---- draw
    ctx.save();
    if (g.shake) ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
    const bg = ctx.createLinearGradient(0, 0, 0, RUN_H);
    bg.addColorStop(0, "#0b0f2a");
    bg.addColorStop(0.5, "#141a45");
    bg.addColorStop(1, "#0b0f2a");
    ctx.fillStyle = bg;
    ctx.fillRect(-20, -20, RUN_W + 40, RUN_H + 40);
    // The fibre: streaks of light running past.
    for (const l of g.lines) {
      l.x -= (speed || 120) * l.speed * dt;
      if (l.x + l.len < 0) l.x = RUN_W + Math.random() * 100;
      ctx.strokeStyle = `rgba(50, 224, 255, ${0.12 + l.speed * 0.2})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(l.x, l.y);
      ctx.lineTo(l.x + l.len, l.y);
      ctx.stroke();
    }
    // Cable walls.
    ctx.fillStyle = "#1f2660";
    ctx.fillRect(0, 0, RUN_W, 8);
    ctx.fillRect(0, RUN_H - 8, RUN_W, 8);

    for (const w of g.walls) {
      for (const [y, h] of [
        [0, w.gapY],
        [w.gapY + w.gap, RUN_H - w.gapY - w.gap],
      ] as const) {
        ctx.fillStyle = "#c4501d";
        ctx.fillRect(w.x, y, WALL_W, h);
        ctx.fillStyle = "#e8743a";
        for (let by = y + 6; by < y + h - 6; by += 22) ctx.fillRect(w.x + ((by / 22) % 2 ? 4 : 14), by, 30, 12);
      }
      ctx.fillStyle = "#ff3d7f";
      ctx.shadowColor = "#ff3d7f";
      ctx.shadowBlur = 14;
      ctx.fillRect(w.x - 3, w.gapY - 5, WALL_W + 6, 5);
      ctx.fillRect(w.x - 3, w.gapY + w.gap, WALL_W + 6, 5);
      ctx.shadowBlur = 0;
      ctx.save();
      ctx.translate(w.x + WALL_W / 2, w.gapY > 120 ? w.gapY / 2 : w.gapY + w.gap + (RUN_H - w.gapY - w.gap) / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = "#fff";
      ctx.font = "700 13px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(w.label, 0, 0);
      ctx.restore();
    }

    for (const p of g.pickups) {
      ctx.shadowBlur = 16;
      if (p.kind === "shield") {
        ctx.shadowColor = "#32e0ff";
        ctx.fillStyle = "#32e0ff";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 17, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#0c0a14";
        ctx.font = "800 11px system-ui, sans-serif";
      } else {
        ctx.shadowColor = "#ffd23d";
        ctx.fillStyle = "#ffd23d";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#3a2a00";
        ctx.font = "800 15px ui-monospace, monospace";
      }
      ctx.shadowBlur = 0;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(p.glyph, p.x, p.y + 1);
    }

    for (const v of g.viruses) {
      ctx.fillStyle = "#ff3d7f";
      ctx.shadowColor = "#ff3d7f";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2 + v.phase * 0.5;
        const rr = k % 2 ? 13 : 19;
        ctx.lineTo(v.x + Math.cos(a) * rr, v.y + Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(v.x - 5, v.y - 3, 4, 0, Math.PI * 2);
      ctx.arc(v.x + 5, v.y - 3, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.fillRect(v.x - 6, v.y - 4, 2.5, 3);
      ctx.fillRect(v.x + 4, v.y - 4, 2.5, 3);
    }

    // The packet and its light trail.
    if (!g.over) {
      g.trail.forEach(([x, y], k) => {
        ctx.globalAlpha = (1 - k / g.trail.length) * 0.5;
        ctx.fillStyle = "#b6ff3d";
        ctx.fillRect(x - 12 - k * (speed / 60), y - 3, 10, 6);
      });
      ctx.globalAlpha = g.hurt > 0 && Math.floor(g.hurt * 12) % 2 ? 0.35 : 1;
      ctx.shadowColor = "#b6ff3d";
      ctx.shadowBlur = 18;
      ctx.fillStyle = "#f4f7ff";
      ctx.fillRect(PX - 18, g.y - 12, 36, 24);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#0c0a14";
      ctx.lineWidth = 2;
      ctx.strokeRect(PX - 18, g.y - 12, 36, 24);
      ctx.beginPath();
      ctx.moveTo(PX - 18, g.y - 12);
      ctx.lineTo(PX, g.y + 2);
      ctx.lineTo(PX + 18, g.y - 12);
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (g.shield) {
        ctx.strokeStyle = "#32e0ff";
        ctx.lineWidth = 3;
        ctx.shadowColor = "#32e0ff";
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(PX, g.y, 28 + Math.sin(g.t * 8) * 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }
    stepParticles(g.parts, dt, ctx);

    if (g.t < 0) {
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(0, 0, RUN_W, RUN_H);
      ctx.fillStyle = "#b6ff3d";
      ctx.font = "900 72px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(Math.ceil(-g.t / (START / 3))), RUN_W / 2, RUN_H / 2);
      ctx.font = "700 20px system-ui, sans-serif";
      ctx.fillStyle = "#fff";
      ctx.fillText("↑ ↓ пернелері немесе саусақпен жүргіз", RUN_W / 2, RUN_H / 2 + 64);
    }
    ctx.restore();

    hudAt.current += dt;
    if (hudAt.current > 0.12 && !g.over) {
      hudAt.current = 0;
      setHud({ score: Math.floor(g.dist / 10) + g.bits * 10, shield: g.shield });
    }
  });

  const steer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === "mouse" && e.buttons === 0 && e.type === "pointermove") return;
    s.current.target = logicalPoint(e, e.currentTarget, RUN_W, RUN_H)[1];
  };

  return (
    <div className={styles.actionGame}>
      <div className={styles.hud}>
        <span>
          Ұпай <b data-testid="score">{hud.score}</b>
        </span>
        <span>{hud.shield ? "🔒 TLS қалқаны бар" : "Қалқан жоқ"}</span>
      </div>
      <canvas
        ref={ref}
        className={styles.canvas}
        style={{ aspectRatio: `${RUN_W} / ${RUN_H}` }}
        role="img"
        aria-label={`Пакет-серфер. Ұпай ${hud.score}. Жоғары және төмен бағыттау пернелерімен басқар.`}
        onPointerDown={steer}
        onPointerMove={steer}
        onPointerUp={() => (s.current.target = undefined)}
      />
    </div>
  );
}
