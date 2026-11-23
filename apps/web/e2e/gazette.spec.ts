import { expect, test, type Page } from "@playwright/test";
import { ISSUE_1 } from "../src/lib/crossword";

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});

const cell = (page: Page, r: number, c: number) => page.getByLabel(new RegExp(`^${r + 1}-жол, ${c + 1}-баған`));
const clue = (page: Page, word: string) => {
  const e = ISSUE_1.find((x) => x.word === word)!;
  return page.getByRole("button", { name: new RegExp(`${e.clue.slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) });
};

test("gazette: from the menu, a word typed in, a wrong letter checked, a reload, the whole puzzle solved", async ({ page }) => {
  await page.goto("/");
  await page.locator("summary", { hasText: "Тағы" }).click();
  await page.getByRole("banner").getByRole("link", { name: "Газет", exact: true }).click();
  await expect(page).toHaveURL(/\/gazette$/, { timeout: 20000 });
  await expect(page.getByRole("heading", { name: "INSIDE TECH газеті", level: 1 })).toBeVisible();
  // The lead story quotes the mission model.
  await expect(page.getByText(/Таңертең бір телефоннан мектептің басты беті \d+ мс ішінде ашылады/)).toBeVisible();

  // 1 across, typed in lower case: the letters become capitals and the cursor walks right.
  await clue(page, "ДАТЧИК").click();
  await page.keyboard.type("датчик");
  await expect(cell(page, 0, 2)).toHaveValue("Д");
  await expect(cell(page, 0, 7)).toHaveValue("К");
  await expect(page.getByRole("status").filter({ hasText: "сөз" })).toContainText("1 / 10 сөз");

  // A wrong letter is caught by the check.
  await clue(page, "НЕЙРОН").click();
  await page.keyboard.type("НЕЙРОМ");
  await page.getByRole("button", { name: "Тексеру" }).click();
  await expect(page.getByText("1 әріп қате: олар қызылмен белгіленді.")).toBeVisible();

  // The sheet survives a reload.
  await page.reload();
  await expect(cell(page, 0, 2)).toHaveValue("Д");
  await expect(cell(page, 3, 10)).toHaveValue("М");

  // Fix and finish every word.
  for (const e of ISSUE_1) {
    await clue(page, e.word).click();
    await page.keyboard.type(e.word);
  }
  await expect(page.getByText("ШЕШІЛДІ")).toBeVisible();
  await expect(page.getByText("Әр сөздің зертханасы:")).toBeVisible();
});

test("gazette: arrows move the cursor, Backspace steps back, one letter can be revealed", async ({ page }) => {
  await page.goto("/gazette");
  await cell(page, 0, 2).click();
  await page.keyboard.press("ArrowRight");
  await expect(cell(page, 0, 3)).toBeFocused();
  await page.keyboard.type("А");
  await expect(cell(page, 0, 4)).toBeFocused();
  await page.keyboard.press("Backspace");
  await expect(cell(page, 0, 3)).toBeFocused();
  // Backspace on a filled cell clears it; then the revealed letter is the answer.
  await page.keyboard.press("Backspace");
  await expect(cell(page, 0, 3)).toHaveValue("");
  await page.getByRole("button", { name: "Бір әріп ашу" }).click();
  await expect(cell(page, 0, 3)).toHaveValue("А");
  await expect(page.getByText("ашылған әріп: 1")).toBeVisible();
});

test("gazette on a 320px phone: nothing spills off the screen", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 320, height: 700 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto("/gazette");
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  await cell(page, 0, 2).tap();
  await page.keyboard.type("Д");
  await expect(cell(page, 0, 2)).toHaveValue("Д");
  await ctx.close();
});
