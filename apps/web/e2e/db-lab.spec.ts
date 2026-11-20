import { expect, test, type Page } from "@playwright/test";

const objective = (page: Page, text: string | RegExp) => page.locator("li[data-done]", { hasText: text });
const run = async (page: Page, sql: string) => {
  await page.getByLabel(/Сұраныс/).fill(sql);
  await page.getByRole("button", { name: "Орындау" }).click();
};

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});

test("databases lab page lists eight lessons and the problem set", async ({ page }) => {
  await page.goto("/labs/db");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Databases");
  await expect(page.locator("ol li")).toHaveCount(9);
});

test("lesson 1: a WHERE query is graded against the reference result", async ({ page }) => {
  await page.goto("/labs/db/db-1-select");
  await expect(page.locator("canvas")).toBeVisible();
  await run(page, "SELECT name FROM students WHERE city = 'Астана'");
  await expect(objective(page, "Алматыдағы")).toHaveAttribute("data-done", "false");
  await run(page, "SELECT name FROM students WHERE city = 'Алматы'");
  await expect(page.getByRole("cell", { name: "Аружан" })).toBeVisible();
  await expect(objective(page, "Алматыдағы")).toHaveAttribute("data-done", "true");
});

test("lesson 4: an index cuts 5000 examined rows to a handful", async ({ page }) => {
  await page.goto("/labs/db/db-4-index");
  await page.getByRole("button", { name: "Орындау" }).click();
  await expect(page.getByText(/5000 жол қаралды/)).toBeVisible();
  await run(page, "CREATE INDEX ON events (user_id); SELECT * FROM events WHERE user_id = 42");
  await expect(page.getByText(/9 жол · 9 жол қаралды/)).toBeVisible();
});

test("lesson 6: a crash in the middle of a transaction loses nothing", async ({ page }) => {
  await page.goto("/labs/db/db-6-transactions");
  await run(page, "BEGIN; UPDATE accounts SET balance = balance - 300 WHERE id = 1");
  await expect(page.getByText("Транзакция ашық — COMMIT не ROLLBACK күтуде.")).toBeVisible();
  await page.getByRole("button", { name: "Сервер құлады", exact: true }).click();
  await run(page, "SELECT SUM(balance) AS total FROM accounts");
  await expect(page.getByRole("cell", { name: "1700" })).toBeVisible();
});

test("lesson 7: interleaving two clients loses an update", async ({ page }) => {
  await page.goto("/labs/db/db-7-concurrency");
  for (const b of ["A оқиды", "B оқиды", "A жазады (+100)", "B жазады (+100)"]) await page.getByRole("button", { name: b }).click();
  await expect(objective(page, "жаңартуы жоғалатын")).toHaveAttribute("data-done", "true");
});
