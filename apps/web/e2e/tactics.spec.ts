import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("vector navigator: plan, fly to the target on the shortest route, stars are kept", async ({ page }) => {
  await page.goto("/tactics");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Тактика алаңы");
  const board = page.getByRole("article", { name: "Навигатор: Алғашқы ұшу" });
  await expect(board.getByRole("button", { name: "Жүріс +u" })).toHaveCount(0);
  await board.getByRole("button", { name: "Көбейту" }).click();
  await board.getByRole("button", { name: "Көбейту" }).click();
  await expect(board.getByLabel("Жоспарланған жүріс")).toHaveText("5");
  await board.getByRole("button", { name: "Жоспарды бекіту" }).click();
  for (const m of ["+u", "+u", "+u", "+v", "+v"]) await board.getByRole("button", { name: `Жүріс ${m}` }).click();
  const status = board.getByRole("status");
  await expect(status).toContainText("Нысанаға 5 жүрісте жеттің. Жоспарың дәл болды. Ең қысқа жол: 5 жүріс.");
  await expect(status.getByLabel("3 жұлдыз")).toBeVisible();
  await expect(page.getByLabel("Жұлдыздар")).toHaveText("3/42 жұлдыз");
  await page.reload();
  await expect(page.getByLabel("Жұлдыздар")).toHaveText("3/42 жұлдыз");
});

test("vector navigator: an asteroid blocks a move; an impossible target is proved with the right reason", async ({ page }) => {
  await page.goto("/tactics");
  await page.getByRole("navigation", { name: "Деңгейлер" }).getByRole("button", { name: /Қисық базис/ }).click();
  let board = page.getByRole("article", { name: "Навигатор: Қисық базис" });
  await board.getByRole("button", { name: "Жоспарды бекіту" }).click();
  await board.getByRole("button", { name: "Жүріс +u" }).click();
  await expect(board.getByRole("status")).toHaveText("(2, 1) нүктесінде астероид тұр.");

  await page.getByRole("button", { name: "Келесі деңгей" }).click();
  board = page.getByRole("article", { name: "Навигатор: Жұп қадамдар" });
  await board.getByRole("button", { name: "Жету мүмкін емес деп дәлелдеу" }).click();
  await board.getByRole("radio", { name: /бір түзуде/ }).check();
  await board.getByRole("button", { name: "Дәлелдеу" }).click();
  await expect(board.getByRole("status")).toContainText("себебі басқа");
  await board.getByRole("radio", { name: /коэффициенттер бүтін емес/ }).check();
  await board.getByRole("button", { name: "Дәлелдеу" }).click();
  await expect(board.getByRole("status")).toContainText("det = 4. Крамер ережесі: a = 3/2, b = 2.");
  await expect(board.getByRole("status").getByLabel("2 жұлдыз")).toBeVisible();
});

test("function marksman: the wrong order misses, the right order hits", async ({ page }) => {
  await page.goto("/tactics");
  await page.getByRole("button", { name: "Функция мергені" }).click();
  await page.getByRole("navigation", { name: "Деңгейлер" }).getByRole("button", { name: /Рет маңызды/ }).click();
  const board = page.getByRole("article", { name: "Мерген: Рет маңызды" });
  await expect(board).toContainText("нысана: y = −x² − 1");
  await board.getByRole("button", { name: "Бағдарламаға: Ox осіне шағылу" }).click();
  await board.getByRole("button", { name: "Бағдарламаға: 1 жоғары" }).click();
  await board.getByRole("button", { name: "Атқару" }).click();
  await expect(board.getByRole("status")).toContainText("Мүлт кетті. Шыққаны: y = −x² + 1.");
  await board.getByRole("button", { name: "Алып тастау: 1. Ox осіне шағылу" }).click();
  await board.getByRole("button", { name: "Бағдарламаға: Ox осіне шағылу" }).click();
  await board.getByRole("button", { name: "Атқару" }).click();
  await expect(board.getByRole("status")).toContainText("Дәл нысанада! Бағдарлама 2 карта, ең қысқасы 2.");
  await expect(board.getByRole("status").getByLabel("3 жұлдыз")).toBeVisible();
});

test("the tactics page is in the tools menu", async ({ page }) => {
  await page.goto("/parsons");
  await page.getByText("Құралдар").click();
  await page.getByRole("link", { name: "Тактика алаңы" }).click();
  await expect(page).toHaveURL(/\/tactics/);
});
