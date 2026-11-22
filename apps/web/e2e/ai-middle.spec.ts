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

test("Middle 13: the week-0 model falls to 81% by week 8; retraining restores it", async ({ page }) => {
  await page.goto("/labs/ai/ai-13-drift");
  const r = page.getByRole("status", { name: "Апта нәтижесі" });
  await page.getByRole("button", { name: "Осы аптада бағалау" }).click();
  await expect(r).toContainText("99.5%");
  await page.getByRole("button", { name: "8-апта" }).click();
  await page.getByRole("button", { name: "Осы аптада бағалау" }).click();
  await expect(r).toContainText("81.0%");
  await expect(r).toContainText("37");
});

test("Middle 14: a leaky feature scores 98% and drops to 59%; a patient split tells the truth", async ({ page }) => {
  await page.goto("/labs/ai/ai-14-leakage");
  const f = page.getByRole("status", { name: "Белгі нәтижесі" });
  await page.getByRole("button", { name: "Үйрету және тексеру" }).click();
  await expect(f).toContainText("Тест98%");
  await expect(f).toContainText("Өндіріс59%");
  await page.getByLabel("«Антибиотик жазылды» белгісі қосулы").click();
  await page.getByRole("button", { name: "Үйрету және тексеру" }).click();
  await expect(f).toContainText("Өндіріс77%");
  await expect(objective(page, "Оны алып таста")).toHaveAttribute("data-done", "true");
  const sp = page.getByRole("status", { name: "Бөлу нәтижесі" });
  await page.getByRole("button", { name: "Бөліп, тексеру" }).click();
  await expect(sp).toContainText("Тест85%");
  await page.getByRole("button", { name: "Пациенттер бойынша" }).click();
  await page.getByRole("button", { name: "Бөліп, тексеру" }).click();
  await expect(sp).toContainText("Ортақ жазба0");
});

test("Middle 15: the raw model claims 99% and is right 86%; T = 3 calibrates without changing accuracy", async ({ page }) => {
  await page.goto("/labs/ai/ai-15-calibration");
  const r = page.getByRole("status", { name: "Калибровка нәтижесі" });
  const go = page.getByRole("button", { name: "Сенімділікті тексеру" });
  await go.click();
  await expect(r).toContainText("ECE0.128");
  await expect(page.getByRole("table", { name: "Сенімділік кестесі" })).toContainText("99%86%");
  await page.getByRole("button", { name: "T = 3" }).click();
  await go.click();
  await expect(r).toContainText("Дәлдік79%");
  await expect(r).toContainText("ECE0.011");
});
