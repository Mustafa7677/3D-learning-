import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});

const q = (page: Page) => page.getByRole("heading", { level: 1 });
const status = (page: Page) => page.locator("main").getByRole("status");

test("mission: one request, the class, the hypothesis, cache, its counterexample, a second fix, the report, a reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Негізгі мәзір" }).getByRole("link", { name: "Миссия" }).click();
  await expect(page).toHaveURL(/\/mission$/);
  await expect(q(page)).toHaveText("Мектептің басты беті таңертең бір телефоннан қалай ашылады?");

  // 1. One request, step by step (the same path as reduced motion).
  await page.getByLabel("Қадамдап жүргізу").check();
  await page.getByRole("button", { name: "Сұраныс жіберу" }).click();
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Келесі қадам" }).click();
  await expect(page.getByText(/Таңертең сайт жылдам/)).toBeVisible();

  // 2. The class at once.
  await page.getByRole("button", { name: "Сабақ басталды →" }).click();
  await page.getByRole("button", { name: "Бір сынып қатар кірсін" }).click();
  await expect(page.getByText(/екі түрлі қасиет/)).toBeVisible();

  // 3. A wrong guess, then the right one picked on the map; the timeline follows.
  await page.getByRole("button", { name: "Себебін іздеу →" }).click();
  await page.getByRole("group", { name: "Картадағы нысанды таңдау" }).getByRole("button", { name: "Сервер" }).click();
  await expect(status(page)).toContainText("Ең ұзын аралықты тап");
  await page.getByRole("group", { name: "Картадағы нысанды таңдау" }).getByRole("button", { name: "Wi-Fi арнасы" }).click();
  await expect(page.getByRole("button", { name: /Сабақ басталды: бүкіл сынып бірге кірді: Жүктеу, / })).toHaveAttribute("data-selected", "true");
  await expect(status(page)).toContainText("Дәлел табылды");

  // 4. Cache looks like the answer...
  await page.getByRole("button", { name: "Түзетуді таңдау →" }).click();
  await page.getByLabel(/Кэш қосу/).check();
  await expect(page.getByText(/Шешілді ме\?/)).toBeVisible();

  // 5. ...until a new class comes.
  await page.getByRole("button", { name: "Қарсы сынақ →" }).click();
  await expect(status(page)).toContainText("Қарсы мысал.");
  await page.getByRole("button", { name: "Басқа түзетуді сынау" }).click();
  await page.getByLabel(/Суреттерді кішірейту/).check();
  await page.getByRole("button", { name: "Қарсы сынақ →" }).click();
  await expect(status(page)).toContainText("екі жағдайда да көмектесті");

  // The work survives a reload in the middle.
  await page.reload();
  await expect(q(page)).toHaveText("Шешімің кімге көмектесті, ал кімге көмектеспеді?");

  // 6. The report.
  await page.getByRole("button", { name: "Есеп жазу →" }).click();
  const save = page.getByRole("button", { name: "Есепті сақтау" });
  await expect(save).toBeDisabled();
  await page.getByLabel("Бастапқы өлшем").selectOption("newClass:none");
  await page.getByLabel("Кейінгі өлшем").selectOption("newClass:resize");
  await expect(page.getByLabel("Кейінгі өлшем").locator("option:checked")).toHaveText(/^Жаңа сынып: бәрі алғаш рет кіреді, суреттер кішірейтілді: \d/);
  await page.getByLabel(/Қорытынды/).fill("Суреттерді кішірейттім. Кэш тек бұрын кірген телефонға көмектесті, ал кішірейту жаңа сыныпқа да көмектесті.");
  await expect(save).toBeEnabled();
  await save.click();
  const card = page.getByRole("article", { name: "Сақталған есеп" });
  await expect(card).toContainText("Дейін:");
  await page.reload();
  await expect(page.getByRole("article", { name: "Сақталған есеп" })).toContainText("Суреттерді кішірейттім.");
});

test("mission on a 320px phone: one view at a time, and the chosen part stays chosen across views", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 320, height: 700 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto("/mission");
  await page.evaluate(() => document.fonts.ready);
  await page.getByLabel("Қадамдап жүргізу").check();
  await page.getByRole("button", { name: "Сұраныс жіберу" }).tap();
  await page.getByRole("group", { name: "Картадағы нысанды таңдау" }).getByRole("button", { name: "DNS" }).tap();
  await expect(page.getByRole("region", { name: "Уақыт жолағы" })).toBeHidden();
  await page.getByRole("tab", { name: "Уақыт" }).tap();
  await expect(page.getByRole("region", { name: "Карта" })).toBeHidden();
  await expect(page.getByRole("region", { name: "Уақыт жолағы" }).locator("li[data-selected='true']")).toHaveText(/DNS/);
  await expect(page.getByRole("region", { name: "Көрсеткіштер" })).toContainText("DNS");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  await ctx.close();
});

test("mission by keyboard: the first request and the class", async ({ page }) => {
  await page.goto("/mission");
  const reach = async (name: string) => {
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press("Tab");
      if ((await page.evaluate(() => document.activeElement?.textContent?.trim())) === name) return;
    }
    throw new Error(`Tab never reached ${name}`);
  };
  await reach("Сұраныс жіберу");
  await page.keyboard.press("Enter");
  // The request animates through its four parts first.
  await expect(page.getByRole("button", { name: "Сабақ басталды →" })).toBeVisible();
  await reach("Сабақ басталды →");
  await page.keyboard.press("Enter");
  await reach("Бір сынып қатар кірсін");
  await page.keyboard.press("Enter");
  await expect(page.getByText(/екі түрлі қасиет/)).toBeVisible();
});
