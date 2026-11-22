import { describe, expect, it } from "vitest";
import { det, inverse, mul, type M3 } from "./linalg";

/** The numbers the worked examples and error hunts rely on, recomputed. */
const m2 = (a: number, b: number, c: number, d: number): M3 => [
  [a, b, 0],
  [c, d, 0],
  [0, 0, 1],
];

describe("math media: the numbers on the boards are right", () => {
  it("vectors and dot products", () => {
    expect(Math.hypot(4 - 1, 6 - 2, 0)).toBe(5);
    expect([2 * 1 - 4, 2 * -3 - 1, 2 * 2 - 0]).toEqual([-2, -7, 4]);
    expect(1 * 2 + 2 * 1 + 2 * -2).toBe(0);
    expect((3 * 2 + 4 * 1) / Math.hypot(3, 4)).toBe(2);
  });
  it("systems: (1, 2) for both small systems", () => {
    for (const [x, y] of [[1, 2]] as [number, number][]) {
      expect([x + 2 * y, 3 * x - y]).toEqual([5, 1]);
      expect([x + y, 2 * x + 3 * y]).toEqual([3, 8]);
    }
  });
  it("matrices: A·v = (7, −3) and B·A = [[0, −1], [1, 1]]", () => {
    expect([2 * 4 + 1 * -1, 0 * 4 + 3 * -1]).toEqual([7, -3]);
    const BA = mul(m2(0, -1, 1, 0), m2(1, 1, 0, 1));
    expect([BA[0][0], BA[0][1], BA[1][0], BA[1][1]]).toEqual([0, -1, 1, 1]);
  });
  it("inverse: [[2, 1], [5, 3]]⁻¹ = [[3, −1], [−5, 2]]; the cipher round-trips", () => {
    const inv = inverse(m2(2, 1, 5, 3))!;
    expect([inv[0][0], inv[0][1], inv[1][0], inv[1][1]]).toEqual([3, -1, -5, 2]);
    expect(det(m2(2, 4, 1, 2))).toBe(0);
    expect([1 * 1 + 1 * 2, 0 * 1 + 1 * 2]).toEqual([3, 2]);
    expect([1 * 3 - 1 * 2, 0 * 3 + 1 * 2]).toEqual([1, 2]);
  });
  it("determinants: 7 and −2", () => {
    expect(det([[1, 2, 0], [0, 3, 1], [2, 0, 1]])).toBe(7);
    expect(det(m2(1, 2, 3, 4))).toBe(-2);
  });
  it("basis: (5, 5) is (2, 1) in the basis (2, 1), (1, 3); (3, 1) is (2, 1) in (1, 1), (1, −1)", () => {
    expect([2 * 2 + 1 * 1, 2 * 1 + 1 * 3]).toEqual([5, 5]);
    expect([2 * 1 + 1 * 1, 2 * 1 + 1 * -1]).toEqual([3, 1]);
  });
  it("eigenvalues of [[4, 1], [2, 3]] are 5 and 2", () => {
    for (const l of [5, 2]) expect(det(m2(4 - l, 1, 2, 3 - l)) * 1).toBeCloseTo(0, 9);
    expect(det(m2(4 - 5, 1, 2, 3 - 5) as M3)).toBeCloseTo(0, 9);
  });
});
