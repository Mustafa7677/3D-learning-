import { describe, expect, it } from "vitest";
import { countPresses } from "./debounce";

describe("button debouncing", () => {
  it("three real presses read as 15 without debouncing", () => {
    expect(countPresses(0)).toMatchObject({ raw: 15, counted: 15 });
  });
  it("a 10 ms window counts exactly three", () => {
    expect(countPresses(10).counted).toBe(3);
  });
  it("a 60 ms window is too slow: the quick double click is lost, one press counted", () => {
    expect(countPresses(60).counted).toBe(1);
  });
});
