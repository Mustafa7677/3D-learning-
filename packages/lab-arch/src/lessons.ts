import { withContent, withDeepDives, type LessonDefinition } from "@inside-tech/lesson-engine";
import { addTrace } from "./bits";
import { archContent } from "./content";
import { archDeepDives } from "./deep";
import { PROGRAMS, passesTests, ranSource, type ArchLabAction, type ArchLabState } from "./plugin";
import { lessonPsetArch } from "./pset";

type L = LessonDefinition<ArchLabState, ArchLabAction>;

/** Carries generated inside an addition (into bits 1..8). */
export const carryCount = (a: number, b: number) => addTrace(a, b).carries.filter((c) => c === 1).length;
const solved = (s: ArchLabState, id: string) => s.stats.solved.some((x) => x.circuit === id);
const ranWith = (s: ArchLabState, out: number[], f: (r: ArchLabState["stats"]["cpuRuns"][number]) => boolean = () => true) =>
  s.stats.cpuRuns.some((r) => JSON.stringify(r.out) === JSON.stringify(out) && f(r));
/** Hidden tests pass for the current source, and it was actually run. */
const graded = (s: ArchLabState, cases: { mem: number[]; out: number[] }[]) => ranSource(s) && passesTests(s.cpu.source, cases).passed === cases.length;

export const ADD_TESTS = [
  { mem: [2, 3], out: [5] },
  { mem: [10, 20], out: [30] },
  { mem: [0, 0], out: [0] },
  { mem: [100, 55], out: [155] },
];
export const COUNTDOWN_TESTS = [
  { mem: [3], out: [3, 2, 1] },
  { mem: [5], out: [5, 4, 3, 2, 1] },
  { mem: [1], out: [1] },
];
export const MAX_TESTS = [
  { mem: [3, 9, 4, 1, 5], out: [9] },
  { mem: [7, 1, 2, 3, 4], out: [7] },
  { mem: [1, 2, 3, 4, 8], out: [8] },
  { mem: [5, 5, 5, 5, 5], out: [5] },
];

const ADD_TEMPLATE = `; mem[0] + mem[1] қосындысын шығар (OUT)
; Мысалы: LOAD R0, [0] — mem[0]-ді R0-ге жүктейді

HALT`;
const COUNTDOWN_TEMPLATE = `; mem[0] = N. N, N−1, …, 1 сандарын шығар
LOAD R0, [0]

HALT`;
const MAX_TEMPLATE = `; mem[0..4] ішіндегі ең үлкен санды шығар
; CMP R0, R3 — R0 < R3 болса, C жалауы = 1
; JC / JNC — C жалауы бойынша секіру

HALT`;

export const lessonBinary: L = {
  id: "arch-1-binary",
  labId: "arch",
  order: 1,
  title: "Binary",
  summary: "Компьютер тек 0 мен 1-ді біледі. 8 бит, разряд салмақтары және он алтылық жазу.",
  estimatedMinutes: 15,
  steps: [
    {
      id: "bits",
      title: "Биттер мен разрядтар",
      body: "",
      focus: "bits",
      onEnter: [{ type: "mode/set", mode: "bits" }, { type: "bits/signed", on: false }, { type: "bits/set", value: 0 }],
      objectives: [{ id: "42", text: "Биттерді қосып-өшіріп, 42 санын жаса", check: (s) => s.stats.values.includes(42) && s.stats.bitToggles >= 3 }],
    },
    {
      id: "range",
      title: "8 биттің шегі",
      body: "",
      focus: "bits",
      objectives: [
        { id: "255", text: "Ең үлкен 8 биттік санды жаса", check: (s) => s.stats.values.includes(255) },
        { id: "128", text: "Тек ең үлкен разряды жанған санды жаса", check: (s) => s.stats.values.includes(128) },
      ],
    },
    {
      id: "hex",
      title: "Он алтылық жүйе",
      body: "",
      focus: "bits",
      objectives: [{ id: "a5", text: "0xA5 санын жаса", check: (s) => s.stats.values.includes(0xa5) }],
    },
  ],
};

