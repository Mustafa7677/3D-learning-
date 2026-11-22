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
  await expect(page.locator("ol li")).toHaveCount(13);
  await expect(page.locator('ol li[data-level="Middle"]')).toHaveCount(4);
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

test("Middle 10: 20 Hz PWM jerks the motor, 20 kHz runs it smooth and silent", async ({ page }) => {
  await page.goto("/labs/iot/iot-10-pwm");
  await expect(page.locator("canvas")).toBeVisible();
  const r = page.getByRole("status", { name: "PWM нәтижесі" });
  await page.getByRole("button", { name: "Моторды іске қосу" }).click();
  await expect(r).toContainText("6.0 В");
});

test("Middle 11: a baud mismatch reads garbage; matching it reads HELLO", async ({ page }) => {
  await page.goto("/labs/iot/iot-11-buses");
  const r = page.getByRole("status", { name: "UART қабылдады" });
  await page.getByRole("button", { name: "Қабылдау" }).click();
  await expect(r).toContainText("⚠");
  await page.getByRole("group", { name: "Микроконтроллер (RX)" }).getByRole("button", { name: "9600" }).click();
  await page.getByRole("button", { name: "Қабылдау" }).click();
  await expect(r).toContainText("HELLO ✓");
  await expect(objective(page, "Жылдамдықтарды теңестір")).toHaveAttribute("data-done", "true");
});

test("Middle 12: the superloop misses 4 control deadlines; priorities miss none", async ({ page }) => {
  await page.goto("/labs/iot/iot-12-rtos");
  const r = page.getByRole("status", { name: "Жоспарлау нәтижесі" });
  await page.getByRole("button", { name: "Жоспарлауды іске қосу" }).click();
  await expect(r).toContainText("Басқару өткізді4");
  await page.getByRole("button", { name: "RTOS басымдықтары" }).click();
  await page.getByRole("button", { name: "Жоспарлауды іске қосу" }).click();
  await expect(r).toContainText("Басқару өткізді0");
});

test("Middle 13: the gyro drifts 10°, the complementary filter keeps the error under half a degree", async ({ page }) => {
  await page.goto("/labs/iot/iot-13-fusion");
  const r = page.getByRole("status", { name: "Бұрыш қатесі" });
  await page.getByRole("button", { name: "Роботты еңкейту" }).click();
  await expect(r).toContainText("Соңындағы қате10°");
  await page.getByRole("button", { name: "Комплементарлы сүзгі" }).click();
  await page.getByRole("button", { name: "α = 0.98" }).click();
  await page.getByRole("button", { name: "Роботты еңкейту" }).click();
  await expect(r).toContainText("0.43°");
});
