import { expect, test, type Page } from "@playwright/test";
import { answerQuiz, nextStep } from "./helpers";

const objective = (page: Page, text: string | RegExp) => page.locator("li[data-done]", { hasText: text });

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});

test("algorithms lab page lists the Junior lessons, the problem set and the Middle level", async ({ page }) => {
  await page.goto("/labs/algo");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Algorithms");
  await expect(page.locator("ol li")).toHaveCount(14);
  await expect(page.locator('ol li[data-level="Middle"]')).toHaveCount(5);
});

test("Middle 10: anagrams pile up under the sum hash; the polynomial hash and growth fix it", async ({ page }) => {
  await page.goto("/labs/algo/algo-10-hash");
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "Анаграммаларды қосу" }).click();
  await expect(objective(page, "ұзындығы 4 тізбекті")).toHaveAttribute("data-done", "true");
  await page.getByRole("button", { name: "Полиномдық" }).click();
  await expect(objective(page, "Полиномдық хэшке")).toHaveAttribute("data-done", "true");
  await answerQuiz(page);
  await nextStep(page);
  await page.getByRole("button", { name: "24 қаланы қосу" }).click();
  await expect(objective(page, "коэффициент 3-ке")).toHaveAttribute("data-done", "true");
  // The box mirrors the simulation, so it turns checked once the runtime answers.
  await page.getByLabel(/Толғанда кеңейту/).click();
  await expect(page.getByLabel(/Толғанда кеңейту/)).toBeChecked();
  await expect(objective(page, "Кеңеюді қос")).toHaveAttribute("data-done", "true");
});

test("Middle 11: the most urgent call is always on top, and emptying the queue sorts it", async ({ page }) => {
  await page.goto("/labs/algo/algo-11-heap");
  const push = page.getByRole("button", { name: "Келесі шақыруды қосу" });
  await expect(push).toBeVisible();
  for (let i = 0; i < 9; i++) await push.click();
  await expect(objective(page, "9 шақыруды")).toHaveAttribute("data-done", "true");
  await expect(objective(page, "2 деңгей жоғары")).toHaveAttribute("data-done", "true");
  await answerQuiz(page);
  await nextStep(page);
  const pop = page.getByRole("button", { name: "Ең шұғылын алу" });
  for (let i = 0; i < 9; i++) await pop.click();
  await expect(page.getByText("Алынғандар: 1, 2, 3, 4, 5, 6, 7, 8, 9")).toBeVisible();
  await expect(objective(page, "сұрыпталған")).toHaveAttribute("data-done", "true");
});

test("Middle 12: the table beats greedy, 40 against 30", async ({ page }) => {
  await page.goto("/labs/algo/algo-12-dp");
  const step = page.getByRole("button", { name: "Келесі ұяшық" });
  await expect(step).toBeVisible();
  for (let i = 0; i < 10; i++) await step.click();
  await expect(objective(page, "10 ұяшығын")).toHaveAttribute("data-done", "true");
  await page.getByRole("button", { name: "Кестені толтыру" }).click();
  await expect(page.getByText("Кесте таңдағаны: Ұйықтау қабы, Су, Тамақ")).toBeVisible();
  await answerQuiz(page);
  await nextStep(page);
  await page.getByRole("button", { name: "Ашкөз тәсілмен шешу", exact: true }).click();
  await page.getByRole("button", { name: "Кестені толтыру" }).click();
  await expect(page.getByText("Кесте таңдағаны: Камера, Дрон")).toBeVisible();
  await expect(page.getByText("Ашкөз тәсіл алғаны: Ноутбук")).toBeVisible();
  await expect(objective(page, "ашкөз тәсілден жақсы")).toHaveAttribute("data-done", "true");
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

test("Middle 13: naive unions grow a chain of 15; union by rank keeps it at height 1", async ({ page }) => {
  await page.goto("/labs/algo/algo-13-unionfind");
  const r = page.getByRole("status", { name: "Union-Find нәтижесі" });
  await page.getByRole("button", { name: "Біріктіріп, бәрін екі рет іздеу" }).click();
  await expect(r).toContainText("Биіктік15");
  await page.getByRole("button", { name: "Union by rank" }).click();
  await page.getByRole("button", { name: "Біріктіріп, бәрін екі рет іздеу" }).click();
  await expect(r).toContainText("Биіктік1");
});

test("Middle 14: prerequisites give four semesters; a cycle locks three courses", async ({ page }) => {
  await page.goto("/labs/algo/algo-14-toposort");
  const plan = page.getByRole("status", { name: "Жоспар" });
  await page.getByRole("button", { name: "Оқу жоспарын құру" }).click();
  await expect(plan).toContainText("4 семестр");
  await page.getByLabel(/Жаңа ереже/).click();
  await expect(page.getByLabel(/Жаңа ереже/)).toBeChecked();
  await page.getByRole("button", { name: "Оқу жоспарын құру" }).click();
  await expect(plan).toContainText("Цикл: Құрылымдар, Алгоритмдер, Бұлт");
});
