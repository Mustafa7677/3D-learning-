import { describe, expect, it } from "vitest";
import { KERNELS, confusion, convolve, edgeResponse, optimize, patients, squareImage } from "./core";

describe("optimizers on the ravine", () => {
  it("SGD has a narrow window: lr 0.1 too slow, 0.45 converges in 36 steps, 0.55 diverges", () => {
    expect(optimize("sgd", 0.1).steps).toBeNull();
    expect(optimize("sgd", 0.45).steps).toBe(36);
    expect(optimize("sgd", 0.55).diverged).toBe(true);
  });
  it("momentum converges where plain SGD crawled or blew up", () => {
    expect(optimize("momentum", 0.1).steps).toBe(59);
    expect(optimize("momentum", 0.55)).toMatchObject({ diverged: false, steps: 62 });
  });
  it("Adam at lr 0.3: 37 steps", () => {
    expect(optimize("adam", 0.3).steps).toBe(37);
  });
});

describe("metrics on imbalanced data", () => {
  const d = patients();
  it("200 people, 10 sick: 'everyone is healthy' scores 95% accuracy and 0 recall", () => {
    expect(d.filter((p) => p.sick)).toHaveLength(10);
    expect(confusion(d, 0.5, true)).toMatchObject({ accuracy: 0.95, recall: 0, tp: 0 });
  });
  it("threshold 0.5: recall 0.9, precision 0.2; threshold 0.7: the same 95% accuracy, recall 0.6, precision 0.5", () => {
    expect(confusion(d, 0.5)).toMatchObject({ tp: 9, fp: 35, fn: 1, recall: 0.9 });
    expect(confusion(d, 0.5).precision).toBeCloseTo(0.2045, 3);
    expect(confusion(d, 0.7)).toMatchObject({ tp: 6, fp: 6, fn: 4, accuracy: 0.95, precision: 0.5, recall: 0.6 });
  });
});

describe("convolution", () => {
  it("Sobel-x answers vertical edges (4) and ignores horizontal ones and flat areas", () => {
    expect(edgeResponse(KERNELS["sobel-x"])).toEqual({ vertical: 4, horizontal: 0, flat: 0 });
    expect(edgeResponse(KERNELS["sobel-y"]).vertical).toBe(0);
  });
  it("on the square, Sobel-x lights the left and right sides only", () => {
    const out = convolve(squareImage(), KERNELS["sobel-x"]);
    expect(out).toHaveLength(36);
    expect(out.slice(12, 18)).toEqual([4, 4, 0, 0, -4, -4]);
  });
  it("blur keeps the overall brightness (its weights sum to 1)", () => {
    expect(edgeResponse(KERNELS.blur).flat).toBeCloseTo(1, 9);
  });
});
