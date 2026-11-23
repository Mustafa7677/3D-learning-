import { describe, expect, it } from "vitest";
import { LAB_COMICS } from "./comics";
import { FILM_COMICS } from "./films";
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

describe("film comics", () => {
  it("the third lesson of every IT lab opens with a film: a genre, a poster line, scenes, a sound", () => {
    const labs = [...new Set(lessonEntries.map((e) => e.labId))].filter((l) => l !== "math");
    for (const lab of labs) {
      const third = lessonEntries.find((e) => e.labId === lab && e.lesson.order === 3)!;
      expect(FILM_COMICS[third.lesson.id], third.lesson.id).toBeDefined();
    }
    const genres = new Set<string>();
    for (const [id, { step, comic }] of Object.entries(FILM_COMICS)) {
      const e = lessonEntries.find((x) => x.lesson.id === id);
      expect(e?.lesson.steps.some((s) => s.id === step), `${id}:${step}`).toBe(true);
      expect(comic.genre && comic.tagline, id).toBeTruthy();
      expect(comic.panels.length, id).toBeGreaterThanOrEqual(7);
      expect(comic.panels.filter((p) => p.scene).length, id).toBeGreaterThanOrEqual(2);
      expect(comic.panels.some((p) => p.sfx), id).toBe(true);
      expect(comic.panels.some((p) => p.board), id).toBe(true);
      expect(/[–—]/.test(JSON.stringify(comic)), id).toBe(false);
      genres.add(comic.genre!);
    }
    // Ten films, ten different genres.
    expect(genres.size).toBe(Object.keys(FILM_COMICS).length);
  });

  it("films are on the shelf", () => {
    expect(comicShelf().filter((c) => c.comic.genre)).toHaveLength(10);
  });
});
