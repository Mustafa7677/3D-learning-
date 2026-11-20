import { describe, expect, it } from "vitest";
import { SimulationRuntime, replay } from "@inside-tech/sim-core";
import { LessonEngine } from "@inside-tech/lesson-engine";
import {
  GRID,
  cellCenter,
  gameLabPlugin,
  gameLessons,
  initialGame,
  kineticEnergy,
  reparent,
  starterScene,
  stepPhysics,
  tickGame,
  worldTransform,
  type GameLabAction,
  type GameLabState,
  type PhysicsWorld,
} from "./index";

describe("scene graph", () => {
  it("composes parent transforms", () => {
    const e = starterScene();
    const wheel = worldTransform(e, 4);
    expect(wheel.pos[0]).toBeCloseTo(-2 + 0.7);
    const rotated = e.map((x) => (x.id === 2 ? { ...x, rotY: 90, scale: 2 } : x));
    const w = worldTransform(rotated, 4);
    // local (0.7, -0.3, 0.55) scaled ×2 and rotated 90° about Y around the car at (-2, 0.5, 0)
    expect(w.pos[0]).toBeCloseTo(-2 + 1.1);
    expect(w.pos[1]).toBeCloseTo(0.5 - 0.6);
    expect(w.pos[2]).toBeCloseTo(-1.4);
    expect(w.scale).toBe(2);
  });
  it("reparenting keeps the world position and refuses cycles", () => {
    const e = starterScene();
    const before = worldTransform(e, 7).pos;
    const attached = reparent(e, 7, 2);
    expect(attached.find((x) => x.id === 7)!.parent).toBe(2);
    worldTransform(attached, 7).pos.forEach((v, i) => expect(v).toBeCloseTo(before[i]!, 3));
    expect(reparent(e, 2, 4)).toBe(e);
  });
});

describe("physics", () => {
  const world = (over: Partial<PhysicsWorld> = {}): PhysicsWorld => ({
    balls: [],
    walls: [],
    params: { gravity: 9.8, restitution: 0.6, friction: 0, substeps: 4 },
    time: 0,
    running: true,
    nextId: 1,
    ...over,
  });
  it("a dropped ball falls with g and bounces lower each time", () => {
    let w = world({ balls: [{ id: 1, pos: [0, 4, 0], vel: [0, 0, 0], r: 0.35, mass: 1, color: "#fff" }] });
    const peaks: number[] = [];
    let prevVy = 0;
    for (let i = 0; i < 60 * 6; i++) {
      w = stepPhysics(w, 1 / 60).world;
      const vy = w.balls[0]!.vel[1];
      if (prevVy > 0 && vy <= 0) peaks.push(w.balls[0]!.pos[1]);
      prevVy = vy;
    }
    expect(peaks.length).toBeGreaterThanOrEqual(2);
    expect(peaks[1]!).toBeLessThan(peaks[0]!);
    expect(peaks[0]!).toBeLessThan(4);
  });
  it("energy never increases with restitution ≤ 1", () => {
    let w = world({ params: { gravity: 9.8, restitution: 1, friction: 0, substeps: 8 }, balls: [{ id: 1, pos: [0, 3, 0], vel: [1, 0, 0.5], r: 0.35, mass: 1, color: "#fff" }, { id: 2, pos: [0.3, 1, 0.2], vel: [0, 0, 0], r: 0.35, mass: 1, color: "#fff" }] });
    const e0 = kineticEnergy(w);
    for (let i = 0; i < 300; i++) w = stepPhysics(w, 1 / 60).world;
    expect(kineticEnergy(w)).toBeLessThanOrEqual(e0 * 1.02);
  });
});

describe("arena game", () => {
  it("ignores input without a movement rule and moves with one", () => {
    const g = { ...initialGame(), status: "playing" as const, input: { up: false, down: true, left: false, right: false } };
    expect(tickGame(g, 0.5).game.player).toEqual(g.player);
    const ruled = { ...g, rules: [{ id: 1, when: "keys" as const, then: "movePlayer" as const }] };
    expect(tickGame(ruled, 0.5).game.player.z).toBeGreaterThan(g.player.z);
  });
  it("walls stop the player", () => {
    const g = { ...initialGame(), status: "playing" as const, rules: [{ id: 1, when: "keys" as const, then: "movePlayer" as const }], input: { up: true, down: false, left: false, right: false } };
    let cur: ReturnType<typeof initialGame> = g;
    for (let i = 0; i < 120; i++) cur = tickGame(cur, 1 / 60).game;
    expect(cur.player.z).toBeGreaterThan(cellCenter(1, 1)[1] - 0.25);
  });
});

