import { expect, test, type Page } from "@playwright/test";

const objective = (page: Page, text: string | RegExp) => page.locator("li[data-done]", { hasText: text });

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});

test("cybersecurity lab page lists eight lessons and the problem set", async ({ page }) => {
  await page.goto("/labs/sec");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Cybersecurity");
  await expect(page.locator("ol li")).toHaveCount(9);
});

test("lesson 2: the most frequent letter gives the key away", async ({ page }) => {
  await page.goto("/labs/sec/sec-2-frequency");
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "Әріп жиілігі" }).click();
  const status = await page.getByRole("status").filter({ hasText: "Ең жиі әріп" }).textContent();
  const top = Number(/нөмірі (\d+)/.exec(status ?? "")?.[1]);
  await page.getByLabel("Кілт болжамы (дешифрлау)").fill(String(top));
  await expect(objective(page, "кілтті тап")).toHaveAttribute("data-done", "true");
  await expect(page.getByLabel("Дешифрланған мәтін")).toContainText("Алматы");
});

test("lesson 4: one changed character flips about half the hash", async ({ page }) => {
  await page.goto("/labs/sec/sec-4-hash");
  const input = page.getByLabel("Кіріс", { exact: true });
  await input.fill("abc");
  await expect(page.getByLabel("Хэш", { exact: true })).toHaveText("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  await input.fill("abd");
  await input.fill("Сәлем");
  await expect(objective(page, "3 түрлі мәтін")).toHaveAttribute("data-done", "true");
});

test("lesson 5: unsalted hashes fall to a dictionary and reveal shared passwords", async ({ page }) => {
  await page.goto("/labs/sec/sec-5-passwords");
  await page.getByRole("button", { name: "SHA-256", exact: true }).click();
  await page.getByRole("button", { name: "Сөздік шабуылы (50 сөз)" }).click();
  await expect(page.getByText("aigerim = erlan")).toBeVisible();
});

test("lesson 8: SQL injection gets in; parameters stop it", async ({ page }) => {
  await page.goto("/labs/sec/sec-8-injection");
  await page.getByLabel("Логин").fill("' OR '1'='1");
  await page.getByLabel("Құпиясөз").fill("' OR '1'='1");
  await page.getByRole("button", { name: "Кіру", exact: true }).click();
  await expect(page.getByText("Кірді: admin — құпиясөзсіз (injection)!")).toBeVisible();
  await expect(objective(page, "admin болып кір")).toHaveAttribute("data-done", "true");
});
