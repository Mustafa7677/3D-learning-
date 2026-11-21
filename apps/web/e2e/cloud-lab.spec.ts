import { expect, test, type Page } from "@playwright/test";

const objective = (page: Page, text: string | RegExp) => page.locator("li[data-done]", { hasText: text });

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});

test("cloud lab page lists eight lessons and the problem set", async ({ page }) => {
  await page.goto("/labs/cloud");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Cloud & DevOps");
  await expect(page.locator("ol li")).toHaveCount(12);
  await expect(page.locator('ol li[data-level="Middle"]')).toHaveCount(3);
});

test("lesson 1: reordering the Dockerfile makes rebuilds fast", async ({ page }) => {
  await page.goto("/labs/cloud/cloud-1-containers");
  await expect(page.locator("canvas")).toBeVisible();
  const build = page.getByRole("button", { name: "Код өзгерді → жинау" });
  await build.click();
  await expect(page.getByRole("status").filter({ hasText: "65.7 с" })).toBeVisible();
  await expect(objective(page, "неше секунд")).toHaveAttribute("data-done", "true");
  const down = page.getByRole("button", { name: "COPY src ./src төмен" });
  await down.click();
  await down.click();
  await build.click();
  await expect(page.getByRole("status").filter({ hasText: "20.5 с" })).toBeVisible();
});

test("lesson 3: too few servers overload", async ({ page }) => {
  await page.goto("/labs/cloud/cloud-3-scaling");
  await page.getByLabel("Серверлер (n)").fill("4");
  await expect(page.getByRole("status").filter({ hasText: "∞" })).toBeVisible();
  await expect(objective(page, "азайтып")).toHaveAttribute("data-done", "true");
});

test("lesson 8: payments is the root cause", async ({ page }) => {
  await page.goto("/labs/cloud/cloud-8-incident");
  await page.getByRole("button", { name: "Себеп: gateway" }).click();
  await expect(objective(page, "Түпкі себеп")).toHaveAttribute("data-done", "false");
  await page.getByRole("button", { name: "Себеп: payments" }).click();
  await expect(objective(page, "Түпкі себеп")).toHaveAttribute("data-done", "true");
});

test("Middle 10: a rollout without readiness errors, with readiness it does not", async ({ page }) => {
  await page.goto("/labs/cloud/cloud-10-probes");
  const result = page.getByRole("status", { name: "Тексеріс нәтижесі" });
  await page.getByRole("button", { name: "90 секундты ойнату" }).click();
  await expect(result).toContainText("1980");
  await page.getByLabel(/Readiness тексерісі/).click();
  await expect(page.getByLabel(/Readiness тексерісі/)).toBeChecked();
  await page.getByRole("button", { name: "90 секундты ойнату" }).click();
  await expect(result).toContainText("Қате сұраныс0");
  await expect(objective(page, "бірде-бір қатесіз")).toHaveAttribute("data-done", "true");
});

test("Middle 11: one consumer queues 1500 jobs for 15 s; two consumers queue none", async ({ page }) => {
  await page.goto("/labs/cloud/cloud-11-queues");
  const result = page.getByRole("status", { name: "Кезек нәтижесі" });
  await page.getByRole("button", { name: "Толқынды жіберу" }).click();
  await expect(result).toContainText("1500");
  await expect(result).toContainText("15 с");
  await page.getByRole("button", { name: "2 өңдеуші (200/с)" }).click();
  await page.getByRole("button", { name: "Толқынды жіберу" }).click();
  await expect(result).toContainText("0 с");
});

test("Middle 12: least connections keeps p95 at 50 ms where round robin reaches 1226", async ({ page }) => {
  await page.goto("/labs/cloud/cloud-12-lb");
  const result = page.getByRole("status", { name: "Тарату нәтижесі" });
  await page.getByRole("button", { name: "Сұраныстарды жіберу" }).click();
  await expect(result).toContainText("1226 мс");
  await page.getByRole("button", { name: "Least connections" }).click();
  await page.getByRole("button", { name: "Сұраныстарды жіберу" }).click();
  await expect(result).toContainText("144 / 104 / 52");
  await expect(result).toContainText("50 мс");
});
