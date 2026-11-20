import { expect, test, type Page } from "@playwright/test";
import { answerQuiz, nextStep } from "./helpers";

const objective = (page: Page, text: string | RegExp) => page.locator("li[data-done]", { hasText: text });

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});

test("algorithms lab page lists eight lessons and the problem set", async ({ page }) => {
  await page.goto("/labs/algo");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Algorithms");
  await expect(page.locator("ol li")).toHaveCount(9);
});

test("lesson 1: linear search, then a missing value costs n probes", async ({ page }) => {
  await page.goto("/labs/algo/algo-1-search");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(objective(page, "47-ні тап")).toHaveAttribute("data-done", "false");
  await page.getByRole("button", { name: "Қадам", exact: true }).click();
  await page.getByRole("button", { name: "Соңына дейін" }).click();
  await expect(objective(page, "47-ні тап")).toHaveAttribute("data-done", "true");
  await page.getByLabel("Мақсат", { exact: true }).fill("48");
  await page.getByRole("button", { name: "Орнату" }).click();
  await page.getByRole("button", { name: "Соңына дейін" }).click();
  await expect(objective(page, "Жоқ санды ізде")).toHaveAttribute("data-done", "true");
  await nextStep(page);
  await expect(page.getByRole("heading", { name: "Екілік іздеу" })).toBeVisible();
  await page.getByRole("button", { name: "Соңына дейін" }).click();
  await expect(objective(page, "Екілік іздеумен 47-ні тап")).toHaveAttribute("data-done", "true");
});

test("lesson 2: stepping through bubble sort by hand", async ({ page }) => {
  await page.goto("/labs/algo/algo-2-bubble");
  const step = page.getByRole("button", { name: "Қадам", exact: true });
  for (let i = 0; i < 15; i++) await step.click();
  await expect(objective(page, "15 қадам")).toHaveAttribute("data-done", "true");
  await expect(page.getByText(/салыстырылды|орын ауыстырды|орнына/).first()).toBeVisible();
  await nextStep(page);
  await page.getByRole("button", { name: "Соңына дейін" }).click();
  await expect(objective(page, "120 салыстыру")).toHaveAttribute("data-done", "true");
});

test("lesson 4: Big O experiment shows quadratic growth", async ({ page }) => {
  await page.goto("/labs/algo/algo-4-bigo");
  await page.getByRole("button", { name: "Selection" }).click();
  for (const n of ["256", "512", "1024"]) {
    await page.getByRole("button", { name: n, exact: true }).click();
    await page.getByRole("button", { name: "Өлшеу" }).click();
  }
  await expect(page.getByRole("cell", { name: "523 776" })).toBeVisible();
  await expect(objective(page, "Selection sort: кемінде 3 өлшем")).toHaveAttribute("data-done", "true");
  await answerQuiz(page);
});

test("lesson 8: Dijkstra finds the cheapest route", async ({ page }) => {
  await page.goto("/labs/algo/algo-8-dijkstra");
  await page.getByRole("button", { name: "Соңына дейін" }).click();
  await expect(page.getByText("Жол: A → B → D → F → H · қабырға: 4 · құны: 8")).toBeVisible();
  await expect(objective(page, "құны 8")).toHaveAttribute("data-done", "true");
});
