import { describe, expect, it } from "vitest";
import { runUnionFind } from "./uf";

describe("union-find", () => {
  it("naive linking of a chain: height 15, every pass of finds costs 120 hops", () => {
    expect(runUnionFind("naive")).toMatchObject({ height: 15, firstPass: 120, secondPass: 120 });
  });
  it("path compression: the first pass pays 29 and flattens the tree; the second costs 15", () => {
    expect(runUnionFind("compress")).toMatchObject({ height: 15, firstPass: 29, secondPass: 15 });
  });
  it("union by rank never lets the tree grow: height 1, 15 hops", () => {
    expect(runUnionFind("rank")).toMatchObject({ height: 1, firstPass: 15, secondPass: 15 });
  });
});
