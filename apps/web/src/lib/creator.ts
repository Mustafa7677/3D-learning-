import type { Condition, LessonSpec } from "@inside-tech/lesson-engine";
import type { LabKind } from "./labPort";

/** Ready-made building blocks for the lesson creator, per simulation. */
export interface ConditionPreset {
  id: string;
  label: string;
  /** Default number for presets that take one; omitted for yes/no presets. */
  value?: number;
  build: (v: number) => Condition;
}

export interface SetupPreset {
  id: string;
  label: string;
  actions: unknown[];
}

export interface KindInfo {
  kind: LabKind;
  labId: string;
  title: string;
  focus: { id: string; label: string }[];
  conditions: ConditionPreset[];
  setups: SetupPreset[];
}

const n = (path: string, op: ">=" | "<=" = ">=") => (v: number): Condition => ({ path, op, value: v });
const len = (path: string) => (v: number): Condition => ({ path, op: "lengthAtLeast", value: v });
const is = (path: string, value: unknown) => (): Condition => ({ path, op: "==", value });
const has = (path: string, value: unknown) => (): Condition => ({ path, op: "includes", value });
const metric = (name: string, scale = 1) => (v: number): Condition => ({ metric: name, op: ">=", value: v / scale });

export const KINDS: KindInfo[] = [
  {
    kind: "classifier",
    labId: "ai",
    title: "AI · классификатор",
    focus: [
      { id: "dataset", label: "Деректер" },
      { id: "surface", label: "Ықтималдық беті" },
      { id: "neuron", label: "Нейрон" },
      { id: "network", label: "Желі" },
      { id: "charts", label: "Графиктер" },
    ],
    conditions: [
      { id: "test", label: "Test дәлдігі ≥ X%", value: 90, build: metric("testAcc", 100) },
      { id: "train", label: "Train дәлдігі ≥ X%", value: 90, build: metric("trainAcc", 100) },
      { id: "epoch", label: "Epoch саны ≥ N", value: 50, build: n("training.epoch") },
      { id: "add0", label: "0-класқа қосылған нүкте ≥ N", value: 3, build: n("stats.userAdded.0") },
      { id: "add1", label: "1-класқа қосылған нүкте ≥ N", value: 3, build: n("stats.userAdded.1") },
      { id: "inspect", label: "Таңдалған нүкте ≥ N", value: 3, build: len("stats.inspectedPoints") },
      { id: "layers", label: "Жасырын қабат ≥ N", value: 2, build: len("hidden") },
      { id: "l2", label: "L2-мен үйретілген epoch ≥ N", value: 100, build: n("stats.epochsWithL2") },
      { id: "diverged", label: "Training жарылды", build: is("stats.diverged", true) },
      { id: "export", label: "Модель экспортталды", build: () => ({ path: "stats.exports", op: ">=", value: 1 }) },
    ],
    setups: [
      { id: "blobs", label: "Датасет: екі топ", actions: [{ type: "dataset/generate", kind: "blobs", count: 160, noise: 0.2 }] },
      { id: "xor", label: "Датасет: XOR", actions: [{ type: "dataset/generate", kind: "xor", count: 160, noise: 0.1 }] },
      { id: "circles", label: "Датасет: шеңберлер", actions: [{ type: "dataset/generate", kind: "circles", count: 240, noise: 0.15 }] },
      { id: "spiral", label: "Датасет: спираль", actions: [{ type: "dataset/generate", kind: "spiral", count: 300, noise: 0.1, seed: 5 }] },
      { id: "empty", label: "Бос сахна", actions: [{ type: "dataset/clear" }] },
      { id: "neuron", label: "Модель: бір нейрон", actions: [{ type: "model/select", model: "neuron" }] },
      { id: "net-small", label: "Желі: [8, 8] tanh", actions: [{ type: "model/select", model: "network" }, { type: "network/setActivation", activation: "tanh" }, { type: "network/setHidden", hidden: [8, 8] }] },
      { id: "net-none", label: "Желі: жасырын қабатсыз", actions: [{ type: "model/select", model: "network" }, { type: "network/setHidden", hidden: [] }] },
    ],
  },
  {
    kind: "language",
    labId: "ai",
    title: "AI · тіл модельдері",
    focus: [
      { id: "tokens", label: "Токендер" },
      { id: "embedding", label: "Embedding" },
      { id: "attention", label: "Attention" },
      { id: "llm", label: "Тілдік модель" },
    ],
    conditions: [
      { id: "text", label: "Сөйлемді өзгертті", build: () => ({ path: "stats.textEdits", op: ">=", value: 1 }) },
      { id: "words", label: "Таңдалған сөз ≥ N", value: 3, build: len("stats.inspectedWords") },
      { id: "attn", label: "Attention-ы қаралған токен ≥ N", value: 2, build: len("stats.attnInspected") },
      { id: "causal", label: "Causal mask қосылды", build: is("stats.causalToggled", true) },
      { id: "samples", label: "Генерацияланған токен ≥ N", value: 5, build: n("stats.samples") },
      { id: "cold", label: "Temperature ≤ 0.3-те токен ≥ N", value: 3, build: n("stats.samplesLowT") },
      { id: "greedy", label: "Top-k = 1-де токен ≥ N", value: 3, build: n("stats.greedySamples") },
    ],
    setups: [
      { id: "cat", label: "Сөйлем: «мысық сүт ішеді»", actions: [{ type: "text/set", text: "мысық сүт ішеді" }] },
      { id: "long", label: "Сөйлем: «мысық пен ит үйде сүт ішеді»", actions: [{ type: "text/set", text: "мысық пен ит үйде сүт ішеді" }] },
      { id: "prompt", label: "Prompt: «бала»", actions: [{ type: "lm/setPrompt", prompt: "бала" }] },
    ],
  },
  {
    kind: "web",
    labId: "web",
    title: "Web",
    focus: [
      { id: "network", label: "Желі" },
      { id: "dom", label: "DOM" },
      { id: "box", label: "Box model" },
      { id: "flex", label: "Flexbox" },
      { id: "loop", label: "Event loop" },
      { id: "db", label: "Дерекқор" },
    ],
    conditions: [
      { id: "ok", label: "200 OK жауап ≥ N", value: 1, build: n("stats.statuses.200") },
      { id: "404", label: "404 жауап ≥ N", value: 1, build: n("stats.statuses.404") },
      { id: "requests", label: "Сұрау саны ≥ N", value: 3, build: n("stats.requests") },
      { id: "dnscache", label: "DNS кэштен алынды", build: () => ({ path: "stats.dnsCacheHits", op: ">=", value: 1 }) },
      { id: "dom", label: "DOM түйіні таңдалды", build: () => ({ path: "stats.domSelected", op: ">=", value: 1 }) },
      { id: "basic", label: "«setTimeout vs Promise» дұрыс болжанды", build: has("stats.predictedCorrect", "basic") },
      { id: "insert", label: "SQL INSERT орындалды", build: has("stats.sqlKinds", "insert") },
      { id: "index", label: "Индекспен іздеу болды", build: has("stats.indexScan", "orders") },
      { id: "deploy", label: "Deploy саны ≥ N", value: 1, build: n("stats.deploys") },
    ],
    setups: [
      { id: "internet", label: "Әлем: inside.kz", actions: [{ type: "scenario/load", id: "internet" }] },
      { id: "api", label: "Әлем: API сервері", actions: [{ type: "scenario/load", id: "api" }] },
      { id: "debug", label: "Әлем: бұзылған shop.kz", actions: [{ type: "scenario/load", id: "debug" }] },
      { id: "deploy", label: "Әлем: mysite.kz (deploy)", actions: [{ type: "scenario/load", id: "deploy" }] },
      { id: "loop-basic", label: "Бағдарлама: setTimeout vs Promise", actions: [{ type: "loop/select", programId: "basic" }] },
      { id: "loop-fetch", label: "Бағдарлама: fetch және Promise", actions: [{ type: "loop/select", programId: "fetch" }] },
    ],
  },
  {
    kind: "game",
    labId: "game",
    title: "Game",
    focus: [
      { id: "scene", label: "Сахна ағашы" },
      { id: "camera", label: "Камера" },
      { id: "loop", label: "Game loop" },
      { id: "physics", label: "Физика" },
      { id: "graphics", label: "Графика" },
      { id: "game", label: "Ойын" },
      { id: "editor", label: "Деңгей редакторы" },
    ],
    conditions: [
      { id: "drops", label: "Тасталған доп ≥ N", value: 3, build: n("stats.drops") },
      { id: "collisions", label: "Соқтығысу ≥ N", value: 1, build: n("stats.collisions") },
      { id: "tunnel", label: "Доп қабырғадан өтіп кетті", build: is("stats.tunneled", true) },
      { id: "coins", label: "Жиналған тиын ≥ N", value: 3, build: n("stats.coinsCollected") },
      { id: "wins", label: "Жеңіс ≥ N", value: 1, build: n("stats.wins") },
      { id: "chase", label: "Жау қуа бастады", build: has("stats.enemyStates", "chase") },
      { id: "selected", label: "Таңдалған объект ≥ N", value: 2, build: len("stats.selected") },
      { id: "dt", label: "Delta time-пен теңескенін көрді", build: is("stats.loopMatch", true) },
      { id: "shiny", label: "Жалтыр металл материал", build: has("stats.graphicsSeen", "shiny") },
    ],
    setups: [
      { id: "phys-clear", label: "Физика: бос арена", actions: [{ type: "physics/clear" }, { type: "physics/wall", on: false }] },
      { id: "moon", label: "Физика: Ай гравитациясы", actions: [{ type: "physics/set", patch: { gravity: 1.6 } }] },
      { id: "wall", label: "Физика: жұқа қабырға", actions: [{ type: "physics/wall", on: true }] },
      { id: "game-reset", label: "Ойын: басынан", actions: [{ type: "game/reset" }] },
      {
        id: "game-rules",
        label: "Ойын: негізгі ережелер",
        actions: [
          { type: "game/rule/add", when: "keys", then: "movePlayer" },
          { type: "game/rule/add", when: "touchCoin", then: "collectCoin" },
          { type: "game/rule/add", when: "touchCoin", then: "addScore" },
          { type: "game/rule/add", when: "allCoins", then: "win" },
          { type: "game/rule/add", when: "touchEnemy", then: "lose" },
        ],
      },
    ],
  },
];

