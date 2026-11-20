import type { AssessmentResult, SimulationPlugin } from "@inside-tech/sim-core";
import { EFFECT_TEXT, TRIGGER_TEXT, initialGame, sanitizeLevel, spawn, tickGame, type AiParams, type Effect, type EnemyState, type GameState, type Tile, type Trigger, GRID } from "./game";
import { ARENA, THIN_WALL, stepPhysics, type Ball, type PhysicsParams, type PhysicsWorld } from "./physics";
import { reparent, starterScene, type Entity, type V3 } from "./scene";

export interface CameraParams {
  projection: "perspective" | "orthographic";
  fov: number;
  /** Orthographic half-height in world units. */
  orthoSize: number;
  follow: boolean;
  distance: number;
  height: number;
  view: "editor" | "game";
}

export interface LoopDemo {
  useDeltaTime: boolean;
  /** Units per second when using delta time. */
  speed: number;
  /** Units per frame when NOT using delta time (tuned so 60 fps matches `speed`). */
  perFrame: number;
  fps: number[];
  positions: number[];
  frames: number[];
  acc: number[];
  t: number;
  duration: number;
  running: boolean;
}

export interface GraphicsParams {
  ambient: number;
  directional: number;
  point: number;
  color: string;
  roughness: number;
  metalness: number;
  emissive: number;
  flatShading: boolean;
}

export interface GameStats {
  selected: number[];
  parentMoved: boolean;
  parentScaled: boolean;
  reparented: boolean;
  /** Ids attached to a new parent, and whether such a parent was moved afterwards. */
  attached: number[];
  movedWithAttached: boolean;
  viewedGame: boolean;
  fovs: number[];
  usedOrtho: boolean;
  followUsed: boolean;
  loopMismatch: boolean;
  loopMatch: boolean;
  drops: number;
  maxBounceRatio: number;
  restitutions: number[];
  gravities: number[];
  collisions: number;
  tunneled: boolean;
  blockedFast: boolean;
  graphicsSeen: string[];
  rulesAdded: number;
  coinsCollected: number;
  enemyStates: EnemyState[];
  wins: number;
  losses: number;
  levelEdits: number;
  movedPlayer: boolean;
  /** Restitution in effect at the latest real bounce (problem set). */
  lastBounceE: number | null;
  /** Fast throws and whether the thin wall stopped them, with the substeps used. */
  throwLog: { speed: number; substeps: number; result: "blocked" | "tunneled" }[];
  /** Levels (rows joined by "/") on which the learner has won. */
  wonLevels: string[];
}

export interface GameLabState {
  scene: { entities: Entity[]; selected: number | null; time: number; carSpin: boolean };
  camera: CameraParams;
  loop: LoopDemo;
  physics: PhysicsWorld;
  graphics: GraphicsParams;
  game: GameState;
  stats: GameStats;
}

export type GameLabAction =
  | { type: "scene/select"; id: number | null }
  | { type: "scene/set"; id: number; patch: Partial<Pick<Entity, "pos" | "rotY" | "scale" | "color">> }
  | { type: "scene/reparent"; id: number; parent: number | null }
  | { type: "scene/spin"; on: boolean }
  | { type: "camera/set"; patch: Partial<CameraParams> }
  | { type: "loop/set"; patch: Partial<Pick<LoopDemo, "useDeltaTime" | "speed">> }
  | { type: "loop/run" }
  | { type: "physics/set"; patch: Partial<PhysicsParams> }
  | { type: "physics/drop"; x?: number; z?: number; height?: number }
  | { type: "physics/throw"; speed: number }
  | { type: "physics/clear" }
  | { type: "physics/toggle"; running: boolean }
  | { type: "physics/wall"; on: boolean }
  | { type: "graphics/set"; patch: Partial<GraphicsParams> }
  | { type: "game/rule/add"; when: Trigger; then: Effect }
  | { type: "game/rule/remove"; id: number }
  | { type: "game/ai"; patch: Partial<AiParams> }
  | { type: "game/speed"; player: number }
  | { type: "game/start" }
  | { type: "game/reset" }
  | { type: "game/input"; key: "up" | "down" | "left" | "right"; down: boolean }
  | { type: "game/tile"; i: number; j: number; tile: Tile }
  | { type: "game/level"; level: string[] };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo));
const uniq = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs : [...xs, x]);