describe("game-lab plugin", () => {
  it("replays a play session exactly", () => {
    const rt = new SimulationRuntime(gameLabPlugin, 1);
    rt.dispatch({ type: "game/rule/add", when: "keys", then: "movePlayer" });
    rt.dispatch({ type: "game/start" });
    rt.dispatch({ type: "game/input", key: "down", down: true });
    rt.stepTicks(90);
    rt.dispatch({ type: "physics/drop" });
    rt.stepTicks(30);
    expect(replay(gameLabPlugin, rt.record())).toEqual(rt.getState());
  });
});

// ---------------- lesson bots ----------------

type D = (a: GameLabAction) => void;
interface Bot {
  d: D;
  s: () => GameLabState;
  tick: (n: number) => void;
}

/** Walk the player through grid cells in straight, axis-aligned segments. */
function walk(bot: Bot, cells: [number, number][]) {
  for (const [ci, cj] of cells) {
    const [tx, tz] = cellCenter(ci, cj);
    for (let guard = 0; guard < 600; guard++) {
      const p = bot.s().game.player;
      if (bot.s().game.status !== "playing") return;
      const dx = tx - p.x;
      const dz = tz - p.z;
      if (Math.abs(dx) < 0.05 && Math.abs(dz) < 0.05) break;
      const key = Math.abs(dx) >= 0.05 ? (dx > 0 ? "right" : "left") : dz > 0 ? "down" : "up";
      for (const k of ["up", "down", "left", "right"] as const) bot.d({ type: "game/input", key: k, down: k === key });
      bot.tick(1);
    }
    for (const k of ["up", "down", "left", "right"] as const) bot.d({ type: "game/input", key: k, down: false });
  }
}

const allRules: [GameLabAction & { type: "game/rule/add" }][number][] = [
  { type: "game/rule/add", when: "keys", then: "movePlayer" },
  { type: "game/rule/add", when: "touchCoin", then: "collectCoin" },
  { type: "game/rule/add", when: "touchCoin", then: "addScore" },
  { type: "game/rule/add", when: "allCoins", then: "win" },
  { type: "game/rule/add", when: "touchEnemy", then: "lose" },
];

