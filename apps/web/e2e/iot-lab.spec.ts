import { expect, test, type Page } from "@playwright/test";

const objective = (page: Page, text: string | RegExp) => page.locator("li[data-done]", { hasText: text });

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});

test("robotics lab page lists eight lessons and the problem set", async ({ page }) => {
  await page.goto("/labs/iot");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Robotics & IoT");
  await expect(page.locator("ol li")).toHaveCount(9);
});

test("lesson 1: an 8-bit ADC reads 23.20 °C", async ({ page }) => {
  await page.goto("/labs/iot/iot-1-adc");
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "Оқу", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "23.20 °C" })).toBeVisible();
  await expect(objective(page, "8-разрядты")).toHaveAttribute("data-done", "true");
});

test("lesson 6: inverse kinematics does not count as turning the joints", async ({ page }) => {
  await page.goto("/labs/iot/iot-6-arm");
  await page.getByRole("button", { name: "IK: шынтақ төмен" }).click();
  await expect(objective(page, "Буындарды бұрап")).toHaveAttribute("data-done", "false");
  const elbow = page.getByRole("slider", { name: "Шынтақ θ₂, °" });
  const shoulder = page.getByRole("slider", { name: "Иық θ₁, °" });
  await elbow.fill("60");
  await shoulder.fill("10");
  await expect(objective(page, "Буындарды бұрап")).toHaveAttribute("data-done", "false");
  await elbow.fill("68");
  await shoulder.fill("2");
  await expect(objective(page, "Буындарды бұрап")).toHaveAttribute("data-done", "true");
});

test("lesson 8: only home temperature sensors", async ({ page }) => {
  await page.goto("/labs/iot/iot-8-mqtt");
  const input = page.getByLabel("Сүзгі", { exact: true });
  await input.fill("home/#");
  await page.getByRole("button", { name: "Жазылу" }).click();
  await expect(page.getByRole("status").filter({ hasText: "4 тақырып" })).toBeVisible();
  await expect(objective(page, "температура")).toHaveAttribute("data-done", "false");
  await input.fill("home/+/temp");
  await page.getByRole("button", { name: "Жазылу" }).click();
  await expect(objective(page, "температура")).toHaveAttribute("data-done", "true");
});
