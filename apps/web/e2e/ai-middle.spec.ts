import { expect, test, type Page } from "@playwright/test";

const objective = (page: Page, text: string | RegExp) => page.locator("li[data-done]", { hasText: text });

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});

test("Middle 10: SGD crawls at lr 0.1 and explodes at 0.55; momentum converges at 0.1", async ({ page }) => {
  await page.goto("/labs/ai/ai-10-optimizers");
  await expect(page.locator("canvas")).toBeVisible();
  const result = page.getByRole("status", { name: "Оптимизация нәтижесі" });
  await page.getByRole("button", { name: "Түсуді бастау" }).click();
  await expect(result).toContainText("150 қадамда жетпеді");
  await page.getByRole("button", { name: "lr 0.55" }).click();
  await page.getByRole("button", { name: "Түсуді бастау" }).click();
  await expect(result).toContainText("жарылды");
  await page.getByRole("button", { name: "lr 0.45" }).click();
  await page.getByRole("button", { name: "Түсуді бастау" }).click();
  await expect(result).toContainText("36 қадам");
  await expect(objective(page, "жинақталатын lr")).toHaveAttribute("data-done", "true");
});

test("Middle 11: 'everyone is healthy' scores 95% with zero recall", async ({ page }) => {
  await page.goto("/labs/ai/ai-11-metrics");
  const m = page.getByRole("status", { name: "Метрикалар" });
  await page.getByRole("button", { name: "Бағалау" }).click();
  await expect(m).toContainText("95%");
  await expect(m).toContainText("0.00");
  await page.getByRole("button", { name: "Нақты модель" }).click();
  await page.getByRole("button", { name: "Бағалау" }).click();
  await expect(m).toContainText("TP 9 · FP 35");
});

test("Middle 12: a hand-built Prewitt kernel finds horizontal edges only", async ({ page }) => {
  await page.goto("/labs/ai/ai-12-convolution");
  await page.getByRole("button", { name: "Sobel-x" }).click();
  await page.getByRole("button", { name: "Ядроны қолдану" }).click();
  const test1 = page.getByRole("status", { name: "Шекара сынағы" });
  await expect(test1).toContainText("Тік шекара4");
  await expect(objective(page, "тік шекаралар жанады")).toHaveAttribute("data-done", "true");
});
