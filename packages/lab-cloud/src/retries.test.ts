import { describe, expect, it } from "vitest";
import { runRetries } from "./retries";

describe("retries and circuit breakers", () => {
  it("no retries: 2000 errors during the 20 s outage, back at 30 s", () => {
    expect(runRetries("none")).toMatchObject({ errors: 2000, recoveredAt: 30, peakLoad: 100 });
  });
  it("three immediate retries: 400 requests a second keep the dependency down for good", () => {
    expect(runRetries("immediate")).toMatchObject({ errors: 5000, recoveredAt: null, peakLoad: 400 });
  });
  it("backoff with a retry budget never pushes past capacity: back at 30 s", () => {
    expect(runRetries("backoff")).toMatchObject({ recoveredAt: 30, peakLoad: 150 });
  });
  it("a circuit breaker fails fast: 130 errors, the rest get a quick fallback, back at 35 s", () => {
    expect(runRetries("breaker")).toMatchObject({ errors: 130, degraded: 2360, recoveredAt: 35 });
  });
});
