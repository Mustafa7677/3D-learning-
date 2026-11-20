import { expect, type Page } from "@playwright/test";

/**
 * Answer every concept check on the current step the way a learner would:
 * try options in turn until the question accepts one. Exercises the real UI
 * (feedback, retries) without knowing the answer key.
 */
export async function answerQuiz(page: Page): Promise<void> {
  const questions = page.locator('section[aria-labelledby="lesson-step-title"] fieldset[data-done]');
  const total = await questions.count();
  for (let q = 0; q < total; q++) {
    const fieldset = questions.nth(q);
    if ((await fieldset.getAttribute("data-done")) === "true") continue;
    const options = fieldset.locator("button");
    const n = await options.count();
    for (let i = 0; i < n; i++) {
      await options.nth(i).click();
      if ((await fieldset.getAttribute("data-done")) === "true") break;
    }
    await expect(fieldset).toHaveAttribute("data-done", "true");
  }
}

/** Answer the step's questions, then move on. */
export async function nextStep(page: Page): Promise<void> {
  await answerQuiz(page);
  await page.getByRole("button", { name: "Келесі кезең" }).click();
}
