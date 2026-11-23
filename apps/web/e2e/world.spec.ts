import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});

test("IT archipelago: pick an island, fight its boss, win the treasure", async ({ page }) => {
  await page.goto("/world?i=math");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("архипелагы");
  await expect(page.getByRole("complementary", { name: "Арал: Вектор жағалауы" })).toContainText("Шексіздік айдаһары");
  await page.getByRole("button", { name: /^Транзистор аралы/ }).click();
  const card = page.getByRole("complementary", { name: "Арал: Транзистор аралы" });
  await expect(card).toContainText("Қызып кеткен процессор");
  await expect(card.getByRole("link", { name: /Келесі сабақ/ })).toHaveAttribute("href", "/labs/arch/arch-1-binary");

  await card.getByRole("button", { name: "Боссқа шабуыл ⚔" }).click();
  const fight = page.getByRole("dialog", { name: "Шайқас: Қызып кеткен процессор" });
  // A miss first: the explanation shows and a heart is lost.
  await fight.getByRole("button", { name: "1011", exact: true }).click();
  await expect(fight.getByRole("status")).toContainText("8 + 0 + 2 + 1 = 11");
  await expect(fight.getByLabel("Сенің жүрегің: 1/2")).toBeVisible();
  await fight.getByRole("button", { name: "Келесі →" }).click();
  for (const right of ["256", "Екі кіріс те 1 болғанда", "1000"]) {
    await fight.getByRole("button", { name: right, exact: true }).click();
    await fight.getByRole("button", { name: "Келесі →" }).click();
  }
  await expect(fight.getByRole("heading", { name: "Жеңіс!" })).toBeVisible();
  await expect(fight).toContainText("+50 XP");
  await fight.getByRole("button", { name: "Картаға қайту" }).click();
  await expect(page.getByRole("button", { name: /^Транзистор аралы.*бағындырылды$/ })).toBeVisible();
  await expect(page.getByRole("list", { name: "Қазыналар" })).toContainText("Алтын транзистор: табылды");
});

test("two misses send you back to the ship, with a way to the lesson", async ({ page }) => {
  await page.goto("/world?i=sec");
  await page.getByRole("button", { name: "Боссқа шабуыл ⚔" }).click();
  const fight = page.getByRole("dialog", { name: "Шайқас: Фишинг вирусы" });
  await fight.getByRole("button", { name: "Кілт хаттың ішінде жазылған" }).click();
  await fight.getByRole("button", { name: "Келесі →" }).click();
  await fight.getByRole("button", { name: "Хатты жылдамырақ жіберуге" }).click();
  await fight.getByRole("button", { name: "Келесі →" }).click();
  await expect(fight.getByRole("heading", { name: "Кемеге шегіну" })).toBeVisible();
  await expect(fight.getByRole("link", { name: "Алдымен сабақты оқу →" })).toHaveAttribute("href", "/labs/sec/sec-1-caesar");
  await page.keyboard.press("Escape");
  await expect(fight).toHaveCount(0);
});
