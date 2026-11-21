import { describe, expect, it } from "vitest";
import { levelOf } from "./levels";
import { lessonsForLab } from "./lessons";

describe("course levels", () => {
  it("orders map to levels", () => {
    expect([1, 9, 10, 17, 18, 30].map(levelOf)).toEqual(["Junior", "Junior", "Middle", "Middle", "Senior", "Senior"]);
  });
  it("Databases now reaches the Middle level, in order", () => {
    const db = lessonsForLab("db");
    expect(db.map((e) => e.lesson.order)).toEqual([...db.keys()].map((i) => i + 1));
    expect(db.filter((e) => levelOf(e.lesson.order) === "Middle").length).toBeGreaterThanOrEqual(3);
  });
});
