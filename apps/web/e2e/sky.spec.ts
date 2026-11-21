import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});

test("sky: an empty sky points the North Star at the first lesson; a finished lesson lights its star", async ({ page }) => {
  await page.goto("/sky");
  await expect(page.getByText(/БІЛІМ АСПАНЫ · 0 \/ \d+ ЖҰЛДЫЗ ЖАНДЫ/)).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  const north = page.getByRole("complementary", { name: "Таңдалған жұлдыз" });
  await expect(north.getByText("ТЕМІРҚАЗЫҚ КӨРСЕТЕДІ")).toBeVisible();
  await expect(north.getByRole("link", { name: "Сол жаққа бару →" })).toHaveAttribute("href", "/labs/ai/ai-1-data");
  await expect(page.getByRole("region", { name: "Шоқжұлдыздар" }).locator("details")).toHaveCount(10);
  await expect(page.getByText("Ұғым көпірлері")).toBeVisible();
  await expect(page.getByText(/Дейкстра:/)).toBeVisible();

  // Finish a Cloud lesson and leave a Security lesson open.
  await page.evaluate(() => {
    const now = Date.now();
    const items = [
      { lessonId: "cloud-1-containers", stepIndex: 0, completed: {}, completedAt: now - 1000, startedAt: 1, updatedAt: now - 1000 },
      { lessonId: "sec-2-frequency", stepIndex: 0, completed: {}, startedAt: 1, updatedAt: now },
    ];
    for (const p of items) localStorage.setItem(`inside-tech:progress:${p.lessonId}`, JSON.stringify(p));
    localStorage.setItem("inside-tech:progress:_index", JSON.stringify(items.map((p) => p.lessonId)));
  });
  await page.reload();
  await expect(page.getByText(/БІЛІМ АСПАНЫ · 1 \/ \d+ ЖҰЛДЫЗ ЖАНДЫ/)).toBeVisible();
  await expect(north.getByRole("link", { name: "Сол жаққа бару →" })).toHaveAttribute("href", "/labs/sec/sec-2-frequency");
  const cloud = page.locator("details", { hasText: "Cloud & DevOps" });
  await expect(cloud).toHaveAttribute("open", "");
  await expect(cloud.locator('li[data-state="done"]')).toHaveCount(1);
  await expect(page.locator('details li[data-state="started"]')).toHaveCount(1);
});

test("sky without WebGL: the same sky as a list", async ({ page }) => {
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...rest: unknown[]) {
      if (kind === "webgl" || kind === "webgl2") return null;
      return (orig as (...a: unknown[]) => unknown).call(this, kind, ...rest);
    } as typeof orig;
  });
  await page.goto("/sky");
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Шоқжұлдыздар" }).locator("details")).toHaveCount(10);
  await expect(page.getByRole("link", { name: "Сол жаққа бару →" })).toBeVisible();
});

test("sky on a 320px phone: nothing spills off the screen", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 320, height: 700 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto("/sky");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole("link", { name: "Сол жаққа бару →" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  await ctx.close();
});
