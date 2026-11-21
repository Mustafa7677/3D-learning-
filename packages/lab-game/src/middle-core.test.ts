import { describe, expect, it } from "vitest";
import { bodies, bruteForce, findPath, gridPhase, runGuard } from "./middle-core";

describe("pathfinding", () => {
  it("BFS counts steps, not cost: it wades through the mud, cost 30", () => {
    expect(findPath("bfs")).toMatchObject({ cost: 30 });
  });
  it("Dijkstra finds cost 20 after expanding 139 cells; A* finds the same 20 with 92", () => {
    expect(findPath("dijkstra").cost).toBe(20);
    expect(findPath("dijkstra").expanded).toHaveLength(139);
    expect(findPath("astar").cost).toBe(20);
    expect(findPath("astar").expanded).toHaveLength(92);
  });
  it("greedy and over-weighted A* are fast but pay 30", () => {
    expect(findPath("greedy")).toMatchObject({ cost: 30 });
    expect(findPath("greedy").expanded).toHaveLength(19);
    expect(findPath("astar", 3)).toMatchObject({ cost: 30 });
  });
});

describe("guard state machine", () => {
  it("one radius for seeing and losing: 10 switches; hysteresis 5/7: 4", () => {
    expect(runGuard(5, 5).switches).toBe(10);
    expect(runGuard(5, 7).switches).toBe(4);
    expect(runGuard(5, 7).states).toContain("attack");
  });
});

describe("broad phase", () => {
  const pts = bodies(200);
  it("200 bodies: brute force 19900 pair tests, a 2-unit grid 84, both find the same 30 contacts", () => {
    expect(bruteForce(pts)).toEqual({ checks: 19900, hits: 30 });
    expect(gridPhase(pts, 2)).toEqual({ checks: 84, hits: 30 });
  });
  it("a cell as big as half the world saves nothing", () => {
    expect(gridPhase(pts, 50).checks).toBe(19900);
    expect(gridPhase(pts, 10).checks).toBe(1643);
  });
});
