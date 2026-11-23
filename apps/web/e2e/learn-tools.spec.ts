import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});

test("Қалай оқу керек?: guess first, then the comic opens; a fact is not a myth; the tool link leads on", async ({ page }) => {
  await page.goto("/learn");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Қалай оқу керек?");
  const ep = page.getByRole("article", { name: /Эпизод 1:/ });
  await expect(ep.getByRole("region", { name: /Комикс:/ })).toHaveCount(0);
  await expect(ep).toContainText("Комикс сенің жауабыңнан кейін ашылады");
  await ep.getByRole("group", { name: "Миф пе, шындық па?" }).getByRole("button", { name: "Шындық" }).click();
  await expect(ep.getByRole("status")).toContainText("Көп адам осылай ойлайды. Бұл: миф.");
  await expect(ep.getByRole("region", { name: "Комикс: Үш рет оқыдым, бірақ…" })).toBeVisible();
  await expect(ep.getByRole("region", { name: "Зерттеулер не дейді" })).toContainText("Еске түсіру");

  // Episode 4 is a fact.
  await page.getByRole("navigation", { name: "Эпизодтар" }).getByRole("button", { name: /Фокус бөлмесі/ }).click();
  const ep4 = page.getByRole("article", { name: /Эпизод 4:/ });
  await ep4.getByRole("button", { name: "Шындық" }).click();
  await expect(ep4.getByRole("status")).toContainText("Дұрыс таптың. Бұл: шындық.");
  await expect(page.getByLabel("Курс прогресі")).toHaveText("2/7 эпизод · 1 дұрыс болжам");
  await page.reload();
  await expect(page.getByLabel("Курс прогресі")).toHaveText("2/7 эпизод · 1 дұрыс болжам");
  await page.getByRole("navigation", { name: "Эпизодтар" }).getByRole("button", { name: /Фокус бөлмесі/ }).click();
  await page.getByRole("link", { name: /Фокус бөлмесі →/ }).click();
  await expect(page).toHaveURL(/\/focus$/);
});

test("Оқу құралдары: every group, live badges, reached from the tools menu", async ({ page }) => {
  await page.goto("/");
  await page.locator("summary", { hasText: "Тағы" }).click();
  await page.getByRole("link", { name: "Барлық оқу құралдары →" }).first().click();
  await expect(page).toHaveURL(/\/tools$/);
  for (const g of ["Жоспарла және назар сал", "Есте сақта", "Жаттық және сына", "Зертте және ойна", "Оқуды үйрен"]) await expect(page.getByRole("heading", { level: 2, name: g })).toBeVisible();
  await expect(page.getByRole("link", { name: /Карточкалар/ })).toContainText(/\d+ карточка күтіп тұр/);
  await expect(page.getByRole("link", { name: /Қалай оқу керек\?/ })).toContainText("0/7 эпизод");
  await expect(page.getByRole("link", { name: /Қателер дәптері/ })).toContainText("Әзірге қате жоқ");
  await expect(page.getByLabel("Бүгін күтіп тұрғандар")).toBeVisible();
});
