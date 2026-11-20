import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});

test("home: the enter button starts the dive, the course list has every lab", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "Кіру", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
  await page.getByRole("button", { name: "Курстарды көру" }).click();
  await expect(page.getByRole("heading", { name: "Курстар", level: 2 })).toBeInViewport();
  await expect(page.locator("#courses li")).toHaveCount(10);
  await page.getByRole("link", { name: /Robotics & IoT/ }).last().click();
  await expect(page).toHaveURL(/\/labs\/iot$/);
});

test("home works without WebGL", async ({ page }) => {
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...rest: unknown[]) {
      if (kind === "webgl" || kind === "webgl2") return null;
      return (orig as (...a: unknown[]) => unknown).call(this, kind, ...rest);
    } as typeof orig;
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Технологияның");
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.locator("#courses li")).toHaveCount(10);
  await page.goto("/labs/net");
  await expect(page.locator("ol li")).toHaveCount(9);
});

test("course page: start link and the stations", async ({ page }) => {
  await page.goto("/labs/iot");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Robotics & IoT");
  await expect(page.getByRole("link", { name: "Бірінші сабақтан бастау" })).toHaveAttribute("href", /iot-1-adc$/);
  await page.getByRole("button", { name: "Сабақтарды аралау" }).click();
  await expect(page.getByRole("link", { name: /Sensors & ADC/ })).toBeInViewport();
});

test("lesson: the lecture opens as 3D pages and closes back to the task", async ({ page }) => {
  await page.goto("/labs/iot/iot-5-pid");
  await page.getByRole("button", { name: "Түсіндірмені 3D-де оқу" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Идея" })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(dialog.getByRole("heading", { name: "Түйсік" })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Идея" })).toBeHidden();
  await dialog.getByRole("button", { name: "Жабу" }).click();
  await expect(dialog).toHaveCount(0);
});

test("finishing a lesson pays XP and lights a star on the course card", async ({ page }) => {
  await page.goto("/labs/cloud/cloud-8-incident");
  await page.locator("fieldset").filter({ hasText: "CPU төмен" }).getByRole("button", { name: /күтіп тұр/ }).click();
  await page.locator("fieldset").filter({ hasText: "бірінші не істеу" }).getByRole("button", { name: /Зиянды азайту/ }).click();
  await page.getByRole("button", { name: "Себеп: payments" }).click();
  const reward = page.getByRole("dialog", { name: "Сабақ аяқталды" });
  await expect(reward.getByText("+100 XP")).toBeVisible();
  await reward.getByRole("button", { name: "Жабу" }).click();
  await expect(reward).toHaveCount(0);
  await page.goto("/");
  await expect(page.getByRole("group", { name: /Деңгей 1, 1\d0 XP/ })).toBeAttached();
  await expect(page.getByLabel(/1 жұлдыз, 1 сабақ аяқталды/)).toBeAttached();
});
