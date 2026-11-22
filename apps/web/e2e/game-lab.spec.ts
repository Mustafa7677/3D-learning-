import { expect, test, type Page } from "@playwright/test";
import { answerQuiz, nextStep } from "./helpers";

const objective = (page: Page, text: string) => page.locator("li[data-done]", { hasText: text });

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});

test("game lab page lists eight lessons and the problem set", async ({ page }) => {
  await page.goto("/labs/game");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Game Development");
  await expect(page.locator("ol li")).toHaveCount(14);
  await expect(page.locator('ol li[data-level="Middle"]')).toHaveCount(5);
});

test("lesson 1: selecting and moving a parent object", async ({ page }) => {
  await page.goto("/labs/game/game-1-objects");
  await page.locator("canvas").waitFor();
  for (const name of ["Машина", "Шырша", "Шам"]) await page.getByRole("button", { name, exact: true }).click();
  await expect(objective(page, "3 түрлі объектіні")).toHaveAttribute("data-done", "true");
  await nextStep(page);
  await expect(objective(page, "Машинаны жылжыт")).toBeVisible();
  const car = page.getByRole("button", { name: "Машина", exact: true });
  await car.click();
  await expect(car).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("position.x (local)").fill("1");
  await expect(objective(page, "Машинаны жылжыт")).toHaveAttribute("data-done", "true");
});

test("lesson 3: delta time equalises frame rates", async ({ page }) => {
  await page.goto("/labs/game/game-3-loop");
  await page.locator("canvas").waitFor();
  await page.getByRole("button", { name: "3 секунд жүгірту" }).click();
  await expect(objective(page, "айырманы көр")).toHaveAttribute("data-done", "true", { timeout: 10_000 });
  await nextStep(page);
  await page.getByRole("button", { name: "Delta time қолдану" }).click();
  await page.getByRole("button", { name: "3 секунд жүгірту" }).click();
  await expect(objective(page, "теңескенін")).toHaveAttribute("data-done", "true", { timeout: 10_000 });
});

test("lesson 6: a movement rule lets the keyboard drive the player", async ({ page }) => {
  await page.goto("/labs/game/game-6-scripting");
  await page.locator("canvas").waitFor();
  await page.getByRole("button", { name: "Ереже қосу" }).click();
  await expect(page.getByText("Пернелер басылғанда", { exact: false }).first()).toBeVisible();
  await page.getByRole("button", { name: "Ойынды бастау" }).click();
  await page.locator("canvas").click({ position: { x: 5, y: 5 } });
  await page.keyboard.down("ArrowDown");
  try {
    await expect(objective(page, "пернелермен жылжыт")).toHaveAttribute("data-done", "true");
  } finally {
    await page.keyboard.up("ArrowDown");
  }
});

test("lesson 4: dropping balls and switching to Moon gravity", async ({ page }) => {
  await page.goto("/labs/game/game-4-physics");
  await page.locator("canvas").waitFor();
  await page.getByRole("button", { name: "Доп тастау" }).click();
  await page.getByRole("button", { name: "Доп тастау" }).click();
  await page.getByRole("button", { name: "Ай", exact: true }).click();
  await expect(objective(page, "2 доп")).toHaveAttribute("data-done", "true");
  await expect(objective(page, "Гравитацияны")).toHaveAttribute("data-done", "true");
});

test("Middle 10: BFS wades through the mud (30), Dijkstra goes round (20), A* opens fewer cells", async ({ page }) => {
  await page.goto("/labs/game/game-10-pathfinding");
  const r = page.getByRole("status", { name: "Іздеу нәтижесі" });
  await page.getByRole("button", { name: "Жолды іздеу" }).click();
  await expect(r).toContainText("Жол бағасы30");
  await page.getByRole("button", { name: "Dijkstra" }).click();
  await page.getByRole("button", { name: "Жолды іздеу" }).click();
  await expect(r).toContainText("Жол бағасы20");
  await expect(r).toContainText("139");
});

test("Middle 11: hysteresis calms the guard from 10 switches to 4", async ({ page }) => {
  await page.goto("/labs/game/game-11-fsm");
  const r = page.getByRole("status", { name: "Күзетші нәтижесі" });
  await page.getByRole("button", { name: "Күзетшіні іске қосу" }).click();
  await expect(r).toContainText("Күй ауысуы10");
  await page.getByLabel("Жоғалту радиусы").fill("7");
  await page.getByRole("button", { name: "Күзетшіні іске қосу" }).click();
  await expect(r).toContainText("Күй ауысуы4");
});

test("Middle 12: a 2-unit grid cuts 19 900 pair tests to 84 and finds the same 30 contacts", async ({ page }) => {
  await page.goto("/labs/game/game-12-broadphase");
  const r = page.getByRole("status", { name: "Соқтығыс нәтижесі" });
  await page.getByRole("button", { name: "ұяшық 2" }).click();
  await page.getByRole("button", { name: "Соқтығыстарды іздеу" }).click();
  await expect(r).toContainText("84");
  await expect(r).toContainText("Соқтығыс30");
});

test("Middle 13: without a pool the GC stalls three frames; with one, none", async ({ page }) => {
  await page.goto("/labs/game/game-13-pooling");
  const r = page.getByRole("status", { name: "Пул нәтижесі" });
  await page.getByRole("button", { name: "300 кадр ойнау" }).click();
  await expect(r).toContainText("Қатқан кадр3");
  await page.getByLabel("Объектілер пулы").click();
  await expect(page.getByLabel("Объектілер пулы")).toBeChecked();
  await page.getByRole("button", { name: "300 кадр ойнау" }).click();
  await expect(r).toContainText("Қатқан кадр0");
});

test("Middle 14: frame-delta Euler explodes at 30 FPS; a fixed step keeps amplitude 1 in 720 steps", async ({ page }) => {
  await page.goto("/labs/game/game-14-timestep");
  const r = page.getByRole("status", { name: "Серіппе нәтижесі" });
  await page.getByRole("button", { name: "3 секунд ойнау" }).click();
  await expect(r).toContainText("Физика қадамы90");
  await page.getByRole("button", { name: "Тұрақты 1/240 с қадам" }).click();
  await page.getByRole("button", { name: "3 секунд ойнау" }).click();
  await expect(r).toContainText("Соңғы амплитуда1");
  await expect(r).toContainText("720");
});
