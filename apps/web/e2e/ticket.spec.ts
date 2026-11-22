import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});

test("an exam ticket: confidence first, five mixed questions, calibration at the end", async ({ page }) => {
  await page.goto("/ticket");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Емтихан билеті");
  await expect(page.getByText(/БИЛЕТ № \d+/)).toBeVisible();

  for (let n = 1; n <= 5; n++) {
    const q = page.getByRole("article", { name: `${n}-сұрақ` });
    const answers = q.getByRole("group", { name: "Жауаптар" }).getByRole("button");
    await expect(answers.first()).toBeDisabled();
    await q.getByRole("group", { name: "Сенімділік" }).getByRole("button", { name: "Сенімдімін" }).click();
    await answers.first().click();
    await expect(q.getByRole("status")).toContainText(/Дұрыс|Қате/);
    await q.getByRole("button", { name: "Келесі" }).click();
  }

  const result = page.getByRole("region", { name: "Билет нәтижесі" });
  await expect(result.getByRole("table")).toContainText("Сенімдімін");
  await expect(result.getByRole("row", { name: /Сенімдімін/ })).toContainText("5");
  await result.getByRole("button", { name: "Жаңа билет" }).click();
  await expect(page.getByRole("article", { name: "1-сұрақ" })).toBeVisible();
});
