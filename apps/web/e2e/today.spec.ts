import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});

test("Бүгін: a newcomer gets a three-move plan; a review and a lesson task tick it; the goal is kept", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Негізгі мәзір" }).getByRole("link", { name: "Бүгін" }).click();
  await expect(page).toHaveURL(/\/today$/);
  const plan = page.getByRole("region", { name: "Бүгінгі үш қадам" }).getByRole("link");
  await expect(plan).toHaveCount(3);
  await expect(plan.nth(0)).toHaveAccessibleName(/ЕСКЕ ТҮСІР: \d+ карточканы қайтала$/);
  await expect(plan.nth(1)).toHaveAccessibleName(/ЖАҢА МАТЕРИАЛ: /);
  await expect(plan.nth(2)).toHaveAccessibleName(/ҚИЫН ЕСЕП: /);
  await expect(page.getByRole("img", { name: "бүгінгі жоспар: 0/3" })).toBeVisible();
  await expect(page.getByRole("img", { name: /Соңғы 16 аптадағы белсенділік: 0 белсенді күн/ })).toBeVisible();

  // One review on the cards page.
  await plan.nth(0).click();
  await expect(page).toHaveURL(/\/cards$/);
  await page.getByRole("button", { name: "Жауабын көру" }).click();
  await page.getByRole("button", { name: /^Білдім/ }).click();

  // One task in the suggested lesson.
  await page.goto("/today");
  await expect(page.getByRole("img", { name: "бүгінгі жоспар: 1/3" })).toBeVisible();
  await expect(plan.nth(0)).toHaveAccessibleName(/\(орындалды\)$/);
  await page.goto("/labs/math/la-1-vectors");
  const v = page.getByRole("group", { name: "v векторы" });
  await v.getByLabel("v x", { exact: true }).fill("3");
  await v.getByLabel("v y", { exact: true }).fill("4");
  await expect(page.locator("li[data-done]", { hasText: "AB векторын" })).toHaveAttribute("data-done", "true");
  await page.waitForTimeout(400);

  await page.goto("/today");
  await expect(page.getByRole("img", { name: "бүгінгі жоспар: 2/3" })).toBeVisible();
  await expect(page.getByRole("img", { name: "апта мақсаты: 1/3" })).toBeVisible();
  await expect(page.getByRole("img", { name: /1 белсенді күн/ })).toBeVisible();
  await page.getByRole("group", { name: "Аптасына неше күн" }).getByRole("button", { name: "5 күн" }).click();
  await page.reload();
  await expect(page.getByRole("img", { name: "апта мақсаты: 1/5" })).toBeVisible();
  const math = page.getByRole("region", { name: "Шеберлік картасы" }).getByRole("link", { name: /Mathematics/ });
  await expect(math).toContainText("0/10");
});

test("merely opening a lesson is not a day of study", async ({ page }) => {
  await page.goto("/labs/math/la-2-dot");
  await page.waitForTimeout(800);
  await page.goto("/today");
  await expect(page.getByRole("img", { name: "бүгінгі жоспар: 0/3" })).toBeVisible();
  const learn = page.getByRole("region", { name: "Бүгінгі үш қадам" }).getByRole("link").nth(1);
  await expect(learn).toHaveAccessibleName(/Скаляр көбейтінді/);
  await expect(learn).toContainText("Тоқтаған жеріңнен жалғастыр.");
});
