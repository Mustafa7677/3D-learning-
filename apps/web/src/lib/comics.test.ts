import { describe, expect, it } from "vitest";
import { LAB_COMICS } from "./comics";
import { comicShelf, extraComic } from "./comicLibrary";
import { lessonEntries } from "./lessons";

describe("comics for the IT labs", () => {
  it("open the first two lessons of every IT lab, on a real step", () => {
    const labs = [...new Set(lessonEntries.map((e) => e.labId))].filter((l) => l !== "math");
    for (const lab of labs) {
      const firstTwo = lessonEntries.filter((e) => e.labId === lab && e.lesson.order <= 2);
      for (const e of firstTwo) expect(LAB_COMICS[e.lesson.id], e.lesson.id).toBeDefined();
    }
    for (const [id, c] of Object.entries(LAB_COMICS)) {
      const e = lessonEntries.find((x) => x.lesson.id === id);
      expect(e, id).toBeDefined();
      expect(e!.lesson.steps.some((s) => s.id === c.step), `${id}:${c.step}`).toBe(true);
    }
  });

  it("each is a full comic: five or more panels, a board, the cast, no dashes", () => {
    for (const [id, { comic }] of Object.entries(LAB_COMICS)) {
      expect(comic.panels.length, id).toBeGreaterThanOrEqual(5);
      expect(comic.panels.some((p) => p.board), id).toBe(true);
      expect(new Set(comic.panels.map((p) => p.who)).size, id).toBeGreaterThanOrEqual(3);
      expect(/[–—]/.test(JSON.stringify(comic)), id).toBe(false);
    }
  });

  it("a lesson's own comic wins; the opening comic shows only on its step", () => {
    const [id, c] = Object.entries(LAB_COMICS)[0]!;
    expect(extraComic(id, c.step)).toBe(c.comic);
    expect(extraComic(id, "elsewhere")).toBeUndefined();
    expect(extraComic(id, c.step, c.comic)).toBeUndefined();
  });

  it("the library gathers every comic once", () => {
    const shelf = comicShelf();
    expect(new Set(shelf.map((x) => x.id)).size).toBe(shelf.length);
    expect(shelf.filter((x) => x.shelf === "learn")).toHaveLength(7);
    expect(shelf.length).toBeGreaterThanOrEqual(40);
    expect(new Set(shelf.map((x) => x.shelf)).size).toBe(12);
  });
});
