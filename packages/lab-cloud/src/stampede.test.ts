import { describe, expect, it } from "vitest";
import { runStampede } from "./stampede";

describe("cloud: cache stampede", () => {
  it("no cache: the database is buried every second", () => {
    expect(runStampede("none")).toMatchObject({ dbPeak: 500, overload: 60, hitRate: 0 });
  });
  it("plain TTL: 90% hits, but every expiry sends 500 queries a second for 2 s", () => {
    const r = runStampede("ttl");
    expect(r).toMatchObject({ dbPeak: 500, overload: 6, slow: 6, errors: 2700, hitRate: 0.9 });
    expect(r.timeline.map((x, t) => (x.hit ? -1 : t)).filter((t) => t >= 0)).toEqual([0, 1, 22, 23, 44, 45]);
  });
  it("single-flight: one query per expiry, users still wait", () => {
    expect(runStampede("coalesce")).toMatchObject({ dbPeak: 1, overload: 0, slow: 6, errors: 0 });
  });
  it("refresh-ahead: only the cold start waits", () => {
    expect(runStampede("early")).toMatchObject({ dbPeak: 1, overload: 0, slow: 2, hitRate: 0.97 });
  });
});
