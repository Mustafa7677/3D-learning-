import { describe, expect, it } from "vitest";
import { RemoteRuntime, exposeRuntime, type MessagePortLike, type SimulationPlugin } from "./index";

/** In-memory MessageChannel pair (synchronous delivery, structured-clone semantics). */
function channel(): [MessagePortLike, MessagePortLike] {
  const make = () => {
    const fns = new Set<(ev: { data: unknown }) => void>();
    return { fns, port: null as unknown as MessagePortLike };
  };
  const a = make();
  const b = make();
  const port = (self: typeof a, other: typeof a): MessagePortLike => ({
    postMessage: (msg) => other.fns.forEach((fn) => fn({ data: structuredClone(msg) })),
    addEventListener: (_t, fn) => self.fns.add(fn),
    removeEventListener: (_t, fn) => self.fns.delete(fn),
  });
  return [port(a, b), port(b, a)];
}

const counter: SimulationPlugin<{ n: number }, { type: "inc" }> = {
  id: "counter",
  version: "1",
  initialize: () => ({ n: 0 }),
  dispatch: (s) => ({ n: s.n + 1 }),
  step: (s) => s,
  snapshot: (s) => ({ ...s }),
  restore: (x) => ({ ...(x as { n: number }) }),
  evaluate: (s) => ({ score: s.n >= 2 ? 1 : 0, metrics: { n: s.n }, notes: [] }),
};

describe("worker bridge", () => {
  it("proxies dispatch/undo/record across a port", async () => {
    const [main, worker] = channel();
    const remote = new RemoteRuntime<{ n: number }, { type: "inc" }>(main);
    exposeRuntime(worker, counter, 1);
    remote.dispatch({ type: "inc" });
    remote.dispatch({ type: "inc" });
    expect(remote.snapshot?.state.n).toBe(2);
    expect(remote.snapshot?.ack).toBe(remote.lastSent);
    expect(remote.snapshot?.assessment.score).toBe(1);
    remote.undo();
    expect(remote.snapshot?.state.n).toBe(1);
    const rec = await remote.record();
    expect(rec.journal).toHaveLength(1);
    remote.dispose();
  });
});
