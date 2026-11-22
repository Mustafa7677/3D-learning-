import { describe, expect, it } from "vitest";
import { runSpring } from "./timestep";

describe("fixed timestep", () => {
  it("stepping with the frame delta and explicit Euler explodes, worse at low FPS", () => {
    expect(runSpring("frame-euler", 30).amplitude).toBeGreaterThan(1e7);
    expect(Math.round(runSpring("frame-euler", 60).amplitude)).toBe(10600);
    expect(runSpring("frame-euler", 144).amplitude).toBe(61.83);
  });
  it("a fixed 1/240 s step with symplectic Euler keeps the energy at any FPS, in the same 720 steps", () => {
    for (const fps of [30, 60, 144]) expect(runSpring("fixed-symplectic", fps)).toMatchObject({ amplitude: 1, steps: 720 });
  });
});
