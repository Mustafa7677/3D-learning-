import { describe, expect, it } from "vitest";
import { enoughIdeas, review, sentences, verdict } from "./feynman";
import { lessonEntries } from "./lessons";

const ellipse = lessonEntries.find((e) => e.lesson.id === "ag-3-ellipse")!.lesson;

describe("explain it to Мустафа", () => {
  it("a bare definition gets four questions back", () => {
    const r = review(ellipse, "Эллипс бұл сопақ.");
    expect(r.score).toBe(0);
    expect(r.questions).toHaveLength(4);
    expect(r.questions[0]).toMatch(/^Ал «.+» деген не\?/);
  });

  it("a good explanation: ideas, a cause, an example, short sentences", () => {
    const text = [
      "Эллипс деген сопақ қисық.",
      "Оның екі фокусы бар.",
      "Кез келген нүктеден фокустарға дейінгі қашықтықтар қосындысы тұрақты, ол 2a.",
      "Себебі бағбан оны бау мен екі қазықпен сызады, ал бау созылмайды.",
      "Мысалы, фокустарды бір жерге жинасаң, шеңбер шығады.",
      "Эксцентриситет оның қаншалық созылғанын айтады.",
    ].join(" ");
    const r = review(ellipse, text);
    expect(r.signs).toEqual({ ideas: true, why: true, example: true, simple: true });
    expect(r.score).toBe(4);
    expect(r.questions).toEqual([]);
    expect(verdict(r.score)).toMatch(/түсіндім/);
  });

  it("one long sentence is not simple", () => {
    const long = "Эллипс " + "және тағы бір сөз ".repeat(12) + "бар. Тағы бір өте ұзын сөйлем " + "мен тағы сөздер ".repeat(12) + "бар.";
    const r = review(ellipse, long);
    expect(r.signs.simple).toBe(false);
    expect(r.avgWords).toBeGreaterThan(18);
    expect(r.questions.some((q) => q.startsWith("Баяуырақ!"))).toBe(true);
  });

  it("sentences and the idea threshold", () => {
    expect(sentences("Бір сөз. Екі сөз бар! Сөз? Үш сөз бар ма?")).toHaveLength(3);
    expect([enoughIdeas(2), enoughIdeas(3), enoughIdeas(9)]).toEqual([2, 2, 5]);
  });

  it("every lesson in the course can be explained", () => {
    for (const e of lessonEntries) expect(review(e.lesson, "").questions.length, e.lesson.id).toBe(4);
  });
});
