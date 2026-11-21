import { describe, expect, it } from "vitest";
import { JOURNEY, JOURNEY_TOTAL } from "./journey";
import { openLabs } from "./catalog";

describe("journey", () => {
  it("adds up to the total shown on the page", () => {
    expect(JOURNEY_TOTAL).toBe(185);
    expect(JOURNEY).toHaveLength(10);
  });
  it("every stop has a well-formed question and a real course", () => {
    for (const s of JOURNEY) {
      expect(openLabs.some((l) => l.id === s.lab), s.id).toBe(true);
      expect(s.question.options.length).toBeGreaterThanOrEqual(3);
      expect(s.question.answer).toBeLessThan(s.question.options.length);
      expect(s.text).not.toMatch(/—/);
    }
  });
});
