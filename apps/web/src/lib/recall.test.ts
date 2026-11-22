import { describe, expect, it } from "vitest";
import { lessonEntries } from "./lessons";
import { boldTerms, checkRecall, keyIdeas, latest, nextGapDays, record, stem, suggestions } from "./recall";

const lesson = (id: string) => lessonEntries.find((e) => e.lesson.id === id)!.lesson;

describe("key ideas", () => {
  it("every lesson in the course has at least three ideas to recall", () => {
    const thin = lessonEntries.filter((e) => keyIdeas(e.lesson).length < 3).map((e) => e.lesson.id);
    expect(thin).toEqual([]);
  });

  it("bold terms skip formulas", () => {
    expect(boldTerms("**Вектор** және **u + v = (4, 3)**, **Cache-Control: max-age=N**, сосын **скаляр көбейтінді**.")).toEqual(["Вектор", "Cache-Control", "скаляр көбейтінді"]);
  });

  it("stems forgive Kazakh endings", () => {
    expect(stem("көбейтіндісі")).toBe("көбейт");
    expect(stem("фокустарға")).toBe("фокус");
    expect(stem("шеңберге")).toBe("шеңбер");
    expect("скаляр көбейтіндісін".includes(stem("көбейтінді"))).toBe(true);
    expect(stem("Тор")).toBe("тор");
  });
});

describe("checking a blank page", () => {
  const ideas = keyIdeas(lesson("la-1-vectors"));
  it("a page that says the ideas finds them, an empty one finds none", () => {
    const text = "Вектор деген көрсеткі де, сандар тізімі де. Қосу көрсеткілерді тізбектеп жалғау, санға көбейту созу не қысу, теріс сан бағытты кері бұрады. Ұзындығы Пифагор теоремасынан, түбір астында квадраттар.";
    const r = checkRecall(ideas, text);
    expect(r.found.length).toBeGreaterThanOrEqual(3);
    expect(r.share).toBeGreaterThan(0.3);
    expect(checkRecall(ideas, "").share).toBe(0);
  });

  it("spacing grows with what came back", () => {
    expect([nextGapDays(0.9), nextGapDays(0.6), nextGapDays(0.2)]).toEqual([7, 3, 1]);
  });

  it("suggests due topics first, then the oldest studied; a fresh recall waits", () => {
    const now = 100 * 86400000;
    const a = lessonEntries[0]!.lesson.id;
    const b = lessonEntries[1]!.lesson.id;
    const c = lessonEntries[2]!.lesson.id;
    const studied = [
      { lessonId: a, updatedAt: now - 5 * 86400000 },
      { lessonId: b, updatedAt: now - 9 * 86400000 },
      { lessonId: c, updatedAt: now - 20 * 86400000 },
    ];
    const hist = [record(c, 0.2, now - 2 * 86400000), record(a, 0.9, now - 86400000)];
    const s = suggestions(lessonEntries, studied, hist, now);
    expect(s.map((x) => [x.entry.lesson.id, x.due])).toEqual([
      [c, true],
      [b, false],
    ]);
    expect(latest([record(a, 0.1, 1), record(a, 0.9, 5)]).get(a)!.share).toBe(0.9);
  });
});
