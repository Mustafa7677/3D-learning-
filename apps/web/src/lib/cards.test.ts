import { describe, expect, it } from "vitest";
import { BOXES, CARDS, boxCounts, dueCards, grade, newDeck, nextDue, sanitizeDeck } from "./cards";
import { openLabs } from "./catalog";

const NOW = Date.UTC(2026, 10, 21, 9);
const DAY = 86_400_000;

describe("memory cards (Leitner)", () => {
  it("twenty cards, unique ids, every lab covered, no long dashes", () => {
    expect(CARDS).toHaveLength(20);
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(20);
    for (const l of openLabs) expect(CARDS.some((c) => c.lab === l.id), l.id).toBe(true);
    expect(JSON.stringify(CARDS)).not.toMatch(/[—–]|CS50/);
  });

  it("a new deck has every card due today in box 1", () => {
    const d = newDeck(NOW);
    expect(dueCards(d, NOW)).toHaveLength(20);
    expect(boxCounts(d)).toEqual([20, 0, 0, 0, 0]);
  });

  it("knowing a card moves it up and away; not knowing brings it back now", () => {
    let d = newDeck(NOW);
    d = grade(d, "dns", true, NOW);
    expect(d.dns).toEqual({ box: 2, due: NOW + DAY });
    expect(dueCards(d, NOW).map((c) => c.id)).not.toContain("dns");
    expect(dueCards(d, NOW + DAY).map((c) => c.id)).toContain("dns");
    d = grade(d, "dns", true, NOW);
    expect(d.dns).toEqual({ box: 3, due: NOW + 3 * DAY });
    expect(dueCards(d, NOW).map((c) => c.id)).not.toContain("dns");
    expect(dueCards(d, NOW + 3 * DAY).map((c) => c.id)).toContain("dns");
    d = grade(d, "dns", false, NOW);
    expect(d.dns).toEqual({ box: 1, due: NOW });
  });

  it("the top box stays the top box", () => {
    let d = newDeck(NOW);
    for (let i = 0; i < 9; i++) d = grade(d, "tcp", true, NOW);
    expect(d.tcp!.box).toBe(BOXES);
    expect(d.tcp!.due).toBe(NOW + 14 * DAY);
  });

  it("weakest cards come first", () => {
    // A box-2 card that is due again comes after every box-1 card.
    const d = { ...newDeck(NOW), dns: { box: 2, due: NOW } };
    expect(dueCards(d, NOW).at(-1)!.id).toBe("dns");
  });

  it("nextDue tells when the deck reopens", () => {
    let d = newDeck(NOW);
    for (const c of CARDS) d = grade(grade(d, c.id, true, NOW), c.id, true, NOW);
    expect(dueCards(d, NOW)).toHaveLength(0);
    expect(nextDue(d)).toBe(NOW + 3 * DAY);
  });

  it("saved decks are cleaned, new cards are added", () => {
    const d = sanitizeDeck({ dns: { box: 9, due: "x" }, tcp: { box: 3, due: NOW + 1e12 }, nope: { box: 2, due: 0 } }, NOW);
    expect(d.dns).toEqual({ box: 1, due: NOW });
    expect(d.tcp!.box).toBe(3);
    expect(d.tcp!.due).toBe(NOW + 30 * DAY);
    expect(Object.keys(d)).toHaveLength(20);
    expect(sanitizeDeck("junk", NOW)).toEqual(newDeck(NOW));
  });
});
