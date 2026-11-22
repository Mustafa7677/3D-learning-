import { describe, expect, it } from "vitest";
import { FILM_STAGES } from "@inside-tech/lesson-engine";
import { PROBLEMS, bestStreak, checkStep, dailyProblem, dayKey, markSolvedDay, problemStars, readNumber, streakLength, week } from "./problems";

const byId = (id: string) => PROBLEMS.find((p) => p.id === id)!;
const answers = (id: string) => byId(id).twin.steps.map((s) => s.answer);

describe("hard problems: the numbers are right", () => {
  it("ellipse: a, c, b and the area", () => {
    const [a, c, b, S] = answers("ellipse-bed");
    expect([a, c]).toEqual([5, 3]);
    expect(b).toBe(Math.sqrt(a! * a! - c! * c!));
    expect(S).toBeCloseTo(Math.PI * a! * b!, 9);
    expect(Math.PI * 13 * 5).toBeCloseTo(204.2, 1);
  });

  it("the system has the solution the steps say", () => {
    const [y, x, z] = answers("gauss-trick");
    expect([x! + y! + z!, x! - y! + z!, 3 * x! + y! - z!]).toEqual([10, 4, 4]);
  });

  it("eigenvalues of [[5, 2], [2, 2]] from trace and determinant", () => {
    const [tr, d, l1, l2] = answers("eigen-trace");
    expect([tr, d]).toEqual([7, 6]);
    for (const l of [l1!, l2!]) expect((5 - l) * (2 - l) - 4).toBe(0);
  });

  it("binary search counts", () => {
    const k = (n: number) => Math.ceil(Math.log2(n + 1));
    expect(k(1_000_000)).toBe(20);
    expect(answers("binary-search")).toEqual([k(5000), k(50000), k(50000) - k(5000)]);
  });

  it("birthday probabilities", () => {
    const p = (n: number) => {
      let q = 1;
      for (let i = 0; i < n; i++) q *= (365 - i) / 365;
      return 100 * (1 - q);
    };
    expect(p(23)).toBeGreaterThan(50);
    expect(Math.abs(p(10) - answers("birthday")[0]!)).toBeLessThan(0.01);
    expect(Math.abs(p(30) - answers("birthday")[1]!)).toBeLessThan(0.01);
  });

  it("bandwidth delay", () => {
    expect((64000 * 8) / 0.04 / 1e6).toBeCloseTo(12.8, 9);
    const [rate, bdp, conns] = answers("bdp");
    expect(rate).toBeCloseTo((64000 * 8) / 0.08 / 1e6, 9);
    expect(bdp).toBe((50e6 * 0.08) / 8 / 1000);
    expect(conns).toBe(Math.ceil(50 / rate!));
  });

  it("password entropy", () => {
    expect(8 * Math.log2(62)).toBeCloseTo(47.6, 1);
    expect(62 ** 8 / 1e10 / 3600).toBeCloseTo(6.06, 1);
    const [w, four, lower] = answers("passwords");
    expect(w).toBeCloseTo(12.92, 2);
    expect(four).toBeCloseTo(51.7, 1);
    expect(lower).toBeCloseTo(56.4, 1);
  });

  it("every film walks Pólya's route and every strategy has three options", () => {
    for (const p of PROBLEMS) {
      const st = p.film.frames.map((f) => f.stage);
      expect(st[0], p.id).toBe(0);
      expect(st.at(-1), p.id).toBe(FILM_STAGES.length - 1);
      expect(st.every((x, i) => i === 0 || x >= st[i - 1]!), p.id).toBe(true);
      for (const f of p.film.frames) if (f.mark) expect(f.board.join(" "), `${p.id} ${f.mark}`).toContain(f.mark);
      expect(p.strategy.options).toHaveLength(3);
      expect(/[–—]/.test(JSON.stringify(p)), `${p.id} dashes`).toBe(false);
    }
  });
});

describe("checking and scoring", () => {
  it("reads Kazakh decimals, fractions and the minus sign", () => {
    expect([readNumber("62,8"), readNumber("62.8"), readNumber("1/4"), readNumber("−3"), readNumber(""), readNumber("abc")]).toEqual([62.8, 62.8, 0.25, -3, null, null]);
    const area = byId("ellipse-bed").twin.steps[3]!;
    expect([checkStep(area, "62,8"), checkStep(area, "62"), checkStep(area, " ")]).toEqual(["right", "wrong", "empty"]);
  });

  it("stars", () => {
    expect([problemStars(0, 0), problemStars(1, 0), problemStars(0, 2), problemStars(3, 1)]).toEqual([3, 2, 2, 1]);
  });
});

describe("the day and the streak", () => {
  it("a different problem each day, all of them in a cycle", () => {
    const seen = new Set<string>();
    for (let i = 0; i < PROBLEMS.length; i++) seen.add(dailyProblem(new Date(2026, 10, 1 + i)).id);
    expect(seen.size).toBe(PROBLEMS.length);
    expect(dailyProblem(new Date(2026, 10, 22)).id).toBe(dailyProblem(new Date(2026, 10, 22, 23, 59)).id);
  });

  it("counts days in a row, survives until a day is missed, keeps the best", () => {
    let s = { days: [] as string[] };
    for (const d of [18, 19, 20, 21]) s = markSolvedDay(s, new Date(2026, 10, d));
    s = markSolvedDay(s, new Date(2026, 10, 21));
    expect(s.days).toHaveLength(4);
    expect(streakLength(s, new Date(2026, 10, 21))).toBe(4);
    expect(streakLength(s, new Date(2026, 10, 22))).toBe(4);
    expect(streakLength(s, new Date(2026, 10, 23))).toBe(0);
    expect(bestStreak({ days: [...s.days, "2026-11-25"] })).toBe(4);
    expect(streakLength({ days: ["2026-12-31", "2027-01-01"] }, new Date(2027, 0, 1))).toBe(2);
    const w = week(s, new Date(2026, 10, 22));
    expect(w.map((x) => x.solved)).toEqual([false, false, true, true, true, true, false]);
    expect(w.at(-1)).toMatchObject({ key: dayKey(new Date(2026, 10, 22)), today: true });
  });
});
