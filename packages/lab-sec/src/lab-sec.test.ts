import { LessonEngine } from "@inside-tech/lesson-engine";
import { SimulationRuntime, replay } from "@inside-tech/sim-core";
import { describe, expect, it } from "vitest";
import { secDeepDives } from "./deep";
import {
  CHALLENGES,
  FAKE_RELEASE,
  POW_PREFIX,
  PSET_C,
  RELEASE_TEXT,
  crack,
  guessShift,
  minedBlock,
  caesar,
  rsaKeys,
  secLabPlugin,
  secLessons,
  type SecLabAction,
} from "./index";

describe("cybersecurity lab content", () => {
  for (const lesson of secLessons)
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
    for (const dives of Object.values(secDeepDives))
      for (const text of Object.values(dives)) {
        n++;
        expect(text.split("\n").filter((l) => /^##+ /.test(l))).toHaveLength(1);
        expect((text.match(/```/g) ?? []).length % 2).toBe(0);
      }
    expect(n).toBeGreaterThanOrEqual(4);
  });
  it("the numbers quoted in the lectures are what the simulation produces", () => {
    expect(crack("salted").work).toBe(92);
    expect(crack("slow").work).toBe(92_000);
    expect(guessShift(caesar(CHALLENGES.pset.text, CHALLENGES.pset.key))).toBe(CHALLENGES.pset.key);
    // The short message cannot be broken by frequency alone (it needs brute force).
    expect(guessShift(caesar(CHALLENGES.short.text, CHALLENGES.short.key))).not.toBe(CHALLENGES.short.key);
    const pset = rsaKeys(47, 59, 17);
    expect(pset).toMatchObject({ n: 2773, phi: 2668, d: 157 });
  });
});

type D = (a: SecLabAction) => void;
/** Find a proof-of-work input by trying counters, the way a learner would. */
const mine = () => {
  for (let i = 0; ; i++) if (minedBlock(`${POW_PREFIX}${i}`)) return `${POW_PREFIX}${i}`;
};

const scripts: Record<string, Record<string, (d: D) => void>> = {
  "sec-1-caesar": {
    encrypt: (d) => d({ type: "cipher/shift", shift: 5 }),
    decrypt: (d) => d({ type: "cipher/guess", guess: 5 }),
    brute: (d) => {
      for (let k = 0; k <= CHALLENGES.short.key; k++) d({ type: "cipher/guess", guess: k });
    },
  },
  "sec-2-frequency": {
    attack: (d) => {
      d({ type: "cipher/freq", on: true });
      d({ type: "cipher/guess", guess: CHALLENGES.long.key });
    },
  },
  "sec-3-xor": {
    otp: (d) => {
      d({ type: "xor/set", key: "QWERTYUIOPASDFGH" });
      d({ type: "xor/encrypt" });
    },
    reuse: (d) => {
      d({ type: "xor/set", message: "RETREAT AT DUSK" });
      d({ type: "xor/encrypt" });
    },
  },
  "sec-4-hash": {
    hash: (d) => ["a", "ab", "Алматы"].forEach((text) => d({ type: "hash/input", text })),
    avalanche: (d) => {
      d({ type: "hash/input", text: "Сәлем" });
      d({ type: "hash/input", text: "Сәлем!" });
    },
    integrity: (d) => [RELEASE_TEXT, FAKE_RELEASE].forEach((text) => d({ type: "hash/input", text })),
  },
  "sec-5-passwords": {
    plain: (d) => d({ type: "pw/crack" }),
    hash: (d) => d({ type: "pw/crack" }),
    salt: (d) => {
      d({ type: "pw/crack" });
      d({ type: "pw/storage", storage: "slow" });
      d({ type: "pw/crack" });
    },
  },
  "sec-6-strength": {
    weak: (d) => d({ type: "pw/test", password: "qwerty" }),
    strong: (d) => d({ type: "pw/test", password: "vR7qLm2xTc9w" }),
    passphrase: (d) => d({ type: "pw/test", password: "қызыл алма тау өзен" }),
  },
  "sec-7-rsa": {
    keys: (d) => d({ type: "rsa/keys", p: 61, q: 53, e: 17 }),
    encrypt: (d) => d({ type: "rsa/encrypt", m: 65 }),
    sign: (d) => d({ type: "rsa/sign", m: 123 }),
  },
  "sec-8-injection": {
    sqli: (d) => {
      d({ type: "attack/fields", user: "' OR '1'='1", pass: "' OR '1'='1" });
      d({ type: "attack/login" });
    },
    fix: (d) => {
      d({ type: "attack/param", on: true });
      d({ type: "attack/login" });
    },
    xss: (d) => {
      d({ type: "attack/comment", text: "<script>alert(1)</script>" });
      d({ type: "attack/post" });
      d({ type: "attack/escape", on: true });
      d({ type: "attack/comment", text: "<script>alert(1)</script>" });
      d({ type: "attack/post" });
    },
  },
  "sec-9-pset": {
    break: (d) => d({ type: "cipher/guess", guess: CHALLENGES.pset.key }),
    mine: (d) => d({ type: "hash/input", text: mine() }),
    rsa: (d) => {
      d({ type: "rsa/keys", p: 47, q: 59, e: 17 });
      d({ type: "rsa/decrypt", c: PSET_C });
    },
    login: (d) => {
      d({ type: "attack/fields", user: "dana'--", pass: "x" });
      d({ type: "attack/login" });
    },
  },
};

describe("cybersecurity lessons are completable", () => {
  for (const lesson of secLessons)
    it(lesson.id, () => {
      const rt = new SimulationRuntime(secLabPlugin, 1);
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
      expect(replay(secLabPlugin, rt.record())).toEqual(rt.getState());
    });
});

describe("autograder", () => {
  const pset = secLessons.find((l) => l.id === "sec-9-pset")!;
  const ok = (rt: SimulationRuntime<never, never>, step: string) =>
    pset.steps.find((s) => s.id === step)!.objectives.every((o) => o.check(rt.getState() as never, { assessment: rt.evaluate() }));
  it("logging in as admin does not solve the dana problem; parameterized mode blocks it", () => {
    const rt = new SimulationRuntime(secLabPlugin, 1) as unknown as SimulationRuntime<never, never>;
    const d = (a: SecLabAction) => (rt as unknown as SimulationRuntime<unknown, SecLabAction>).dispatch(a);
    d({ type: "attack/fields", user: "' OR '1'='1", pass: "' OR '1'='1" });
    d({ type: "attack/login" });
    expect(ok(rt, "login")).toBe(false);
    d({ type: "attack/param", on: true });
    d({ type: "attack/fields", user: "dana'--", pass: "x" });
    d({ type: "attack/login" });
    expect(ok(rt, "login")).toBe(false);
  });
  it("a hash starting with 0 needs the block prefix; the textbook RSA key does not open the problem ciphertext", () => {
    const rt = new SimulationRuntime(secLabPlugin, 1) as unknown as SimulationRuntime<unknown, SecLabAction>;
    let other = "";
    for (let i = 0; ; i++) if (minedBlock(`${POW_PREFIX}${i}`)) {
      other = `x${i}`;
      break;
    }
    rt.dispatch({ type: "hash/input", text: other });
    expect(ok(rt as never, "mine")).toBe(false);
    rt.dispatch({ type: "rsa/keys", p: 61, q: 53, e: 17 });
    rt.dispatch({ type: "rsa/decrypt", c: PSET_C });
    expect(ok(rt as never, "rsa")).toBe(false);
  });
});
