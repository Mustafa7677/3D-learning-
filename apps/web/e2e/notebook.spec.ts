import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});

test("an empty notebook says so", async ({ page }) => {
  await page.goto("/notebook");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Қателескен жерің");
  await expect(page.getByRole("heading", { name: "Дәптер әзірге таза" })).toBeVisible();
});

test("a wrong quiz answer lands in the notebook and can be re-solved", async ({ page }) => {
  await page.goto("/labs/web/web-10-cache");
  const q = page.locator("fieldset", { hasText: "Кэштен алынған жауап кезінде" });
  await q.getByRole("button", { name: "Тек DNS" }).click();
  await expect(q).toContainText("қателер дәптеріне жазылды");
  await page.waitForTimeout(500);

  await page.goto("/notebook");
  const tally = page.getByRole("region", { name: "Дәптер есебі" });
  await expect(tally).toContainText("1барлық қате");
  const sheet = page.getByRole("region", { name: "Дәптер беттері" });
  await expect(sheet).toContainText("DNS, TCP, TLS және HTTP");

  const practice = page.getByRole("article", { name: "Қайта шешу" });
  await practice.getByRole("button", { name: /DNS, TCP, TLS және HTTP/ }).click();
  await expect(practice.getByRole("status")).toContainText("Дұрыс");
  await practice.getByRole("button", { name: "Келесі" }).click();
  await expect(page.getByRole("heading", { name: "Бүгінгі қайталау бітті" })).toBeVisible();
  await expect(sheet).toContainText("2-қорап");
});
