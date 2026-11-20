import { describe, expect, it } from "vitest";
import { computeFlex, type FlexModel } from "./index";

const base: FlexModel = { direction: "row", justify: "flex-start", align: "stretch", wrap: false, gap: 10, containerWidth: 600, items: 4 };

describe("flex layout", () => {
  it("packs from the start and stretches to the tallest item", () => {
    const { items } = computeFlex(base);
    expect(items.map((r) => r.x)).toEqual([0, 130, 260, 390]);
    expect(new Set(items.map((r) => r.h))).toEqual(new Set([100]));
  });
  it("space-between pins the first and last item to the edges", () => {
    const { items } = computeFlex({ ...base, justify: "space-between" });
    expect(items[0]!.x).toBe(0);
    expect(items[3]!.x + items[3]!.w).toBeCloseTo(600, 6);
  });
  it("align center centres items on the cross axis", () => {
    const { items } = computeFlex({ ...base, align: "center" });
    expect(items[0]!.y).toBe((100 - 60) / 2);
  });
  it("nowrap shrinks items to fit; wrap breaks lines", () => {
    const narrow = computeFlex({ ...base, containerWidth: 300 });
    const last = narrow.items[3]!;
    expect(last.x + last.w).toBeCloseTo(300, 6);
    const wrapped = computeFlex({ ...base, containerWidth: 300, wrap: true });
    expect(wrapped.items.map((r) => r.w)).toEqual([120, 120, 120, 120]);
    expect(wrapped.items[2]!.y).toBeGreaterThan(0);
    expect(wrapped.height).toBeGreaterThan(narrow.height);
  });
});
