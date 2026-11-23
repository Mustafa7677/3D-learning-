import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});

test("the interest test ranks professions; a profession shows its day and a road through the lessons", async ({ page }) => {
  await page.goto("/career");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Кім");
  await page.getByRole("button", { name: "▶ Тестті бастау · 2 минут" }).click();
  // Always pick the answer that leans to security.
  const picks = ["Жұмбақ, детектив, логикалық есеп шешу", "Барлық деректі жинап, кестеге салу", "Хакерлер банкті қалай бұзуға тырысады?", "Мұны біреу әдейі бұзған жоқ па?", "Информатика және логика", "Санмен: 3 секунд 20 мс болды", "Кез келген жүйеге көрінбей кіру"];
  for (const [k, text] of picks.entries()) {
    await expect(page.getByText(`${k + 1}/7-сұрақ`)).toBeVisible();
    await page.getByRole("button", { name: text }).click();
  }
  await expect(page.getByRole("heading", { name: "Саған ең жақыны" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Саған ең жақыны" }).getByRole("heading", { level: 3, name: "Киберқауіпсіздік маманы" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Барлық мамандыққа сәйкестік" }).getByRole("listitem")).toHaveCount(8);

  await page.getByRole("button", { name: "Бұл мамандықтың бір күні →" }).click();
  const detail = page.getByRole("region", { name: "Киберқауіпсіздік маманы" });
  await expect(detail).toContainText("Бір күні");
  await expect(detail).toContainText("SQL injection");
  await expect(detail.getByRole("link", { name: "Caesar Cipher", exact: true })).toHaveAttribute("href", "/labs/sec/sec-1-caesar");
  await expect(detail.getByRole("link", { name: /Келесі қадам: Caesar Cipher/ })).toBeVisible();

  // The result is remembered.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Саған ең жақыны" })).toBeVisible();
});

test("a profession can be opened straight from a link", async ({ page }) => {
  await page.goto("/career?c=gamedev");
  await expect(page.getByRole("region", { name: "Ойын әзірлеуші" })).toContainText("Unity");
});
