import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});

const visas = (page: Page) => page.getByRole("region", { name: "Зертхана мөрлері" }).getByRole("link");

/** Write saved progress the way the lesson engine does. */
async function seed(page: Page, items: object[]) {
  await page.evaluate((list) => {
    const ids: string[] = [];
    for (const p of list as { lessonId: string }[]) {
      localStorage.setItem(`inside-tech:progress:${p.lessonId}`, JSON.stringify(p));
      ids.push(p.lessonId);
    }
    localStorage.setItem("inside-tech:progress:_index", JSON.stringify(ids));
  }, items);
}

test("passport: an empty passport earns nothing and points at the first lesson", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Негізгі мәзір" }).getByRole("link", { name: "Паспорт" }).click();
  await expect(page).toHaveURL(/\/passport$/);
  await expect(page.getByRole("heading", { name: "Оқу паспорты", level: 1 })).toBeVisible();
  await expect(page.getByText("Паспорт әлі таза")).toBeVisible();
  await expect(visas(page)).toHaveCount(10);
  for (const v of await visas(page).all()) await expect(v).toHaveAttribute("aria-label", /: 0 \/ \d+ сабақ аяқталды\. Мөр әлі жоқ\./);
  await expect(page.getByText("Әзірге бос.")).toBeVisible();
  const start = page.getByRole("link", { name: /^Алғашқы сабақты бастау:/ });
  await expect(start).toHaveAttribute("href", /\/labs\/ai\/.+/);
  await start.click();
  await expect(page).toHaveURL(/\/labs\/ai\/.+/, { timeout: 20000 });
});

test("passport: finishing a real lesson stamps that lab, and the open lesson is offered to continue", async ({ page }) => {
  // Finish one lesson through the lesson itself.
  await page.goto("/labs/cloud/cloud-8-incident");
  await page.locator("fieldset").filter({ hasText: "CPU төмен" }).getByRole("button", { name: /күтіп тұр/ }).click();
  await page.locator("fieldset").filter({ hasText: "бірінші не істеу" }).getByRole("button", { name: /Зиянды азайту/ }).click();
  await page.getByRole("button", { name: "Себеп: payments" }).click();
  await expect(page.getByRole("dialog", { name: "Сабақ аяқталды" })).toBeVisible();

  // And leave another one half done, a moment later.
  await page.evaluate(() => {
    const now = Date.now() + 1000;
    const p = { lessonId: "iot-5-pid", stepIndex: 1, completed: {}, startedAt: now, updatedAt: now };
    localStorage.setItem("inside-tech:progress:iot-5-pid", JSON.stringify(p));
    const idx = JSON.parse(localStorage.getItem("inside-tech:progress:_index") ?? "[]");
    localStorage.setItem("inside-tech:progress:_index", JSON.stringify([...idx, "iot-5-pid"]));
  });

  await page.goto("/passport");
  const cloud = visas(page).filter({ has: page.getByText("Cloud & DevOps", { exact: true }) });
  await expect(cloud).toHaveAttribute("aria-label", /^Cloud & DevOps: 1 \/ \d+ сабақ аяқталды\. Мөр \d\d\.\d\d\.\d{4}, алғашқы аяқталған сабақ: .+\./);
  await expect(cloud.getByText("АЯҚТАЛДЫ")).toBeVisible();
  await expect(page.getByRole("region", { name: "Зертхана мөрлері" }).getByText("АЯҚТАЛДЫ")).toHaveCount(1);
  await expect(page.getByText("Тоқтаған жерің")).toBeVisible();
  await expect(page.getByText(/2 \/ \d+ кезең/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Аяқталған сабақтар" }).getByRole("listitem")).toHaveCount(1);
  const go = page.getByRole("link", { name: "Сабақты жалғастыру" });
  await expect(go).toHaveAttribute("href", "/labs/iot/iot-5-pid");
});

test("passport: unknown lessons in storage are not counted", async ({ page }) => {
  await page.goto("/passport");
  await seed(page, [{ lessonId: "custom-not-here", stepIndex: 0, completed: {}, completedAt: 5, startedAt: 1, updatedAt: 5 }]);
  await page.reload();
  await expect(page.getByText("Паспорт әлі таза")).toBeVisible();
});

test("passport by keyboard: Tab from the top reaches the continue link and Enter opens the lesson", async ({ page }) => {
  await page.goto("/passport");
  await seed(page, [{ lessonId: "sec-1-caesar", stepIndex: 0, completed: {}, startedAt: 1, updatedAt: 9 }]);
  await page.reload();
  await expect(page.getByText("Тоқтаған жерің")).toBeVisible();
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    if ((await page.evaluate(() => document.activeElement?.textContent?.trim())) === "Сабақты жалғастыру") break;
  }
  await expect(page.locator(":focus")).toHaveText("Сабақты жалғастыру");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/labs\/sec\/sec-1-caesar$/, { timeout: 20000 });
});

for (const width of [320, 1440]) {
  test(`passport at ${width}px: nothing spills off the screen`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width, height: 800 }, ...(width < 500 ? { isMobile: true, hasTouch: true } : {}) });
    const page = await ctx.newPage();
    await page.goto("/passport");
    await page.evaluate(() => document.fonts.ready);
    await expect(visas(page)).toHaveCount(10);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
    const right = await visas(page).evaluateAll((els) => Math.max(...els.map((e) => e.getBoundingClientRect().right)));
    expect(right).toBeLessThanOrEqual(width);
    await ctx.close();
  });
}
