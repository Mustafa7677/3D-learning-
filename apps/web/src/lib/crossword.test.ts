import { describe, expect, it } from "vitest";
import { ISSUE_1, buildBoard, cellsOf, check, key, normalizeLetter, sanitizeLetters, solvedEntries } from "./crossword";
import { openLabs } from "./catalog";

const board = buildBoard(ISSUE_1);
const full = () => Object.fromEntries([...board.cells].map(([k, c]) => [k, c.answer]));

describe("crossword issue 1", () => {
  it("letters agree at every crossing and every word crosses another", () => {
    for (const e of ISSUE_1) {
      const crossings = cellsOf(e).filter(([r, c]) => ISSUE_1.some((o) => o !== e && cellsOf(o).some(([r2, c2]) => r2 === r && c2 === c)));
      expect(crossings.length, e.word).toBeGreaterThan(0);
    }
  });

  it("no two words run side by side (every pair of neighbouring letters belongs to one word)", () => {
    for (const [, cell] of board.cells) {
      for (const [dr, dc, dir] of [
        [0, 1, "across"],
        [1, 0, "down"],
      ] as const) {
        if (!board.cells.has(key(cell.r + dr, cell.c + dc))) continue;
        const shared = ISSUE_1.some((e) => e.dir === dir && cellsOf(e).some(([r, c]) => r === cell.r && c === cell.c) && cellsOf(e).some(([r, c]) => r === cell.r + dr && c === cell.c + dc));
        expect(shared, `${cell.r},${cell.c} ${dir}`).toBe(true);
      }
    }
  });

  it("numbers starts in reading order", () => {
    expect(board.entries[0]).toMatchObject({ word: "ДАТЧИК", num: 1 });
    expect(board.entries.find((e) => e.word === "ИНДЕКС")!.num).toBe(2);
    const nums = board.entries.map((e) => e.num);
    expect([...nums].sort((a, b) => a - b)).toEqual(nums);
  });

  it("every clue points at a real lab", () => {
    for (const e of ISSUE_1) expect(openLabs.some((l) => l.id === e.lab), e.word).toBe(true);
  });

  it("check: empty, one wrong letter, solved", () => {
    expect(check(board, {})).toMatchObject({ filled: 0, solved: false });
    const letters = full();
    expect(check(board, letters).solved).toBe(true);
    letters[key(0, 2)] = "Т";
    const r = check(board, letters);
    expect(r.solved).toBe(false);
    expect(r.wrong).toEqual([key(0, 2)]);
    expect(solvedEntries(board, letters).has(0)).toBe(false);
    expect(solvedEntries(board, letters).size).toBe(ISSUE_1.length - 1);
  });

  it("typing: Kazakh letters are upper-cased, other characters dropped", () => {
    expect(normalizeLetter("ә")).toBe("Ә");
    expect(normalizeLetter("і")).toBe("І");
    expect(normalizeLetter("ң")).toBe("Ң");
    expect(normalizeLetter("5")).toBe("");
    expect(normalizeLetter("аб")).toBe("Б");
  });

  it("saved letters are kept only for real cells", () => {
    expect(sanitizeLetters(board, { [key(0, 2)]: "Д", "99:99": "А", [key(0, 3)]: "аа", [key(0, 4)]: 5 })).toEqual({ [key(0, 2)]: "Д" });
    expect(sanitizeLetters(board, "junk")).toEqual({});
  });
});