const emptyStats = (): GameStats => ({
  selected: [],
  parentMoved: false,
  parentScaled: false,
  reparented: false,
  attached: [],
  movedWithAttached: false,
  viewedGame: false,
  fovs: [],
  usedOrtho: false,
  followUsed: false,
  loopMismatch: false,
  loopMatch: false,
  drops: 0,
  maxBounceRatio: 0,
  restitutions: [],
  gravities: [],
  collisions: 0,
  tunneled: false,
  blockedFast: false,
  graphicsSeen: [],
  rulesAdded: 0,
  coinsCollected: 0,
  enemyStates: [],
  wins: 0,
  losses: 0,
  levelEdits: 0,
  movedPlayer: false,
  lastBounceE: null,
  throwLog: [],
  wonLevels: [],
});

function newLoop(useDeltaTime: boolean, speed: number): LoopDemo {
  const fps = [30, 60, 144];
  return { useDeltaTime, speed, perFrame: speed / 60, fps, positions: fps.map(() => 0), frames: fps.map(() => 0), acc: fps.map(() => 0), t: 0, duration: 3, running: false };
}

export function initialGameLabState(_seed: number): GameLabState {
  return {
    scene: { entities: starterScene(), selected: null, time: 0, carSpin: false },
    camera: { projection: "perspective", fov: 50, orthoSize: 5, follow: false, distance: 6, height: 3, view: "editor" },
    loop: newLoop(false, 2),
    physics: { balls: [], walls: [], params: { gravity: 9.8, restitution: 0.6, friction: 0.2, substeps: 4 }, time: 0, running: true, nextId: 1 },
    graphics: { ambient: 0.4, directional: 1.2, point: 0, color: "#2f5bea", roughness: 0.5, metalness: 0, emissive: 0, flatShading: false },
    game: initialGame(),
    stats: emptyStats(),
  };
}

/** Where the car is at scene time t when spinning (circle of radius 3). */
export function carPath(t: number): { pos: V3; rotY: number } {
  const a = t * 0.6;
  return { pos: [Math.cos(a) * 3, 0.5, Math.sin(a) * 3], rotY: (-a * 180) / Math.PI - 90 };
}

function stepLoop(l: LoopDemo, dt: number): LoopDemo {
  if (!l.running) return l;
  const t = Math.min(l.duration, l.t + dt);
  const real = t - l.t;
  const positions = [...l.positions];
  const frames = [...l.frames];
  const acc = l.acc.map((a, i) => {
    let left = a + real;
    const frameDt = 1 / l.fps[i]!;
    while (left >= frameDt - 1e-9) {
      left -= frameDt;
      frames[i]!++;
      positions[i]! += l.useDeltaTime ? l.speed * frameDt : l.perFrame;
    }
    return left;
  });
  return { ...l, t, positions, frames, acc, running: t < l.duration };
}

