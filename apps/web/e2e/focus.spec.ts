import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});

test("a focus session: intention, timer, a parked thought, the clock follows into a lesson, one sentence learned, a break, minutes on Бүгін", async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 10, 22, 10, 0, 0) });
  await page.goto("/focus");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Бір нәрсеге, толық.");
  await page.getByRole("group", { name: "Бүгінгі жоспардан" }).getByRole("button", { name: /Қиын есеп:/ }).click();
  await expect(page.getByLabel("Бұл сессияда не үйренемін?")).toHaveValue(/Қиын есеп:/);
  await page.getByRole("group", { name: "Ұзақтығы" }).getByRole("button", { name: /15/ }).click();
  await page.getByRole("button", { name: "Фокусты бастау" }).click();

  const timer = page.getByRole("timer", { name: "Қалған уақыт" });
  await expect(timer).toHaveText("15:00");
  await page.getByLabel(/Басқа ой келді ме/).fill("Досыма хат жазу");
  await page.getByRole("button", { name: "Тұраққа қою" }).click();
  await expect(page.getByRole("list", { name: "Тұрақтағы ойлар" })).toContainText("Досыма хат жазу");

  // The clock keeps counting in a lesson.
  await page.clock.fastForward("05:00");
  await page.goto("/labs/math/la-1-vectors");
  await expect(page.getByRole("link", { name: /Фокус: 10:00 қалды|Фокус: 09:5\d қалды/ })).toBeVisible();
  await page.goto("/focus");
  await expect(timer).toHaveText(/^(10:00|09:5\d)$/);

  await page.clock.fastForward("10:05");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("15 минут терең жұмыс.");
  await expect(page.getByRole("region", { name: "Сессия қорытындысы" })).toContainText("Досыма хат жазу");
  await expect(page.getByRole("region", { name: "Сессия қорытындысы" })).toContainText("бетті тастап кету: 0");
  await page.getByRole("button", { name: "Сақтап, демалуға" }).click();
  await expect(page.getByText("Кемінде бір толық сөйлем жаз")).toBeVisible();
  await page.getByLabel("Бір сөйлеммен: не үйрендің?").fill("Бинарлық іздеу әр қадамда ауқымды екіге бөледі.");
  await page.getByRole("group", { name: "Фокус бағасы" }).getByRole("button", { name: /Терең/ }).click();
  await page.getByRole("button", { name: "Сақтап, демалуға" }).click();

  await expect(page.getByRole("timer", { name: "Үзіліске қалған уақыт" })).toHaveText("03:00");
  const history = page.getByRole("region", { name: "Фокус тарихы" });
  await expect(history).toContainText("Бүгін: 15 мин");
  await expect(history).toContainText("Бинарлық іздеу әр қадамда ауқымды екіге бөледі.");

  await page.goto("/today");
  await expect(page.getByRole("region", { name: "Фокус уақыты" })).toContainText("15 мин бүгін");
  await expect(page.getByRole("img", { name: /1 белсенді күн/ })).toBeVisible();
});

test("pausing stops the clock", async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 10, 22, 10, 0, 0) });
  await page.goto("/focus");
  await page.getByRole("button", { name: "Фокусты бастау" }).click();
  await page.clock.fastForward("02:00");
  await page.getByRole("button", { name: "Кідірту" }).click();
  const timer = page.getByRole("timer", { name: "Қалған уақыт" });
  const at = await timer.textContent();
  await page.clock.fastForward("05:00");
  await expect(timer).toHaveText(at!);
  await page.getByRole("button", { name: "Жалғастыру" }).click();
  await page.getByRole("button", { name: "Ертерек аяқтау" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("2 минут терең жұмыс.");
});