KINDS.push({
  kind: "algo",
  labId: "algo",
  title: "Algorithms",
  focus: [
    { id: "sort", label: "Сұрыптау" },
    { id: "search", label: "Іздеу" },
    { id: "graph", label: "Граф" },
    { id: "bench", label: "Тәжірибе (Big O)" },
  ],
  conditions: [
    { id: "steps", label: "Қолмен жасалған сұрыптау қадамы ≥ N", value: 10, build: n("stats.manualSortSteps") },
    { id: "runs", label: "Аяқталған сұрыптау ≥ N", value: 1, build: len("stats.sortRuns") },
    { id: "searches", label: "Аяқталған іздеу ≥ N", value: 1, build: len("stats.searches") },
    { id: "graphs", label: "Аяқталған граф іздеуі ≥ N", value: 1, build: len("stats.graphRuns") },
    { id: "bench", label: "Big O өлшемі ≥ N", value: 3, build: len("stats.bench") },
    { id: "graphMode", label: "Граф режимі ашылды", build: has("stats.modes", "graph") },
  ],
  setups: [
    { id: "bubble", label: "Bubble sort, 12 кездейсоқ", actions: [{ type: "mode/set", mode: "sort" }, { type: "sort/config", alg: "bubble", preset: "random", n: 12 }] },
    { id: "insertion", label: "Insertion sort, дерлік сұрыпталған", actions: [{ type: "mode/set", mode: "sort" }, { type: "sort/config", alg: "insertion", preset: "nearly", n: 24 }] },
    { id: "merge", label: "Merge sort, 16 кездейсоқ", actions: [{ type: "mode/set", mode: "sort" }, { type: "sort/config", alg: "merge", preset: "random", n: 16 }] },
    { id: "binary", label: "Екілік іздеу, 64 элемент", actions: [{ type: "mode/set", mode: "search" }, { type: "search/config", kind: "binary", n: 64, sorted: true }] },
    { id: "bfs", label: "BFS, 4×4 тор", actions: [{ type: "mode/set", mode: "graph" }, { type: "graph/config", preset: "grid", alg: "bfs" }] },
    { id: "dijkstra", label: "Дейкстра, жолдар картасы", actions: [{ type: "mode/set", mode: "graph" }, { type: "graph/config", preset: "roads", alg: "dijkstra" }] },
  ],
});

