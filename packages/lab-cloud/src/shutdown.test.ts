import { describe, expect, it } from "vitest";
import { runShutdown } from "./shutdown";

describe("cloud: graceful shutdown", () => {
  it("killing a pod loses what it serves and what is still routed to it: 700 errors", () => {
    const r = runShutdown("kill");
    expect(r.total).toBe(700);
    expect(r.errors[10]).toBe(75);
    expect(r.errors[14]).toBe(25);
    expect(r.errors[15]).toBe(0);
  });
  it("closing the port on SIGTERM saves in-flight requests but not the balancer's lag: 500", () => {
    expect(runShutdown("close")).toMatchObject({ total: 500, stopSeconds: 2 });
  });
  it("draining behind a preStop wait: no errors, each pod takes 7 s to stop", () => {
    expect(runShutdown("drain")).toMatchObject({ total: 0, stopSeconds: 7 });
  });
});
