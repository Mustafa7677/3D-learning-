import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EPISODES } from "./learnHow";
import { lessonEntries } from "./lessons";

describe("how to learn", () => {
  it("seven episodes, each a full comic with a board, a finding and a tool", () => {
    expect(EPISODES).toHaveLength(7);
    expect(new Set(EPISODES.map((e) => e.id)).size).toBe(7);
    // Not every answer is "myth": the learner has to think.
    expect(EPISODES.filter((e) => e.fact).length).toBe(3);
    for (const e of EPISODES) {
      expect(e.comic.panels.length, e.id).toBeGreaterThanOrEqual(5);
      expect(e.comic.panels.some((p) => p.board), e.id).toBe(true);
      expect(e.finding.length, e.id).toBeGreaterThan(120);
      expect(/[–—]/.test(JSON.stringify(e)), `${e.id} dashes`).toBe(false);
    }
  });

  it("every tool link leads to a real page", () => {
    for (const e of EPISODES) {
      const [, first, ...rest] = e.tool.href.split("/");
      if (first === "labs") {
        expect(lessonEntries.some((x) => x.labId === rest[0] && x.lesson.id === rest[1]), e.tool.href).toBe(true);
      } else {
        expect(existsSync(join(__dirname, "..", "app", first!, "page.tsx")), e.tool.href).toBe(true);
      }
    }
  });
});