function reduce(s: GameLabState, a: GameLabAction): GameLabState {
  const st = s.stats;
  switch (a.type) {
    case "scene/select":
      if (a.id !== null && !s.scene.entities.some((e) => e.id === a.id)) return s;
      return { ...s, scene: { ...s.scene, selected: a.id }, stats: a.id === null ? st : { ...st, selected: uniq(st.selected, a.id) } };
    case "scene/set": {
      const e = s.scene.entities.find((x) => x.id === a.id);
      if (!e) return s;
      const p = a.patch;
      const next: Entity = {
        ...e,
        ...(p.pos ? { pos: p.pos.map((v) => clamp(v, -8, 8)) as V3 } : {}),
        ...(p.rotY !== undefined ? { rotY: clamp(p.rotY, -360, 360) } : {}),
        ...(p.scale !== undefined ? { scale: clamp(p.scale, 0.2, 3) } : {}),
        ...(p.color && /^#[0-9a-f]{6}$/i.test(p.color) ? { color: p.color } : {}),
      };
      const hasKids = s.scene.entities.some((x) => x.parent === a.id);
      const carriesAttached = !!p.pos && s.scene.entities.some((x) => x.parent === a.id && st.attached.includes(x.id));
      return {
        ...s,
        scene: { ...s.scene, entities: s.scene.entities.map((x) => (x.id === a.id ? next : x)) },
        stats: { ...st, movedWithAttached: st.movedWithAttached || carriesAttached, parentMoved: st.parentMoved || (hasKids && !!p.pos), parentScaled: st.parentScaled || (hasKids && p.scale !== undefined && p.scale !== 1) },
      };
    }
    case "scene/reparent": {
      if (a.id === 1 || a.parent === a.id) return s;
      const entities = reparent(s.scene.entities, a.id, a.parent);
      if (entities === s.scene.entities) return s;
      return { ...s, scene: { ...s.scene, entities }, stats: { ...st, reparented: true, attached: a.parent === null ? st.attached.filter((x) => x !== a.id) : uniq(st.attached, a.id) } };
    }
    case "scene/spin":
      return { ...s, scene: { ...s.scene, carSpin: a.on } };

    case "camera/set": {
      const c = { ...s.camera };
      const p = a.patch;
      if (p.projection) c.projection = p.projection === "orthographic" ? "orthographic" : "perspective";
      if (p.fov !== undefined) c.fov = Math.round(clamp(p.fov, 15, 120));
      if (p.orthoSize !== undefined) c.orthoSize = clamp(p.orthoSize, 1, 15);
      if (p.follow !== undefined) c.follow = !!p.follow;
      if (p.distance !== undefined) c.distance = clamp(p.distance, 2, 15);
      if (p.height !== undefined) c.height = clamp(p.height, 0.5, 10);
      if (p.view) c.view = p.view === "game" ? "game" : "editor";
      return {
        ...s,
        camera: c,
        scene: c.follow && !s.scene.carSpin ? { ...s.scene, carSpin: true } : s.scene,
        stats: {
          ...st,
          viewedGame: st.viewedGame || c.view === "game",
          fovs: p.fov !== undefined ? uniq(st.fovs, c.fov) : st.fovs,
          usedOrtho: st.usedOrtho || (c.projection === "orthographic" && c.view === "game"),
          followUsed: st.followUsed || (c.follow && c.view === "game"),
        },
      };
    }

    case "loop/set": {
      const useDeltaTime = a.patch.useDeltaTime ?? s.loop.useDeltaTime;
      const speed = clamp(a.patch.speed ?? s.loop.speed, 0.5, 5);
      return { ...s, loop: newLoop(useDeltaTime, speed) };
    }
    case "loop/run":
      return { ...s, loop: { ...newLoop(s.loop.useDeltaTime, s.loop.speed), running: true } };

    case "physics/set": {
      const p = { ...s.physics.params };
      if (a.patch.gravity !== undefined) p.gravity = clamp(a.patch.gravity, 0, 30);
      if (a.patch.restitution !== undefined) p.restitution = clamp(a.patch.restitution, 0, 1);
      if (a.patch.friction !== undefined) p.friction = clamp(a.patch.friction, 0, 1);
      if (a.patch.substeps !== undefined) p.substeps = Math.round(clamp(a.patch.substeps, 1, 16));
      return {
        ...s,
        physics: { ...s.physics, params: p },
        stats: {
          ...st,
          restitutions: a.patch.restitution !== undefined ? uniq(st.restitutions, Math.round(p.restitution * 10) / 10) : st.restitutions,
          gravities: a.patch.gravity !== undefined ? uniq(st.gravities, Math.round(p.gravity * 10) / 10) : st.gravities,
        },
      };
    }
    case "physics/drop": {
      if (s.physics.balls.length >= 30) return s;
      const id = s.physics.nextId;
      const colors = ["#2f5bea", "#ee9a22", "#17895c", "#c23b3b", "#6d8cff"];
      const ball: Ball = { id, pos: [clamp(a.x ?? 0, -5, 5), clamp(a.height ?? 4, 0.5, 10), clamp(a.z ?? 0, -5, 5)], vel: [0, 0, 0], r: 0.35, mass: 1, color: colors[id % colors.length]! };
      return { ...s, physics: { ...s.physics, balls: [...s.physics.balls, ball], nextId: id + 1, running: true }, stats: { ...st, drops: st.drops + 1 } };
    }
    case "physics/throw": {
      const id = s.physics.nextId;
      const ball: Ball = { id, pos: [-5, 1, 0], vel: [clamp(a.speed, 1, 80), 0, 0], r: 0.25, mass: 1, color: "#c23b3b" };
      return { ...s, physics: { ...s.physics, balls: [...s.physics.balls.filter((b) => b.pos[0] < 5.5 || b.vel[0] !== 0).slice(-20), ball], nextId: id + 1, running: true } };
    }
    case "physics/clear":
      return { ...s, physics: { ...s.physics, balls: [] } };
    case "physics/toggle":
      return { ...s, physics: { ...s.physics, running: a.running } };
    case "physics/wall":
      return { ...s, physics: { ...s.physics, walls: a.on ? [THIN_WALL] : [] } };

    case "graphics/set": {
      const g = { ...s.graphics };
      const p = a.patch;
      if (p.ambient !== undefined) g.ambient = clamp(p.ambient, 0, 2);
      if (p.directional !== undefined) g.directional = clamp(p.directional, 0, 3);
      if (p.point !== undefined) g.point = clamp(p.point, 0, 40);
      if (p.color && /^#[0-9a-f]{6}$/i.test(p.color)) g.color = p.color;
      if (p.roughness !== undefined) g.roughness = clamp(p.roughness, 0, 1);
      if (p.metalness !== undefined) g.metalness = clamp(p.metalness, 0, 1);
      if (p.emissive !== undefined) g.emissive = clamp(p.emissive, 0, 2);
      if (p.flatShading !== undefined) g.flatShading = !!p.flatShading;
      let seen = st.graphicsSeen;
      if (g.ambient > 0 && g.directional === 0 && g.point === 0) seen = uniq(seen, "ambientOnly");
      if (g.directional > 0 && g.ambient <= 0.15) seen = uniq(seen, "directionalOnly");
      if (g.point > 0) seen = uniq(seen, "point");
      if (g.metalness >= 0.8 && g.roughness <= 0.25) seen = uniq(seen, "shiny");
      if (g.emissive >= 0.8) seen = uniq(seen, "glow");
      if (g.flatShading) seen = uniq(seen, "flat");
      return { ...s, graphics: g, stats: { ...st, graphicsSeen: seen } };
    }

    case "game/rule/add": {
      if (!(a.when in TRIGGER_TEXT) || !(a.then in EFFECT_TEXT)) return s;
      if (s.game.rules.some((r) => r.when === a.when && r.then === a.then) || s.game.rules.length >= 12) return s;
      const rule = { id: s.game.nextRuleId, when: a.when, then: a.then };
      return { ...s, game: { ...s.game, rules: [...s.game.rules, rule], nextRuleId: rule.id + 1 }, stats: { ...st, rulesAdded: st.rulesAdded + 1 } };
    }
    case "game/rule/remove":
      return { ...s, game: { ...s.game, rules: s.game.rules.filter((r) => r.id !== a.id) } };
    case "game/ai": {
      const ai = { ...s.game.ai };
      if (a.patch.chaseRadius !== undefined) ai.chaseRadius = clamp(a.patch.chaseRadius, 0, 10);
      if (a.patch.giveUpRadius !== undefined) ai.giveUpRadius = clamp(a.patch.giveUpRadius, 0, 12);
      if (a.patch.enemySpeed !== undefined) ai.enemySpeed = clamp(a.patch.enemySpeed, 0, 5);
      return { ...s, game: { ...s.game, ai } };
    }
    case "game/speed":
      return { ...s, game: { ...s.game, playerSpeed: clamp(a.player, 0.5, 6) } };
    case "game/start":
      return { ...s, game: { ...spawn(s.game), status: "playing", input: { up: false, down: false, left: false, right: false } } };
    case "game/reset":
      return { ...s, game: { ...spawn(s.game), status: "ready" } };
    case "game/input":
      if (!["up", "down", "left", "right"].includes(a.key)) return s;
      return { ...s, game: { ...s.game, input: { ...s.game.input, [a.key]: !!a.down } } };
    case "game/tile": {
      if (a.i <= 0 || a.j <= 0 || a.i >= GRID - 1 || a.j >= GRID - 1 || !".#cep".includes(a.tile)) return s;
      let level = s.game.level.map((row, j) => (j === a.j ? row.slice(0, a.i) + a.tile + row.slice(a.i + 1) : row));
      if (a.tile === "p") level = level.map((row, j) => [...row].map((ch, i) => (ch === "p" && !(i === a.i && j === a.j) ? "." : ch)).join(""));
      level = sanitizeLevel(level);
      return { ...s, game: { ...spawn({ ...s.game, level }), status: "ready" }, stats: { ...st, levelEdits: st.levelEdits + 1 } };
    }
    case "game/level":
      return { ...s, game: { ...spawn({ ...s.game, level: sanitizeLevel(a.level) }), status: "ready" } };
  }
}

export function evaluateGameLab(s: GameLabState): AssessmentResult {
  return {
    score: s.game.score,
    metrics: {
      coinsLeft: s.game.coins.filter((c) => !c.taken).length,
      score: s.game.score,
      balls: s.physics.balls.length,
      loopSpread: Math.max(...s.loop.positions) - Math.min(...s.loop.positions),
    },
    notes: [],
  };
}

export const gameLabPlugin: SimulationPlugin<GameLabState, GameLabAction> = {
  id: "game-lab",
  version: "1.0.0",
  initialize: initialGameLabState,
  dispatch: reduce,
  step(s, dt) {
    let next = s;
    // Scene time (car on its circular path)
    if (s.scene.carSpin) {
      const time = s.scene.time + dt;
      const { pos, rotY } = carPath(time);
      next = { ...next, scene: { ...next.scene, time, entities: next.scene.entities.map((e) => (e.id === 2 ? { ...e, pos, rotY } : e)) } };
    }
    // Delta-time demo
    if (s.loop.running) {
      const loop = stepLoop(s.loop, dt);
      let stats = next.stats;
      if (!loop.running) {
        const spread = Math.max(...loop.positions) - Math.min(...loop.positions);
        stats = loop.useDeltaTime ? (spread < 0.05 ? { ...stats, loopMatch: true } : stats) : spread > 1 ? { ...stats, loopMismatch: true } : stats;
      }
      next = { ...next, loop, stats };
    }
    // Physics
    if (s.physics.running && s.physics.balls.length) {
      const { world, events } = stepPhysics(s.physics, dt);
      let stats = next.stats;
      if (events.collisions) stats = { ...stats, collisions: stats.collisions + events.collisions };
      if (events.tunneled.length) stats = { ...stats, tunneled: true };
      const log = (result: "blocked" | "tunneled", balls: Ball[]) => {
        for (const b of balls) stats = { ...stats, throwLog: [...stats.throwLog, { speed: Math.round(b.vel[0]), substeps: s.physics.params.substeps, result }].slice(-20) };
      };
      log("tunneled", s.physics.balls.filter((b) => events.tunneled.includes(b.id)));
      // A fast ball stopped by the thin wall: it is left of the wall and moving left after a hit.
      if (events.wallHits && world.walls.length && world.balls.some((b) => b.r === 0.25 && b.pos[0] < THIN_WALL.min[0] && b.vel[0] < 0)) {
        const fast = s.physics.balls.some((b) => b.r === 0.25 && b.vel[0] > 30);
        if (fast) stats = { ...stats, blockedFast: true };
        log("blocked", s.physics.balls.filter((b) => b.r === 0.25 && b.vel[0] > 30 && world.balls.some((w) => w.id === b.id && w.vel[0] < 0)));
      }
      for (const b of events.bounces) {
        const ball = s.physics.balls.find((x) => x.id === b.id);
        if (ball && b.speed > 2) {
          // Ratio of rebound to impact speed = coefficient of restitution actually observed.
          stats = { ...stats, maxBounceRatio: Math.max(stats.maxBounceRatio, world.params.restitution), lastBounceE: world.params.restitution };
        }
      }
      // Remove balls that tunnelled out of the arena or came to rest long ago: keep the world small.
      next = { ...next, physics: { ...world, balls: world.balls.filter((b) => Math.abs(b.pos[0]) <= ARENA + 1) }, stats };
    }
    // Game
    if (s.game.status === "playing") {
      const { game, events } = tickGame(next.game, dt);
      let stats = next.stats;
      if (events.coins) stats = { ...stats, coinsCollected: stats.coinsCollected + events.coins };
      for (const e of events.states) stats = { ...stats, enemyStates: uniq(stats.enemyStates, e) };
      if (events.moved) stats = { ...stats, movedPlayer: true };
      if (game.status === "won") stats = { ...stats, wins: stats.wins + 1, wonLevels: [...stats.wonLevels, game.level.join("/")].slice(-5) };
      if (game.status === "lost") stats = { ...stats, losses: stats.losses + 1 };
      next = { ...next, game, stats };
    }
    return next;
  },
  snapshot: (s) => structuredClone(s),
  restore: (snap) => structuredClone(snap as GameLabState),
  evaluate: evaluateGameLab,
};