const scripts: Record<string, Record<string, (b: Bot) => void>> = {
  "game-1-objects": {
    select: ({ d }) => [2, 4, 6].forEach((id) => d({ type: "scene/select", id })),
    parent: ({ d }) => {
      d({ type: "scene/set", id: 2, patch: { pos: [-1, 0.5, 1] } });
      d({ type: "scene/set", id: 2, patch: { scale: 1.5 } });
    },
    attach: ({ d }) => {
      d({ type: "scene/reparent", id: 7, parent: 2 });
      d({ type: "scene/set", id: 2, patch: { pos: [1, 0.5, -1] } });
    },
  },
  "game-2-camera": {
    "game-view": ({ d }) => {
      d({ type: "camera/set", patch: { view: "game" } });
      d({ type: "camera/set", patch: { fov: 100 } });
      d({ type: "camera/set", patch: { fov: 25 } });
    },
    ortho: ({ d }) => d({ type: "camera/set", patch: { projection: "orthographic" } }),
    follow: ({ d }) => d({ type: "camera/set", patch: { projection: "perspective", follow: true } }),
  },
  "game-3-loop": {
    bug: ({ d, tick }) => {
      d({ type: "loop/run" });
      tick(200);
    },
    fix: ({ d, tick }) => {
      d({ type: "loop/set", patch: { useDeltaTime: true } });
      d({ type: "loop/run" });
      tick(200);
    },
  },
  "game-4-physics": {
    gravity: ({ d, tick }) => {
      d({ type: "physics/drop" });
      tick(30);
      d({ type: "physics/set", patch: { gravity: 1.6 } });
      d({ type: "physics/drop", x: 1 });
      tick(30);
    },
    bounce: ({ d, tick }) => {
      d({ type: "physics/set", patch: { restitution: 0.95 } });
      d({ type: "physics/drop", x: -1 });
      tick(60);
      d({ type: "physics/set", patch: { restitution: 0.1 } });
    },
    collide: ({ d, tick }) => {
      d({ type: "physics/set", patch: { gravity: 9.8 } });
      d({ type: "physics/drop", x: 2, height: 2 });
      d({ type: "physics/drop", x: 2.1, height: 4 });
      tick(90);
    },
    tunnel: ({ d, tick }) => {
      d({ type: "physics/throw", speed: 75 });
      tick(30);
      d({ type: "physics/set", patch: { substeps: 8 } });
      d({ type: "physics/throw", speed: 75 });
      tick(30);
    },
  },
  "game-5-graphics": {
    lights: ({ d }) => {
      d({ type: "graphics/set", patch: { directional: 0, point: 0, ambient: 0.8 } });
      d({ type: "graphics/set", patch: { ambient: 0, directional: 1.5 } });
      d({ type: "graphics/set", patch: { point: 10 } });
    },
    material: ({ d }) => {
      d({ type: "graphics/set", patch: { metalness: 0.9, roughness: 0.1 } });
      d({ type: "graphics/set", patch: { emissive: 1 } });
      d({ type: "graphics/set", patch: { flatShading: true } });
    },
  },
  "game-6-scripting": {
    move: (b) => {
      b.d({ type: "game/rule/add", when: "keys", then: "movePlayer" });
      b.d({ type: "game/start" });
      walk(b, [[1, 2]]);
    },
    coins: (b) => {
      b.d({ type: "game/rule/add", when: "touchCoin", then: "collectCoin" });
      b.d({ type: "game/rule/add", when: "touchCoin", then: "addScore" });
      walk(b, [
        [1, 5],
        [1, 9],
      ]);
    },
    rules: (b) => {
      b.d({ type: "game/rule/add", when: "allCoins", then: "win" });
      b.d({ type: "game/rule/add", when: "touchEnemy", then: "lose" });
      b.d({ type: "game/ai", patch: { chaseRadius: 6 } });
      b.d({ type: "game/start" });
      walk(b, [
        [3, 1],
        [3, 3],
        [5, 3],
        [5, 5],
      ]);
      b.tick(240);
    },
  },
  "game-7-logic": {
    fsm: (b) => {
      b.d({ type: "game/start" });
      walk(b, [
        [3, 1],
        [3, 3],
        [5, 3],
      ]);
      b.tick(30);
      // Run away from the enemy to the far corner: beyond the give-up radius it turns back.
      walk(b, [
        [5, 1],
        [9, 1],
      ]);
      b.tick(240);
    },
    tune: ({ d }) => {
      d({ type: "game/ai", patch: { chaseRadius: 4, giveUpRadius: 6, enemySpeed: 1.5 } });
    },
  },
  "game-8-create": {
    level: ({ d }) => {
      const empty = Array.from({ length: GRID }, (_, j) => (j === 0 || j === GRID - 1 ? "#".repeat(GRID) : "#" + ".".repeat(GRID - 2) + "#"));
      d({ type: "game/level", level: empty });
      d({ type: "game/tile", i: 1, j: 1, tile: "p" });
      for (const i of [2, 3, 4]) d({ type: "game/tile", i, j: 1, tile: "c" });
      d({ type: "game/tile", i: 8, j: 8, tile: "e" });
      d({ type: "game/tile", i: 5, j: 5, tile: "#" });
    },
    rules: ({ d }) => allRules.forEach((r) => d(r)),
    win: (b) => {
      b.d({ type: "game/start" });
      walk(b, [[4, 1]]);
      b.tick(5);
    },
  },
};

describe("game lessons are completable", () => {
  for (const lesson of gameLessons) {
    it(lesson.id, () => {
      const rt = new SimulationRuntime(gameLabPlugin, 1);
      const engine = new LessonEngine(lesson);
      const sync = () => engine.update(rt.getState(), rt.evaluate());
      const enter = () => engine.step.onEnter?.forEach((a) => rt.dispatch(a));
      const bot: Bot = {
        d: (a) => {
          rt.dispatch(a);
          sync();
        },
        s: () => rt.getState(),
        tick: (n) => {
          for (let i = 0; i < n; i++) {
            rt.stepTicks(1);
            sync();
          }
        },
      };
      enter();
      sync();
      for (const step of lesson.steps) {
        const script = scripts[lesson.id]?.[step.id];
        expect(script, `script for ${step.id}`).toBeDefined();
        script!(bot);
        sync();
        expect(engine.view().objectives.filter((o) => !o.done).map((o) => o.text), `${lesson.id}/${step.id}`).toEqual([]);
        for (const q of step.quiz ?? []) expect(engine.answer(q.id, q.answer).correct).toBe(true);
        if (!engine.isLastStep()) {
          engine.advance();
          enter();
          sync();
        }
      }
      expect(engine.isLessonComplete()).toBe(true);
    });
  }
});
