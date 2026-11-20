import { expect, test, type Page } from "@playwright/test";
import { answerQuiz, nextStep } from "./helpers";

const objective = (page: Page, text: string) => page.locator("li[data-done]", { hasText: text });

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});

test("home page shows the live hero and the lab map", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Технологияның");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByText(/Epoch \d+/)).toBeVisible();
  await expect(page.getByRole("link", { name: /AI & Machine Learning/ })).toBeVisible();
});

test("objectives are not pre-completed by the default world", async ({ page }) => {
  await page.goto("/labs/ai/ai-3-network");
  await expect(page.getByText("Жасырын қабат жоқ")).toBeVisible();
  await expect(objective(page, "жасырын қабат қос")).toHaveAttribute("data-done", "false");
  await page.getByRole("button", { name: "Қабат қосу" }).click();
  await expect(objective(page, "жасырын қабат қос")).toHaveAttribute("data-done", "true");
  await answerQuiz(page);
  await expect(page.getByRole("button", { name: "Келесі кезең" })).toBeEnabled();
});

test("lesson 2: tuning a neuron by hand reaches the boundary objective", async ({ page }) => {
  await page.goto("/labs/ai/ai-2-neuron");
  const w1 = page.getByLabel("w₁");
  await w1.fill("2");
  await page.getByLabel("w₂").fill("2");
  await expect(objective(page, "w₁, w₂ немесе b")).toHaveAttribute("data-done", "true");
  await nextStep(page);
  await expect(page.getByRole("heading", { name: "Шешім шекарасы" })).toBeVisible();
  await page.getByLabel("w₁").fill("3");
  await page.getByLabel("w₂").fill("3");
  await page.getByLabel("Bias (b)").fill("0.2");
  await expect(objective(page, "≥ 90%")).toHaveAttribute("data-done", "true");
  await expect(objective(page, "Bias")).toHaveAttribute("data-done", "true");
});

test("lesson 4: real training in the worker drives loss down", async ({ page }) => {
  await page.goto("/labs/ai/ai-4-training");
  await page.getByRole("button", { name: "Training бастау" }).click();
  await expect(objective(page, "50 epoch")).toHaveAttribute("data-done", "true", { timeout: 20_000 });
  const loss = Number(await page.locator('[role="status"] div', { hasText: "Loss" }).locator("strong").textContent());
  expect(loss).toBeLessThan(0.4);
});

test("progress survives a reload", async ({ page }) => {
  await page.goto("/labs/ai/ai-3-network");
  await page.getByRole("button", { name: "Қабат қосу" }).click();
  await nextStep(page);
  await expect(page.getByRole("heading", { name: "Forward propagation" })).toBeVisible();
  await page.waitForTimeout(700); // progress save is debounced
  await page.reload();
  await expect(page.getByRole("heading", { name: "Forward propagation" })).toBeVisible();
  await page.goto("/labs/ai");
  await expect(page.getByText(/% орындалды/)).toBeVisible();
});

test("«Есептеу ішінен» shows the numbers behind a prediction and one gradient step", async ({ page }) => {
  await page.goto("/labs/ai/ai-2-neuron");
  await page.getByRole("button", { name: "Нүктені талдау" }).click();
  const dialog = page.getByRole("dialog", { name: "Таңдалған нүкте" });
  await expect(dialog.getByText("Есептеу ішінен")).toBeVisible();
  await expect(dialog.getByText("Backprop мүмкін емес.")).toBeVisible();
  await page.getByRole("button", { name: "sigmoid", exact: true }).click();
  await expect(dialog.getByText("∂L/∂z = p − y =")).toBeVisible();
  await expect(dialog.getByText(/w₁: .* → /)).toBeVisible();

  await page.goto("/labs/ai/ai-3-network");
  await page.getByRole("button", { name: "Қабат қосу" }).click();
  await page.getByRole("button", { name: "Қате нүктені табу" }).click();
  const net = page.getByRole("dialog", { name: "Таңдалған нүкте" });
  await net.getByText("Есептеу ішінен").click();
  await expect(net.locator("table caption", { hasText: "Шығыс" })).toBeVisible();
});

test("deep dives are collapsed until opened", async ({ page }) => {
  await page.goto("/labs/ai/ai-4-training");
  const deep = page.locator("details", { hasText: "Тереңірек: ∂L/∂z = p − y" });
  await expect(deep).toBeVisible();
  await expect(deep.getByText("Сандармен.")).toBeHidden();
  await deep.locator("summary").click();
  await expect(deep.getByText(/Бір қадамда loss 3 есеге/)).toBeVisible();
});
