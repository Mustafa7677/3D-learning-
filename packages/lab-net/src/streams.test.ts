import { describe, expect, it } from "vitest";
import { runStreams } from "./streams";

describe("head-of-line blocking", () => {
  it("no loss: streams finish at 65, 70, 75 ms whatever the transport", () => {
    for (const p of ["tcp", "quic", "udp"] as const) expect(runStreams(p, false).finish).toEqual({ A: 65, B: 70, C: 75 });
  });
  it("TCP: one lost packet of stream B holds all three streams until 85 ms", () => {
    expect(runStreams("tcp", true).finish).toEqual({ A: 85, B: 85, C: 85 });
  });
  it("QUIC: only stream B waits; A and C finish on time", () => {
    expect(runStreams("quic", true).finish).toEqual({ A: 65, B: 85, C: 75 });
  });
  it("UDP: nothing ever waits more than 20 ms, and one packet is simply gone", () => {
    expect(runStreams("udp", true)).toMatchObject({ maxDelay: 20, lost: 1, finish: { A: 65, B: null, C: 75 } });
    expect(runStreams("tcp", true).maxDelay).toBe(80);
  });
});
