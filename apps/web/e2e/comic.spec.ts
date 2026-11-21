import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});

const choose = (page: import("@playwright/test").Page, name: RegExp) => page.getByRole("group", { name: "Браузер не дейді?" }).getByRole("button", { name });

test("comic: a wrong turn plays out and comes back, the right path reaches the end, a reload keeps the place", async ({ page }) => {
  await page.goto("/");
  await page.locator("summary", { hasText: "Құралдар" }).click();
  await page.getByRole("link", { name: "Комикс", exact: true }).click();
  await expect(page).toHaveURL(/\/comic$/);
  await expect(page.getByRole("heading", { name: "Үш қол алысу", level: 1 })).toBeVisible();

  // Asking for the page before any connection: the packet is dropped.
  await choose(page, /^GET \/: «Бетті бер!»/).click();
  await expect(page.getByText("Сен кімсің? Арамызда байланыс жоқ. Бұл пакетті тастаймын.")).toBeVisible();
  await expect(page.getByRole("group", { name: "Браузер не дейді?" })).toHaveCount(0);
  await page.getByRole("button", { name: "Қайта таңдау" }).click();
  await choose(page, /^SYN: «Сөйлесейік бе\?»/).click();
  await expect(page.getByText("SYN-ACK · 40 мс")).toBeVisible();

  // The place survives a reload.
  await page.reload();
  await expect(page.getByText("SYN-ACK · 40 мс")).toBeVisible();

  await choose(page, /^ACK: «Дайынмын, бастайық»/).click();
  await choose(page, /^ClientHello/).click();
  await choose(page, /^Тексеремін/).click();
  await choose(page, /^GET \/ : «Басты бетті бер»/).click();
  await expect(page.getByText("АЯҚТАЛДЫ")).toBeVisible();
  await expect(page.getByText("Жолда 1 рет бұрылдың: әрқайсысы бір нақты сабақ.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Сұраудың саяхатын 3D-де көру" })).toHaveAttribute("href", /web-1-internet/);
});

test("comic on a 320px phone: panels stack, nothing spills off the screen", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 320, height: 700 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto("/comic");
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole("button", { name: /^SYN/ }).tap();
  await expect(page.getByText("SYN-ACK · 40 мс")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  await ctx.close();
});
