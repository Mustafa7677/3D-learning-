import { expect, test, type Page } from "@playwright/test";
import { answerQuiz, nextStep } from "./helpers";

const objective = (page: Page, text: string) => page.locator("li[data-done]", { hasText: text });
const send = async (page: Page) => {
  await page.getByRole("button", { name: "Жіберу" }).click();
  // "Соңына өту" shows only while a trace runs and vanishes when it ends, which can
  // happen between the check and the click: never wait the default 30 s for it.
  const skip = page.getByRole("button", { name: "Соңына өту" });
  if (await skip.isVisible().catch(() => false)) await skip.click({ timeout: 1000 }).catch(() => {});
};

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});

test("web lab page lists the Junior lessons, the problem set and the Middle level", async ({ page }) => {
  await page.goto("/labs/web");
  await expect(page.locator("ol li")).toHaveCount(12);
  await expect(page.locator('ol li[data-level="Middle"]')).toHaveCount(3);
});

test("predict, observe, explain: the guess is locked, then revealed after the experiment", async ({ page }) => {
  await page.goto("/labs/web/web-10-cache");
  const card = page.getByRole("region", { name: "Алдымен болжа" });
  await expect(card).toContainText("max-age=60");
  // A wrong guess on purpose: the server sends the page again.
  await card.getByRole("button", { name: /Сервер бетті қайта жібереді/ }).click();
  await expect(card.getByRole("button", { name: /Браузер оны кэштен алады/ })).toBeDisabled();
  await expect(card.getByRole("status")).toContainText("Болжамың жазылды");
  await send(page);
  await expect(page.locator("text=200 OK").first()).toBeVisible({ timeout: 10_000 });
  await send(page);
  await expect(objective(page, "кэштен ашылады")).toHaveAttribute("data-done", "true", { timeout: 10_000 });
  await expect(card.getByRole("status")).toContainText("Тәжірибе басқаша көрсетті");
  await expect(card.getByRole("button", { name: /Браузер оны кэштен алады/ })).toHaveAttribute("data-answer", "true");
  // The guess survives a reload.
  await page.reload();
  await expect(page.getByRole("region", { name: "Алдымен болжа" }).getByRole("button", { name: /Сервер бетті қайта жібереді/ })).toHaveAttribute("aria-pressed", "true");
});

test("Middle 10: an expired copy comes back as 304 Not Modified with ETag", async ({ page }) => {
  await page.goto("/labs/web/web-10-cache");
  await page.getByRole("region", { name: "Алдымен болжа" }).getByRole("button").first().click();
  await send(page);
  await expect(page.locator("text=200 OK").first()).toBeVisible({ timeout: 10_000 });
  await send(page);
  await expect(objective(page, "кэштен ашылады")).toHaveAttribute("data-done", "true", { timeout: 10_000 });
  await nextStep(page);
  await page.getByLabel(/ETag \(304 жауабы\)/).click();
  await expect(objective(page, "ETag-ті қос")).toHaveAttribute("data-done", "true");
  await page.getByRole("button", { name: "Уақыт +60 с" }).click();
  await send(page);
  await expect(page.locator("text=304 Not Modified").first()).toBeVisible({ timeout: 10_000 });
  await expect(objective(page, "304 Not Modified келеді")).toHaveAttribute("data-done", "true", { timeout: 10_000 });
});

test("Middle 11: 401 without a token, 403 with a user's, 200 with the admin's", async ({ page }) => {
  await page.goto("/labs/web/web-11-roles");
  await send(page);
  await expect(objective(page, "401 Unauthorized")).toHaveAttribute("data-done", "true", { timeout: 10_000 });
  await nextStep(page);
  await page.getByLabel("Authorization: Bearer (token)").fill("secret-123");
  await page.getByLabel("Authorization: Bearer (token)").blur();
  await send(page);
  await expect(objective(page, "403 Forbidden")).toHaveAttribute("data-done", "true", { timeout: 10_000 });
  await page.getByLabel("Authorization: Bearer (token)").fill("admin-777");
  await page.getByLabel("Authorization: Bearer (token)").blur();
  await send(page);
  await expect(objective(page, "200 OK")).toHaveAttribute("data-done", "true", { timeout: 10_000 });
});

test("lesson 1: a request travels DNS → TCP → TLS → HTTP and returns 200", async ({ page }) => {
  await page.goto("/labs/web/web-1-internet");
  await send(page);
  await expect(page.locator("text=200 OK").first()).toBeVisible({ timeout: 10_000 });
  // The log shows 200 OK when the response arrives; the objectives are graded when the
  // whole trace (render included) has finished, which can take a few more seconds under load.
  await expect(objective(page, "200 OK")).toHaveAttribute("data-done", "true", { timeout: 10_000 });
  await expect(objective(page, "DNS, TCP және TLS")).toHaveAttribute("data-done", "true");
  await expect(page.locator('ol[aria-label="Сұрау кезеңдері"] li')).toHaveCount(12);
});

test("lesson 4: predicting the event loop order", async ({ page }) => {
  await page.goto("/labs/web/web-4-js");
  const next = page.getByRole("button", { name: "Келесі қадам" });
  // Click until the last frame; the button disables itself there.
  for (let i = 0; i < 20 && (await next.isEnabled()); i++) await next.click({ timeout: 2000 }).catch(() => {});
  await expect(next).toBeDisabled();
  await expect(objective(page, "соңына дейін орында")).toHaveAttribute("data-done", "true");
  await nextStep(page);
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
  await nextStep(page);
  await page.getByLabel("Домен").fill("mysite.kz");
  await page.getByLabel("IP адрес").fill("93.184.10.9");
  await page.getByRole("button", { name: "Жазба қосу" }).click();
  await page.getByRole("button", { name: "Deploy", exact: true }).click();
  await send(page);
  await expect(objective(page, "сенің бетің")).toHaveAttribute("data-done", "true", { timeout: 10_000 });
});
