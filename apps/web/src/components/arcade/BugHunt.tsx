"use client";

import { useEffect, useRef, useState } from "react";
import { BOSS_EVERY, BUGS, BUG_LIVES, CODE_LINES, bugEvery, bugKindAt, dist, type BugKind } from "@/lib/games";
import { play } from "@/lib/sfx";
import { burst, logicalPoint, stepParticles, useCanvasLoop, type Particle } from "./useCanvas";
import styles from "./arcade.module.css";

const W = 800;
const H = 480;
const TOP = 44;
const LINE_H = 52;
const GUTTER = 70;
const START = 1.5;

interface Bug {
  id: number;
  kind: BugKind;
  line: number;
  x: number;
  y: number;
  hp: number;
  wobble: number;
  hitT: number;
}
interface Float {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

const COLOR: Record<BugKind, string> = { bug: "#ff3d7f", leak: "#a46bff", race: "#ffd23d", feature: "#5cff9d", boss: "#ff3b30" };

/** Баг аулау: bugs crawl along the code toward production; squash them, spare the features. */
export function BugHunt({ onEnd }: { onEnd: (score: number) => void }) {
  const s = useRef({
    t: -START,
    next: 0.3,
    nextBoss: BOSS_EVERY,
    bugs: [] as Bug[],
    floats: [] as Float[],
    parts: [] as Particle[],
    id: 0,
    score: 0,
    combo: 1,
    lastHit: -9,
    lives: BUG_LIVES,
    flash: 0,
    shake: 0,
    over: false,
  });
  const [hud, setHud] = useState({ score: 0, combo: 1, lives: BUG_LIVES, lines: "" });
  const end = useRef(onEnd);
  const hudAt = useRef(0);
  useEffect(() => {
    end.current = onEnd;
  });

  const lineY = (line: number) => TOP + line * LINE_H + LINE_H / 2;

  const float = (x: number, y: number, text: string, color: string) => s.current.floats.push({ x, y, text, color, life: 0.9 });

  const smack = (b: Bug) => {
    const g = s.current;
    if (g.over || g.t < 0) return;
    if (b.kind === "feature") {
      g.bugs = g.bugs.filter((x) => x !== b);
      g.score = Math.max(0, g.score + BUGS.feature.points);
      g.combo = 1;
      g.shake = 6;
      float(b.x, b.y - 20, "Бұл фича еді! −40", "#5cff9d");
      burst(g.parts, b.x, b.y, "#5cff9d", 10);
      play("hit");
      return;
    }
    b.hp--;
    b.hitT = 0.12;
    if (b.hp > 0) {
      burst(g.parts, b.x, b.y, COLOR[b.kind], 5, 120);
      play("hit");
      return;
    }
    g.combo = g.t - g.lastHit < 1.3 ? Math.min(5, g.combo + 1) : 1;
    g.lastHit = g.t;
    const pts = BUGS[b.kind].points * g.combo;
    g.score += pts;
    g.bugs = g.bugs.filter((x) => x !== b);
    burst(g.parts, b.x, b.y, COLOR[b.kind], b.kind === "boss" ? 50 : 16, b.kind === "boss" ? 360 : 220);
    float(b.x, b.y - 22, `+${pts}${g.combo > 1 ? ` ×${g.combo}` : ""}`, "#b6ff3d");
    if (b.kind === "boss") g.shake = 14;
    play(b.kind === "boss" ? "boom" : "squash");
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (!(n >= 1 && n <= CODE_LINES.length)) return;
      e.preventDefault();
      const lead = s.current.bugs.filter((b) => b.line === n - 1 && b.kind !== "feature").sort((a, b) => a.x - b.x)[0];
      if (lead) smack(lead);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const ref = useCanvasLoop(W, H, (dt, ctx) => {
    const g = s.current;
    g.t += dt;
    if (g.t > 0 && !g.over) {
      g.next -= dt;
      if (g.next <= 0) {
        const kind = bugKindAt(g.t, Math.random());
        const line = Math.floor(Math.random() * CODE_LINES.length);
        g.bugs.push({ id: ++g.id, kind, line, x: W + 20, y: lineY(line), hp: BUGS[kind].hp, wobble: Math.random() * 6, hitT: 0 });
        g.next = bugEvery(g.t);
      }
      if (g.t >= g.nextBoss) {
        const line = 1 + Math.floor(Math.random() * (CODE_LINES.length - 2));
        g.bugs.push({ id: ++g.id, kind: "boss", line, x: W + 40, y: lineY(line), hp: BUGS.boss.hp + Math.floor(g.t / 60) * 4, wobble: 0, hitT: 0 });
        g.nextBoss += BOSS_EVERY;
        float(W / 2, 30, "⚠ PROD БАҒЫ КЕЛЕ ЖАТЫР!", "#ff3b30");
        play("wave");
      }
      for (const b of g.bugs) {
        b.wobble += dt * (b.kind === "race" ? 14 : 8);
        b.x -= BUGS[b.kind].speed * (1 + g.t / 120) * dt;
        b.y = lineY(b.line) + (b.kind === "race" ? Math.sin(b.wobble) * 12 : Math.sin(b.wobble) * 2);
        b.hitT = Math.max(0, b.hitT - dt);
      }
      const escaped = g.bugs.filter((b) => b.x < GUTTER - 10);
      if (escaped.length) {
        g.bugs = g.bugs.filter((b) => b.x >= GUTTER - 10);
        for (const b of escaped) {
          if (b.kind === "feature") {
            float(GUTTER + 40, b.y, "фича шықты ✓", "#5cff9d");
            continue;
          }
          g.lives -= b.kind === "boss" ? 3 : 1;
          g.flash = 0.35;
          g.shake = 10;
          g.combo = 1;
          float(GUTTER + 60, b.y, "PROD-қа кетті!", "#ff3d7f");
          play("hit");
        }
        if (g.lives <= 0) {
          g.over = true;
          play("lose");
          window.setTimeout(() => end.current(g.score), 1000);
        }
      }
    }
    g.flash = Math.max(0, g.flash - dt);
    g.shake = Math.max(0, g.shake - dt * 40);

    // ---- draw: an editor
    ctx.save();
    if (g.shake) ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
    ctx.fillStyle = "#14121f";
    ctx.fillRect(-20, -20, W + 40, H + 40);
    ctx.fillStyle = "#1c1930";
    ctx.fillRect(0, 0, W, 30);
    ctx.fillStyle = "#ff5f57";
    ctx.beginPath();
    ctx.arc(18, 15, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#febc2e";
    ctx.beginPath();
    ctx.arc(38, 15, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#28c840";
    ctx.beginPath();
    ctx.arc(58, 15, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8e87b8";
    ctx.font = "600 13px ui-monospace, monospace";
    ctx.textBaseline = "middle";
    ctx.fillText("checkout.js", 84, 16);

    // production gutter
    ctx.fillStyle = g.flash > 0 ? "rgba(255,61,127,0.45)" : "#1f1b33";
    ctx.fillRect(0, TOP - 6, GUTTER - 8, LINE_H * CODE_LINES.length + 12);
    ctx.save();
    ctx.translate(14, TOP + (LINE_H * CODE_LINES.length) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = "#ff3d7f";
    ctx.font = "800 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("PRODUCTION", 0, 0);
    ctx.restore();

    CODE_LINES.forEach((code, k) => {
      const y = lineY(k);
      const busy = g.bugs.some((b) => b.line === k && b.kind !== "feature");
      if (busy) {
        ctx.fillStyle = "rgba(255,61,127,0.06)";
        ctx.fillRect(GUTTER - 8, y - LINE_H / 2, W, LINE_H);
      }
      ctx.fillStyle = busy ? "#ff3d7f" : "#5b5385";
      ctx.font = "700 15px ui-monospace, monospace";
      ctx.textAlign = "right";
      ctx.fillText(String(k + 1), GUTTER - 18, y);
      ctx.textAlign = "left";
      ctx.fillStyle = "#cfc9f2";
      ctx.font = "500 18px ui-monospace, monospace";
      ctx.fillText(code, GUTTER + 8, y);
    });

    for (const b of g.bugs) {
      const big = b.kind === "boss" ? 2.2 : b.kind === "leak" ? 1.25 : 1;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.scale(big, big);
      // legs
      ctx.strokeStyle = "#0c0a14";
      ctx.lineWidth = 2;
      for (let k = -1; k <= 1; k++) {
        const swing = Math.sin(b.wobble * 2 + k) * 4;
        ctx.beginPath();
        ctx.moveTo(k * 6, 0);
        ctx.lineTo(k * 6 + swing, -15);
        ctx.moveTo(k * 6, 0);
        ctx.lineTo(k * 6 - swing, 15);
        ctx.stroke();
      }
      if (b.kind === "feature") {
        ctx.fillStyle = "#5cff9d";
        ctx.beginPath();
        ctx.ellipse(-2, -8, 10, 7, -0.5 + Math.sin(b.wobble) * 0.3, 0, Math.PI * 2);
        ctx.ellipse(-2, 8, 10, 7, 0.5 - Math.sin(b.wobble) * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = b.hitT > 0 ? "#fff" : COLOR[b.kind];
      ctx.shadowColor = COLOR[b.kind];
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.ellipse(0, 0, 13, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#0c0a14";
      ctx.beginPath();
      ctx.arc(-11, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(-13, -3, 2, 0, Math.PI * 2);
      ctx.arc(-13, 3, 2, 0, Math.PI * 2);
      ctx.fill();
      if (b.kind === "leak") {
        ctx.strokeStyle = "#e4d5ff";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-6, -8);
        ctx.lineTo(-6, 8);
        ctx.moveTo(2, -9);
        ctx.lineTo(2, 9);
        ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = COLOR[b.kind];
      ctx.font = `700 ${b.kind === "boss" ? 14 : 11}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(BUGS[b.kind].name + (b.hp > 1 ? ` ${b.hp}` : ""), b.x, b.y - 18 * big - 4);
    }
    stepParticles(g.parts, dt, ctx);
    for (let i = g.floats.length - 1; i >= 0; i--) {
      const f = g.floats[i]!;
      f.life -= dt;
      f.y -= 40 * dt;
      if (f.life <= 0) {
        g.floats.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = Math.min(1, f.life * 2);
      ctx.fillStyle = f.color;
      ctx.font = "900 20px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    if (g.t < 0) {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#b6ff3d";
      ctx.font = "900 70px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(Math.ceil(-g.t / (START / 3))), W / 2, H / 2);
      ctx.font = "700 19px system-ui, sans-serif";
      ctx.fillStyle = "#fff";
      ctx.fillText("Бағты бас немесе жол нөмірін (1-8) бас. Жасыл фичаға тиме!", W / 2, H / 2 + 60);
    }
    ctx.restore();

    hudAt.current += dt;
    if (hudAt.current > 0.1) {
      hudAt.current = 0;
      const lines = [...new Set(g.bugs.filter((b) => b.kind !== "feature").map((b) => b.line + 1))].sort().join(",");
      setHud({ score: g.score, combo: g.combo, lives: Math.max(0, g.lives), lines });
    }
  });

  const click = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const [x, y] = logicalPoint(e, e.currentTarget, W, H);
    const g = s.current;
    const target = g.bugs
      .map((b) => ({ b, d: dist(x, y, b.x, b.y) }))
      .filter(({ b, d }) => d < (b.kind === "boss" ? 46 : b.kind === "leak" ? 30 : 26))
      .sort((a, b) => a.d - b.d)[0];
    if (target) smack(target.b);
  };

  return (
    <div className={styles.actionGame} data-lines={hud.lines}>
      <div className={styles.hud}>
        <span>
          Ұпай <b data-testid="score">{hud.score}</b>
        </span>
        <span>Комбо ×{hud.combo}</span>
        <span aria-label={`Өмір: ${hud.lives}`}>
          {Array.from({ length: BUG_LIVES }, (_, k) => (
            <i key={k} data-on={k < hud.lives || undefined}>
              ♥
            </i>
          ))}
        </span>
      </div>
      <canvas
        ref={ref}
        className={styles.canvas}
        style={{ aspectRatio: `${W} / ${H}`, cursor: "crosshair" }}
        role="img"
        aria-label={`Баг аулау. Ұпай ${hud.score}. Бағы бар жолдар: ${hud.lines || "жоқ"}. Жол нөмірін басып, сол жолдағы бағты жой.`}
        onPointerDown={click}
      />
      <ul className={styles.legend} aria-label="Бағтар">
        {(Object.keys(BUGS) as BugKind[]).map((k) => (
          <li key={k}>
            <i style={{ background: COLOR[k] }} aria-hidden /> <b>{BUGS[k].name}</b> {BUGS[k].note}
          </li>
        ))}
      </ul>
    </div>
  );
}
