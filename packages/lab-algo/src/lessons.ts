import { algoMiddleContent, lessonDp, lessonHash, lessonHeap, lessonUnionFind } from "./middle";
import { withContent, withDeepDives, type LessonDefinition } from "@inside-tech/lesson-engine";
import { algoContent } from "./content";
import { algoDeepDives } from "./deep";
import type { AlgoLabAction, AlgoLabState, SortRun } from "./plugin";
import { lessonPsetAlgo } from "./pset";
import type { SortAlg } from "./sort";

type L = LessonDefinition<AlgoLabState, AlgoLabAction>;

const runs = (s: AlgoLabState, alg: SortAlg, f: (r: SortRun) => boolean = () => true) => s.stats.sortRuns.filter((r) => r.alg === alg && f(r));
const ran = (s: AlgoLabState, alg: SortAlg, f?: (r: SortRun) => boolean) => runs(s, alg, f).length > 0;
const benchNs = (s: AlgoLabState, alg: SortAlg) => [...new Set(s.stats.bench.filter((p) => p.alg === alg && p.preset === "random").map((p) => p.n))].sort((a, b) => a - b);
const quadratic = (n: number) => (n * (n - 1)) / 2;

export const lessonSearch: L = {
  id: "algo-1-search",
  labId: "algo",
  order: 1,
  title: "Searching",
  summary: "Сызықтық және екілік іздеу: n қадам мен log₂n қадамның айырмашылығы.",
  estimatedMinutes: 20,
  steps: [
    {
      id: "linear",
      title: "Сызықтық іздеу",
      body: "",
      focus: "search",
      onEnter: [{ type: "mode/set", mode: "search" }, { type: "search/config", kind: "linear", n: 32, sorted: true, target: 47 }],
      objectives: [
        { id: "found", text: "Сызықтық іздеумен 47-ні тап", check: (s) => s.stats.searches.some((x) => x.kind === "linear" && x.found && x.target === 47) },
        { id: "missing", text: "Жоқ санды ізде (мысалы 48): неше қадам кетеді?", check: (s) => s.stats.searches.some((x) => x.kind === "linear" && !x.present && x.probes === x.n) },
      ],
    },
    {
      id: "binary",
      title: "Екілік іздеу",
      body: "",
      focus: "search",
      onEnter: [{ type: "search/config", kind: "binary", n: 32, sorted: true, target: 47 }],
      objectives: [
        { id: "found", text: "Екілік іздеумен 47-ні тап", check: (s) => s.stats.searches.some((x) => x.kind === "binary" && x.sorted && x.found && x.target === 47) },
        { id: "big", text: "128 элементте екілік іздеу жүргіз (≤ 8 қадам)", check: (s) => s.stats.searches.some((x) => x.kind === "binary" && x.sorted && x.n >= 128 && x.probes <= 8) },
      ],
    },
    {
      id: "unsorted",
      title: "Екілік іздеудің шарты",
      body: "",
      focus: "search",
      onEnter: [{ type: "search/config", kind: "binary", n: 32, sorted: false, target: 13 }],
      objectives: [
        {
          id: "fail",
          text: "Араластырылған массивте бар санды екілік іздеу таппай қалғанын көр",
          check: (s) => s.stats.searches.some((x) => x.kind === "binary" && !x.sorted && x.present && !x.found),
        },
      ],
    },
  ],
};

export const lessonBubble: L = {
  id: "algo-2-bubble",
  labId: "algo",
  order: 2,
  title: "Bubble Sort",
  summary: "Көршілерді салыстырып ауыстыру. Салыстырулар санын өзің санап, формуламен тексер.",
  estimatedMinutes: 20,
  steps: [
    {
      id: "step",
      title: "Қадамдап орында",
      body: "",
      focus: "sort",
      onEnter: [{ type: "mode/set", mode: "sort" }, { type: "sort/config", alg: "bubble", preset: "random", n: 8 }],
      objectives: [{ id: "manual", text: "Bubble sort-ты кемінде 15 қадам қолмен жүргіз", check: (s) => s.sort.alg === "bubble" && s.sort.manual >= 15 }],
    },
    {
      id: "count",
      title: "Ең нашар жағдай",
      body: "",
      focus: "sort",
      onEnter: [{ type: "sort/config", alg: "bubble", preset: "reversed", n: 16 }],
      objectives: [{ id: "worst", text: "Кері ретті 16 элементті сұрыпта: n(n−1)/2 = 120 салыстыру", check: (s) => ran(s, "bubble", (r) => r.preset === "reversed" && r.n >= 16 && r.comparisons === quadratic(r.n)) }],
    },
    {
      id: "early",
      title: "Ерте тоқтау",
      body: "",
      focus: "sort",
      onEnter: [{ type: "sort/config", alg: "bubble", preset: "sorted", n: 16 }],
      objectives: [{ id: "best", text: "Сұрыпталған массивте bubble sort n − 1 салыстырумен тоқтайды", check: (s) => ran(s, "bubble", (r) => r.preset === "sorted" && r.comparisons === r.n - 1) }],
    },
  ],
};

