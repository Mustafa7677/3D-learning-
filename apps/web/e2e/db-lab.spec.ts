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

test("databases lab page lists the Junior lessons, the problem set and the Middle level", async ({ page }) => {
  await page.goto("/labs/db");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Databases");
  await expect(page.locator("ol li")).toHaveCount(13);
  await expect(page.locator('ol li[data-level="Middle"]')).toHaveCount(4);
  await expect(page.getByRole("link", { name: /LEFT JOIN & NULL/ })).toContainText("Middle");
});

test("Middle 10: LEFT JOIN finds the course nobody took, and COUNT gives it zero", async ({ page }) => {
  await page.goto("/labs/db/db-10-left-join");
  await expect(page.getByLabel(/Сұраныс/)).toHaveValue(/^SELECT c\.title, e\.student_id FROM courses c JOIN/);
  await run(page, "SELECT c.title, e.student_id FROM courses c LEFT JOIN enrollments e ON e.course_id = c.id");
  await expect(objective(page, "Барлық курсты")).toHaveAttribute("data-done", "true");
  await run(page, "SELECT c.title FROM courses c LEFT JOIN enrollments e ON e.course_id = c.id WHERE e.student_id IS NULL");
  await expect(objective(page, "студенті жоқ курстарды")).toHaveAttribute("data-done", "true");
  await expect(page.getByText("Бұлт").first()).toBeVisible();
});

test("Middle 11: a copied average does not pass, a subquery does", async ({ page }) => {
  await page.goto("/labs/db/db-11-subqueries");
  await expect(page.getByLabel(/Сұраныс/)).toHaveValue("SELECT AVG(grade) FROM enrollments");
  await run(page, "SELECT student_id, course_id, grade FROM enrollments WHERE grade > 84.89");
  await expect(objective(page, "орташадан жоғары")).toHaveAttribute("data-done", "false");
  await run(page, "SELECT student_id, course_id, grade FROM enrollments WHERE grade > (SELECT AVG(grade) FROM enrollments)");
  await expect(objective(page, "орташадан жоғары")).toHaveAttribute("data-done", "true");
});

test("lesson 1: a WHERE query is graded against the reference result", async ({ page }) => {
  await page.goto("/labs/db/db-1-select");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByLabel(/Сұраныс/)).toHaveValue("SELECT * FROM students");
  await run(page, "SELECT name FROM students WHERE city = 'Астана'");
  await expect(objective(page, "Алматыдағы")).toHaveAttribute("data-done", "false");
  await run(page, "SELECT name FROM students WHERE city = 'Алматы'");
  await expect(page.getByRole("cell", { name: "Аружан" })).toBeVisible();
  await expect(objective(page, "Алматыдағы")).toHaveAttribute("data-done", "true");
});

test("lesson 4: an index cuts 5000 examined rows to a handful", async ({ page }) => {
  await page.goto("/labs/db/db-4-index");
  // Run the step's own query only once the runtime has put it in the box.
  await page.locator("canvas").waitFor();
  await expect(page.getByLabel(/Сұраныс/)).toHaveValue("SELECT * FROM events WHERE user_id = 42");
  await page.getByRole("button", { name: "Орындау" }).click();
  await expect(page.getByText(/5000 жол қаралды/).first()).toBeVisible();
  await run(page, "CREATE INDEX ON events (user_id); SELECT * FROM events WHERE user_id = 42");
  await expect(page.getByText(/9 жол · 9 жол қаралды/)).toBeVisible();
});

test("lesson 6: a crash in the middle of a transaction loses nothing", async ({ page }) => {
  await page.goto("/labs/db/db-6-transactions");
  await expect(page.getByLabel(/Сұраныс/)).toHaveValue("SELECT * FROM accounts");
  await run(page, "BEGIN; UPDATE accounts SET balance = balance - 300 WHERE id = 1");
  await expect(page.getByText("Транзакция ашық: COMMIT не ROLLBACK күтуде.")).toBeVisible();
  await page.getByRole("button", { name: "Сервер құлады", exact: true }).click();
  await run(page, "SELECT SUM(balance) AS total FROM accounts");
  await expect(page.getByRole("cell", { name: "1700" })).toBeVisible();
});

test("lesson 7: interleaving two clients loses an update", async ({ page }) => {
  await page.goto("/labs/db/db-7-concurrency");
  for (const b of ["A оқиды", "B оқиды", "A жазады (+100)", "B жазады (+100)"]) await page.getByRole("button", { name: b }).click();
  await expect(objective(page, "жаңартуы жоғалатын")).toHaveAttribute("data-done", "true");
});

test("Middle 13: updating one copy of a repeated fact makes two truths", async ({ page }) => {
  await page.goto("/labs/db/db-13-normalization");
  await expect(page.getByLabel(/Сұраныс/)).toHaveValue(/enrollments_flat/);
  await run(page, "UPDATE enrollments_flat SET student_city = 'Тараз' WHERE id = 1");
  await expect(objective(page, "екі қаласы пайда болсын")).toHaveAttribute("data-done", "true");
  await run(page, "UPDATE enrollments_flat SET student_city = 'Тараз' WHERE student_name = 'Айгерім'");
  await expect(objective(page, "барлық жолдарын түзет")).toHaveAttribute("data-done", "true");
});
