import { LessonEngine } from "@inside-tech/lesson-engine";
import { SimulationRuntime, replay } from "@inside-tech/sim-core";
import { describe, expect, it } from "vitest";
import { iotDeepDives } from "./deep";
import { iotLabPlugin, iotLessons, type IotLabAction } from "./index";

describe("iot lab content", () => {
  for (const lesson of iotLessons)
    for (const step of lesson.steps)
      it(`${lesson.id}/${step.id}`, () => {
        expect(step.body.length, "lecture text").toBeGreaterThan(600);
        expect(step.body).toMatch(/## /);
        expect(step.quiz?.length ?? 0).toBeGreaterThanOrEqual(2);
        for (const q of step.quiz ?? []) {
          expect(q.options.length).toBeGreaterThanOrEqual(3);
          expect(new Set(q.options).size).toBe(q.options.length);
          expect(q.answer).toBeLessThan(q.options.length);
          expect(q.explain.length).toBeGreaterThan(20);
        }
      });
  it("deep dives are well-formed", () => {
    let n = 0;
    for (const dives of Object.values(iotDeepDives))
      for (const text of Object.values(dives)) {
        n++;
        expect(text.split("\n").filter((l) => /^##+ /.test(l))).toHaveLength(1);
        expect((text.match(/```/g) ?? []).length % 2).toBe(0);
      }
    expect(n).toBeGreaterThanOrEqual(4);
  });
});

type D = (a: IotLabAction) => void;

const scripts: Record<string, Record<string, (d: D) => void>> = {
  "iot-1-adc": {
    read: (d) => d({ type: "adc/read" }),
    bits: (d) => {
      d({ type: "adc/set", bits: 11 });
      d({ type: "adc/read" });
      d({ type: "adc/set", bits: 12 });
      d({ type: "adc/read" });
    },
  },
  "iot-2-sampling": {
    alias: (d) => d({ type: "sampling/set", fs: 60 }),
    nyquist: (d) => d({ type: "sampling/set", fs: 120 }),
  },
  "iot-3-filter": {
    raw: (d) => d({ type: "filter/run" }),
    tune: (d) => {
      d({ type: "filter/set", alpha: 0.15 });
      d({ type: "filter/run" });
    },
  },
  "iot-4-thermostat": {
    chatter: (d) => d({ type: "thermo/run" }),
    hysteresis: (d) => {
      d({ type: "thermo/set", hysteresis: 1.2 });
      d({ type: "thermo/run" });
    },
  },
  "iot-5-pid": {
    p: (d) => d({ type: "pid/run" }),
    tune: (d) => {
      d({ type: "pid/set", kp: 10, ki: 5, kd: 4 });
      d({ type: "pid/run" });
    },
  },
  "iot-6-arm": {
    fk: (d) => {
      // Search integer joint angles like a student turning the sliders.
      for (let t1 = 0; t1 <= 90; t1 += 1)
        for (let t2 = 0; t2 <= 90; t2 += 1) {
          const tip = [2 * Math.cos((t1 * Math.PI) / 180) + 1.5 * Math.cos(((t1 + t2) * Math.PI) / 180), 2 * Math.sin((t1 * Math.PI) / 180) + 1.5 * Math.sin(((t1 + t2) * Math.PI) / 180)];
          if (Math.hypot(tip[0]! - 2.5, tip[1]! - 1.5) < 0.05) return d({ type: "arm/set", t1, t2 });
        }
    },
    ik: (d) => {
      d({ type: "arm/ik", elbow: "up" });
      d({ type: "arm/ik", elbow: "down" });
      d({ type: "arm/target", target: 2 });
      d({ type: "arm/ik", elbow: "up" });
    },
  },
  "iot-7-kalman": {
    extremes: (d) => {
      d({ type: "kalman/set", r: 1000 });
      d({ type: "kalman/run" });
      d({ type: "kalman/set", q: 100, r: 9 });
      d({ type: "kalman/run" });
    },
    fuse: (d) => {
      d({ type: "kalman/set", q: 0.05, r: 9 });
      d({ type: "kalman/run" });
    },
  },
  "iot-8-mqtt": {
    topics: (d) => {
      d({ type: "mqtt/subscribe", filter: "home/#" });
      d({ type: "mqtt/subscribe", filter: "home/+/temp" });
    },
    power: (d) => [10, 15].forEach((minutes) => d({ type: "power/set", minutes, radio: "wifi" })),
  },
  "iot-9-pset": {
    heavy: (d) => {
      d({ type: "pid/set", kp: 10, ki: 5, kd: 4 });
      d({ type: "pid/run" });
    },
    gps: (d) => {
      d({ type: "kalman/set", q: 0.05, r: 36 });
      d({ type: "kalman/run" });
    },
    minute: (d) => d({ type: "power/set", minutes: 1, radio: "lora" }),
  },
};

describe("iot lessons are completable", () => {
  for (const lesson of iotLessons)
    it(lesson.id, () => {
      const rt = new SimulationRuntime(iotLabPlugin, 1);
      const engine = new LessonEngine(lesson);
      const sync = () => engine.update(rt.getState(), rt.evaluate());
      const d: D = (a) => {
        rt.dispatch(a);
        sync();
      };
      engine.step.onEnter?.forEach((a) => rt.dispatch(a));
      sync();
      expect(engine.view().objectives.some((o) => o.done)).toBe(false);
      for (const step of lesson.steps) {
        scripts[lesson.id]![step.id]!(d);
        sync();
        expect(engine.view().objectives.filter((o) => !o.done).map((o) => o.text), `${lesson.id}/${step.id}`).toEqual([]);
        for (const q of step.quiz ?? []) expect(engine.answer(q.id, q.answer).correct).toBe(true);
        engine.advance()?.onEnter?.forEach((a) => rt.dispatch(a));
        sync();
      }
      expect(engine.isLessonComplete()).toBe(true);
      expect(replay(iotLabPlugin, rt.record())).toEqual(rt.getState());
    });
});

describe("autograder", () => {
  const pset = iotLessons.find((l) => l.id === "iot-9-pset")!;
  const check = (step: string, actions: IotLabAction[]) => {
    const rt = new SimulationRuntime(iotLabPlugin, 1);
    const st = pset.steps.find((s) => s.id === step)!;
    st.onEnter?.forEach((a) => rt.dispatch(a));
    actions.forEach((a) => rt.dispatch(a));
    return st.objectives.every((o) => o.check(rt.getState(), { assessment: rt.evaluate() }));
  };
  it("gains tuned for the light lift, or too aggressive, fail on the heavy one", () => {
    expect(check("heavy", [{ type: "pid/set", kp: 15, ki: 5, kd: 5 }, { type: "pid/run" }])).toBe(false);
    expect(check("heavy", [{ type: "pid/set", kp: 20, ki: 8, kd: 6 }, { type: "pid/run" }])).toBe(false);
    expect(check("heavy", [{ type: "pid/set", kp: 10, ki: 5, kd: 4, plant: "lift" }, { type: "pid/run" }])).toBe(false);
  });
  it("trusting the noisy GPS, or a quieter GPS, does not pass", () => {
    expect(check("gps", [{ type: "kalman/run" }])).toBe(false);
    expect(check("gps", [{ type: "kalman/set", gpsNoise: 3, q: 0.05, r: 9 }, { type: "kalman/run" }])).toBe(false);
  });
  it("Wi-Fi every minute drains the battery in a month", () => {
    expect(check("minute", [{ type: "power/set", minutes: 1, radio: "wifi" }])).toBe(false);
    expect(check("minute", [{ type: "power/set", minutes: 15, radio: "lora" }])).toBe(false);
  });
  it("a filter that only matches one home sensor or more than the two is rejected", async () => {
    const lesson = iotLessons.find((l) => l.id === "iot-8-mqtt")!;
    const obj = lesson.steps[0]!.objectives[0]!;
    for (const f of ["home/kitchen/temp", "home/#", "+/temp", "home/+/+"]) {
      const rt = new SimulationRuntime(iotLabPlugin, 1);
      rt.dispatch({ type: "mqtt/subscribe", filter: f });
      expect(obj.check(rt.getState(), { assessment: rt.evaluate() }), f).toBe(false);
    }
  });
});
