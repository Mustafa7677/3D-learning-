import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});

test("an IT lesson opens with its comic", async ({ page }) => {
  await page.goto("/labs/sec/sec-1-caesar");
  const comic = page.getByRole("region", { name: "Комикс: Сабақтағы жасырын хат" });
  await expect(comic).toBeVisible();
  await expect(comic).toContainText("Цезарь шифры");
  await expect(comic.locator("li")).toHaveCount(5);
});

test("the comic library: shelves, a reader frame by frame with keys, read marks, a way to the lesson", async ({ page }) => {
  await page.goto("/comics");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Комикс");
  await expect(page.getByLabel("Оқылған комикстер")).toHaveText(/^0\/\d+ оқылды$/);
  await page.getByRole("navigation", { name: "Сөрелер" }).getByRole("button", { name: /Databases/ }).click();
  await page.getByRole("button", { name: "Оқу: Сынып журналы" }).click();

  const reader = page.getByRole("dialog", { name: "Комикс: Сынып журналы" });
  await expect(reader.getByRole("article", { name: "1-кадр" })).toContainText("800 оқушы");
  await page.keyboard.press("ArrowRight");
  await expect(reader.getByRole("article", { name: "2-кадр" })).toBeVisible();
  await reader.getByRole("button", { name: "Келесі кадр →" }).click();
  await expect(reader.getByRole("article", { name: "3-кадр" })).toContainText("SELECT name FROM students");
  await reader.getByRole("list", { name: "Кадрлар" }).getByRole("button", { name: "5-кадр" }).click();
  await expect(reader.getByRole("link", { name: "Сабаққа өту →" })).toHaveAttribute("href", "/labs/db/db-1-select");
  await page.keyboard.press("Escape");
  await expect(reader).toHaveCount(0);
  await expect(page.getByLabel("Оқылған комикстер")).toHaveText(/^1\/\d+ оқылды$/);
  await expect(page.getByRole("button", { name: "Оқу: Сынып журналы" })).toContainText("✓ оқылды");
});
