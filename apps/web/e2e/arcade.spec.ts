import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});

test("the arcade hall shows four cabinets and opens a game", async ({ page }) => {
  await page.goto("/arcade");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Ойна да");
  await expect(page.getByRole("button", { name: /^Ойнау: / })).toHaveCount(4);
  await page.getByRole("button", { name: "Ойнау: Бит-метеор" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Бит-метеор");
});

test("bit meteor: set the switches to a meteor's number and it is shot down", async ({ page }) => {
  await page.goto("/arcade?g=bits");
  const meteor = page.getByRole("list", { name: "Метеорлар" }).getByRole("listitem").first();
  await expect(meteor).toBeVisible();
  const n = Number(await meteor.getAttribute("data-n"));
  const bits = page.getByRole("group", { name: "Биттер" });
  for (const w of [8, 4, 2, 1]) if (n & w) await bits.getByRole("button", { name: `${w} биті` }).click();
  await expect(page.getByTestId("score")).not.toHaveText("0");
  await expect(bits.getByRole("button", { name: "1 биті" })).toHaveAttribute("aria-pressed", "false");
});

test("gate rush: a right answer scores and grows the combo", async ({ page }) => {
  await page.goto("/arcade?g=gates");
  const formula = await page.locator("p", { hasText: "= ?" }).textContent();
  const lamps = page.getByRole("group", { name: "Сұлба" });
  const a = (await lamps.getByLabel(/^A = /).getAttribute("aria-label"))!.endsWith("1");
  const bLamp = lamps.getByLabel(/^B = /);
  const b = (await bLamp.count()) ? (await bLamp.getAttribute("aria-label"))!.endsWith("1") : false;
  const out = formula!.includes("NOT") ? !a : formula!.includes("AND") ? a && b : a || b;
  await page.keyboard.press(out ? "1" : "0");
  await expect(page.getByTestId("score")).toHaveText("10");
  await expect(page.getByText("Комбо ×2")).toBeVisible();
});

test("phishing filter: a wrong call shows why and costs a life", async ({ page }) => {
  await page.goto("/arcade?g=phish");
  const letter = page.getByRole("article", { name: "Хат" });
  await expect(letter).toBeVisible();
  const from = (await letter.textContent()) ?? "";
  // Answer the opposite of the truth on purpose, using the deck's own hints.
  const looksPhish = /xyz|instagrarn|security-check|kazpost-track|free-robux|kz\.co|netflix-payments|secure-icloud|жаңа нөмір|6 таңбалы код/.test(from);
  await page.getByRole("button", { name: looksPhish ? "← Қауіпсіз" : "Фишинг →" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("Өмір: 2")).toBeVisible();
  await page.getByRole("button", { name: "Түсіндім →" }).click();
  await expect(page.getByText("Хат 2/")).toBeVisible();
});

test("cache keeper: a full cache waits for the player to evict, the end races LRU and the optimal", async ({ page }) => {
  await page.goto("/arcade?g=cache");
  const slots = page.getByRole("group", { name: "Кэш ұяшықтары" });
  test.setTimeout(60_000);
  for (let k = 0; k < 150; k++) {
    if (await page.getByRole("list", { name: "Алгоритмдермен жарыс" }).isVisible()) break;
    const free = slots.getByRole("button", { disabled: false });
    if (await free.count()) await free.first().click();
    else await page.waitForTimeout(250);
  }
  const race = page.getByRole("list", { name: "Алгоритмдермен жарыс" });
  await expect(race).toContainText("LRU");
  await expect(race).toContainText("Оптималды");
  await page.getByRole("button", { name: /Ұпайды алу/ }).click();
  await expect(page.getByText("ОЙЫН БІТТІ")).toBeVisible();
  await expect(page.getByRole("button", { name: "↻ Тағы ойнау" })).toBeVisible();
});
