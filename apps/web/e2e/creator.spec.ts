import { expect, test } from "@playwright/test";
import { answerQuiz } from "./helpers";

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});

test("a teacher builds a game lesson, test-plays it and shares it with a link", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/create");
  await page.getByLabel("Симуляция").selectOption("game");
  await page.getByRole("button", { name: "Жаңа сабақ" }).click();

  await page.getByLabel("Сабақ атауы").fill("Гравитация зертханасы");
  await page.getByLabel("Камера қарайтын жер").selectOption("physics");
  await page.getByLabel("Физика: Ай гравитациясы").check();
  await page.getByLabel("1-тапсырма шарты").selectOption("drops");
  await page.getByLabel("1-тапсырма саны").fill("2");
  await expect(page.getByLabel("1-тапсырма мәтіні")).toHaveValue("Тасталған доп ≥ 2");

  // A question with a missing explanation blocks publishing until it is fixed.
  await page.getByRole("button", { name: "+ Сұрақ" }).click();
  await page.getByLabel("1-сұрақ", { exact: true }).fill("Айда доп қалай құлайды?");
  await page.getByLabel("1-сұрақ, 1-нұсқа").fill("Жерге қарағанда баяу");
  await page.getByLabel("1-сұрақ, 2-нұсқа").fill("Жылдамырақ");
  await page.getByRole("button", { name: "3-нұсқаны өшіру" }).click();
  await expect(page.getByText(/Түзету керек/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Сынап көру" })).toBeDisabled();
  await page.getByLabel("1-сұрақ түсіндірмесі").fill("Ай гравитациясы 1.6 м/с², Жерде 9.8 м/с².");
  await expect(page.getByText(/Сабақ дұрыс құрылған/)).toBeVisible();

  // The draft survives a reload.
  await page.reload();
  await expect(page.getByLabel("Сабақ атауы")).toHaveValue("Гравитация зертханасы");

  await page.getByRole("button", { name: "Сынап көру" }).click();
  await expect(page.getByText("Сынақ режимі:")).toBeVisible();
  await expect(page.locator("li[data-done]", { hasText: "Тасталған доп ≥ 2" })).toHaveAttribute("data-done", "false");
  await page.getByRole("button", { name: "Доп тастау" }).click();
  await page.getByRole("button", { name: "Доп тастау" }).click();
  await expect(page.locator("li[data-done]", { hasText: "Тасталған доп ≥ 2" })).toHaveAttribute("data-done", "true");
  await answerQuiz(page);
  await expect(page.getByText("Сабақ аяқталды.")).toBeVisible();

  await page.getByRole("button", { name: "Редакторға қайту" }).click();
  await page.getByRole("button", { name: "Оқушыларға сілтеме" }).click();
  await expect(page.getByText("Оқушыларға арналған сілтеме көшірілді.")).toBeVisible();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(/\/play#l=[A-Za-z0-9_-]+$/);

  // A learner opens the link in a fresh browser: the lesson is inside the URL.
  const learner = await context.browser()!.newContext();
  const lp = await learner.newPage();
  await lp.goto(link);
  await expect(lp.getByText("Мұғалім жасаған сабақ:")).toBeVisible();
  await expect(lp.getByRole("heading", { name: "Бірінші кезең" })).toBeVisible();
  await expect(lp.locator("li[data-done]", { hasText: "Тасталған доп ≥ 2" })).toHaveAttribute("data-done", "false");
  await learner.close();
});

test("a broken share link explains itself", async ({ page }) => {
  await page.goto("/play#l=bm90LWEtbGVzc29u");
  await expect(page.getByText(/Сабақты ашу мүмкін емес/)).toBeVisible();
});
