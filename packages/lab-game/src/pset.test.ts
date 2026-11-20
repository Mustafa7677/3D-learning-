import { describe, expect, it } from "vitest";
import { analyzeLevel } from "./game";
import { levelMeetsSpec } from "./pset";

const L = (...rows: string[]) => rows;

describe("BFS level analysis", () => {
  it("measures shortest paths, not any path", () => {
    // Coin is 4 steps away in a straight line even though a longer detour exists.
    const r = analyzeLevel(L("#######", "#p...c#", "#.###.#", "#.....#", "#######"));
    expect(r.farthestCoin).toBe(4);
    expect(r.reachableCoins).toBe(1);
  });

  it("does not walk through walls", () => {
    const r = analyzeLevel(L("#######", "#p.#c.#", "#..#.e#", "#######"));
    expect(r).toMatchObject({ coins: 1, reachableCoins: 0, enemies: 1, reachableEnemies: 0 });
  });

  it("the spec rejects unreachable or crowded levels", () => {
    const good = ["###########", "#p.c.c.c.c#", "#########.#", "#c........#", "#.#########", "#.........#", "#.........#", "#....e....#", "#.........#", "#e........#", "###########"];
    expect(levelMeetsSpec(good)).toBe(true);
    const walledOff = good.map((r, j) => (j === 4 ? "###########" : r));
    expect(levelMeetsSpec(walledOff)).toBe(false);
    const short = ["###########", "#pccccc...#", "#ee.......#", ...good.slice(3)];
    expect(levelMeetsSpec(short)).toBe(false);
  });
});
