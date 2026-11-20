import { expect, test, type Page } from "@playwright/test";
import { answerQuiz, nextStep } from "./helpers";

const objective = (page: Page, text: string) => page.locator("li[data-done]", { hasText: text });

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});

test("lab page lists eight AI lessons and the problem set", async ({ page }) => {
  await page.goto("/labs/ai");
  await expect(page.locator("ol li")).toHaveCount(9);
  await expect(page.getByRole("heading", { name: "Transformers" })).toBeVisible();
});

test("lesson 5: overfitting setup trains a large net on a small dataset", async ({ page }) => {
  await page.goto("/labs/ai/ai-5-overfitting");
  await expect(page.getByText("Параметрлер саны: 609")).toBeVisible();
  await expect(page.getByLabel("Деректер саны")).toHaveValue("80");
  await page.getByRole("button", { name: "Training бастау" }).click();
  await expect(objective(page, "300 epoch")).toHaveAttribute("data-done", "true", { timeout: 20_000 });
});

test("lesson 6: tokenizer and attention respond to the learner", async ({ page }) => {
  await page.goto("/labs/ai/ai-6-transformers");
  const tokens = page.locator('[role="status"] div', { hasText: "Токендер" }).locator("strong");
  await expect(page.getByLabel("Сөйлем")).toHaveValue("мысық сүт ішеді");
  const before = Number(await tokens.textContent());
  await page.getByLabel("Merge саны").fill("0");
  // Without merges every letter plus the end-of-word mark is its own token: 5+3+5 + 3.
  await expect(tokens).toHaveText("16");
  expect(before).toBeLessThan(16);
  await page.getByLabel("Сөйлем").fill("бағдарламашы код жазады");
  await expect(objective(page, "Өз сөйлеміңді жаз")).toHaveAttribute("data-done", "true");
  await page.getByLabel("Merge саны").fill("120");
  await expect(objective(page, "3 түрлі мәнін")).toHaveAttribute("data-done", "true");
  await nextStep(page);
  for (const w of ["мысық", "компьютер", "аспан"]) await page.getByRole("button", { name: w, exact: true }).click();
  await expect(page.getByText("сөзінің ең жақын көршілері")).toBeVisible();
  await expect(objective(page, "3 сөзді таңдап")).toHaveAttribute("data-done", "true");
  await nextStep(page);
  await page.locator("table").getByRole("button", { name: "сүт" }).click();
  await expect(page.getByText("назарының энтропиясы")).toBeVisible();
});

test("lesson 7: the language model generates tokens", async ({ page }) => {
  await page.goto("/labs/ai/ai-7-llm");
  await page.getByLabel("Prompt (бастама)").fill("бала");
  // The prompt is committed after a short typing pause; wait for the model to pick it up.
  await expect(page.locator("[aria-live=polite]").last()).toHaveText(/^бала/);
  await page.getByLabel("Prompt (бастама)").fill("компьютер");
  await expect(objective(page, "Prompt")).toHaveAttribute("data-done", "true");
  await nextStep(page);
  for (let i = 0; i < 5; i++) {
    await page.getByRole("button", { name: "Тазалау" }).click();
    await page.getByRole("button", { name: "Келесі токен", exact: true }).click();
  }
  await expect(objective(page, "5 токен")).toHaveAttribute("data-done", "true");
});

test("lesson 8: model JSON can be copied", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/labs/ai/ai-8-build");
  await expect(page.locator("#export-json")).toContainText("inside-tech/mlp@1");
  await page.getByRole("button", { name: "JSON-ды көшіру" }).click();
  await expect(page.getByText(/көшірілді|белгіленді/)).toBeVisible();
});
