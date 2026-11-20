import { describe, expect, it } from "vitest";
import { hardest, summarize } from "./analytics";

describe("session analytics", () => {
  it("adds up time per step, including steps re-entered later", () => {
    const s = summarize([
      { t: 1000, type: "enter", step: "a" },
      { t: 5000, type: "enter", step: "b" },
      { t: 6000, type: "enter", step: "a" },
      { t: 9000, type: "done", step: "a" },
      { t: 9500, type: "enter", step: "b" },
      { t: 12000, type: "undo", step: "b" },
    ]);
    expect(s.stepMs).toEqual({ a: 7000, b: 3500 });
    expect(s.totalMs).toBe(11000);
    expect(s.stepsDone).toEqual(["a"]);
    expect(s.undos).toBe(1);
  });
  it("ranks the questions the class got wrong", () => {
    const a = summarize([{ t: 0, type: "wrong", step: "s", q: "x" }, { t: 1, type: "wrong", step: "s", q: "x" }]);
    const b = summarize([{ t: 0, type: "wrong", step: "s", q: "x" }, { t: 1, type: "wrong", step: "s", q: "y" }]);
    expect(hardest([a, b])).toEqual([
      { key: "s/x", wrong: 3, learners: 2 },
      { key: "s/y", wrong: 1, learners: 1 },
    ]);
    expect(summarize([])).toMatchObject({ totalMs: 0, stepMs: {} });
  });
});
