import { describe, expect, it } from "vitest";
import { archive, runFeature, runSplit } from "./leak";

describe("ai: data leakage", () => {
  it("the antibiotic column wins in the archive and is empty in production", () => {
    expect(archive().production.every((v) => v.antibiotic === 0)).toBe(true);
    expect(runFeature(true)).toMatchObject({ stump: { feature: "antibiotic" }, test: 0.98, production: 0.59 });
  });
  it("without it, the test score is the real score", () => {
    expect(runFeature(false)).toMatchObject({ stump: { feature: "temp", threshold: 37.89 }, test: 0.77, production: 0.77 });
  });
  it("a row split shares patients and flatters the model; a patient split does not", () => {
    expect(runSplit("rows")).toMatchObject({ test: 0.85, fresh: 0.53, shared: 74 });
    expect(runSplit("patients")).toMatchObject({ test: 0.6, fresh: 0.52, shared: 0 });
  });
});
