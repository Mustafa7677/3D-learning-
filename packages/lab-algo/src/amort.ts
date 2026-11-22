/**
 * A dynamic array (like a JavaScript array or a Python list) that grows
 * when it is full: allocate a bigger block and copy everything across. How
 * much bigger decides whether n pushes cost O(n) or O(n²) in total.
 */

export type Growth = "plus1" | "x1.5" | "x2";
export const GROWTHS: Growth[] = ["plus1", "x1.5", "x2"];
export const PUSHES = 65;

export interface AmortRun {
  growth: Growth;
  /** Cost of each push: 1 for the write, plus the elements copied if it had to grow. */
  costs: number[];
  copies: number;
  /** The most expensive single push. */
  maxCost: number;
  /** Average cost per push, two decimals. */
  average: number;
  capacity: number;
  /** Allocated slots never used at the end. */
  unused: number;
}

const grow = (cap: number, g: Growth) => (g === "plus1" ? cap + 1 : g === "x2" ? cap * 2 : Math.ceil(cap * 1.5));

export function runAmort(growth: Growth, n = PUSHES): AmortRun {
  let cap = 1;
  let size = 0;
  let copies = 0;
  const costs: number[] = [];
  for (let i = 0; i < n; i++) {
    let cost = 1;
    if (size === cap) {
      cap = Math.max(cap + 1, grow(cap, growth));
      cost += size;
      copies += size;
    }
    size++;
    costs.push(cost);
  }
  const total = costs.reduce((a, b) => a + b, 0);
  return { growth, costs, copies, maxCost: Math.max(...costs), average: Math.round((total / n) * 100) / 100, capacity: cap, unused: cap - size };
}
