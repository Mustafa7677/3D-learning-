import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("a hard problem: watch the analysis, choose the strategy, solve the twin yourself; the streak starts", async ({ page }) => {
  await page.goto("/problems?p=ellipse-bed");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Есептер залы");
  await expect(page.getByLabel("Серия ұзындығы")).toHaveText("0 күн қатарынан");
  const room = page.getByRole("article", { name: "Есеп: Бағбанның гүлзары" });
  await expect(room.getByRole("button", { name: "Стратегияға өту" })).toBeDisabled();

  // 1. The analysis film, to its end; then the key idea.
  await room.getByRole("button", { name: /Осы жерде көру/ }).click();
  const film = room.getByRole("region", { name: /Шешім фильмі/ });
  await film.getByRole("button", { name: "Тоқтату" }).click();
  for (let k = 0; k < 5; k++) await film.getByRole("button", { name: "Келесі кадр" }).click();
  await expect(film).toContainText("204,2");
  await expect(room.getByRole("status").filter({ hasText: "ТҮЙІН" })).toContainText("b² = a² − c²");
  await room.getByRole("button", { name: "Стратегияға өту" }).click();

  // 2. The strategy: a wrong pick costs a star.
  const strat = room.getByRole("group", { name: "Стратегиялар" });
  await strat.getByRole("button", { name: /шеңбердің ұзындығы/ }).click();
  await expect(room.getByRole("status")).toContainText("Бұл жол бұл есепке келмейді");
  await strat.getByRole("button", { name: /Бау = 2a/ }).click();
  await room.getByRole("button", { name: "Өзім шығарамын" }).click();

  // 3. The twin, step by step; Kazakh decimal comma accepted.
  const answer = async (label: string, value: string) => {
    const box = room.getByRole("textbox", { name: label });
    await box.fill(value);
    await box.press("Enter");
  };
  await answer("a неге тең?", "4");
  await expect(room).toContainText("Әзірге емес");
  await answer("a неге тең?", "5");
  await answer("c неге тең?", "3");
  await answer("b неге тең?", "4");
  await answer("Аудан S = π·a·b (0,1-ге дейін)", "62,8");
  const win = room.getByRole("status", { name: "Нәтиже" });
  await expect(win).toContainText("Өзің шығардың.");
  await expect(win.getByLabel("2 жұлдыз")).toBeVisible();
  await expect(page.getByLabel("Серия ұзындығы")).toHaveText("1 күн қатарынан");

  // Kept after a reload, and the home page shows the streak.
  await page.reload();
  await expect(page.getByLabel("Серия ұзындығы")).toHaveText("1 күн қатарынан");
  await expect(page.getByRole("navigation", { name: "Есептер" }).getByRole("button", { name: /Бағбанның гүлзары/ }).getByLabel("2 жұлдыз")).toBeVisible();
  await page.goto("/");
  const banner = page.getByRole("region", { name: "Бүгінгі қиын есеп" });
  await expect(banner).toContainText("1 күн қатарынан");
  await expect(banner.getByRole("link")).toHaveText("Тағы бір есеп");
});

test("a hint costs a star; the daily problem is marked", async ({ page }) => {
  await page.goto("/problems?p=binary-search");
  const room = page.getByRole("article", { name: "Есеп: Миллион кітаптың ішінен" });
  await room.getByRole("button", { name: "Фильмсіз түйінді көру" }).click();
  await room.getByRole("button", { name: "Стратегияға өту" }).click();
  await room.getByRole("button", { name: /ең кіші 2-нің дәрежесін/ }).click();
  await room.getByRole("button", { name: "Өзім шығарамын" }).click();
  await room.getByRole("button", { name: "Кеңес (−1 ★)" }).click();
  await expect(room).toContainText("2^12 = 4096");
  for (const [l, v] of [["5 000 жазбаға", "13"], ["50 000 жазбаға", "16"], ["неше салыстыру қосылды", "3"]] as const) {
    const input = room.getByRole("textbox", { name: new RegExp(l) });
    await input.fill(v);
    await input.press("Enter");
  }
  await expect(room.getByRole("status", { name: "Нәтиже" }).getByLabel("2 жұлдыз")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Есептер" }).getByText("Бүгін")).toHaveCount(1);
});
