import { describe, expect, it } from "vitest";
import { COMIC, COMIC_START, decisionCount, validateComic, type Scene } from "./comic";

describe("the branching comic", () => {
  it("is well formed: links exist, wrong turns come back, the end is reachable", () => {
    expect(validateComic(COMIC)).toEqual([]);
    expect(COMIC[COMIC_START]).toBeDefined();
    expect(decisionCount(COMIC)).toBe(5);
  });

  it("the checker catches a dead end and a wrong turn that does not return", () => {
    const broken: Record<string, Scene> = {
      a: { id: "a", chapter: "", panels: [], choices: [{ text: "", to: "b", correct: true }, { text: "", to: "c", correct: false }] },
      b: { id: "b", chapter: "", panels: [] },
      c: { id: "c", chapter: "", panels: [], back: "zzz" },
    };
    const errs = validateComic(broken, "a");
    expect(errs).toContain("a: wrong choice c does not come back");
    expect(errs).toContain("b: dead end");
    expect(errs).toContain("the end is not reachable");
  });

  it("no visible text uses the long dash or names another course", () => {
    const all = JSON.stringify(COMIC);
    expect(all).not.toMatch(/[—–]/);
    expect(all).not.toMatch(/CS50/);
  });
});
