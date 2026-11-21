import { LessonEngine } from "@inside-tech/lesson-engine";
import { SimulationRuntime, replay } from "@inside-tech/sim-core";
import { describe, expect, it } from "vitest";
import { algoDeepDives } from "./deep";
import { algoLabPlugin, algoLessons, type AlgoLabAction, type AlgoLabState } from "./index";

describe("algorithms lab content", () => {
  for (const lesson of algoLessons) {
    for (const step of lesson.steps) {
      it(`${lesson.id}/${step.id}`, () => {
        expect(step.body.length, "lecture text").toBeGreaterThan(600);
        expect(step.body).toMatch(/## /);
        expect(step.quiz?.length ?? 0).toBeGreaterThanOrEqual(2);
        for (const q of step.quiz ?? []) {
          expect(q.options.length).toBeGreaterThanOrEqual(3);
          expect(new Set(q.options).size).toBe(q.options.length);
          expect(q.answer).toBeGreaterThanOrEqual(0);
          expect(q.answer).toBeLessThan(q.options.length);
          expect(q.explain.length).toBeGreaterThan(20);
        }
      });
    }
  }
  it("deep dives are well-formed", () => {
    let n = 0;
    for (const dives of Object.values(algoDeepDives))
      for (const text of Object.values(dives)) {
        n++;
        const heads = text.split("\n").filter((l) => /^##+ /.test(l));
        expect(heads).toHaveLength(1);
        expect(heads[0]).toMatch(/^## Тереңірек: /);
        expect((text.match(/```/g) ?? []).length % 2).toBe(0);
      }
    expect(n).toBeGreaterThanOrEqual(6);
  });
});

describe("algorithms lab plugin", () => {
  it("plays a sort to the end at the chosen speed and records the run", () => {
    const rt = new SimulationRuntime(algoLabPlugin, 1);
    rt.dispatch({ type: "sort/config", alg: "selection", preset: "random", n: 10 });
    rt.dispatch({ type: "speed/set", speed: 400 });
    rt.dispatch({ type: "sort/play" });
    rt.stepTicks(120);
    const s = rt.getState();
    expect(s.sort.cursor).toBe(s.sort.total);
    expect(s.sort.arr).toEqual([...s.sort.arr].sort((a, b) => a - b));
    expect(s.stats.sortRuns.at(-1)).toMatchObject({ alg: "selection", n: 10, comparisons: 45 });
  });

  it("is deterministic and replayable", () => {
    const rt = new SimulationRuntime(algoLabPlugin, 5);
    rt.dispatch({ type: "sort/config", alg: "quick", n: 20 });
    for (let i = 0; i < 30; i++) rt.dispatch({ type: "sort/step" });
    rt.dispatch({ type: "graph/config", alg: "dijkstra" });
    rt.dispatch({ type: "graph/play" });
    rt.stepTicks(200);
    rt.dispatch({ type: "bench/run", alg: "merge", n: 2048 });
    expect(replay(algoLabPlugin, rt.record())).toEqual(rt.getState());
  });

  it("clamps sizes", () => {
    const rt = new SimulationRuntime(algoLabPlugin, 1);
    rt.dispatch({ type: "sort/config", n: 10_000 });
    rt.dispatch({ type: "bench/run", alg: "bubble", n: 1e9 });
    expect(rt.getState().sort.n).toBe(48);
    expect(rt.getState().stats.bench[0]!.n).toBe(4096);
  });
});

type D = (a: AlgoLabAction) => void;
const finishSort = (d: D, cfg: Omit<Extract<AlgoLabAction, { type: "sort/config" }>, "type">) => {
  d({ type: "sort/config", ...cfg });
  d({ type: "sort/finish" });
};
const search = (d: D, cfg: Omit<Extract<AlgoLabAction, { type: "search/config" }>, "type">) => {
  d({ type: "search/config", ...cfg });
  d({ type: "search/finish" });
};
const graph = (d: D, cfg: Omit<Extract<AlgoLabAction, { type: "graph/config" }>, "type">) => {
  d({ type: "graph/config", ...cfg });
  d({ type: "graph/finish" });
};
const steps = (d: D, n: number) => {
  for (let i = 0; i < n; i++) d({ type: "sort/step" });
};

const scripts: Record<string, Record<string, (d: D, s: () => AlgoLabState) => void>> = {
  "algo-10-hash": {
    collide: (d) => {
      d({ type: "hash/fill", set: "anagrams" });
      d({ type: "hash/config", fn: "poly" });
    },
    load: (d) => {
      d({ type: "hash/fill", set: "cities" });
      d({ type: "hash/config", resize: true });
    },
  },
  "algo-11-heap": {
    push: (d) => {
      for (let i = 0; i < 9; i++) d({ type: "heap/push" });
    },
    pop: (d) => {
      for (let i = 0; i < 9; i++) d({ type: "heap/pop" });
    },
  },
  "algo-12-dp": {
    table: (d) => {
      for (let i = 0; i < 10; i++) d({ type: "dp/step" });
      d({ type: "dp/finish" });
    },
    greedy: (d) => {
      d({ type: "dp/greedy" });
      d({ type: "dp/finish" });
    },
  },
  "algo-1-search": {
    linear: (d) => {
      d({ type: "search/finish" });
      search(d, { target: 48 });
    },
    binary: (d) => {
      d({ type: "search/finish" });
      search(d, { n: 128, target: 99 });
    },
    unsorted: (d) => d({ type: "search/finish" }),
  },
  "algo-2-bubble": {
    step: (d) => steps(d, 15),
    count: (d) => d({ type: "sort/finish" }),
    early: (d) => d({ type: "sort/finish" }),
  },
  "algo-3-quadratic": {
    selection: (d) => d({ type: "sort/finish" }),
    insertion: (d) => d({ type: "sort/finish" }),
    nearly: (d) => {
      d({ type: "sort/finish" });
      finishSort(d, { alg: "selection" });
    },
  },
  "algo-4-bigo": {
    double: (d) => [256, 512, 1024].forEach((n) => d({ type: "bench/run", alg: "selection", n })),
    nlogn: (d) => [256, 512, 1024].forEach((n) => d({ type: "bench/run", alg: "merge", n })),
    race: () => {},
  },
  "algo-5-merge": {
    watch: (d) => {
      steps(d, 10);
      d({ type: "sort/finish" });
    },
    stable: (d) => {
      d({ type: "sort/finish" });
      finishSort(d, { preset: "random" });
    },
  },
  "algo-6-quick": {
    partition: (d) => {
      steps(d, 10);
      d({ type: "sort/finish" });
    },
    worst: (d) => d({ type: "sort/finish" }),
    fix: (d) => finishSort(d, { pivot: "middle" }),
  },
  "algo-7-graphs": {
    bfs: (d) => d({ type: "graph/finish" }),
    dfs: (d) => d({ type: "graph/finish" }),
    roads: (d) => d({ type: "graph/finish" }),
  },
  "algo-8-dijkstra": {
    run: (d) => d({ type: "graph/finish" }),
    other: (d) => graph(d, { start: "B", goal: "G" }),
  },
  "algo-9-pset": {
    budget: (d) => finishSort(d, { alg: "insertion" }),
    search: (d) => search(d, { kind: "binary" }),
    route: (d) => graph(d, { alg: "dijkstra" }),
  },
};

describe("lessons are completable", () => {
  for (const lesson of algoLessons)
    for (const seed of [1, 42, 2026]) {
      it(`${lesson.id} (seed ${seed})`, () => {
        const rt = new SimulationRuntime(algoLabPlugin, seed);
        const engine = new LessonEngine(lesson);
        const sync = () => engine.update(rt.getState(), rt.evaluate());
        const d: D = (a) => {
          rt.dispatch(a);
          sync();
        };
        engine.step.onEnter?.forEach((a) => rt.dispatch(a));
        sync();
        // Nothing is complete before the learner acts.
        expect(engine.view().objectives.some((o) => o.done)).toBe(false);
        for (const step of lesson.steps) {
          const script = scripts[lesson.id]?.[step.id];
          expect(script, `script for ${step.id}`).toBeDefined();
          script!(d, () => rt.getState());
          sync();
          expect(engine.view().objectives.filter((o) => !o.done).map((o) => o.text), `${lesson.id}/${step.id}`).toEqual([]);
          for (const q of step.quiz ?? []) expect(engine.answer(q.id, q.answer).correct).toBe(true);
          const next = engine.advance();
          if (next) {
            next.onEnter?.forEach((a) => rt.dispatch(a));
            sync();
          }
        }
        expect(engine.isLessonComplete()).toBe(true);
      });
    }
});

describe("problem set autograder", () => {
  const pset = algoLessons.find((l) => l.id === "algo-9-pset")!;
  const check = (s: AlgoLabState, step: number) => pset.steps[step]!.objectives.every((o) => o.check(s, { assessment: algoLabPlugin.evaluate(s) }));
  it("rejects over-budget algorithms and the wrong tool", () => {
    const rt = new SimulationRuntime(algoLabPlugin, 1);
    pset.steps[0]!.onEnter!.forEach((a) => rt.dispatch(a));
    rt.dispatch({ type: "sort/finish" }); // merge sort: ≈ 80 comparisons
    expect(check(rt.getState(), 0)).toBe(false);
    rt.dispatch({ type: "sort/config", alg: "bubble" });
    rt.dispatch({ type: "sort/finish" });
    expect(check(rt.getState(), 0)).toBe(false);
    pset.steps[1]!.onEnter!.forEach((a) => rt.dispatch(a));
    rt.dispatch({ type: "search/finish" }); // linear: 120 probes
    expect(check(rt.getState(), 1)).toBe(false);
    pset.steps[2]!.onEnter!.forEach((a) => rt.dispatch(a));
    rt.dispatch({ type: "graph/finish" }); // BFS: cost 10
    expect(check(rt.getState(), 2)).toBe(false);
  });
});
