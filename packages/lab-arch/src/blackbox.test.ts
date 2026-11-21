import { describe, expect, it } from "vitest";
import { BOXES, INPUTS, addPart, check, describeCounter, nodeValues, expression, findBox, lampOf, removePart, sanitize, type Build } from "./blackbox";

const box = (id: string) => findBox(id)!;

describe("black box", () => {
  it("the hidden rules are AND, A AND NOT B, XOR", () => {
    const table = (id: string) => INPUTS.map(([a, b]) => box(id).rule(a, b)).join("");
    expect(table("pair")).toBe("0001");
    expect(table("alarm")).toBe("0010");
    expect(table("corridor")).toBe("0110");
  });

  it("the wiring revealed inside each box matches its rule", () => {
    for (const b of BOXES) expect(check(b.inside, b)).toEqual({ ok: true });
  });

  it("accepts two structurally different XOR circuits", () => {
    // (A OR B) AND NOT (A AND B)
    const one: Build = {
      parts: [
        { id: "g1", type: "OR", in: ["A", "B"] },
        { id: "g2", type: "AND", in: ["A", "B"] },
        { id: "g3", type: "NOT", in: ["g2", "g2"] },
        { id: "g4", type: "AND", in: ["g1", "g3"] },
      ],
      out: "g4",
    };
    // (A AND NOT B) OR (NOT A AND B)
    const two: Build = {
      parts: [
        { id: "g1", type: "NOT", in: ["B", "B"] },
        { id: "g2", type: "AND", in: ["A", "g1"] },
        { id: "g3", type: "NOT", in: ["A", "A"] },
        { id: "g4", type: "AND", in: ["g3", "B"] },
        { id: "g5", type: "OR", in: ["g2", "g4"] },
      ],
      out: "g5",
    };
    expect(expression(one)).not.toBe(expression(two));
    expect(check(one, box("corridor"))).toEqual({ ok: true });
    expect(check(two, box("corridor"))).toEqual({ ok: true });
  });

  it("the counterexample for a wrong circuit really differs", () => {
    const or: Build = { parts: [{ id: "g1", type: "OR", in: ["A", "B"] }], out: "g1" };
    const v = check(or, box("corridor"));
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.counter).toEqual({ a: 1, b: 1, mine: 1, box: 0 });
    expect(lampOf(or, v.counter.a, v.counter.b)).not.toBe(box("corridor").rule(v.counter.a, v.counter.b));
    expect(describeCounter(v.counter)).toBe("A=1, B=1 кезінде сенің шамың жанды, жәшіктің шамы сөнді.");
  });

  it("every wrong build of up to two gates gets a counterexample that differs", () => {
    const types = ["AND", "OR", "NOT"] as const;
    const src1 = ["A", "B"];
    for (const b of BOXES) {
      for (const t1 of types)
        for (const x of src1)
          for (const y of src1)
            for (const t2 of types)
              for (const p of ["A", "B", "g1"])
                for (const q of ["A", "B", "g1"]) {
                  const build: Build = {
                    parts: [
                      { id: "g1", type: t1, in: [x, y] },
                      { id: "g2", type: t2, in: [p, q] },
                    ],
                    out: "g2",
                  };
                  const v = check(build, b);
                  const same = INPUTS.every(([a, c]) => lampOf(build, a, c) === b.rule(a, c));
                  expect(v.ok).toBe(same);
                  if (!v.ok) expect(v.counter.mine).not.toBe(v.counter.box);
                }
    }
  });

  it("fixing one element turns a wrong alarm into a right one", () => {
    const wrong: Build = {
      parts: [
        { id: "g1", type: "NOT", in: ["B", "B"] },
        { id: "g2", type: "AND", in: ["A", "B"] },
      ],
      out: "g2",
    };
    expect(check(wrong, box("alarm")).ok).toBe(false);
    const fixed: Build = { ...wrong, parts: [wrong.parts[0]!, { ...wrong.parts[1]!, in: ["A", "g1"] }] };
    expect(check(fixed, box("alarm")).ok).toBe(true);
    expect(expression(fixed)).toBe("A AND NOT B");
  });

  it("shows each node's value for the current switches", () => {
    const b = box("corridor").inside;
    expect(nodeValues(b, 1, 1)).toMatchObject({ g1: 1, g2: 1, g3: 0, g4: 0 });
    expect(expression(b)).toBe("(A OR B) AND NOT (A AND B)");
  });

  it("adding and removing parts keeps the circuit loop-free and the lamp wired", () => {
    let b: Build = { parts: [], out: "A" };
    b = addPart(b, "OR");
    b = addPart(b, "NOT");
    expect(b.out).toBe("g2");
    expect(b.parts[1]!.in[0]).toBe("g1");
    b = removePart(b, "g1");
    expect(b.parts[0]!.in).toEqual(["A", "A"]);
    expect(b.out).toBe("g2");
  });

  it("sanitize drops forward references, unknown types and a dangling lamp", () => {
    const s = sanitize({
      parts: [
        { id: "g1", type: "AND", in: ["A", "g2"] },
        { id: "g2", type: "XOR", in: ["A", "B"] },
        { id: "g3", type: "OR", in: ["g1", "B"] },
      ],
      out: "g9",
    });
    expect(s.parts.map((p) => p.id)).toEqual(["g1", "g3"]);
    expect(s.parts[0]!.in).toEqual(["A", "A"]);
    expect(s.out).toBe("g3");
    expect(sanitize("junk")).toEqual({ parts: [], out: "A" });
  });
});