export const kindInfo = (kind: string) => KINDS.find((k) => k.kind === kind) ?? KINDS[0]!;

export function newSpec(kind: LabKind): LessonSpec {
  const k = kindInfo(kind);
  const c = k.conditions[0]!;
  return {
    format: "inside-tech/lesson@1",
    id: `my-${kind}-${Date.now().toString(36)}`,
    labId: k.labId,
    kind,
    title: "Менің сабағым",
    summary: "Қысқа сипаттама",
    estimatedMinutes: 10,
    steps: [
      {
        id: "step-1",
        title: "Бірінші кезең",
        body: "Оқушыға не істеу керегін және неге екенін түсіндір.",
        focus: k.focus[0]!.id,
        onEnter: [],
        objectives: [{ id: "goal-1", text: c.label.replace("X", String(c.value ?? "")).replace("N", String(c.value ?? "")), when: c.build(c.value ?? 1) }],
      },
    ],
  };
}

const KEY = "inside-tech:custom-lessons";

export function loadCustomLessons(): LessonSpec[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LessonSpec[]) : [];
  } catch {
    return [];
  }
}

export function saveCustomLessons(list: LessonSpec[]): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

/** Simulations an authored lesson may run on. */
export const KIND_IDS = KINDS.map((k) => k.kind);

