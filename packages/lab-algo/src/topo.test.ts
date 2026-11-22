import { describe, expect, it } from "vitest";
import { CYCLE_EDGE, TOPO_EDGES, topoSort } from "./topo";

describe("topological sort", () => {
  it("all seven courses in order, four semesters at least", () => {
    expect(topoSort(TOPO_EDGES)).toMatchObject({ order: [0, 1, 2, 3, 4, 5, 6], semester: [1, 2, 3, 2, 2, 3, 4], semesters: 4, stuck: [] });
  });
  it("one rule that closes a cycle: three courses can never start", () => {
    expect(topoSort([...TOPO_EDGES, CYCLE_EDGE])).toMatchObject({ order: [0, 3, 4, 5], stuck: [1, 2, 6] });
  });
});
