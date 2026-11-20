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
  await expect(page.locator("ol li")).toHaveCount(9);
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