export interface PresetMatch {
  preset: ConditionPreset;
  value: number;
}

/** Recover which preset (and number) built a condition, so the editor can show it as a form. */
export function presetOf(kind: string, when: Condition): PresetMatch | undefined {
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const raw = (when as { value?: unknown }).value;
  const candidates = typeof raw === "number" ? [raw, Math.round(raw * 100 * 1e6) / 1e6] : [1];
  for (const preset of kindInfo(kind).conditions) {
    for (const v of preset.value === undefined ? [preset.value ?? 1] : candidates) {
      if (same(preset.build(v), when)) return { preset, value: v };
    }
  }
  return undefined;
}

/** Objective text for a preset with its number filled in. */
export const presetText = (p: ConditionPreset, v: number) => p.label.replace(/\bX\b/, String(v)).replace(/\bN\b/, String(v));

/** Whether a setup preset's actions are part of a step's onEnter list. */
export function hasSetup(onEnter: unknown[] | undefined, setup: SetupPreset): boolean {
  const list = (onEnter ?? []).map((a) => JSON.stringify(a));
  const want = setup.actions.map((a) => JSON.stringify(a));
  for (let i = 0; i + want.length <= list.length; i++) if (want.every((w, k) => list[i + k] === w)) return true;
  return false;
}

export function toggleSetup(onEnter: unknown[] | undefined, setup: SetupPreset): unknown[] {
  const list = [...(onEnter ?? [])];
  if (!hasSetup(list, setup)) return [...list, ...setup.actions];
  const want = setup.actions.map((a) => JSON.stringify(a));
  for (let i = 0; i + want.length <= list.length; i++) {
    if (want.every((w, k) => JSON.stringify(list[i + k]) === w)) {
      list.splice(i, want.length);
      break;
    }
  }
  return list;
}

/** A fresh id that is not in `taken`: prefix-1, prefix-2, … */
export function freshId(prefix: string, taken: string[]): string {
  for (let i = 1; ; i++) if (!taken.includes(`${prefix}-${i}`)) return `${prefix}-${i}`;
}

/** Link that opens an authored lesson for a learner, on either build of the site. */
export function playLink(code: string): string {
  if (process.env.NEXT_PUBLIC_STANDALONE === "1") return `${window.location.origin}${window.location.pathname}#play=${code}`;
  return `${window.location.origin}/play#l=${code}`;
}
