import { describe, expect, it } from "vitest";
import { BROADCAST_MAC, GATEWAY, NEW_IP, OLD_IP, ageSwitch, lanSend, newLan, newTcp, resolve, tcpStep, type Tcp, type TcpEvent } from "./middle-core";

describe("DNS resolver", () => {
  it("cold: root, TLD, authoritative, 100 ms; warm: 10 ms; a sibling name: 30 ms", () => {
    const a = resolve([], "inside.kz", 0, false);
    expect(a.hops.map((h) => h.server)).toEqual(["resolver", "root", "tld", "auth"]);
    expect(a.ms).toBe(100);
    expect(a.ip).toBe(OLD_IP);
    const b = resolve(a.cache, "inside.kz", 5, false);
    expect(b.fromCache).toBe(true);
    expect(b.ms).toBe(10);
    const c = resolve(a.cache, "api.inside.kz", 5, false);
    expect(c.hops.map((h) => h.server)).toEqual(["resolver", "auth"]);
    expect(c.ms).toBe(30);
    // Another TLD: back to the root.
    expect(resolve(c.cache, "example.com", 5, false).ms).toBe(100);
  });

  it("a moved site: the cache answers with the old address until the TTL (300 s) runs out", () => {
    const a = resolve([], "inside.kz", 0, false);
    const stale = resolve(a.cache, "inside.kz", 299, true);
    expect([stale.ip, stale.stale, stale.fromCache]).toEqual([OLD_IP, true, true]);
    const after = resolve(a.cache, "inside.kz", 300, true);
    expect([after.ip, after.stale, after.fromCache]).toEqual([NEW_IP, false, false]);
    // The zone's servers are still remembered (NS TTL is a day): only the authoritative hop.
    expect(after.ms).toBe(30);
  });

  it("api.inside.kz has a short TTL of 60 s", () => {
    const a = resolve([], "api.inside.kz", 0, false);
    expect(resolve(a.cache, "api.inside.kz", 59, false).fromCache).toBe(true);
    expect(resolve(a.cache, "api.inside.kz", 60, false).fromCache).toBe(false);
  });
});

const run = (t: Tcp, evs: TcpEvent[]) => evs.reduce(tcpStep, t);
const deliver: TcpEvent = { kind: "deliver" };

describe("TCP state machine", () => {
  it("a SYN to a port nobody listens on gets RST: connection refused", () => {
    const t = run(newTcp(), [{ kind: "connect" }, deliver]);
    expect(t.wire).toEqual([{ from: "server", flag: "RST" }]);
    expect(run(t, [deliver]).client).toBe("CLOSED");
  });

  it("three-way handshake", () => {
    let t = run(newTcp(), [{ kind: "listen" }, { kind: "connect" }]);
    expect([t.client, t.server]).toEqual(["SYN_SENT", "LISTEN"]);
    t = run(t, [deliver]);
    expect([t.client, t.server]).toEqual(["SYN_SENT", "SYN_RCVD"]);
    t = run(t, [deliver]);
    expect([t.client, t.server]).toEqual(["ESTABLISHED", "SYN_RCVD"]);
    t = run(t, [deliver]);
    expect([t.client, t.server, t.wire.length]).toEqual(["ESTABLISHED", "ESTABLISHED", 0]);
  });

  it("a lost SYN is resent by the timer, once", () => {
    let t = run(newTcp(), [{ kind: "listen" }, { kind: "connect" }, { kind: "drop" }]);
    expect(t.wire).toEqual([]);
    t = run(t, [{ kind: "timer", side: "client" }, { kind: "timer", side: "client" }]);
    expect(t.wire).toEqual([{ from: "client", flag: "SYN" }]);
    t = run(t, [deliver, deliver, deliver]);
    expect([t.client, t.server]).toEqual(["ESTABLISHED", "ESTABLISHED"]);
  });

  it("the handshake's last ACK is lost: the server resends SYN-ACK and gets a fresh ACK", () => {
    let t = run(newTcp(), [{ kind: "listen" }, { kind: "connect" }, deliver, deliver, { kind: "drop" }]);
    expect([t.client, t.server]).toEqual(["ESTABLISHED", "SYN_RCVD"]);
    t = run(t, [{ kind: "timer", side: "server" }, deliver, deliver]);
    expect([t.client, t.server]).toEqual(["ESTABLISHED", "ESTABLISHED"]);
  });

  it("four-way close: the side that closes first waits in TIME_WAIT", () => {
    let t = run(newTcp(), [{ kind: "listen" }, { kind: "connect" }, deliver, deliver, deliver]);
    t = run(t, [{ kind: "close", side: "client" }, deliver]);
    expect([t.client, t.server]).toEqual(["FIN_WAIT_1", "CLOSE_WAIT"]);
    t = run(t, [deliver]);
    expect(t.client).toBe("FIN_WAIT_2");
    t = run(t, [{ kind: "close", side: "server" }, deliver]);
    expect([t.client, t.server]).toEqual(["TIME_WAIT", "LAST_ACK"]);
    t = run(t, [deliver]);
    expect(t.server).toBe("CLOSED");
    t = run(t, [{ kind: "timer", side: "client" }]);
    expect(t.client).toBe("CLOSED");
  });

  it("the last ACK is lost: the server resends FIN, the waiting client acknowledges again", () => {
    let t = run(newTcp(), [{ kind: "listen" }, { kind: "connect" }, deliver, deliver, deliver, { kind: "close", side: "client" }, deliver, deliver, { kind: "close", side: "server" }, deliver]);
    expect(t.client).toBe("TIME_WAIT");
    t = run(t, [{ kind: "drop" }, { kind: "timer", side: "server" }, deliver, deliver]);
    expect([t.client, t.server]).toEqual(["TIME_WAIT", "CLOSED"]);
  });
});

describe("switch and ARP", () => {
  it("first packet: ARP request is flooded, the reply and the data go to one port each", () => {
    const r = lanSend(newLan(), "A", "192.168.1.11");
    expect(r.frames.map((f) => [f.kind, f.flooded, f.outPorts])).toEqual([
      ["arp-request", true, [1, 3, 4]],
      ["arp-reply", false, [2]],
      ["data", false, [3]],
    ]);
    expect(r.frames[0]!.dstMac).toBe(BROADCAST_MAC);
    // Second packet: no ARP, one port.
    const r2 = lanSend(r.lan, "A", "192.168.1.11");
    expect(r2.frames.map((f) => [f.kind, f.flooded])).toEqual([["data", false]]);
    // B already knows A (it learned from the request): it answers without ARP.
    expect(lanSend(r2.lan, "B", "192.168.1.10").arped).toBe(false);
  });

  it("after the switch forgets, a known MAC is still flooded once, then learned again", () => {
    const r = lanSend(newLan(), "A", "192.168.1.11");
    const aged = ageSwitch(r.lan);
    const f = lanSend(aged, "A", "192.168.1.11");
    expect(f.frames.map((x) => [x.kind, x.flooded])).toEqual([["data", true]]);
    expect(lanSend(lanSend(f.lan, "B", "192.168.1.10").lan, "A", "192.168.1.11").frames[0]!.flooded).toBe(false);
  });

  it("an address outside the subnet goes to the gateway's MAC", () => {
    const r = lanSend(newLan(), "A", "8.8.8.8");
    expect(r.nextHop).toBe(GATEWAY.ip);
    expect(r.frames.at(-1)!.dstMac).toBe(GATEWAY.mac);
    expect(r.frames.at(-1)!.note).toContain("8.8.8.8");
  });
});
