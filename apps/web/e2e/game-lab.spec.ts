import { expect, test, type Page } from "@playwright/test";
import { answerQuiz, nextStep } from "./helpers";

const objective = (page: Page, text: string) => page.locator("li[data-done]", { hasText: text });

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});

test("game lab page lists eight lessons", async ({ page }) => {
  await page.goto("/labs/game");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Game Development");
  await expect(page.locator("ol li")).toHaveCount(8);
});

test("lesson 1: selecting and moving a parent object", async ({ page }) => {
  await page.goto("/labs/game/game-1-objects");
  for (const name of ["Машина", "Шырша", "Шам"]) await page.getByRole("button", { name, exact: true }).click();
  await expect(objective(page, "3 түрлі объектіні")).toHaveAttribute("data-done", "true");
  await nextStep(page);
  await page.getByRole("button", { name: "Машина", exact: true }).click();
  await page.getByLabel("position.x (local)").fill("1");
  await expect(objective(page, "Машинаны жылжыт")).toHaveAttribute("data-done", "true");
});

test("lesson 3: delta time equalises frame rates", async ({ page }) => {
  await page.goto("/labs/game/game-3-loop");
  await page.getByRole("button", { name: "3 секунд жүгірту" }).click();
  await expect(objective(page, "айырманы көр")).toHaveAttribute("data-done", "true", { timeout: 10_000 });
  await nextStep(page);
  await page.getByRole("button", { name: "Delta time қолдану" }).click();
  await page.getByRole("button", { name: "3 секунд жүгірту" }).click();
  await expect(objective(page, "теңескенін")).toHaveAttribute("data-done", "true", { timeout: 10_000 });
});

test("lesson 6: a movement rule lets the keyboard drive the player", async ({ page }) => {
  await page.goto("/labs/game/game-6-scripting");
  await page.getByRole("button", { name: "Ереже қосу" }).click();
  await expect(page.getByText("Пернелер басылғанда", { exact: false }).first()).toBeVisible();
  await page.getByRole("button", { name: "Ойынды бастау" }).click();
  await page.locator("canvas").click({ position: { x: 5, y: 5 } }).catch(() => {});
  await page.keyboard.down("ArrowDown");
  await page.waitForTimeout(600);
  await page.keyboard.up("ArrowDown");
  await expect(objective(page, "пернелермен жылжыт")).toHaveAttribute("data-done", "true");
});

test("lesson 4: dropping balls and switching to Moon gravity", async ({ page }) => {
  await page.goto("/labs/game/game-4-physics");
  await page.getByRole("button", { name: "Доп тастау" }).click();
  await page.getByRole("button", { name: "Доп тастау" }).click();
  await page.getByRole("button", { name: "Ай", exact: true }).click();
  await expect(objective(page, "2 доп")).toHaveAttribute("data-done", "true");
  await expect(objective(page, "Гравитацияны")).toHaveAttribute("data-done", "true");
});
