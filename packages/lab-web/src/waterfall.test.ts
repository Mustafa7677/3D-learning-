import { describe, expect, it } from "vitest";
import { runWaterfall } from "./waterfall";

describe("web: request waterfalls", () => {
  it("awaiting one after another: 1150 ms, ten requests in a line", () => {
    const r = runWaterfall("serial");
    expect(r).toMatchObject({ total: 1150, requests: 10 });
    for (let i = 1; i < r.fetches.length; i++) expect(r.fetches[i]!.start).toBe(r.fetches[i - 1]!.end);
  });
  it("Promise.all: six at once, two more in a second wave: 490 ms", () => {
    const r = runWaterfall("parallel");
    expect(r).toMatchObject({ total: 490, requests: 10 });
    const comments = r.fetches.slice(2);
    expect(comments.filter((f) => f.start === 270)).toHaveLength(6);
    expect(comments.filter((f) => f.start === 380)).toHaveLength(2);
  });
  it("one batched request: 430 ms and only three requests; posts always wait for the user", () => {
    expect(runWaterfall("batch")).toMatchObject({ total: 430, requests: 3 });
    for (const s of ["serial", "parallel", "batch"] as const) expect(runWaterfall(s).fetches[1]!.start).toBe(120);
  });
});
