import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
  await page.addInitScript(() => sessionStorage.setItem("inside-tech:booted", "1"));
});

test("the journey: Enter starts it, answers pay XP, the finale adds up to 185 ms", async ({ page }) => {
  await page.goto("/journey");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Бір басудың саяхаты");
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: /Enter/ }).click();
  const first = page.getByRole("region", { name: "Пернетақта" });
  await expect(first).toBeInViewport();
  await first.getByRole("button", { name: "125 мс" }).click();
  await expect(first.getByText("Дұрыс емес")).toBeVisible();
  await first.getByRole("button", { name: "8 мс" }).click();
  await expect(first.getByText(/\+10 XP/)).toBeVisible();
  await expect(page.getByRole("group", { name: /Деңгей 1, 10 XP/ })).toBeAttached();
  await expect(page.getByRole("heading", { name: "185 мс" })).toBeAttached();
  await expect(page.getByText("1 / 10 сұрақ шешілді")).toBeAttached();
  // The answer is remembered.
  await page.reload();
  await expect(page.getByRole("region", { name: "Пернетақта" }).getByRole("button", { name: "8 мс" })).toBeDisabled();
});

test("the header leads to the journey", async ({ page }) => {
  await page.goto("/");
  await page.locator("summary", { hasText: "Тағы" }).click();
  await page.getByRole("link", { name: "Саяхат", exact: true }).click();
  await expect(page).toHaveURL(/\/journey$/);
});
