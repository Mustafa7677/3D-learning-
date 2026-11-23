import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});

test("search: Ctrl+K anywhere, Kazakh endings forgiven, arrows and Enter open the hit; it works inside a lesson too", async ({ page }) => {
  await page.goto("/today");
  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog", { name: "Іздеу" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("combobox").fill("векторларды");
  const results = dialog.getByRole("listbox", { name: "Іздеу нәтижелері" });
  await expect(results.getByRole("option").first()).toContainText("Векторлар және олармен амалдар");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/labs\/math\/la-1-vectors$/);

  // In a lesson: the button in the top bar.
  await page.getByRole("button", { name: "Іздеу (Ctrl+K)" }).click();
  await dialog.getByRole("combobox").fill("туған күн");
  await expect(results.getByRole("option").first()).toContainText("Туған күн парадоксы");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);

  // "/" opens it, a learning-course hit opens the right episode.
  await page.goto("/tools");
  await page.keyboard.press("/");
  await dialog.getByRole("combobox").fill("бір түн");
  await results.getByRole("option", { name: /Бір түн мен бір апта/ }).click();
  await expect(page).toHaveURL(/\/learn\?e=cram$/);
  await expect(page.getByRole("article", { name: /Эпизод 2:/ })).toBeVisible();
});

test("phone: a tab bar with the main places and search; a returning learner sees «Жалғастыр» on the home page", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 760 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => {
    throw e;
  });
  await page.goto("/today");
  const tabs = page.getByRole("navigation", { name: "Төменгі мәзір" });
  await expect(tabs).toBeVisible();
  await expect(tabs.getByRole("link", { name: "Бүгін" })).toHaveAttribute("aria-current", "page");
  await tabs.getByRole("button", { name: "Іздеу" }).click();
  await expect(page.getByRole("dialog", { name: "Іздеу" })).toBeVisible();
  await page.keyboard.press("Escape");
  await tabs.getByRole("link", { name: "Құралдар" }).click();
  await expect(page).toHaveURL(/\/tools$/);

  // Newcomer: no card. After a task in a lesson: the card offers to continue.
  await page.goto("/");
  await expect(page.getByRole("complementary", { name: "Қайта қош келдің" })).toHaveCount(0);
  await page.goto("/labs/math/la-1-vectors");
  const v = page.getByRole("group", { name: "v векторы" });
  await v.getByLabel("v x", { exact: true }).fill("3");
  await v.getByLabel("v y", { exact: true }).fill("4");
  await expect(page.locator("li[data-done]", { hasText: "AB векторын" })).toHaveAttribute("data-done", "true");
  await page.waitForTimeout(400);
  await page.goto("/");
  const card = page.getByRole("complementary", { name: "Қайта қош келдің" });
  await expect(card).toContainText("Векторлар және олармен амалдар");
  await expect(card.getByRole("link", { name: "Жалғастыр" })).toHaveAttribute("href", "/labs/math/la-1-vectors");
  await card.getByRole("button", { name: "Жабу" }).click();
  await expect(card).toHaveCount(0);
  await ctx.close();
});