export const lessonArith: L = {
  id: "arch-2-arith",
  labId: "arch",
  order: 2,
  title: "Binary Arithmetic",
  summary: "Тасымалмен қосу, толып кету және теріс сандар: two's complement.",
  estimatedMinutes: 20,
  steps: [
    {
      id: "add",
      title: "Тасымалмен қосу",
      body: "",
      focus: "bits",
      onEnter: [{ type: "mode/set", mode: "bits" }],
      objectives: [{ id: "carry", text: "Кемінде 3 тасымал болатын қосу жаса (мысалы 7 + 1)", check: (s) => s.stats.additions.some((x) => carryCount(x.a, x.b) >= 3) }],
    },
    {
      id: "overflow",
      title: "Толып кету",
      body: "",
      focus: "bits",
      objectives: [{ id: "out", text: "Нәтижесі 8 битке сыймайтын қосу жаса", check: (s) => s.stats.additions.some((x) => x.carryOut) }],
    },
    {
      id: "twos",
      title: "Теріс сандар",
      body: "",
      focus: "bits",
      onEnter: [{ type: "bits/signed", on: true }],
      objectives: [
        { id: "m1", text: "Таңбалы көріністе −1 санын жаса", check: (s) => s.stats.signedValues.includes(-1) },
        { id: "m128", text: "Ең кіші таңбалы санды жаса", check: (s) => s.stats.signedValues.includes(-128) },
      ],
    },
  ],
};

export const lessonGates: L = {
  id: "arch-3-gates",
  labId: "arch",
  order: 3,
  title: "Logic Gates",
  summary: "AND, OR, NOT, XOR және NAND: транзисторлардан ойлауға дейін.",
  estimatedMinutes: 15,
  steps: [
    {
      id: "truth",
      title: "Ақиқат кестесі",
      body: "",
      focus: "gates",
      onEnter: [{ type: "mode/set", mode: "gates" }, { type: "gates/circuit", circuit: "single" }],
      objectives: [{ id: "rows", text: "A мен B-нің барлық 4 комбинациясын байқа", check: (s) => (s.stats.rowsTried.single ?? []).length >= 4 }],
    },
    {
      id: "types",
      title: "Элементтер отбасы",
      body: "",
      focus: "gates",
      objectives: [{ id: "types", text: "Кемінде 4 түрлі элементті байқап көр", check: (s) => s.stats.gateTypesTried.length >= 4 }],
    },
  ],
};

export const lessonAdder: L = {
  id: "arch-4-adder",
  labId: "arch",
  order: 4,
  title: "Building an Adder",
  summary: "Элементтерден қосындылағыш құрастыр: компьютер санауды осылай үйренеді.",
  estimatedMinutes: 25,
  steps: [
    {
      id: "half",
      title: "Жарты қосындылағыш",
      body: "",
      focus: "gates",
      onEnter: [{ type: "mode/set", mode: "gates" }, { type: "gates/circuit", circuit: "half" }],
      objectives: [{ id: "solve", text: "S пен C-ның элементтерін таңда: ақиқат кестесі спецификацияға сай", check: (s) => solved(s, "half") }],
    },
    {
      id: "full",
      title: "Толық қосындылағыш",
      body: "",
      focus: "gates",
      onEnter: [{ type: "gates/circuit", circuit: "full" }],
      objectives: [{ id: "solve", text: "Толық қосындылағышты аяқта: 8 жолдың бәрі дұрыс", check: (s) => solved(s, "full") }],
    },
    {
      id: "ripple",
      title: "Тізбектелген тасымал",
      body: "",
      focus: "bits",
      onEnter: [{ type: "mode/set", mode: "bits" }],
      objectives: [{ id: "chain", text: "Тасымал кемінде 6 разрядтан өтетін қосу жаса", check: (s) => s.stats.additions.some((x) => carryCount(x.a, x.b) >= 6) }],
    },
  ],
};

export const lessonCpu: L = {
  id: "arch-5-cpu",
  labId: "arch",
  order: 5,
  title: "The CPU",
  summary: "Fetch → decode → execute: процессор бір нұсқауды қалай орындайды.",
  estimatedMinutes: 20,
  steps: [
    {
      id: "cycle",
      title: "Нұсқау циклі",
      body: "",
      focus: "cpu",
      onEnter: [{ type: "mode/set", mode: "cpu" }, { type: "cpu/memory", mem: [] }, { type: "cpu/source", source: PROGRAMS.first!.source }],
      objectives: [{ id: "stages", text: "Кемінде 6 кезеңді (2 нұсқау) қолмен жүргіз", check: (s) => s.stats.manualStages >= 6 }],
    },
    {
      id: "run",
      title: "Бағдарламаны соңына дейін",
      body: "",
      focus: "cpu",
      objectives: [{ id: "12", text: "Бағдарлама 12 шығарып, HALT-қа жетсін", check: (s) => ranWith(s, [12]) }],
    },
    {
      id: "loop",
      title: "Секіру және цикл",
      body: "",
      focus: "cpu",
      onEnter: [{ type: "cpu/source", source: PROGRAMS.sum!.source }],
      objectives: [{ id: "55", text: "Циклмен 1 + … + 10 = 55 есепте", check: (s) => ranWith(s, [55], (r) => r.instructions > 20) }],
    },
  ],
};

