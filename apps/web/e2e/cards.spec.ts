import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});

const box = (page: import("@playwright/test").Page, n: number) => page.getByRole("region", { name: "Қораптар" }).locator(`[data-box="${n}"] b`);

test("cards: flip, knew moves a card up, not knowing brings it back today, the boxes survive a reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Есте сақтау/ }).click();
  await expect(page).toHaveURL(/\/cards$/);
  await expect(box(page, 1)).toHaveText("22");
  await expect(page.getByText("Бүгін қалды: 22")).toBeVisible();

  const card = page.getByRole("button", { name: /^Сұрақ: / });
  const first = (await card.getAttribute("aria-label"))!.replace(/^Сұрақ: (.*?)\. Аудару.*$/, "$1");
  await card.click();
  await expect(page.getByRole("button", { name: /^Жауабы: / })).toBeVisible();
  await page.getByRole("button", { name: /^Білдім/ }).click();
  await expect(box(page, 2)).toHaveText("1");
  await expect(page.getByText("Бүгін қалды: 21 · білдім: 1")).toBeVisible();

  // Not knowing keeps the count: the card goes to the end of today's pile.
  await page.getByRole("button", { name: "Жауабын көру" }).click();
  await page.getByRole("button", { name: /^Білмедім/ }).click();
  await expect(page.getByText("Бүгін қалды: 21 · білдім: 1 · қайталаймын: 1")).toBeVisible();

  await page.reload();
  await expect(box(page, 2)).toHaveText("1");
  await expect(box(page, 1)).toHaveText("21");
  // The known card is not due today any more.
  await expect(page.getByText("Бүгін қалды: 21")).toBeVisible();
  expect(first.length).toBeGreaterThan(0);
});

test("cards by keyboard: Space flips, 2 means knew, until the day is done", async ({ page }) => {
  await page.goto("/cards");
  await expect(page.getByText("Бүгін қалды: 22")).toBeVisible();
  for (let i = 0; i < 22; i++) {
    await page.locator("body").press("Space");
    await page.locator("body").press("2");
  }
  await expect(page.getByText("БҮГІНГЕ БІТТІ")).toBeVisible();
  await expect(box(page, 2)).toHaveText("22");
  await expect(page.getByText(/Келесі карточкалар \d\d\.\d\d\.\d{4} күні оралады/)).toBeVisible();
});

test("cards on a 320px phone, and the shelf on the home page", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 320, height: 700 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto("/cards");
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole("button", { name: /^Сұрақ: / }).tap();
  await expect(page.getByRole("button", { name: /^Білдім/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Сабақтан басқа да жол бар." })).toBeAttached();
  await expect(page.getByRole("region", { name: "Сабақтан басқа да жол бар." }).getByRole("link")).toHaveCount(11);
  await ctx.close();
});
