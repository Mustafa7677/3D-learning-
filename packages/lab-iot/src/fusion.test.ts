import { describe, expect, it } from "vitest";
import { runFusion } from "./fusion";

describe("sensor fusion", () => {
  it("gyro alone drifts 10° in 20 s (0.5°/s bias); RMS 5.76°", () => {
    expect(runFusion("gyro")).toMatchObject({ rms: 5.76, finalError: 10 });
  });
  it("accelerometer alone does not drift but is noisy: RMS 3.49°", () => {
    expect(runFusion("accel").rms).toBe(3.49);
  });
  it("complementary filter, α = 0.98: RMS 0.43°", () => {
    expect(runFusion("complementary", 0.98).rms).toBe(0.43);
  });
  it("α too low lets noise in (2.02°), too high lets drift in (3.99°)", () => {
    expect(runFusion("complementary", 0.5).rms).toBe(2.02);
    expect(runFusion("complementary", 0.999).rms).toBe(3.99);
  });
});