export const lessonAsm: L = {
  id: "arch-6-asm",
  labId: "arch",
  order: 6,
  title: "Assembly",
  summary: "Өз бағдарламаңды жаз: автотексеруші оны басқа деректермен де іске қосады.",
  estimatedMinutes: 30,
  steps: [
    {
      id: "add",
      title: "mem[0] + mem[1]",
      body: "",
      focus: "cpu",
      onEnter: [{ type: "mode/set", mode: "cpu" }, { type: "cpu/memory", mem: [2, 3] }, { type: "cpu/source", source: ADD_TEMPLATE }],
      objectives: [{ id: "tests", text: "Бағдарлама барлық жасырын тесттен өтсін (4 тест)", check: (s) => graded(s, ADD_TESTS) }],
      hints: ["LOAD R0, [0]\nLOAD R1, [1]\nADD R0, R1\nOUT R0\nHALT"],
    },
    {
      id: "countdown",
      title: "Кері санау",
      body: "",
      focus: "cpu",
      onEnter: [{ type: "cpu/memory", mem: [3] }, { type: "cpu/source", source: COUNTDOWN_TEMPLATE }],
      objectives: [{ id: "tests", text: "N, N−1, …, 1 шығар (3 жасырын тест)", check: (s) => graded(s, COUNTDOWN_TESTS) }],
    },
  ],
};

export const lessonMemory: L = {
  id: "arch-7-memory",
  labId: "arch",
  order: 7,
  title: "Memory",
  summary: "Адрестер, LOAD/STORE және жадқа қатынаудың бағасы.",
  estimatedMinutes: 25,
  steps: [
    {
      id: "array",
      title: "Массив — жадтағы қатар",
      body: "",
      focus: "cpu",
      onEnter: [{ type: "mode/set", mode: "cpu" }, { type: "cpu/memory", mem: PROGRAMS.array!.mem! }, { type: "cpu/source", source: PROGRAMS.array!.source }],
      objectives: [{ id: "sum", text: "Массивтің қосындысын (14) есепте және циклдар санына қара", check: (s) => ranWith(s, [14], (r) => r.memoryAccesses >= 5) }],
    },
    {
      id: "max",
      title: "Ең үлкенін тап",
      body: "",
      focus: "cpu",
      onEnter: [{ type: "cpu/memory", mem: [3, 9, 4, 1, 5] }, { type: "cpu/source", source: MAX_TEMPLATE }],
      objectives: [{ id: "tests", text: "mem[0..4] максимумын шығар (4 жасырын тест)", check: (s) => graded(s, MAX_TESTS) }],
    },
  ],
};

export const lessonCache: L = {
  id: "arch-8-cache",
  labId: "arch",
  order: 8,
  title: "Caches & Locality",
  summary: "Бір деректі әр түрлі ретпен оқу 4 есе баяу болуы мүмкін. Неге?",
  estimatedMinutes: 25,
  steps: [
    {
      id: "row",
      title: "Жол бойымен",
      body: "",
      focus: "cache",
      onEnter: [{ type: "mode/set", mode: "cache" }, { type: "cache/config", pattern: "row", lines: 4, lineSize: 16 }],
      objectives: [{ id: "row", text: "Матрицаны жол бойымен оқы (4 жол × 16 байт кэш)", check: (s) => s.stats.cacheRuns.some((r) => r.pattern === "row" && r.lines === 4 && r.lineSize === 16) }],
    },
    {
      id: "column",
      title: "Баған бойымен",
      body: "",
      focus: "cache",
      onEnter: [{ type: "cache/config", pattern: "column", lines: 4, lineSize: 16 }],
      objectives: [{ id: "col", text: "Сол кэшпен баған бойымен оқы", check: (s) => s.stats.cacheRuns.some((r) => r.pattern === "column" && r.lines === 4 && r.lineSize === 16) }],
    },
    {
      id: "bigger",
      title: "Кэшті үлкейт",
      body: "",
      focus: "cache",
      objectives: [{ id: "fit", text: "Баған бойымен оқығанда hit rate ≥ 75% болатын кэш таңда", check: (s) => s.stats.cacheRuns.some((r) => r.pattern === "column" && r.hits / 64 >= 0.75) }],
    },
  ],
};

export const archLessons: L[] = [lessonBinary, lessonArith, lessonGates, lessonAdder, lessonCpu, lessonAsm, lessonMemory, lessonCache, lessonPsetArch].map((l) =>
  withDeepDives(withContent(l, archContent[l.id] ?? {}), archDeepDives[l.id] ?? {}),
);
