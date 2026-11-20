import { describe, expect, it } from "vitest";
import { cidr, congestion, convergenceRounds, distanceVector, natIn, natOut, newNat, packetize, sameSubnet, shortestPath, transfer } from "./core";

describe("packets", () => {
  it("a megabyte over a 1500-byte MTU", () => {
    const p = packetize(1_000_000, 1500);
    expect(p.packets).toBe(685);
    expect(p.wireBytes).toBe(1_000_000 + 685 * 58);
    expect(p.efficiency).toBeCloseTo(0.9618, 3);
    expect(packetize(100, 1500).efficiency).toBeLessThan(0.65);
  });
});

describe("IPv4", () => {
  it("CIDR arithmetic", () => {
    expect(cidr("192.168.10.77", 26)).toEqual({ network: "192.168.10.64", broadcast: "192.168.10.127", mask: "255.255.255.192", first: "192.168.10.65", last: "192.168.10.126", hosts: 62 });
    expect(cidr("10.1.2.3", 8)!.hosts).toBe(16_777_214);
    expect(cidr("10.0.0.1", 32)!.hosts).toBe(1);
    expect(cidr("300.1.1.1", 24)).toBeNull();
    expect(sameSubnet("192.168.1.10", "192.168.1.200", 24)).toBe(true);
    expect(sameSubnet("192.168.1.10", "192.168.1.200", 25)).toBe(false);
  });
});

describe("routing", () => {
  it("link state finds the cheapest path and reroutes around a failure", () => {
    expect(shortestPath("A", "F")).toEqual({ path: ["A", "B", "D", "F"], cost: 8 });
    expect(shortestPath("A", "F", ["BD"])).toEqual({ path: ["A", "B", "C", "E", "D", "F"], cost: 9 });
    expect(shortestPath("A", "F", ["BD", "DE", "EF"]).cost).toBe(Infinity);
  });
  it("distance vector converges to the same costs", () => {
    const k = convergenceRounds("F");
    expect(k).toBeGreaterThan(1);
    const dv = distanceVector("F", k);
    for (const r of ["A", "B", "C", "D", "E"]) expect(dv[r]).toBe(shortestPath(r, "F").cost);
  });
});

describe("reliable transfer", () => {
  it("stop-and-wait wastes the link; a window of one RTT fills it", () => {
    const sw = transfer("stopwait", 20, 10, 1, 0);
    expect(sw.time).toBe(200);
    expect(sw.utilization).toBeCloseTo(0.1);
    const w = transfer("window", 20, 10, 10, 0);
    expect(w.time).toBe(29); // last send at t = 19, its ACK one RTT later
    expect(transfer("window", 50, 10, 10, 0).utilization).toBeGreaterThan(0.8);
    expect(transfer("window", 50, 10, 4, 0).utilization).toBeLessThan(0.45);
  });
  it("losses are retransmitted and everything arrives", () => {
    const t = transfer("window", 50, 10, 10, 0.2);
    expect(t.retransmits).toBeGreaterThan(3);
    expect(t.events.filter((e) => e.kind === "ack").length).toBe(50);
  });
});

describe("congestion control", () => {
  it("slow start doubles, then AIMD saws; Tahoe falls to 1, Reno to half", () => {
    const reno = congestion("reno", 20, 40);
    expect(reno.cwnd.slice(0, 6)).toEqual([1, 2, 4, 8, 16, 32]);
    expect(reno.losses.length).toBeGreaterThan(1);
    expect(reno.cwnd[reno.losses[1]! + 1]).toBeGreaterThan(5);
    const tahoe = congestion("tahoe", 20, 40);
    expect(tahoe.cwnd[tahoe.losses[0]! + 1]).toBe(1);
  });
});

describe("NAT", () => {
  it("replies find their way back; unsolicited packets are dropped", () => {
    let n = natOut(newNat(), "192.168.1.10", 51000);
    n = natOut(n, "192.168.1.11", 51000);
    expect(n.table.map((e) => e.publicPort)).toEqual([40000, 40001]);
    expect(natIn(n, 40001).delivered).toBe("192.168.1.11");
    expect(natIn(n, 40999).delivered).toBeNull();
  });
});
