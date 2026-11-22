import { describe, expect, it } from "vitest";
import { HUGE_PAGE, runTlb, splitAddress, tlbAddresses } from "./tlb";

describe("virtual memory and the TLB", () => {
  it("0x12345 with 4 KB pages: page 0x12 (18), offset 0x345 (837)", () => {
    expect(splitAddress(0x12345)).toEqual({ vpn: 18, offset: 837 });
  });
  it("sequential reads over 8 pages: 8 misses, 56 hits, 224 cycles", () => {
    expect(runTlb(tlbAddresses("sequential"))).toMatchObject({ hits: 56, misses: 8, cycles: 224 });
  });
  it("striding across 8 pages with a 4-entry TLB: every read misses, 1344 cycles", () => {
    expect(runTlb(tlbAddresses("stride"))).toMatchObject({ hits: 0, misses: 64, cycles: 1344 });
  });
  it("four pages fit the TLB: 4 misses; a 2 MB huge page holds all 8: one miss", () => {
    expect(runTlb(tlbAddresses("random-few")).misses).toBe(4);
    expect(runTlb(tlbAddresses("stride"), HUGE_PAGE)).toMatchObject({ hits: 63, misses: 1 });
  });
});
