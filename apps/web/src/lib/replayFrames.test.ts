import { describe, expect, it } from "vitest";
import { SimulationRuntime } from "@inside-tech/sim-core";
import { cloudLabPlugin, cloudLessons } from "@inside-tech/lab-cloud";
import { replayFrames } from "./replayFrames";
import { pluginFor } from "./labPort";

describe("replay frames", () => {
  it("shows when each objective started to hold", () => {
    const lesson = cloudLessons.find((l) => l.id === "cloud-3-scaling")!;
    const rt = new SimulationRuntime(cloudLabPlugin, 5);
    lesson.steps[0]!.onEnter!.forEach((a) => rt.dispatch(a));
    rt.stepTicks(3);
    rt.dispatch({ type: "scale/set", instances: 9 });
    rt.dispatch({ type: "scale/set", instances: 4 });
    rt.stepTicks(2);
    rt.dispatch({ type: "scale/set", instances: 10 });
    const frames = replayFrames(cloudLabPlugin, rt.record(), lesson);
    expect(frames).toHaveLength(5);
    expect(frames[2]!.holds["overload"]).toBeUndefined();
    expect(frames[3]!.holds["overload"]).toEqual(["over"]);
    expect(frames[4]!.holds["slo"]).toEqual(["slo"]);
    expect(frames[4]!.time).toBeCloseTo(5 * rt.record().fixedDt, 6);
  });
  it("knows every lab kind", () => {
    for (const k of ["classifier", "language", "web", "game", "algo", "arch", "sec", "db", "net", "cloud", "iot"]) expect(pluginFor(k)?.id, k).toBeTruthy();
    expect(pluginFor("nope")).toBeUndefined();
  });
});
