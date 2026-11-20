/**
 * A top-down arena game built from a tile grid. Behaviour comes from rules
 * ("WHEN trigger DO effect") and the enemy's finite-state machine, so the
 * learner changes how the game plays without writing engine code.
 */
export const GRID = 11;
export type Tile = "." | "#" | "c" | "e" | "p";

export type Trigger = "keys" | "touchCoin" | "touchEnemy" | "allCoins" | "timeUp";
export type Effect = "movePlayer" | "collectCoin" | "addScore" | "win" | "lose";

export interface Rule {
  id: number;
  when: Trigger;
  then: Effect;
}

export type EnemyState = "patrol" | "chase" | "return";

export interface Enemy {
  id: number;
  x: number;
  z: number;
  home: [number, number];
  patrol: [number, number][];
  target: number;
  state: EnemyState;
}

export interface AiParams {
  chaseRadius: number;
  giveUpRadius: number;
  enemySpeed: number;
}

export interface GameState {
  level: string[];
  rules: Rule[];
  nextRuleId: number;
  ai: AiParams;
  playerSpeed: number;
  timeLimit: number;
  status: "ready" | "playing" | "won" | "lost";
  player: { x: number; z: number };
  coins: { x: number; z: number; taken: boolean }[];
  enemies: Enemy[];
  score: number;
  time: number;
  input: { up: boolean; down: boolean; left: boolean; right: boolean };
  lastEvent: string;
}

export const DEFAULT_LEVEL: string[] = [
  "###########",
  "#p..#.....#",
  "#.#.#.###c#",
  "#.#...#...#",
  "#.###.#.#.#",
  "#c....e.#c#",
  "#.#.###.#.#",
  "#.#.....#.#",
  "#.###.#.#.#",
  "#c....#..c#",
  "###########",
];

export const cellCenter = (i: number, j: number): [number, number] => [i - GRID / 2 + 0.5, j - GRID / 2 + 0.5];
const toCell = (x: number, z: number): [number, number] => [Math.floor(x + GRID / 2), Math.floor(z + GRID / 2)];

export function tileAt(level: string[], i: number, j: number): Tile {
  if (i < 0 || j < 0 || i >= GRID || j >= GRID) return "#";
  return (level[j]?.[i] ?? "#") as Tile;
}

export function sanitizeLevel(level: string[]): string[] {
  const rows = Array.from({ length: GRID }, (_, j) =>
    Array.from({ length: GRID }, (_, i) => {
      const ch = level[j]?.[i] ?? "#";
      const t = ".#cep".includes(ch) ? ch : ".";
      return i === 0 || j === 0 || i === GRID - 1 || j === GRID - 1 ? "#" : t;
    }).join(""),
  );
  // Exactly one player spawn.
  let seen = false;
  const fixed = rows.map((r) =>
    [...r]
      .map((ch) => {
        if (ch !== "p") return ch;
        if (seen) return ".";
        seen = true;
        return "p";
      })
      .join(""),
  );
  if (!seen) fixed[1] = "#p" + fixed[1]!.slice(2);
  return fixed;
}

function patrolFor(level: string[], i: number, j: number): [number, number][] {
  // Walk right (or left) along open floor up to 3 cells to form a patrol route.
  for (const di of [1, -1, 0]) {
    for (const dj of di === 0 ? [1, -1] : [0]) {
      let k = 0;
      while (k < 3 && tileAt(level, i + di * (k + 1), j + dj * (k + 1)) !== "#") k++;
      if (k >= 2) return [cellCenter(i, j), cellCenter(i + di * k, j + dj * k)];
    }
  }
  return [cellCenter(i, j)];
}

/** Place player, coins and enemies from the level grid. */
export function spawn(g: GameState): GameState {
  let player = { x: 0, z: 0 };
  const coins: GameState["coins"] = [];
  const enemies: Enemy[] = [];
  g.level.forEach((row, j) =>
    [...row].forEach((ch, i) => {
      const [x, z] = cellCenter(i, j);
      if (ch === "p") player = { x, z };
      if (ch === "c") coins.push({ x, z, taken: false });
      if (ch === "e") enemies.push({ id: enemies.length + 1, x, z, home: [x, z], patrol: patrolFor(g.level, i, j), target: 0, state: "patrol" });
    }),
  );
  return { ...g, player, coins, enemies, score: 0, time: 0, lastEvent: "" };
}

export function initialGame(): GameState {
  return spawn({
    level: DEFAULT_LEVEL,
    rules: [],
    nextRuleId: 1,
    ai: { chaseRadius: 3, giveUpRadius: 4, enemySpeed: 1.6 },
    playerSpeed: 2.6,
    timeLimit: 60,
    status: "ready",
    player: { x: 0, z: 0 },
    coins: [],
    enemies: [],
    score: 0,
    time: 0,
    input: { up: false, down: false, left: false, right: false },
    lastEvent: "",
  });
}

const RADIUS = 0.3;

