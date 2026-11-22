import { expect, test, type Page } from "@playwright/test";
import { nextStep } from "./helpers";

const objective = (page: Page, text: string | RegExp) => page.locator("li[data-done]", { hasText: text });

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});

test("architecture lab page lists the Junior lessons, the problem set and the Middle level", async ({ page }) => {
  await page.goto("/labs/arch");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Computer Architecture");
  await expect(page.locator("ol li")).toHaveCount(15);
  await expect(page.locator('ol li[data-level="Middle"]')).toHaveCount(6);
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

test("Middle 10: forwarding leaves one load-use stall; moving the independent ADD up reaches 9 cycles", async ({ page }) => {
  await page.goto("/labs/arch/arch-10-pipeline");
  const result = page.getByRole("status", { name: "Конвейер нәтижесі" });
  await page.getByRole("button", { name: "Бағдарламаны орындау" }).click();
  await expect(result).toContainText("25");
  await page.getByRole("button", { name: "Конвейер, forwarding-сіз" }).click();
  await page.getByRole("button", { name: "Бағдарламаны орындау" }).click();
  await expect(result).toContainText("15");
  await page.getByRole("button", { name: "Конвейер + forwarding" }).click();
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "ADD r4, r5, r6: жоғары жылжыту" }).click();
  await expect(page.getByRole("list", { name: "Бағдарлама" }).locator("li").nth(1)).toContainText("ADD r4, r5, r6");
  await page.getByRole("button", { name: "Бағдарламаны орындау" }).click();
  await expect(result).toContainText("9");
  await expect(result).toContainText("0");
});

test("Middle 11: a sorted array makes the branch predictable", async ({ page }) => {
  await page.goto("/labs/arch/arch-11-branch");
  const result = page.getByRole("status", { name: "Болжау нәтижесі" });
  await page.getByRole("button", { name: "Болжап көру" }).click();
  await expect(result).toContainText("19 / 40");
  await page.getByRole("button", { name: "2 биттік" }).click();
  await page.getByRole("button", { name: "Болжап көру" }).click();
  await expect(result).toContainText("10 / 40");
});

test("Middle 12: two arrays a cache apart thrash a direct-mapped cache, not a 2-way one", async ({ page }) => {
  await page.goto("/labs/arch/arch-12-assoc");
  const result = page.getByRole("status", { name: "Кэш нәтижесі" });
  await page.getByRole("button", { name: "Оқуды бастау" }).click();
  await expect(result).toContainText("Hit0");
  await page.getByRole("button", { name: "2 жолды" }).click();
  await page.getByRole("button", { name: "Оқуды бастау" }).click();
  await expect(result).toContainText("Hit48");
  await expect(objective(page, "2 жолды кэшпен")).toHaveAttribute("data-done", "true");
});

test("Middle 13: striding over eight pages misses every TLB lookup; huge pages fix it", async ({ page }) => {
  await page.goto("/labs/arch/arch-13-tlb");
  const r = page.getByRole("status", { name: "TLB нәтижесі" });
  await page.getByRole("button", { name: "64 рет оқу" }).click();
  await expect(r).toContainText("Hit56");
  await page.getByRole("button", { name: "Сегіз бетті кезектесіп" }).click();
  await page.getByRole("button", { name: "64 рет оқу" }).click();
  await expect(r).toContainText("Hit0");
  await page.getByLabel("Үлкен беттер (2 МБ)").click();
  await expect(page.getByLabel("Үлкен беттер (2 МБ)")).toBeChecked();
  await page.getByRole("button", { name: "64 рет оқу" }).click();
  await expect(r).toContainText("Hit63");
});

test("Middle 14: 0.1 + 0.2 is not 0.3; Kahan rescues a float32 sum", async ({ page }) => {
  await page.goto("/labs/arch/arch-14-float");
  const r = page.getByRole("status", { name: "Есеп нәтижесі" });
  await page.getByRole("button", { name: "Есептеу" }).click();
  await expect(r).toContainText("0.30000000000000004 (≠ 0.3)");
  await page.getByRole("group", { name: "Дәлдік" }).getByRole("button", { name: "float32" }).click();
  await page.getByLabel("Kahan қосындысы").click();
  await expect(page.getByLabel("Kahan қосындысы")).toBeChecked();
  await page.getByRole("button", { name: "Есептеу" }).click();
  await expect(r).toContainText("10000 (қате 0.0e+0)");
});

test("Middle 15: two threads on one cache line are 39 times slower than one; padding makes them twice as fast", async ({ page }) => {
  await page.goto("/labs/arch/arch-15-false-sharing");
  const r = page.getByRole("status", { name: "Ядролар нәтижесі" });
  const go = page.getByRole("button", { name: "Іске қосу" });
  await go.click();
  await expect(r).toContainText("Такт2039");
  await page.getByRole("button", { name: "2 ағын, бір кэш жолы" }).click();
  await go.click();
  await expect(r).toContainText("Такт80000");
  await nextStep(page);
  await go.click();
  await expect(r).toContainText("Такт1039");
  await expect(page.getByRole("region", { name: "Өз сөзіңмен түсіндір" })).toBeVisible();
});
