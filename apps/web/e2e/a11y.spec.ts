import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** Every page, on a desktop and a phone: no script errors, no sideways scroll, no serious accessibility faults. */
const ROUTES = ["/", "/today", "/tools", "/focus", "/recall", "/teach", "/comics", "/learn", "/problems", "/tactics", "/parsons", "/ticket", "/cards", "/notebook", "/comic", "/mission", "/journey", "/gazette", "/blackbox", "/sky", "/world", "/passport", "/create", "/teacher", "/account", "/labs/math", "/labs/ai", "/labs/math/la-1-vectors", "/labs/web/web-10-cache", "/labs/math/ag-4-conics"];

async function serious(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  return r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`);
}
async function overflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

for (const [view, viewport] of [
  ["desktop", { width: 1440, height: 900 }],
  ["phone", { width: 390, height: 844 }],
] as const) {
  test(`${view}: every page is clean`, async ({ browser }) => {
    test.setTimeout(240_000);
    const ctx = await browser.newContext({ viewport });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`${page.url()}: ${e.message}`));
    const faults: string[] = [];
    for (const route of ROUTES) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      if ((await overflow(page)) > 1) faults.push(`${route}: sideways scroll`);
      for (const v of await serious(page)) faults.push(`${route}: ${v}`);
    }
    expect(errors).toEqual([]);
    expect(faults).toEqual([]);
    await ctx.close();
  });
}

test("interactive states are clean too: search open, a focus session, an episode, a recall result", async ({ page }) => {
  const faults: string[] = [];
  const check = async (name: string) => {
    for (const v of await serious(page)) faults.push(`${name}: ${v}`);
  };
  await page.goto("/tools");
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox").fill("вектор");
  await expect(page.getByRole("option").first()).toBeVisible();
  await check("search");
  await page.keyboard.press("Escape");

  await page.goto("/focus");
  await page.getByRole("button", { name: "Фокусты бастау" }).click();
  await check("focus running");

  await page.goto("/learn");
  await page.getByRole("button", { name: "Миф" }).click();
  await check("episode");

  await page.goto("/recall");
  await page.getByRole("group", { name: "Зертхана" }).getByRole("button", { name: "Mathematics" }).click();
  await page.getByRole("button", { name: /Шеңбер және эллипс/ }).click();
  await page.getByLabel("Есіңде қалғанның бәрі").fill("Эллипс: екі фокусқа дейінгі қашықтықтар қосындысы тұрақты.");
  await page.getByRole("button", { name: "Тексеру" }).click();
  await check("recall result");

  await page.goto("/comics");
  await page.getByRole("button", { name: "Оқу: Сынып журналы" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await check("comic reader");
  await page.keyboard.press("Escape");

  await page.goto("/world");
  await page.getByRole("button", { name: "Боссқа шабуыл ⚔" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await check("boss battle");
  expect(faults).toEqual([]);
});
