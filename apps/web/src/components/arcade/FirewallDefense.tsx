"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PATH_LENGTH, TD_COLS, TD_LIVES, TD_MONEY, TD_ROWS, THREATS, TOWERS, WAVES, dist, pathCells, pointAlong, sellBack, waveHp, type ThreatKind, type TowerKind } from "@/lib/games";
import { play } from "@/lib/sfx";
import { burst, logicalPoint, stepParticles, useCanvasLoop, type Particle } from "./useCanvas";
import styles from "./arcade.module.css";

const C = 56;
const W = TD_COLS * C;
const H = TD_ROWS * C;

interface Tower {
  id: number;
  kind: TowerKind;
  c: number;
  r: number;
  cool: number;
}
interface Threat {
  id: number;
  kind: ThreatKind;
  d: number;
  hp: number;
  max: number;
  slowT: number;
  seen: boolean;
}
interface Beam {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  life: number;
}
type Phase = "build" | "wave" | "won" | "lost";

/** Брандмауэр қорғанысы: build defences beside the road and keep malware off the server. */
export function FirewallDefense({ onEnd }: { onEnd: (score: number) => void }) {
  const road = useMemo(() => new Set(pathCells().map(([c, r]) => `${c},${r}`)), []);
  const s = useRef({
    money: TD_MONEY,
    lives: TD_LIVES,
    wave: 0,
    phase: "build" as Phase,
    towers: [] as Tower[],
    threats: [] as Threat[],
    queue: [] as { kind: ThreatKind; at: number }[],
    clock: 0,
    beams: [] as Beam[],
    parts: [] as Particle[],
    id: 0,
    earned: 0,
    seenKinds: new Set<ThreatKind>(),
    flow: 0,
    shake: 0,
  });
  const [pick, setPick] = useState<TowerKind>("firewall");
  const [chosen, setChosen] = useState<number>();
  const [hover, setHover] = useState<[number, number]>();
  const [cursor, setCursor] = useState<[number, number]>([2, 3]);
  const cursorRef = useRef(cursor);
  useEffect(() => {
    cursorRef.current = cursor;
  });
  const [fast, setFast] = useState(false);
  const [news, setNews] = useState<string>();
  const [hud, setHud] = useState({ money: TD_MONEY, lives: TD_LIVES, wave: 0, phase: "build" as Phase, earned: 0 });
  const end = useRef(onEnd);
  const hudAt = useRef(0);
  const fastRef = useRef(fast);
  useEffect(() => {
    end.current = onEnd;
    fastRef.current = fast;
  });

  const sync = () => {
    const g = s.current;
    setHud({ money: g.money, lives: g.lives, wave: g.wave, phase: g.phase, earned: g.earned });
  };

  const finalScore = () => {
    const g = s.current;
    return g.earned + g.wave * 100 + (g.phase === "won" ? g.lives * 25 + 500 : 0);
  };

  const startWave = () => {
    const g = s.current;
    if (g.phase !== "build" || g.wave >= WAVES.length) return;
    const groups = WAVES[g.wave]!;
    let at = 0.5;
    g.queue = [];
    const fresh: string[] = [];
    for (const grp of groups) {
      for (let k = 0; k < grp.count; k++) {
        g.queue.push({ kind: grp.kind, at });
        at += grp.gap;
      }
      at += 1.2;
      if (!g.seenKinds.has(grp.kind)) {
        g.seenKinds.add(grp.kind);
        fresh.push(`Жаңа қауіп: ${THREATS[grp.kind].name}. ${THREATS[grp.kind].note}`);
      }
    }
    g.clock = 0;
    g.phase = "wave";
    setNews(fresh.length ? fresh.join(" ") : undefined);
    play("wave");
    sync();
  };

  const place = (c: number, r: number) => {
    const g = s.current;
    if (g.phase === "won" || g.phase === "lost") return;
    const there = g.towers.find((t) => t.c === c && t.r === r);
    if (there) {
      setChosen(there.id);
      return;
    }
    setChosen(undefined);
    if (road.has(`${c},${r}`) || c < 0 || r < 0 || c >= TD_COLS || r >= TD_ROWS) return;
    const cost = TOWERS[pick].cost;
    if (g.money < cost) {
      setNews(`Ақша жетпейді: ${TOWERS[pick].name} ${cost} тұрады.`);
      return;
    }
    g.money -= cost;
    g.towers.push({ id: ++g.id, kind: pick, c, r, cool: 0 });
    burst(g.parts, (c + 0.5) * C, (r + 0.5) * C, TOWERS[pick].color, 12, 140);
    play("power");
    sync();
  };

  const sell = () => {
    const g = s.current;
    const t = g.towers.find((x) => x.id === chosen);
    if (!t) return;
    g.money += sellBack(TOWERS[t.kind].cost);
    g.towers = g.towers.filter((x) => x !== t);
    setChosen(undefined);
    sync();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["BUTTON", "INPUT", "A"].includes(target.tagName) && e.key === "Enter") return;
      const move: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (move[e.key] && document.activeElement?.tagName === "CANVAS") {
        e.preventDefault();
        const [dx, dy] = move[e.key]!;
        setCursor(([c, r]) => [Math.max(0, Math.min(TD_COLS - 1, c + dx)), Math.max(0, Math.min(TD_ROWS - 1, r + dy))]);
      }
      if ((e.key === "Enter" || e.key === " ") && document.activeElement?.tagName === "CANVAS") {
        e.preventDefault();
        place(cursorRef.current[0], cursorRef.current[1]);
      }
      if (e.key === "1") setPick("firewall");
      if (e.key === "2") setPick("antivirus");
      if (e.key === "3") setPick("scanner");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const ref = useCanvasLoop(W, H, (rawDt, ctx) => {
    const g = s.current;
    const dt = rawDt * (fastRef.current ? 2 : 1);
    g.flow += dt;

    if (g.phase === "wave") {
      g.clock += dt;
      while (g.queue.length && g.queue[0]!.at <= g.clock) {
        const q = g.queue.shift()!;
        const hp = THREATS[q.kind].hp * waveHp(g.wave);
        g.threats.push({ id: ++g.id, kind: q.kind, d: 0, hp, max: hp, slowT: 0, seen: !THREATS[q.kind].hidden });
      }
      const scanners = g.towers.filter((t) => t.kind === "scanner");
      for (const e of g.threats) {
        const [x, y] = pointAlong(e.d);
        e.seen = !THREATS[e.kind].hidden || scanners.some((t) => dist(t.c + 0.5, t.r + 0.5, x, y) <= TOWERS.scanner.range);
        const slow = e.slowT > 0 ? 1 - (TOWERS.scanner.slow ?? 0) : 1;
        e.d += THREATS[e.kind].speed * slow * dt;
        e.slowT = Math.max(0, e.slowT - dt);
      }
      // Towers fire at the visible threat furthest along the road.
      for (const t of g.towers) {
        t.cool -= dt;
        const spec = TOWERS[t.kind];
        const tx = t.c + 0.5;
        const ty = t.r + 0.5;
        const inRange = g.threats.filter((e) => {
          const [x, y] = pointAlong(e.d);
          return e.seen && dist(tx, ty, x, y) <= spec.range;
        });
        if (t.kind === "scanner") for (const e of inRange) e.slowT = 0.25;
        if (t.cool > 0 || !inRange.length) continue;
        const target = inRange.sort((a, b) => b.d - a.d)[0]!;
        const [x, y] = pointAlong(target.d);
        t.cool = 1 / spec.rate;
        target.hp -= spec.damage;
        if (spec.splash) {
          for (const e of g.threats) {
            if (e === target || !e.seen) continue;
            const [ex, ey] = pointAlong(e.d);
            if (dist(x, y, ex, ey) <= spec.splash) e.hp -= spec.damage * 0.6;
          }
          burst(g.parts, x * C, y * C, spec.color, 10, 120);
        }
        g.beams.push({ x1: tx * C, y1: ty * C, x2: x * C, y2: y * C, color: spec.color, life: t.kind === "scanner" ? 0.12 : 0.09 });
        if (t.kind === "firewall") play("shoot");
      }
      for (const e of [...g.threats]) {
        if (e.hp <= 0) {
          const [x, y] = pointAlong(e.d);
          const reward = THREATS[e.kind].reward;
          g.money += reward;
          g.earned += reward;
          burst(g.parts, x * C, y * C, THREATS[e.kind].color, e.kind === "ransom" ? 60 : 14, e.kind === "ransom" ? 380 : 200);
          if (e.kind === "ransom") {
            g.shake = 14;
            play("boom");
          } else play("squash");
          g.threats = g.threats.filter((x) => x !== e);
        } else if (e.d >= PATH_LENGTH) {
          g.lives -= THREATS[e.kind].harm;
          g.shake = 9;
          burst(g.parts, (TD_COLS - 0.5) * C, (TD_ROWS - 1.5) * C, "#ff3d7f", 16);
          play("hit");
          g.threats = g.threats.filter((x) => x !== e);
        }
      }
      if (g.lives <= 0) {
        g.lives = 0;
        g.phase = "lost";
        play("lose");
        sync();
        window.setTimeout(() => end.current(finalScore()), 1400);
      } else if (!g.queue.length && !g.threats.length) {
        g.wave++;
        if (g.wave >= WAVES.length) {
          g.phase = "won";
          play("power");
          sync();
          window.setTimeout(() => end.current(finalScore()), 1600);
        } else {
          const bonus = 25 + g.wave * 6;
          g.money += bonus;
          g.phase = "build";
          setNews(`Толқын тоқтатылды! +${bonus} бонус. Қорғанысты күшейт те, келесі толқынды баста.`);
          sync();
        }
      }
    }
    g.shake = Math.max(0, g.shake - rawDt * 40);

    // ---- draw
    ctx.save();
    if (g.shake) ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
    ctx.fillStyle = "#0e1424";
    ctx.fillRect(-20, -20, W + 40, H + 40);
    for (let c = 0; c < TD_COLS; c++)
      for (let r = 0; r < TD_ROWS; r++) {
        const onRoad = road.has(`${c},${r}`);
        ctx.fillStyle = onRoad ? "#25305a" : (c + r) % 2 ? "#131b31" : "#111829";
        ctx.fillRect(c * C, r * C, C, C);
      }
    // The road's moving packets of light.
    ctx.strokeStyle = "rgba(50,224,255,0.35)";
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 14]);
    ctx.lineDashOffset = -g.flow * 40;
    ctx.beginPath();
    for (let d = 0; d <= PATH_LENGTH; d += 0.25) {
      const [x, y] = pointAlong(d);
      if (d === 0) ctx.moveTo(x * C, y * C);
      else ctx.lineTo(x * C, y * C);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Internet and the server.
    const [sx, sy] = pointAlong(0);
    ctx.fillStyle = "#3a4472";
    ctx.beginPath();
    ctx.arc(26, sy * C, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "800 8px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("ИНТЕРНЕТ", 26, sy * C);
    const [ex, ey] = pointAlong(PATH_LENGTH);
    ctx.fillStyle = g.lives > 6 ? "#2c7a4b" : "#8a1f17";
    ctx.fillRect(ex * C - 22, ey * C - 26, 44, 52);
    ctx.fillStyle = "#b6ff3d";
    for (let k = 0; k < 4; k++) ctx.fillRect(ex * C - 16, ey * C - 20 + k * 12, 6, 4);
    ctx.fillStyle = "#fff";
    ctx.font = "800 12px system-ui, sans-serif";
    ctx.fillText(`♥${g.lives}`, ex * C + 4, ey * C + 34);

    const showRange = (c: number, r: number, range: number, color: string) => {
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc((c + 0.5) * C, (r + 0.5) * C, range * C, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = color;
      ctx.fill();
      ctx.globalAlpha = 1;
    };

    for (const t of g.towers) {
      const spec = TOWERS[t.kind];
      if (t.id === chosen) showRange(t.c, t.r, spec.range, spec.color);
      ctx.fillStyle = "#0c0a14";
      ctx.fillRect(t.c * C + 6, t.r * C + 6, C - 12, C - 12);
      ctx.strokeStyle = spec.color;
      ctx.lineWidth = 3;
      ctx.shadowColor = spec.color;
      ctx.shadowBlur = 10;
      ctx.strokeRect(t.c * C + 6, t.r * C + 6, C - 12, C - 12);
      ctx.shadowBlur = 0;
      ctx.fillStyle = spec.color;
      ctx.font = "800 24px system-ui, sans-serif";
      ctx.fillText(spec.glyph, (t.c + 0.5) * C, (t.r + 0.5) * C + 1);
    }
    const ghost = hover ?? cursor;
    if (g.phase === "build" || g.phase === "wave") {
      const [c, r] = ghost;
      const free = !road.has(`${c},${r}`) && !g.towers.some((t) => t.c === c && t.r === r);
      ctx.strokeStyle = free ? "#fff" : "#ff3d7f";
      ctx.lineWidth = 2;
      ctx.strokeRect(c * C + 2, r * C + 2, C - 4, C - 4);
      if (free) showRange(c, r, TOWERS[pick].range, TOWERS[pick].color);
    }

    for (const e of g.threats) {
      const [x, y] = pointAlong(e.d);
      const px = x * C;
      const py = y * C;
      const spec = THREATS[e.kind];
      ctx.globalAlpha = e.seen ? 1 : 0.22;
      ctx.fillStyle = spec.color;
      ctx.shadowColor = spec.color;
      ctx.shadowBlur = e.seen ? 10 : 0;
      if (e.kind === "spam") {
        ctx.fillRect(px - 11, py - 8, 22, 16);
        ctx.strokeStyle = "#0c0a14";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(px - 11, py - 8);
        ctx.lineTo(px, py + 1);
        ctx.lineTo(px + 11, py - 8);
        ctx.stroke();
      } else if (e.kind === "worm") {
        for (let k = 0; k < 4; k++) {
          ctx.beginPath();
          ctx.arc(px - k * 7, py + Math.sin(g.flow * 10 + k) * 3, 6 - k * 0.8, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (e.kind === "ddos") {
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.kind === "trojan") {
        ctx.beginPath();
        ctx.moveTo(px - 12, py + 10);
        ctx.lineTo(px - 8, py - 6);
        ctx.lineTo(px + 6, py - 12);
        ctx.lineTo(px + 12, py - 4);
        ctx.lineTo(px + 8, py + 10);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillRect(px - 18, py - 8, 36, 26);
        ctx.strokeStyle = spec.color;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(px, py - 8, 11, Math.PI, 0);
        ctx.stroke();
        ctx.fillStyle = "#0c0a14";
        ctx.font = "800 11px system-ui, sans-serif";
        ctx.fillText("$$$", px, py + 6);
      }
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      if (e.seen && e.hp < e.max) {
        const w = e.kind === "ransom" ? 44 : 24;
        ctx.fillStyle = "#3a0d16";
        ctx.fillRect(px - w / 2, py - 22, w, 4);
        ctx.fillStyle = "#b6ff3d";
        ctx.fillRect(px - w / 2, py - 22, (w * Math.max(0, e.hp)) / e.max, 4);
      }
    }
    for (let i = g.beams.length - 1; i >= 0; i--) {
      const b = g.beams[i]!;
      b.life -= rawDt;
      if (b.life <= 0) {
        g.beams.splice(i, 1);
        continue;
      }
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 3;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    stepParticles(g.parts, rawDt, ctx);
    if (g.phase === "won" || g.phase === "lost") {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = g.phase === "won" ? "#b6ff3d" : "#ff3d7f";
      ctx.font = "900 46px system-ui, sans-serif";
      ctx.fillText(g.phase === "won" ? "СЕРВЕР АМАН!" : "СЕРВЕР ҚҰЛАДЫ", W / 2, H / 2);
    }
    ctx.restore();

    hudAt.current += rawDt;
    if (hudAt.current > 0.15) {
      hudAt.current = 0;
      sync();
    }
  });

  const cell = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const [x, y] = logicalPoint(e, e.currentTarget, W, H);
    return [Math.floor(x / C), Math.floor(y / C)];
  };

  const chosenTower = s.current.towers.find((t) => t.id === chosen);
  const canBuild = hud.phase === "build" || hud.phase === "wave";

  return (
    <div className={styles.actionGame} data-phase={hud.phase} data-money={hud.money}>
      <div className={styles.hud}>
        <span>
          Ақша <b data-testid="money">{hud.money}</b>
        </span>
        <span>
          Толқын <b>{Math.min(hud.wave + (hud.phase === "wave" ? 1 : 0), WAVES.length)}</b>/{WAVES.length}
        </span>
        <span>
          Сервер <b>♥ {hud.lives}</b>
        </span>
        <span>
          Ұпай <b data-testid="score">{hud.earned + hud.wave * 100}</b>
        </span>
      </div>

      <div className={styles.toolbar} role="group" aria-label="Қорғаныс құралдары">
        {(Object.keys(TOWERS) as TowerKind[]).map((k, i) => (
          <button key={k} type="button" aria-pressed={pick === k} disabled={!canBuild} onClick={() => setPick(k)} title={TOWERS[k].note} style={{ ["--tc" as string]: TOWERS[k].color }}>
            <span aria-hidden>{TOWERS[k].glyph}</span> {TOWERS[k].name} <small>{TOWERS[k].cost}₸</small> <kbd>{i + 1}</kbd>
          </button>
        ))}
        <button type="button" className={styles.play} disabled={hud.phase !== "build"} onClick={startWave}>
          ▶ {hud.phase === "wave" ? "Толқын жүріп жатыр" : `${hud.wave + 1}-толқынды бастау`}
        </button>
        <button type="button" aria-pressed={fast} onClick={() => setFast((f) => !f)}>
          ⏩ ×2
        </button>
      </div>
      <p className={styles.towerNote}>
        <b>{TOWERS[pick].name}:</b> {TOWERS[pick].note}
      </p>

      <canvas
        ref={ref}
        tabIndex={0}
        className={styles.canvas}
        style={{ aspectRatio: `${W} / ${H}`, cursor: "pointer" }}
        role="img"
        aria-label={`Брандмауэр қорғанысы. Ақша ${hud.money}, сервер өмірі ${hud.lives}, толқын ${hud.wave + 1}. Бағыттау пернелерімен ұяшық таңда, Enter: құрал қою. Курсор: ${cursor[0] + 1}-баған, ${cursor[1] + 1}-қатар.`}
        onPointerDown={(e) => {
          const [c, r] = cell(e);
          setCursor([c, r]);
          place(c, r);
        }}
        onPointerMove={(e) => setHover(cell(e))}
        onPointerLeave={() => setHover(undefined)}
      />

      {chosenTower && (
        <div className={styles.towerNote}>
          <b>{TOWERS[chosenTower.kind].name}</b> ({chosenTower.c + 1}, {chosenTower.r + 1}){" "}
          <button type="button" className={styles.back} onClick={sell}>
            Сату +{sellBack(TOWERS[chosenTower.kind].cost)}₸
          </button>
        </div>
      )}
      {news && (
        <p className={styles.news} role="status">
          {news}
        </p>
      )}
    </div>
  );
}