function blocked(level: string[], x: number, z: number): boolean {
  for (const [dx, dz] of [
    [-RADIUS, -RADIUS],
    [RADIUS, -RADIUS],
    [-RADIUS, RADIUS],
    [RADIUS, RADIUS],
  ] as const) {
    const [i, j] = toCell(x + dx, z + dz);
    if (tileAt(level, i, j) === "#") return true;
  }
  return false;
}

/** Move with wall sliding: try each axis separately. */
function moveWithWalls(level: string[], x: number, z: number, dx: number, dz: number): [number, number] {
  let nx = x;
  let nz = z;
  if (dx && !blocked(level, x + dx, z)) nx = x + dx;
  if (dz && !blocked(level, nx, z + dz)) nz = z + dz;
  return [nx, nz];
}

const has = (g: GameState, when: Trigger, then: Effect) => g.rules.some((r) => r.when === when && r.then === then);

export interface TickEvents {
  coins: number;
  states: EnemyState[];
  touched: boolean;
  moved: boolean;
}

export function tickGame(g: GameState, dt: number): { game: GameState; events: TickEvents } {
  const ev: TickEvents = { coins: 0, states: [], touched: false, moved: false };
  if (g.status !== "playing") return { game: g, events: ev };
  let { x, z } = g.player;
  if (has(g, "keys", "movePlayer")) {
    const dx = (g.input.right ? 1 : 0) - (g.input.left ? 1 : 0);
    const dz = (g.input.down ? 1 : 0) - (g.input.up ? 1 : 0);
    const n = Math.hypot(dx, dz) || 1;
    const step = g.playerSpeed * dt;
    [x, z] = moveWithWalls(g.level, x, z, (dx / n) * step, (dz / n) * step);
    ev.moved = dx !== 0 || dz !== 0;
  }
  let score = g.score;
  let lastEvent = g.lastEvent;
  const coins = g.coins.map((c) => {
    if (c.taken || Math.hypot(c.x - x, c.z - z) > 0.5) return c;
    if (!g.rules.some((r) => r.when === "touchCoin")) return c;
    if (has(g, "touchCoin", "addScore")) score += 10;
    if (has(g, "touchCoin", "collectCoin")) {
      ev.coins++;
      lastEvent = "Тиын жиналды";
      return { ...c, taken: true };
    }
    return c;
  });

  const enemies = g.enemies.map((e) => {
    const d = Math.hypot(x - e.x, z - e.z);
    let state = e.state;
    if (state === "patrol" && d < g.ai.chaseRadius) state = "chase";
    else if (state === "chase" && d > g.ai.giveUpRadius) state = "return";
    else if (state === "return" && Math.hypot(e.home[0] - e.x, e.home[1] - e.z) < 0.15) state = "patrol";
    if (state !== e.state) ev.states.push(state);
    let target = e.target;
    let goal: [number, number];
    if (state === "chase") goal = [x, z];
    else if (state === "return") goal = e.home;
    else {
      goal = e.patrol[target % e.patrol.length]!;
      if (Math.hypot(goal[0] - e.x, goal[1] - e.z) < 0.1) {
        target = (target + 1) % e.patrol.length;
        goal = e.patrol[target]!;
      }
    }
    const gx = goal[0] - e.x;
    const gz = goal[1] - e.z;
    const gl = Math.hypot(gx, gz);
    const step = Math.min(gl, g.ai.enemySpeed * dt);
    const [ex, ez] = gl > 1e-6 ? moveWithWalls(g.level, e.x, e.z, (gx / gl) * step, (gz / gl) * step) : [e.x, e.z];
    return { ...e, x: ex, z: ez, state, target };
  });

  let status: GameState["status"] = g.status;
  const time = g.time + dt;
  const touching = enemies.some((e) => Math.hypot(e.x - x, e.z - z) < 0.55);
  if (touching) {
    ev.touched = true;
    if (has(g, "touchEnemy", "lose")) {
      status = "lost";
      lastEvent = "Жау ұстап алды";
    }
  }
  if (status === "playing" && coins.length > 0 && coins.every((c) => c.taken) && has(g, "allCoins", "win")) {
    status = "won";
    lastEvent = "Барлық тиын жиналды — жеңіс!";
  }
  if (status === "playing" && time >= g.timeLimit && has(g, "timeUp", "lose")) {
    status = "lost";
    lastEvent = "Уақыт бітті";
  }
  const round = (v: number) => Math.round(v * 1e5) / 1e5;
  return {
    game: { ...g, player: { x: round(x), z: round(z) }, coins, enemies: enemies.map((e) => ({ ...e, x: round(e.x), z: round(e.z) })), score, time, status, lastEvent },
    events: ev,
  };
}

export const TRIGGER_TEXT: Record<Trigger, string> = {
  keys: "Пернелер басылғанда",
  touchCoin: "Ойыншы тиынға тигенде",
  touchEnemy: "Ойыншы жауға тигенде",
  allCoins: "Барлық тиын жиналғанда",
  timeUp: "Уақыт біткенде",
};

export const EFFECT_TEXT: Record<Effect, string> = {
  movePlayer: "ойыншыны жылжыт",
  collectCoin: "тиынды жина",
  addScore: "ұпайға +10 қос",
  win: "жеңіс",
  lose: "жеңіліс",
};
