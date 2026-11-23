import { describe, expect, it } from "vitest";
import { BUGS, CODE_LINES, PATH_LENGTH, TD_COLS, TD_ROWS, THREATS, TOWERS, WAVES, bugEvery, bugKindAt, circleHitsRect, pathCells, pointAlong, runSpeed, wallGap } from "./games";
import { GAMES } from "./arcade";
import { lessonEntries } from "./lessons";

describe("action games", () => {
  it("every game points at a real lesson, action games come first", () => {
    for (const g of GAMES) expect(lessonEntries.some((e) => e.lesson.id === g.lesson && e.labId === g.lab), g.id).toBe(true);
    expect(GAMES.filter((g) => g.kind === "action").map((g) => g.id)).toEqual(["surf", "bughunt", "defense"]);
    expect(/[–—]/.test(JSON.stringify([GAMES, BUGS, TOWERS, THREATS]))).toBe(false);
  });

  it("collision: a circle touches a rectangle only when it overlaps", () => {
    expect(circleHitsRect(10, 10, 5, 12, 0, 10, 20)).toBe(true);
    expect(circleHitsRect(0, 0, 5, 12, 0, 10, 20)).toBe(false);
    expect(circleHitsRect(17, 24, 5, 12, 0, 10, 20)).toBe(true);
    expect(circleHitsRect(17, 25, 5, 12, 0, 10, 20)).toBe(false);
  });

  it("surfer: faster over time, the gap shrinks but stays passable", () => {
    expect(runSpeed(30)).toBeGreaterThan(runSpeed(0));
    expect(runSpeed(1e4)).toBe(560);
    expect(wallGap(1e4)).toBeGreaterThanOrEqual(118);
  });

  it("bug hunt: early game is plain bugs, later it mixes, spawning speeds up to a floor", () => {
    expect(bugKindAt(1, 0)).toBe("bug");
    expect(bugKindAt(30, 0.05)).toBe("feature");
    expect(bugKindAt(30, 0.2)).toBe("race");
    expect(bugEvery(1e4)).toBe(0.55);
    expect(CODE_LINES.length).toBeLessThanOrEqual(9);
    expect(BUGS.feature.points).toBeLessThan(0);
  });

  it("defence: the road is one connected walk across the board, inside it", () => {
    const cells = pathCells();
    for (let i = 1; i < cells.length; i++) {
      const [a, b] = [cells[i - 1]!, cells[i]!];
      expect(Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1])).toBe(1);
    }
    for (const [c, r] of cells) {
      expect(c >= 0 && c < TD_COLS && r >= 0 && r < TD_ROWS).toBe(true);
    }
    expect(new Set(cells.map(([c, r]) => `${c},${r}`)).size).toBe(cells.length);
    expect(PATH_LENGTH).toBe(cells.length - 1);
    expect(pointAlong(0)).toEqual([0.5, 1.5]);
    const last = cells[cells.length - 1]!;
    expect(pointAlong(PATH_LENGTH)).toEqual([last[0] + 0.5, last[1] + 0.5]);
  });

  it("defence: ten waves, trojans only after a scanner can be afforded, a boss at the end", () => {
    expect(WAVES).toHaveLength(10);
    const firstTrojan = WAVES.findIndex((w) => w.some((g) => g.kind === "trojan"));
    expect(firstTrojan).toBeGreaterThanOrEqual(3);
    expect(WAVES[9]!.some((g) => g.kind === "ransom")).toBe(true);
    expect(THREATS.trojan.hidden).toBe(true);
  });
});
