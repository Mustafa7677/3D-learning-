import { expect, test, type Page } from "@playwright/test";

const objective = (page: Page, text: string | RegExp) => page.locator("li[data-done]", { hasText: text });

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});

test("networks lab page lists eight lessons and the problem set", async ({ page }) => {
  await page.goto("/labs/net");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Computer Networks");
  await expect(page.locator("ol li")).toHaveCount(9);
});

test("lesson 2: the CIDR calculator finds the network", async ({ page }) => {
  await page.goto("/labs/net/net-2-ip");
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByLabel("Префикс (/n)").fill("26");
  await expect(page.getByRole("status").filter({ hasText: "192.168.10.64" })).toBeVisible();
  await expect(objective(page, "192.168.10.77/26")).toHaveAttribute("data-done", "true");
});

test("lesson 3: a cut link reroutes the packet", async ({ page }) => {
  await page.goto("/labs/net/net-3-routing");
  await page.getByRole("button", { name: "Пакет жіберу" }).click();
  await expect(page.getByText("A → B → D → F · құны 8")).toBeVisible();
  await page.getByRole("button", { name: /^BD сызығы/ }).click();
  await page.getByRole("button", { name: "Пакет жіберу" }).click();
  await expect(page.getByText("A → B → C → E → D → F · құны 9")).toBeVisible();
});

test("lesson 6: a window of one RTT fills the link", async ({ page }) => {
  await page.goto("/labs/net/net-6-window");
  await page.getByLabel("Терезе (W)").fill("10");
  await page.getByRole("button", { name: "Жіберу", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "85%" })).toBeVisible();
  await expect(objective(page, "≥ 80% пайдалан")).toHaveAttribute("data-done", "true");
});
