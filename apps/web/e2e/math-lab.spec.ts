import { expect, test, type Page } from "@playwright/test";
import { nextStep } from "./helpers";

const objective = (page: Page, text: string | RegExp) => page.locator("li[data-done]", { hasText: text });

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});

test("the math lab shows the first-year map: five subjects, 36 topics in order, linear algebra open", async ({ page }) => {
  await page.goto("/labs/math");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mathematics");
  const map = page.getByRole("navigation", { name: "1-курс картасы" });
  await expect(map.getByRole("heading", { level: 3 })).toHaveText([
    "Сызықтық алгебра",
    "Аналитикалық геометрия",
    "Математикалық анализ I: дифференциалдық есептеу",
    "Математикалық анализ II: интегралдық есептеу",
    "Дискретті математика",
  ]);
  await expect(map.locator("ol ol > li")).toHaveCount(36);
  await expect(map.getByRole("link")).toHaveCount(8);
  await expect(map.locator("ol ol > li").nth(8)).toContainText("Жазықтықтағы координаталар");
  await expect(page.locator("ol li[data-level='Math']")).toHaveCount(8);
});

test("lesson 1: vectors add tip to tail; AB has length 5", async ({ page }) => {
  await page.goto("/labs/math/la-1-vectors");
  const v = page.getByRole("group", { name: "v векторы" });
  await v.getByLabel("v y", { exact: true }).fill("2");
  await v.getByLabel("v z", { exact: true }).fill("2");
  await expect(page.getByRole("status", { name: "Векторлар нәтижесі" })).toContainText("(4, 3, 2)");
  await expect(objective(page, "u + v = (4, 3, 2)")).toHaveAttribute("data-done", "true");
  await v.getByLabel("v x", { exact: true }).fill("3");
  await v.getByLabel("v y", { exact: true }).fill("4");
  await v.getByLabel("v z", { exact: true }).fill("0");
  await expect(page.getByRole("status", { name: "Векторлар нәтижесі" })).toContainText("|v|5");
  await expect(objective(page, "AB векторын")).toHaveAttribute("data-done", "true");
});

test("lesson 3: row operations reach the staircase and the solution (1, 2, 3)", async ({ page }) => {
  await page.goto("/labs/math/la-3-gauss");
  const op = page.getByRole("group", { name: "Жол амалы" });
  const run = async (i: number, j: number, c: string, kind = "add") => {
    await op.getByLabel("Амал").selectOption(kind);
    await op.getByLabel("i жолы").selectOption(String(i));
    if (kind !== "scale") await op.getByLabel("j жолы").selectOption(String(j));
    await op.getByLabel("Коэффициент c").fill(c);
    await page.getByRole("button", { name: "Амалды орындау" }).click();
  };
  await run(1, 0, "-2");
  await run(2, 0, "-1");
  await run(2, 1, "-2");
  await expect(page.getByRole("table", { name: "Жүйенің матрицасы" }).locator("tr").nth(2)).toContainText("00721");
  await expect(objective(page, "Баспалдақ")).toHaveAttribute("data-done", "true");
  await nextStep(page);
  await run(2, 0, "1/7", "scale");
  await run(1, 2, "3");
  await run(1, 0, "-1", "scale");
  await run(0, 2, "-1");
  await run(0, 1, "-1");
  await expect(objective(page, "бірлік матрицаға")).toHaveAttribute("data-done", "true");
  await expect(page.getByRole("region", { name: "Өз сөзіңмен түсіндір" })).toBeVisible();
});

test("lesson 6: a box of volume 6, then flattened and mirrored", async ({ page }) => {
  await page.goto("/labs/math/la-6-determinant");
  await page.getByLabel("A 2,2").fill("2");
  await page.getByLabel("A 3,3").fill("3");
  const r = page.getByRole("status", { name: "Матрица нәтижесі" });
  await expect(r).toContainText("det A6");
  await page.getByRole("group", { name: "Дайын матрицалар" }).getByRole("button", { name: "Ығысу" }).click();
  await expect(objective(page, "Ығысу")).toHaveAttribute("data-done", "true");
  await nextStep(page);
  await page.getByRole("group", { name: "Дайын матрицалар" }).getByRole("button", { name: "Жаншу" }).click();
  await expect(r).toContainText("A⁻¹жоқ");
  await page.getByRole("group", { name: "Дайын матрицалар" }).getByRole("button", { name: "Айна" }).click();
  await expect(r).toContainText("det A-1");
  await expect(objective(page, "айнадай аудар")).toHaveAttribute("data-done", "true");
});

test("lesson 8: [[2, 1], [1, 2]] stretches 45° by 3 and keeps 135°", async ({ page }) => {
  await page.goto("/labs/math/la-8-eigen");
  const slider = page.getByLabel("v бағыты, градус");
  const r = page.getByRole("status", { name: "Меншікті нәтиже" });
  await slider.fill("45");
  await expect(r).toContainText("λ3");
  await slider.fill("135");
  await expect(r).toContainText("λ1");
  await slider.fill("90");
  await expect(r).toContainText("λжоқ");
  await expect(objective(page, "екінші бағытты")).toHaveAttribute("data-done", "true");
});