export const lessonQuadratic: L = {
  id: "algo-3-quadratic",
  labId: "algo",
  order: 3,
  title: "Selection & Insertion",
  summary: "Екі басқа идея, бір O(n²). Бірақ «жақсы» деректерде олардың мінезі мүлде басқа.",
  estimatedMinutes: 20,
  steps: [
    {
      id: "selection",
      title: "Selection sort",
      body: "",
      focus: "sort",
      onEnter: [{ type: "mode/set", mode: "sort" }, { type: "sort/config", alg: "selection", preset: "random", n: 16 }],
      objectives: [{ id: "run", text: "Selection sort-ты 16+ элементте аяқта", check: (s) => ran(s, "selection", (r) => r.n >= 16) }],
    },
    {
      id: "insertion",
      title: "Insertion sort",
      body: "",
      focus: "sort",
      onEnter: [{ type: "sort/config", alg: "insertion", preset: "random", n: 16 }],
      objectives: [{ id: "run", text: "Insertion sort-ты 16+ элементте аяқта", check: (s) => ran(s, "insertion", (r) => r.n >= 16) }],
    },
    {
      id: "nearly",
      title: "Дерек «дерлік сұрыпталған» болса",
      body: "",
      focus: "sort",
      onEnter: [{ type: "sort/config", alg: "insertion", preset: "nearly", n: 32 }],
      objectives: [
        { id: "ins", text: "Insertion sort: дерлік сұрыпталған 32 элемент", check: (s) => ran(s, "insertion", (r) => r.preset === "nearly" && r.n >= 32) },
        { id: "sel", text: "Selection sort: сол дерек: салыстыруларды салыстыр", check: (s) => ran(s, "selection", (r) => r.preset === "nearly" && r.n >= 32) },
      ],
    },
  ],
};

export const lessonBigO: L = {
  id: "algo-4-bigo",
  labId: "algo",
  order: 4,
  title: "Big O",
  summary: "Уақытты емес, қадамдарды өлшейміз. n екі есе өскенде не болады: тәжірибемен.",
  estimatedMinutes: 25,
  steps: [
    {
      id: "double",
      title: "n-ді екі есе өсір",
      body: "",
      focus: "bench",
      onEnter: [{ type: "bench/clear" }],
      objectives: [
        {
          id: "sel",
          text: "Selection sort: кемінде 3 өлшем, ең үлкені ең кішісінен ≥ 4 есе",
          check: (s) => {
            const ns = benchNs(s, "selection");
            return ns.length >= 3 && ns[ns.length - 1]! >= 4 * ns[0]!;
          },
        },
      ],
    },
    {
      id: "nlogn",
      title: "n log n",
      body: "",
      focus: "bench",
      objectives: [
        {
          id: "merge",
          text: "Merge sort: кемінде 3 өлшем, ең үлкені ≥ 1024",
          check: (s) => {
            const ns = benchNs(s, "merge");
            return ns.length >= 3 && ns[ns.length - 1]! >= 1024;
          },
        },
      ],
    },
    {
      id: "race",
      title: "Жарыс",
      body: "",
      focus: "bench",
      objectives: [
        {
          id: "same",
          text: "Бір n ≥ 1024-те selection мен merge-ті салыстыр",
          check: (s) => benchNs(s, "selection").some((n) => n >= 1024 && benchNs(s, "merge").includes(n)),
        },
      ],
    },
  ],
};

export const lessonMerge: L = {
  id: "algo-5-merge",
  labId: "algo",
  order: 5,
  title: "Merge Sort",
  summary: "Бөліп ал да, жеңе бер: рекурсия, біріктіру және n·log₂n.",
  estimatedMinutes: 25,
  steps: [
    {
      id: "watch",
      title: "Бөлу және біріктіру",
      body: "",
      focus: "sort",
      onEnter: [{ type: "mode/set", mode: "sort" }, { type: "sort/config", alg: "merge", preset: "random", n: 16 }],
      objectives: [{ id: "run", text: "Merge sort-ты 16 элементте аяқта (кемінде 10 қадамды қолмен)", check: (s) => ran(s, "merge", (r) => r.n >= 16 && r.manualSteps >= 10) }],
    },
    {
      id: "stable",
      title: "Кез келген деректе бірдей",
      body: "",
      focus: "sort",
      onEnter: [{ type: "sort/config", alg: "merge", preset: "reversed", n: 32 }],
      objectives: [
        { id: "rev", text: "Кері ретті 32 элемент", check: (s) => ran(s, "merge", (r) => r.preset === "reversed" && r.n >= 32) },
        { id: "rnd", text: "Кездейсоқ 32 элемент", check: (s) => ran(s, "merge", (r) => r.preset === "random" && r.n >= 32) },
      ],
    },
  ],
};

