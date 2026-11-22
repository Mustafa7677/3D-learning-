import { describe, expect, it } from "vitest";
import {
  CARDS,
  FN_LEVELS,
  NAV_LEVELS,
  REASONS,
  applyCard,
  coefficients,
  evalFn,
  fnPar,
  fnStars,
  fnTarget,
  formula,
  navPar,
  navStars,
  run,
  same,
  start,
  whyUnreachable,
  type Card,
  type Fn,
} from "./tactics";

const nav = (id: string) => NAV_LEVELS.find((l) => l.id === id)!;
const fn = (id: string) => FN_LEVELS.find((l) => l.id === id)!;

describe("vector navigator", () => {
  it("pins each level's shortest route or the reason it has none", () => {
    const got = Object.fromEntries(NAV_LEVELS.map((l) => [l.id, navPar(l) ?? whyUnreachable(l)]));
    expect(got).toEqual({ n1: 5, n2: 3, n3: "lattice", n4: "line", n5: 5, n6: 3, n7: "lattice", n8: "walls" });
  });

  it("solves with Cramer's rule: whole coefficients mean a lattice point", () => {
    expect(coefficients(nav("n2"))).toEqual([1, 2]);
    expect(coefficients(nav("n6"))).toEqual([2, -1]);
    expect(coefficients(nav("n7"))).toEqual([0.4, 0.8]);
    expect(coefficients(nav("n4"))).toBeNull();
  });

  it("the asteroid in level 2 forces v first; without it the route is the same length", () => {
    expect(navPar({ ...nav("n2"), rocks: [] })).toBe(3);
  });

  it("the fortress is on the lattice, only walls stop it", () => {
    expect(navPar({ ...nav("n8"), rocks: [] })).toBe(8);
  });

  it("every reason has a sentence, every level has a fair field", () => {
    expect(Object.keys(REASONS)).toHaveLength(3);
    for (const l of NAV_LEVELS) expect(l.rocks.some((r) => r[0] === 0 && r[1] === 0)).toBe(false);
  });

  it("stars", () => {
    expect([navStars(5, 5), navStars(7, 5), navStars(8, 5)]).toEqual([3, 2, 1]);
  });
});

describe("function marksman", () => {
  it("cards move the graph as the rules say, checked pointwise", () => {
    const f: Fn = { base: "cube", a: 2, h: 1, k: -3 };
    const rules: Record<Card, (x: number) => number> = {
      up: (x) => evalFn(f, x) + 1,
      down: (x) => evalFn(f, x) - 1,
      right: (x) => evalFn(f, x - 1),
      left: (x) => evalFn(f, x + 1),
      stretch: (x) => 2 * evalFn(f, x),
      flipx: (x) => -evalFn(f, x),
      flipy: (x) => evalFn(f, -x),
    };
    for (const c of Object.keys(CARDS) as Card[]) {
      const g = applyCard(f, c);
      for (const x of [-2, -0.5, 0, 1.5, 3]) expect(evalFn(g, x)).toBeCloseTo(rules[c](x), 9);
    }
  });

  it("an even base forgets the y-axis flip", () => {
    expect(same(applyCard(start("sq"), "flipy"), start("sq"))).toBe(true);
    expect(same(applyCard(start("cube"), "flipy"), start("cube"))).toBe(false);
  });

  it("order matters: up then flip is not flip then up", () => {
    expect(formula(run(start("sq"), ["up", "flipx"]))).toBe("y = −x² − 1");
    expect(formula(run(start("sq"), ["flipx", "up"]))).toBe("y = −x² + 1");
    expect(formula(run(start("sq"), ["stretch", "up"]))).toBe("y = 2x² + 1");
    expect(formula(run(start("sq"), ["up", "stretch"]))).toBe("y = 2x² + 2");
  });

  it("pins every target and its shortest programme", () => {
    const got = Object.fromEntries(FN_LEVELS.map((l) => [l.id, [formula(fnTarget(l)), fnPar(l)]]));
    expect(got).toEqual({
      f1: ["y = (x − 2)² + 1", 3],
      f2: ["y = −|x| + 2", 3],
      f3: ["y = −x² − 1", 2],
      f4: ["y = 2x² + 1", 2],
      f5: ["y = −(x − 1)³ + 1", 3],
      f6: ["y = −2|x + 1| − 1", 4],
    });
    for (const l of FN_LEVELS) for (const c of l.answer) expect(l.cards).toContain(c);
  });

  it("stars", () => {
    expect([fnStars(2, 2, false), fnStars(3, 2, false), fnStars(2, 2, true), fnStars(3, 2, true)]).toEqual([3, 2, 2, 1]);
  });
});
