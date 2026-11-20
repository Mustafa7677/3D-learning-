import { expect, test, type Page } from "@playwright/test";

const objective = (page: Page, text: string) => page.locator("li[data-done]", { hasText: text });
const send = async (page: Page) => {
  await page.getByRole("button", { name: "Жіберу" }).click();
  const skip = page.getByRole("button", { name: "Соңына өту" });
  if (await skip.isVisible().catch(() => false)) await skip.click().catch(() => {});
};

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});

test("web lab page lists eight lessons", async ({ page }) => {
  await page.goto("/labs/web");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Web Development");
  await expect(page.locator("ol li")).toHaveCount(8);
});

test("lesson 1: a request travels DNS → TCP → TLS → HTTP and returns 200", async ({ page }) => {
  await page.goto("/labs/web/web-1-internet");
  await send(page);
  await expect(page.locator("text=200 OK").first()).toBeVisible({ timeout: 10_000 });
  await expect(objective(page, "200 OK")).toHaveAttribute("data-done", "true");
  await expect(objective(page, "DNS, TCP және TLS")).toHaveAttribute("data-done", "true");
  await expect(page.locator('ol[aria-label="Сұрау кезеңдері"] li')).toHaveCount(12);
});

test("lesson 4: predicting the event loop order", async ({ page }) => {
  await page.goto("/labs/web/web-4-js");
  for (let i = 0; i < 20; i++) {
    const next = page.getByRole("button", { name: "Келесі қадам" });
    if (await next.isDisabled()) break;
    await next.click();
  }
  await expect(objective(page, "соңына дейін орында")).toHaveAttribute("data-done", "true");
  await page.getByRole("button", { name: "Келесі кезең" }).click();
  for (const t of ["A", "D", "C", "B"]) await page.getByRole("button", { name: t, exact: true }).click();
  await expect(page.getByText("Дұрыс!")).toBeVisible();
});

test("lesson 6: an index cuts the rows scanned", async ({ page }) => {
  await page.goto("/labs/web/web-6-db");
  const sql = page.getByLabel("Сұрау");
  await sql.fill("SELECT name FROM users WHERE city = 'Алматы'");
  await sql.blur();
  await page.getByRole("button", { name: "Орындау" }).click();
  await expect(page.getByRole("cell", { name: "Айгерім" })).toBeVisible();
  await expect(objective(page, "WHERE")).toHaveAttribute("data-done", "true");
});

test("lesson 7: fixing a DNS typo makes shop.kz resolve", async ({ page }) => {
  await page.goto("/labs/web/web-7-debug");
  await send(page);
  await expect(page.getByText(/NXDOMAIN/).first()).toBeVisible({ timeout: 10_000 });
  await page.getByLabel("Домен").fill("shop.kz");
  await page.getByLabel("IP адрес").fill("93.184.10.5");
  await page.getByRole("button", { name: "Жазба қосу" }).click();
  await send(page);
  await expect(page.locator("text=404 Not Found").first()).toBeVisible({ timeout: 10_000 });
  await expect(objective(page, "IP адреске шешілсін")).toHaveAttribute("data-done", "true");
});

test("lesson 8: deploy your page and open it", async ({ page }) => {
  await page.goto("/labs/web/web-8-deploy");
  const code = page.getByLabel("Код");
  await code.fill("<h1>Менің жобам</h1><p>Сәлем, әлем!</p>");
  await code.blur();
  await expect(objective(page, "Өз тақырыбың")).toHaveAttribute("data-done", "true");
  await page.getByRole("button", { name: "Келесі кезең" }).click();
  await page.getByLabel("Домен").fill("mysite.kz");
  await page.getByLabel("IP адрес").fill("93.184.10.9");
  await page.getByRole("button", { name: "Жазба қосу" }).click();
  await page.getByRole("button", { name: "Deploy", exact: true }).click();
  await send(page);
  await expect(objective(page, "сенің бетің")).toHaveAttribute("data-done", "true", { timeout: 10_000 });
});
