import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});

const SQL = ["SELECT city, COUNT(*) AS n", "FROM students", "WHERE year > 1", "GROUP BY city", "HAVING COUNT(*) >= 3", "ORDER BY n DESC", "LIMIT 3"];

test("a Parsons problem: the distractor is caught, the first wrong line is named, a clean build scores", async ({ page }) => {
  await page.goto("/parsons");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ретке келтір");
  const board = page.getByRole("article", { name: "SQL сөйлемдерінің реті" });
  const tray = board.getByRole("region", { name: "Касса" });
  const take = (text: string) => tray.getByRole("button", { name: `Тізгішке: ${text}`, exact: true }).click();

  // The distractor in third place.
  await take(SQL[0]!);
  await take(SQL[1]!);
  await take("WHERE COUNT(*) >= 3");
  await board.getByRole("button", { name: "Басып шығару: тексеру" }).click();
  await expect(board.getByRole("status")).toContainText("3-жол бұл бағдарламаға жатпайды");

  // Back to the case; finish in the wrong order, then fix it with the arrows.
  await board.getByRole("button", { name: "Кассаға қайтару: WHERE COUNT(*) >= 3" }).click();
  await take(SQL[2]!);
  await take(SQL[4]!);
  await take(SQL[3]!);
  for (const l of SQL.slice(5)) await take(l);
  await board.getByRole("button", { name: "Басып шығару: тексеру" }).click();
  await expect(board.getByRole("status")).toContainText("Алғашқы 3 жол дұрыс, 4-жолдан бастап рет бұзылды");
  await board.getByRole("button", { name: `Жоғары: ${SQL[3]}` }).click();
  await board.getByRole("button", { name: "Басып шығару: тексеру" }).click();
  await expect(board.getByRole("status")).toContainText("Дұрыс тізілді. 1 ұпай.");
  await expect(page.getByLabel("Ұпай", { exact: true })).toHaveText("1/14 есеп · 1/42 ұпай");

  // Saved: still there after a reload.
  await page.reload();
  await expect(page.getByLabel("Ұпай", { exact: true })).toHaveText("1/14 есеп · 1/42 ұпай");
});

test("hints alone solve a problem, at the lowest score", async ({ page }) => {
  await page.goto("/parsons");
  await page.getByRole("navigation", { name: "Есептер" }).getByRole("button", { name: /Algorithms/ }).click();
  const board = page.getByRole("article", { name: "Екілік іздеу" });
  for (let i = 0; i < 10; i++) await board.getByRole("button", { name: /Бір жолды қойып бер/ }).click();
  await board.getByRole("button", { name: "Басып шығару: тексеру" }).click();
  await expect(board.getByRole("status")).toContainText("Дұрыс тізілді. 1 ұпай.");
});
