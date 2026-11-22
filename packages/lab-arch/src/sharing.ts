/**
 * False sharing. Two counters, each incremented 1000 times. Caches move data
 * in 64-byte lines and keep them coherent (MESI): a core may write a line
 * only while it holds it exclusively. If both counters sit in one line, every
 * write by one core takes the line away from the other: 40 cycles each time,
 * and the two cores wait for each other. Put each counter in its own line and
 * both cores run at cache speed, in parallel.
 */

export type Layout = "single" | "shared" | "padded";
export const LAYOUTS: Layout[] = ["single", "shared", "padded"];
export const INCREMENTS = 1000;
export const LINE_BYTES = 64;
/** Cycles to fetch a line from memory or from the other core's cache. */
export const TRANSFER = 40;
export const HIT = 1;

export interface SharingRun {
  layout: Layout;
  /** Wall-clock cycles until both counters reach 1000. */
  cycles: number;
  /** Times a cache line moved between cores (or came from memory). */
  transfers: number;
  /** Byte address of each counter. */
  addresses: [number, number];
}

export function runSharing(layout: Layout): SharingRun {
  const addresses: [number, number] = layout === "padded" ? [0, LINE_BYTES] : [0, 8];
  const line = (i: 0 | 1) => Math.floor(addresses[i] / LINE_BYTES);
  const owner = new Map<number, number>(); // line → core holding it modified
  let transfers = 0;
  const access = (core: number, i: 0 | 1) => {
    const l = line(i);
    if (owner.get(l) === core) return HIT;
    owner.set(l, core);
    transfers++;
    return TRANSFER;
  };
  let cycles = 0;
  if (layout === "single") {
    for (let k = 0; k < INCREMENTS; k++) cycles += access(0, 0) + access(0, 1);
  } else {
    const sameLine = line(0) === line(1);
    for (let k = 0; k < INCREMENTS; k++) {
      const a = access(0, 0);
      const b = access(1, 1);
      // On one line the cores take turns holding it; on separate lines they run side by side.
      cycles += sameLine ? a + b : Math.max(a, b);
    }
  }
  return { layout, cycles, transfers, addresses };
}