export const lessonQuick: L = {
  id: "algo-6-quick",
  labId: "algo",
  order: 6,
  title: "Quicksort",
  summary: "Pivot, бөлу (partition) және ең нашар жағдайдан қалай құтылу керегі.",
  estimatedMinutes: 25,
  steps: [
    {
      id: "partition",
      title: "Partition",
      body: "",
      focus: "sort",
      onEnter: [{ type: "mode/set", mode: "sort" }, { type: "sort/config", alg: "quick", pivot: "last", preset: "random", n: 12 }],
      objectives: [{ id: "run", text: "Quicksort-ты аяқта (кемінде 10 қадамды қолмен)", check: (s) => ran(s, "quick", (r) => r.manualSteps >= 10) }],
    },
    {
      id: "worst",
      title: "Ең нашар жағдай",
      body: "",
      focus: "sort",
      onEnter: [{ type: "sort/config", alg: "quick", pivot: "last", preset: "sorted", n: 32 }],
      objectives: [
        { id: "worst", text: "Сұрыпталған 32 элемент, pivot = соңғы: n(n−1)/2 салыстыру", check: (s) => ran(s, "quick", (r) => r.pivot === "last" && r.preset === "sorted" && r.n >= 32 && r.comparisons === quadratic(r.n)) },
      ],
    },
    {
      id: "fix",
      title: "Pivot-ты дұрыс таңда",
      body: "",
      focus: "sort",
      onEnter: [{ type: "sort/config", alg: "quick", pivot: "last", preset: "sorted", n: 32 }],
      objectives: [
        { id: "fix", text: "Сол деректе pivot = ортаңғы: < n·log₂n салыстыру", check: (s) => ran(s, "quick", (r) => r.pivot === "middle" && r.preset === "sorted" && r.n >= 32 && r.comparisons < r.n * Math.log2(r.n)) },
      ],
    },
  ],
};

export const lessonGraphs: L = {
  id: "algo-7-graphs",
  labId: "algo",
  order: 7,
  title: "Graphs: BFS & DFS",
  summary: "Кезек пен стек: бір ғана құрылымды ауыстырсаң, іздеу мүлде басқаша жүреді.",
  estimatedMinutes: 25,
  steps: [
    {
      id: "bfs",
      title: "BFS: толқын сияқты",
      body: "",
      focus: "graph",
      onEnter: [{ type: "mode/set", mode: "graph" }, { type: "graph/config", preset: "grid", alg: "bfs", start: "A1", goal: "D4" }],
      objectives: [{ id: "run", text: "Торда BFS-ті соңына дейін жүргіз", check: (s) => s.stats.graphRuns.some((r) => r.preset === "grid" && r.alg === "bfs") }],
    },
    {
      id: "dfs",
      title: "DFS: тереңге",
      body: "",
      focus: "graph",
      onEnter: [{ type: "graph/config", preset: "grid", alg: "dfs", start: "A1", goal: "D4" }],
      objectives: [{ id: "run", text: "Сол торда DFS-ті жүргізіп, ретін салыстыр", check: (s) => s.stats.graphRuns.some((r) => r.preset === "grid" && r.alg === "dfs") }],
    },
    {
      id: "roads",
      title: "Ең аз жол ≠ ең арзан жол",
      body: "",
      focus: "graph",
      onEnter: [{ type: "graph/config", preset: "roads", alg: "bfs", start: "A", goal: "H" }],
      objectives: [{ id: "bfs", text: "Жолдар картасында A → H үшін BFS", check: (s) => s.stats.graphRuns.some((r) => r.preset === "roads" && r.alg === "bfs" && r.start === "A" && r.goal === "H") }],
    },
  ],
};

export const lessonDijkstra: L = {
  id: "algo-8-dijkstra",
  labId: "algo",
  order: 8,
  title: "Dijkstra",
  summary: "Салмақты графтағы ең қысқа жол: навигаторлар осылай жұмыс істейді.",
  estimatedMinutes: 25,
  steps: [
    {
      id: "run",
      title: "Дейкстра алгоритмі",
      body: "",
      focus: "graph",
      onEnter: [{ type: "mode/set", mode: "graph" }, { type: "graph/config", preset: "roads", alg: "dijkstra", start: "A", goal: "H" }],
      objectives: [{ id: "run", text: "A → H ең арзан жолын тап (құны 8)", check: (s) => s.stats.graphRuns.some((r) => r.preset === "roads" && r.alg === "dijkstra" && r.start === "A" && r.goal === "H" && r.cost === 8) }],
    },
    {
      id: "other",
      title: "Басқа бағыт",
      body: "",
      focus: "graph",
      objectives: [
        {
          id: "other",
          text: "Басқа бастау не мақсат үшін Дейкстра жүргіз",
          check: (s) => s.stats.graphRuns.some((r) => r.preset === "roads" && r.alg === "dijkstra" && (r.start !== "A" || r.goal !== "H") && r.path.length > 1),
        },
      ],
    },
  ],
};

export const algoLessons: L[] = [
  lessonSearch,
  lessonBubble,
  lessonQuadratic,
  lessonBigO,
  lessonMerge,
  lessonQuick,
  lessonGraphs,
  lessonDijkstra,
  lessonPsetAlgo,
  // Middle level
  lessonHash,
  lessonHeap,
  lessonDp,
  lessonUnionFind,
].map((l) => withDeepDives(withContent(l, algoContent[l.id] ?? algoMiddleContent[l.id] ?? {}), algoDeepDives[l.id] ?? {}));
