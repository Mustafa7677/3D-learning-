/** Gate-level circuits: evaluate, enumerate truth tables, check against a specification. */
export type GateType = "AND" | "OR" | "XOR" | "NAND" | "NOR" | "NOT";
export const GATE_TYPES: GateType[] = ["AND", "OR", "XOR", "NAND", "NOR", "NOT"];

export interface Gate {
  id: string;
  type: GateType;
  /** Input names or ids of earlier gates. NOT uses only the first. */
  in: string[];
  /** Position for drawing (column, row). */
  at: [number, number];
}

export type CircuitId = "single" | "half" | "full" | "nand-xor";

export interface Circuit {
  id: CircuitId;
  title: string;
  inputs: string[];
  /** Output name → node id. */
  outputs: Record<string, string>;
  gates: Gate[];
  /** Gates whose type the learner may change. */
  editable: string[];
  /** The specification: expected outputs for given inputs (absent for free exploration). */
  spec?: (x: Record<string, number>) => Record<string, number>;
}

export function gate(type: GateType, a: number, b = 0): number {
  switch (type) {
    case "AND":
      return a & b;
    case "OR":
      return a | b;
    case "XOR":
      return a ^ b;
    case "NAND":
      return 1 - (a & b);
    case "NOR":
      return 1 - (a | b);
    case "NOT":
      return 1 - a;
  }
}

export const CIRCUITS: Record<CircuitId, Circuit> = {
  single: {
    id: "single",
    title: "Бір элемент",
    inputs: ["A", "B"],
    outputs: { Y: "g" },
    gates: [{ id: "g", type: "AND", in: ["A", "B"], at: [1, 0] }],
    editable: ["g"],
  },
  half: {
    id: "half",
    title: "Жарты қосындылағыш (half adder)",
    inputs: ["A", "B"],
    outputs: { S: "s", C: "c" },
    gates: [
      { id: "s", type: "OR", in: ["A", "B"], at: [1, -0.8] },
      { id: "c", type: "OR", in: ["A", "B"], at: [1, 0.8] },
    ],
    editable: ["s", "c"],
    spec: ({ A, B }) => ({ S: (A! + B!) & 1, C: (A! + B!) >> 1 }),
  },
  full: {
    id: "full",
    title: "Толық қосындылағыш (full adder)",
    inputs: ["A", "B", "Cin"],
    outputs: { S: "s", Cout: "co" },
    gates: [
      { id: "x1", type: "XOR", in: ["A", "B"], at: [1, -1] },
      { id: "s", type: "AND", in: ["x1", "Cin"], at: [2, -1.2] },
      { id: "a1", type: "AND", in: ["A", "B"], at: [1, 0.6] },
      { id: "a2", type: "AND", in: ["x1", "Cin"], at: [2, 0.2] },
      { id: "co", type: "AND", in: ["a1", "a2"], at: [3, 0.5] },
    ],
    editable: ["s", "co"],
    spec: ({ A, B, Cin }) => ({ S: (A! + B! + Cin!) & 1, Cout: (A! + B! + Cin!) >> 1 }),
  },
  "nand-xor": {
    id: "nand-xor",
    title: "Тек NAND-тан XOR",
    inputs: ["A", "B"],
    outputs: { Y: "n4" },
    gates: [
      { id: "n1", type: "AND", in: ["A", "B"], at: [1, 0] },
      { id: "n2", type: "AND", in: ["A", "n1"], at: [2, -0.9] },
      { id: "n3", type: "AND", in: ["B", "n1"], at: [2, 0.9] },
      { id: "n4", type: "AND", in: ["n2", "n3"], at: [3, 0] },
    ],
    editable: ["n1", "n2", "n3", "n4"],
    spec: ({ A, B }) => ({ Y: A! ^ B! }),
  },
};

/** Value of every node (inputs and gates) for one input assignment. */
export function evaluate(c: Circuit, types: Record<string, GateType>, x: Record<string, number>): Record<string, number> {
  const v: Record<string, number> = { ...x };
  for (const g of c.gates) {
    const t = types[g.id] ?? g.type;
    v[g.id] = gate(t, v[g.in[0]!] ?? 0, v[g.in[1] ?? g.in[0]!] ?? 0);
  }
  return v;
}

/** All 2^k input rows in counting order (A is the most significant). */
export function inputRows(c: Circuit): Record<string, number>[] {
  const k = c.inputs.length;
  return Array.from({ length: 1 << k }, (_, r) => Object.fromEntries(c.inputs.map((name, i) => [name, (r >> (k - 1 - i)) & 1])));
}

export interface TruthRow {
  inputs: Record<string, number>;
  outputs: Record<string, number>;
  expected?: Record<string, number>;
  ok: boolean;
}

export function truthTable(c: Circuit, types: Record<string, GateType>): TruthRow[] {
  return inputRows(c).map((inputs) => {
    const v = evaluate(c, types, inputs);
    const outputs = Object.fromEntries(Object.entries(c.outputs).map(([name, node]) => [name, v[node]!]));
    const expected = c.spec?.(inputs);
    return { inputs, outputs, expected, ok: !expected || Object.keys(expected).every((k) => expected[k] === outputs[k]) };
  });
}

/** The circuit meets its specification for every input. */
export const solves = (c: Circuit, types: Record<string, GateType>) => !!c.spec && truthTable(c, types).every((r) => r.ok);
