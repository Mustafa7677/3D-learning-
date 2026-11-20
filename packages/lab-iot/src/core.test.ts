import { describe, expect, it } from "vitest";
import {
  HEAVY,
  MV_PER_C,
  adc,
  aliasFrequency,
  batteryDays,
  ema,
  filterMetrics,
  fk,
  ik,
  kalman,
  minBitsFor,
  resolutionC,
  runPid,
  thermostat,
  topicMatches,
  validFilter,
  TOPICS,
} from "./core";

describe("ADC", () => {
  it("resolution halves with every bit; 12 bits are needed for 0.1 °C", () => {
    expect(resolutionC(8)).toBeCloseTo(1.289, 3);
    expect(resolutionC(11)).toBeCloseTo(0.161, 3);
    expect(resolutionC(12)).toBeCloseTo(0.0806, 4);
    expect(minBitsFor(0.1)).toBe(12);
  });
  it("23.47 °C reads as code 18 at 8 bits and 291 at 12 bits", () => {
    const v = (23.47 * MV_PER_C) / 1000;
    expect(adc(v, 8).code).toBe(18);
    expect((adc(v, 8).volts * 1000) / MV_PER_C).toBeCloseTo(23.2, 1);
    expect(adc(v, 12).code).toBe(291);
    expect(Math.abs((adc(v, 12).error * 1000) / MV_PER_C)).toBeLessThan(0.03);
  });
});

describe("sampling", () => {
  it("aliases 50 Hz as in the lecture", () => {
    expect(aliasFrequency(50, 60)).toBe(10);
    expect(aliasFrequency(50, 90)).toBe(40);
    expect(aliasFrequency(50, 45)).toBe(5);
    expect(aliasFrequency(50, 70)).toBe(20);
    expect(aliasFrequency(50, 120)).toBe(50);
  });
});

describe("filtering", () => {
  it("EMA steps by alpha", () => {
    expect(ema([20, 30], 0.2)).toEqual([20, 22]);
  });
  it("trades noise for lag as the table says", () => {
    const r = (a: number) => filterMetrics(a);
    expect(r(1).noise).toBeCloseTo(1.24, 2);
    expect(r(0.2)).toMatchObject({ lag: 8 });
    expect(r(0.2).noise).toBeGreaterThan(0.4);
    expect(r(0.15).noise).toBeCloseTo(0.36, 2);
    expect(r(0.15).lag).toBe(11);
    expect(r(0.1).lag).toBe(18);
    expect(r(0.05).lag).toBe(43);
  });
});

describe("thermostat", () => {
  it("chatters without hysteresis and calms down with it", () => {
    expect(thermostat(0).switches).toBe(355);
    expect(thermostat(1).switches).toBe(98);
    expect(thermostat(2).maxDev).toBeGreaterThan(1);
  });
});

describe("PID", () => {
  it("P-only leaves load/Kp of error", () => {
    expect(runPid({ kp: 5, ki: 0, kd: 0 }).ssError).toBeCloseTo(0.4, 2);
    expect(runPid({ kp: 10, ki: 0, kd: 4 }).ssError).toBeCloseTo(0.2, 2);
    expect(runPid({ kp: 10, ki: 0, kd: 0 }).overshoot).toBeCloseTo(0.424, 2);
    expect(runPid({ kp: 10, ki: 5, kd: 0 }).overshoot).toBeCloseTo(0.771, 2);
  });
  it("the lecture's slow PID settles in 5.25 s", () => {
    const r = runPid({ kp: 10, ki: 3, kd: 3 });
    expect(r.settle).toBeCloseTo(5.25, 2);
    expect(r.overshoot).toBeCloseTo(0.03, 2);
  });
  it("the heavy lift needs retuning", () => {
    expect(runPid({ kp: 20, ki: 0, kd: 0 }, HEAVY).ssError).toBeCloseTo(0.3, 1);
    expect(runPid({ kp: 10, ki: 5, kd: 4 }, HEAVY).settle).toBeLessThanOrEqual(6);
  });
});

describe("arm", () => {
  it("forward kinematics matches the worked example", () => {
    const { tip } = fk(30, 60);
    expect(tip[0]).toBeCloseTo(1.732, 3);
    expect(tip[1]).toBeCloseTo(2.5, 3);
    expect(fk(0, 90).tip[0]).toBeCloseTo(2, 6);
  });
  it("inverse kinematics has two solutions and none out of reach", () => {
    const up = ik(-1, 2.5, "up")!;
    const down = ik(-1, 2.5, "down")!;
    expect(up.t1).toBeCloseTo(145.1, 1);
    expect(up.t2).toBeCloseTo(-80.4, 1);
    expect(down.t1).toBeCloseTo(78.5, 1);
    for (const s of [up, down]) {
      const { tip } = fk(s.t1, s.t2);
      expect(tip[0]).toBeCloseTo(-1, 6);
      expect(tip[1]).toBeCloseTo(2.5, 6);
    }
    expect(ik(4, 2, "up")).toBeNull();
  });
});

describe("Kalman", () => {
  it("fusion beats both sensors", () => {
    const k = kalman(0.05, 9);
    expect(k.rmse.odo).toBeCloseTo(2.29, 2);
    expect(k.rmse.gps).toBeCloseTo(2.77, 2);
    expect(k.rmse.fused).toBeCloseTo(0.5, 2);
    expect(k.odo[99]! - k.truth[99]!).toBeCloseTo(3.88, 2);
    expect(kalman(0.05, 1000).rmse.fused).toBeCloseTo(1.99, 2);
    expect(kalman(100, 9).rmse.fused).toBeCloseTo(2.56, 2);
  });
});

describe("MQTT and power", () => {
  it("matches topic filters like a broker", () => {
    const m = (f: string) => TOPICS.filter((t) => topicMatches(f, t));
    expect(m("home/#")).toHaveLength(4);
    expect(m("+/temp")).toEqual(["garden/temp"]);
    expect(m("#")).toHaveLength(7);
    expect(m("garden/+")).toEqual(["garden/temp"]);
    expect(m("home/+/temp").sort()).toEqual(["home/bedroom/temp", "home/kitchen/temp"]);
    expect(validFilter("home/#/temp")).toBe(false);
    expect(validFilter("home/kit+")).toBe(false);
  });
  it("battery life follows the table", () => {
    expect(Math.round(batteryDays(1, "wifi"))).toBe(31);
    expect(Math.round(batteryDays(10, "wifi"))).toBe(301);
    expect(Math.round(batteryDays(15, "wifi"))).toBe(444);
    expect(Math.round(batteryDays(60, "wifi"))).toBe(1531);
    expect(batteryDays(1, "lora")).toBeGreaterThan(365);
  });
});
