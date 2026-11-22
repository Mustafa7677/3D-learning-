import { LessonEngine } from "@inside-tech/lesson-engine";
import { SimulationRuntime, replay } from "@inside-tech/sim-core";
import { describe, expect, it } from "vitest";
import { netDeepDives } from "./deep";
import { PSET_A, PSET_B, convergenceRounds, netLabPlugin, netLessons, smallestCommonPrefix, type NetLabAction } from "./index";

describe("networks lab content", () => {
  for (const lesson of netLessons)
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
    for (const dives of Object.values(netDeepDives))
      for (const text of Object.values(dives)) {
        n++;
        expect(text.split("\n").filter((l) => /^##+ /.test(l))).toHaveLength(1);
        expect((text.match(/```/g) ?? []).length % 2).toBe(0);
      }
    expect(n).toBeGreaterThanOrEqual(4);
  });
  it("numbers in the lectures match the models", () => {
    expect(convergenceRounds("F")).toBe(3);
    expect(convergenceRounds("F", ["BD"])).toBe(5);
    expect(smallestCommonPrefix(PSET_A, PSET_B)).toBe(25);
  });
});

type D = (a: NetLabAction) => void;
const scripts: Record<string, Record<string, (d: D) => void>> = {
  "net-1-packets": {
    split: (d) => d({ type: "pkt/set", size: 1_000_000, mtu: 1500 }),
    overhead: (d) => {
      d({ type: "pkt/set", size: 100 });
      d({ type: "pkt/set", mtu: 9000 });
    },
  },
  "net-2-ip": {
    cidr: (d) => d({ type: "ip/set", addr: "192.168.10.77", prefix: 26 }),
    same: (d) => {
      d({ type: "ip/set", addr: "192.168.10.77", other: "192.168.10.200", prefix: 24 });
      d({ type: "ip/set", prefix: 25 });
    },
  },
  "net-3-routing": {
    send: (d) => d({ type: "route/send" }),
    fail: (d) => {
      d({ type: "route/toggle", link: "BD" });
      d({ type: "route/send" });
    },
    partition: (d) => {
      d({ type: "route/toggle", link: "DF" });
      d({ type: "route/toggle", link: "EF" });
      d({ type: "route/send" });
    },
  },
  "net-4-dv": {
    converge: (d) => [1, 2, 3].forEach((rounds) => d({ type: "route/rounds", rounds })),
    failure: (d) => {
      d({ type: "route/toggle", link: "BD" });
      for (let r = 0; r <= 5; r++) d({ type: "route/rounds", rounds: r });
    },
  },
  "net-5-reliable": {
    stopwait: (d) => d({ type: "tx/run" }),
    loss: (d) => {
      d({ type: "tx/set", loss: 0.1 });
      d({ type: "tx/run" });
    },
  },
  "net-6-window": {
    window: (d) => {
      d({ type: "tx/set", window: 15 });
      d({ type: "tx/run" });
    },
    bdp: (d) => {
      d({ type: "tx/set", window: 10 });
      d({ type: "tx/run" });
    },
  },
  "net-7-congestion": {
    reno: (d) => d({ type: "cc/run" }),
    tahoe: (d) => {
      d({ type: "cc/set", variant: "tahoe" });
      d({ type: "cc/run" });
    },
  },
  "net-8-nat": {
    out: (d) => {
      d({ type: "nat/out", host: "192.168.1.10", port: 51000 });
      d({ type: "nat/out", host: "192.168.1.11", port: 51000 });
    },
    in: (d) => {
      d({ type: "nat/in", port: 40001 });
      d({ type: "nat/in", port: 40999 });
    },
  },
  "net-9-pset": {
    subnet: (d) => d({ type: "ip/set", prefix: 25 }),
    route: (d) => {
      d({ type: "route/toggle", link: "AB" });
      d({ type: "route/send" });
    },
    window: (d) => {
      d({ type: "tx/set", protocol: "window", window: 10, loss: 0.1 });
      d({ type: "tx/run" });
    },
  },
  "net-10-dns": {
    recursion: (d) => {
      d({ type: "dns/resolve", name: "inside.kz" });
      d({ type: "dns/resolve", name: "inside.kz" });
      d({ type: "dns/resolve", name: "api.inside.kz" });
    },
    ttl: (d) => {
      d({ type: "dns/move" });
      d({ type: "dns/resolve", name: "inside.kz" });
      d({ type: "dns/advance", seconds: 300 });
      d({ type: "dns/resolve", name: "inside.kz" });
    },
  },
  "net-11-tcp-states": {
    handshake: (d) => {
      d({ type: "tcp/event", event: { kind: "connect" } });
      d({ type: "tcp/event", event: { kind: "deliver" } });
      d({ type: "tcp/event", event: { kind: "deliver" } });
      d({ type: "tcp/event", event: { kind: "listen" } });
      d({ type: "tcp/event", event: { kind: "connect" } });
      for (let i = 0; i < 3; i++) d({ type: "tcp/event", event: { kind: "deliver" } });
    },
    loss: (d) => {
      d({ type: "tcp/event", event: { kind: "connect" } });
      d({ type: "tcp/event", event: { kind: "drop" } });
      d({ type: "tcp/event", event: { kind: "timer", side: "client" } });
      for (let i = 0; i < 3; i++) d({ type: "tcp/event", event: { kind: "deliver" } });
    },
    close: (d) => {
      d({ type: "tcp/event", event: { kind: "close", side: "client" } });
      d({ type: "tcp/event", event: { kind: "deliver" } });
      d({ type: "tcp/event", event: { kind: "deliver" } });
      d({ type: "tcp/event", event: { kind: "close", side: "server" } });
      d({ type: "tcp/event", event: { kind: "deliver" } });
      d({ type: "tcp/event", event: { kind: "deliver" } });
      d({ type: "tcp/event", event: { kind: "timer", side: "client" } });
    },
  },
  "net-13-quic": {
    hol: (d) => {
      d({ type: "streams/run" });
      d({ type: "streams/set", proto: "quic" });
      d({ type: "streams/run" });
    },
    voice: (d) => d({ type: "streams/run" }),
  },
  "net-12-switch": {
    arp: (d) => {
      d({ type: "lan/send", from: "A", to: "192.168.1.11" });
      d({ type: "lan/send", from: "A", to: "192.168.1.11" });
    },
    flood: (d) => {
      d({ type: "lan/age" });
      d({ type: "lan/send", from: "A", to: "192.168.1.11" });
      d({ type: "lan/send", from: "B", to: "192.168.1.10" });
      d({ type: "lan/send", from: "A", to: "192.168.1.11" });
    },
    gateway: (d) => {
      d({ type: "lan/send", from: "A", to: "8.8.8.8" });
      d({ type: "lan/send", from: "A", to: "1.1.1.1" });
    },
  },
};

describe("networks lessons are completable", () => {
  for (const lesson of netLessons)
    it(lesson.id, () => {
      const rt = new SimulationRuntime(netLabPlugin, 1);
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
        rt.stepTicks(30);
        sync();
        expect(engine.view().objectives.filter((o) => !o.done).map((o) => o.text), `${lesson.id}/${step.id}`).toEqual([]);
        for (const q of step.quiz ?? []) expect(engine.answer(q.id, q.answer).correct).toBe(true);
        engine.advance()?.onEnter?.forEach((a) => rt.dispatch(a));
        sync();
      }
      expect(engine.isLessonComplete()).toBe(true);
      expect(replay(netLabPlugin, rt.record())).toEqual(rt.getState());
    });
});

describe("autograder", () => {
  const pset = netLessons.find((l) => l.id === "net-9-pset")!;
  const check = (step: string, actions: NetLabAction[]) => {
    const rt = new SimulationRuntime(netLabPlugin, 1);
    const st = pset.steps.find((s) => s.id === step)!;
    st.onEnter?.forEach((a) => rt.dispatch(a));
    actions.forEach((a) => rt.dispatch(a));
    return st.objectives.every((o) => o.check(rt.getState(), { assessment: rt.evaluate() }));
  };
  it("a prefix that is too short or too long fails", () => {
    expect(check("subnet", [{ type: "ip/set", prefix: 24 }])).toBe(false);
    expect(check("subnet", [{ type: "ip/set", prefix: 26 }])).toBe(false);
  });
  it("cutting three links to force the route is over budget; a big window is too", () => {
    expect(check("route", [{ type: "route/toggle", link: "BD" }, { type: "route/toggle", link: "BC" }, { type: "route/toggle", link: "EF" }, { type: "route/send" }])).toBe(false);
    expect(check("window", [{ type: "tx/set", protocol: "window", window: 20, loss: 0.1 }, { type: "tx/run" }])).toBe(false);
    expect(check("window", [{ type: "tx/set", protocol: "window", window: 8, loss: 0.1 }, { type: "tx/run" }])).toBe(false);
  });
});
