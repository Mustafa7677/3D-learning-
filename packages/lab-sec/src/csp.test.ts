import { describe, expect, it } from "vitest";
import { evaluateCsp } from "./csp";

describe("Content Security Policy", () => {
  it("no CSP: all three injected scripts run", () => {
    expect(evaluateCsp("none")).toMatchObject({ attacks: 3, brokenLegit: 0 });
  });
  it("script-src 'self': attacks stop, but the site's own inline code breaks too", () => {
    expect(evaluateCsp("self")).toMatchObject({ ran: ["app"], attacks: 0, brokenLegit: 1 });
  });
  it("'self' plus a nonce: the site's scripts run, no attack does", () => {
    expect(evaluateCsp("nonce")).toMatchObject({ ran: ["app", "boot"], attacks: 0, brokenLegit: 0 });
  });
});
