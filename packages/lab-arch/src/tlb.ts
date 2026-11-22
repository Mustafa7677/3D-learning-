/**
 * Virtual memory with a TLB: a virtual address splits into a page number and
 * an offset; a 4-entry TLB (LRU) remembers recent translations; a miss costs
 * a page-table walk. Deterministic counts for the lectures.
 */

export const PAGE = 4096;
export const HUGE_PAGE = 2 * 1024 * 1024;
export const TLB_ENTRIES = 4;
export const WALK_CYCLES = 20;

export type TlbPattern = "sequential" | "stride" | "random-few";

/** 64 reads over a 32 KB region, in three orders. */
export function tlbAddresses(p: TlbPattern): number[] {
  if (p === "sequential") return Array.from({ length: 64 }, (_, i) => 0x10000 + i * 512);
  if (p === "stride") return Array.from({ length: 64 }, (_, i) => 0x10000 + (i % 8) * PAGE + Math.floor(i / 8) * 64);
  return Array.from({ length: 64 }, (_, i) => 0x10000 + ((i * 3) % 4) * PAGE + i * 8);
}

export interface TlbRun {
  hits: number;
  misses: number;
  cycles: number;
  /** Per access: virtual page number and whether the TLB had it. */
  trace: { addr: number; vpn: number; offset: number; hit: boolean }[];
  /** Final TLB contents, most recent last. */
  tlb: number[];
}

export function runTlb(addresses: number[], pageSize = PAGE, entries = TLB_ENTRIES): TlbRun {
  const tlb: number[] = [];
  const trace: TlbRun["trace"] = [];
  let hits = 0;
  for (const addr of addresses) {
    const vpn = Math.floor(addr / pageSize);
    const at = tlb.indexOf(vpn);
    const hit = at >= 0;
    if (hit) {
      hits++;
      tlb.splice(at, 1);
    } else if (tlb.length >= entries) tlb.shift();
    tlb.push(vpn);
    trace.push({ addr, vpn, offset: addr % pageSize, hit });
  }
  const misses = addresses.length - hits;
  return { hits, misses, cycles: hits + misses * (1 + WALK_CYCLES), trace, tlb };
}

/** Split an address the way the MMU does: page number and offset (4 KB pages: low 12 bits). */
export const splitAddress = (addr: number, pageSize = PAGE) => ({ vpn: Math.floor(addr / pageSize), offset: addr % pageSize });
