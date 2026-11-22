import { describe, expect, it } from "vitest";
import { fragmentCount, runMtu } from "./mtu";

describe("net: MTU and PMTU discovery", () => {
  it("1500 bytes over a 1400 tunnel: two fragments of 1376 and 104 data bytes", () => {
    expect(fragmentCount(1500, 1400)).toBe(2);
    expect(fragmentCount(1400, 1400)).toBe(1);
    const r = runMtu(1500, false, false, false);
    expect(r).toMatchObject({ delivered: true, fragments: 2 });
    expect(r.attempts.map((a) => [a.result, a.hop])).toEqual([["fragmented", 1]]);
  });
  it("DF on: ICMP comes back, the sender shrinks to 1400, total 80 ms", () => {
    const r = runMtu(1500, true, false, false);
    expect(r.attempts.map((a) => [a.size, a.result])).toEqual([
      [1500, "icmp"],
      [1400, "delivered"],
    ]);
    expect(r.ms).toBe(80);
  });
  it("ICMP blocked: three silent timeouts, nothing delivered", () => {
    const r = runMtu(1500, true, true, false);
    expect(r.delivered).toBe(false);
    expect(r.attempts.map((a) => a.result)).toEqual(["silent", "silent", "silent"]);
    expect(r.ms).toBe(3000);
  });
  it("small packets never notice; MSS clamping fixes the black hole", () => {
    expect(runMtu(1000, true, true, false).delivered).toBe(true);
    const r = runMtu(1500, true, true, true);
    expect(r.attempts).toHaveLength(1);
    expect(r.attempts[0]).toMatchObject({ size: 1400, result: "delivered" });
  });
});
