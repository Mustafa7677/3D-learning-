import { describe, expect, it } from "vitest";
import { bigPlusOne, pointThree, repeatedSum } from "./float";

describe("floating point", () => {
  it("float64: 0.1 + 0.2 = 0.30000000000000004, not 0.3", () => {
    expect(pointThree(64)).toMatchObject({ equals: false, text: "0.30000000000000004" });
  });
  it("float32 happens to round both sides to the same value", () => {
    expect(pointThree(32).equals).toBe(true);
  });
  it("adding 0.1 a hundred thousand times in float32 gives 9998.556640625 (error 1.44)", () => {
    expect(repeatedSum(32, false)).toMatchObject({ sum: 9998.556640625 });
    expect(repeatedSum(32, false).error).toBeCloseTo(1.443, 3);
  });
  it("Kahan summation in the same float32 gets exactly 10000", () => {
    expect(repeatedSum(32, true)).toMatchObject({ sum: 10000, error: 0 });
  });
  it("above 2^24, float32 cannot add 1; float64 can", () => {
    expect(bigPlusOne(32)).toBe(0);
    expect(bigPlusOne(64)).toBe(1);
  });
});
