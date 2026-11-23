import { describe, expect, it } from "vitest";
import { search, searchIndex } from "./search";

const top = (q: string) => search(q)[0];

describe("site search", () => {
  it("indexes every lesson, lab, tool, problem and episode", () => {
    const kinds = searchIndex().reduce<Record<string, number>>((m, x) => ((m[x.kind] = (m[x.kind] ?? 0) + 1), m), {});
    expect(kinds.lesson).toBe(160);
    expect(kinds.lab).toBe(11);
    expect(kinds.tool).toBe(16);
    expect(kinds.problem).toBe(7);
    expect(kinds.episode).toBe(7);
  });

  it("finds through Kazakh endings and by title first", () => {
    expect(top("векторларды")!.title).toBe("Векторлар және олармен амалдар");
    expect(top("эллипс")!.href).toBe("/labs/math/ag-3-ellipse");
    expect(top("фокус")!.href).toBe("/focus");
    expect(top("бос парақ")!.href).toBe("/recall");
  });

  it("every word must match; key ideas inside lessons count", () => {
    expect(search("гипербола парабола").some((x) => x.href === "/labs/math/ag-4-conics")).toBe(true);
    expect(search("эксцентриситет").some((x) => x.href === "/labs/math/ag-3-ellipse")).toBe(true);
    expect(search("туған күн").some((x) => x.href === "/problems?p=birthday")).toBe(true);
    expect(search("zzzz qqqq")).toEqual([]);
    expect(search(" ")).toEqual([]);
  });

  it("finds the learning course and the comics in it", () => {
    expect(search("қайта оқу").some((x) => x.kind === "episode")).toBe(true);
  });
});
