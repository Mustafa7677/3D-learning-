import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});

test("Бос парақ: a studied topic is suggested; write from memory; recalled ideas are marked, missed ones listed; the next recall is spaced", async ({ page }) => {
  // Study a little first.
  await page.goto("/labs/math/la-1-vectors");
  const v = page.getByRole("group", { name: "v векторы" });
  await v.getByLabel("v x", { exact: true }).fill("3");
  await v.getByLabel("v y", { exact: true }).fill("4");
  await expect(page.locator("li[data-done]", { hasText: "AB векторын" })).toHaveAttribute("data-done", "true");
  await page.waitForTimeout(400);

  await page.goto("/recall");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Есіңде не қалды?");
  const card = page.getByRole("button", { name: "Еске түсіру: Векторлар және олармен амалдар" });
  await expect(card).toContainText("Әлі еске түсірілмеген");
  await card.click();

  await expect(page.getByRole("timer", { name: "Жазу уақыты" })).toHaveText(/^0[23]:\d\d$/);
  await page.getByRole("button", { name: "Тексеру" }).click();
  await expect(page.getByText("Тағы бірнеше сөз жаз")).toBeVisible();
  await page.getByLabel("Есіңде қалғанның бәрі").fill("Вектор көрсеткі де, сандар тізімі де. Қосу көрсеткілерді тізбектеп жалғау. Ұзындығы Пифагор бойынша түбір астында.");
  await page.getByRole("button", { name: "Тексеру" }).click();

  const result = page.getByRole("region", { name: "Нәтиже" });
  await expect(result.getByRole("img", { name: /Еске түсірілді: [1-9]\d*\/\d+/ })).toBeVisible();
  await expect(result.locator("mark").first()).toBeVisible();
  await expect(result).toContainText("Келмегені: қайта қара");
  await expect(result).toContainText(/Келесі еске түсіру: \d күннен кейін/);
  await expect(result.getByRole("link", { name: "Сабақты қайта қарау" })).toHaveAttribute("href", "/labs/math/la-1-vectors");

  // The topic now waits for its spaced date; the page and the plan remember the recall.
  await page.goto("/recall");
  await expect(page.getByRole("button", { name: "Еске түсіру: Векторлар және олармен амалдар" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Еске түсіру тарихы" })).toContainText("Векторлар және олармен амалдар");
  await page.goto("/today");
  await expect(page.getByRole("region", { name: "Бүгінгі үш қадам" }).getByRole("link").first()).toHaveAccessibleName(/\(орындалды\)$/);
});

test("any topic can be chosen from any lab", async ({ page }) => {
  await page.goto("/recall");
  await page.getByRole("group", { name: "Зертхана" }).getByRole("button", { name: "Mathematics" }).click();
  await page.getByRole("button", { name: /Гипербола және парабола/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Гипербола және парабола");
  await page.getByLabel("Есіңде қалғанның бәрі").fill("Конусты жазықтықпен кесеміз: шеңбер, эллипс, парабола, гипербола. Эксцентриситет бір санмен айтады.");
  await page.getByRole("button", { name: "Тексеру" }).click();
  await expect(page.getByRole("region", { name: "Нәтиже" }).getByText("✓", { exact: false }).first()).toBeVisible();
});
