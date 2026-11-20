import { describe, expect, it } from "vitest";
import { levelCost, playerStats } from "./xp";

const p = (lessonId: string, tasks: number, done: boolean) => ({
  lessonId,
  stepIndex: 0,
  completed: { s: Array.from({ length: tasks }, (_, i) => `o${i}`) },
  startedAt: 1,
  updatedAt: 2,
  ...(done ? { completedAt: 3 } : {}),
});

describe("player XP", () => {
  it("starts at level 1", () => {
    expect(playerStats([])).toMatchObject({ xp: 0, level: 1, into: 0, need: levelCost(1), lessonsDone: 0 });
  });
  it("counts tasks and finished lessons, and levels up", () => {
    const s = playerStats([p("iot-1-adc", 2, true), p("iot-2-sampling", 2, true), p("cloud-1-containers", 3, true), p("ai-1-data", 1, false)]);
    // 8 tasks × 10 + 3 lessons × 100 = 380 → level 2 (300 spent), 80 into level 2.
    expect(s).toMatchObject({ xp: 380, level: 2, into: 80, need: 400, lessonsDone: 3, doneByLab: { iot: 2, cloud: 1 } });
  });
});
