import { expect, test, type Page } from "@playwright/test";

const objective = (page: Page, text: string | RegExp) => page.locator("li[data-done]", { hasText: text });

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});

test("architecture lab page lists eight lessons and the problem set", async ({ page }) => {
  await page.goto("/labs/arch");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Computer Architecture");
  await expect(page.locator("ol li")).toHaveCount(9);
});

test("lesson 1: switching bits on builds 42", async ({ page }) => {
  await page.goto("/labs/arch/arch-1-binary");
  await expect(page.locator("canvas")).toBeVisible();
  for (const w of ["32", "8", "2"]) await page.getByRole("button", { name: `Салмағы ${w} бит` }).click();
  await expect(page.getByText("0x2A")).toBeVisible();
  await expect(objective(page, "42 санын жаса")).toHaveAttribute("data-done", "true");
});

test("lesson 4: completing the half adder turns the truth table green", async ({ page }) => {
  await page.goto("/labs/arch/arch-4-adder");
  await expect(page.getByText(/жол сәйкес емес/)).toBeVisible();
  await page.getByLabel("Элемент s").selectOption("XOR");
  await page.getByLabel("Элемент c").selectOption("AND");
  await expect(page.getByText("Барлық жол спецификацияға сай ✓")).toBeVisible();
  await expect(objective(page, "S пен C")).toHaveAttribute("data-done", "true");
});

test("lesson 6: a program written by the learner passes the hidden tests", async ({ page }) => {
  await page.goto("/labs/arch/arch-6-asm");
  const src = page.getByLabel(/Ассемблер/);
  await expect(src).toHaveValue(/^; mem\[0\] \+ mem\[1\]/);
  await src.fill("LI R0, 5\nOUT R0\nHALT");
  await page.getByRole("button", { name: "Жинау (assemble)" }).click();
  await page.getByRole("button", { name: "Соңына дейін" }).click();
  await expect(objective(page, "жасырын тест")).toHaveAttribute("data-done", "false");
  await src.fill("LOAD R0, [0]\nLOAD R1, [1]\nADD R0, R1\nOUT R0\nHALT");
  await page.getByRole("button", { name: "Жинау (assemble)" }).click();
  await page.getByRole("button", { name: "Соңына дейін" }).click();
  await expect(objective(page, "жасырын тест")).toHaveAttribute("data-done", "true");
  await src.fill("LI R9, 1");
  await page.getByRole("button", { name: "Жинау (assemble)" }).click();
  await expect(page.getByRole("group", { name: "Процессор" }).getByRole("alert")).toContainText("1-жол");
});

test("lesson 8: column order thrashes the cache", async ({ page }) => {
  await page.goto("/labs/arch/arch-8-cache");
  await page.getByRole("button", { name: "Соңына дейін" }).click();
  await expect(page.getByRole("status").filter({ hasText: "1648" })).toBeVisible();
});
