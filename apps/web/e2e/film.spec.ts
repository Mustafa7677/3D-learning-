import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});

test("home: the start button dives in, the atlas has every lab", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("canvas").first()).toBeVisible();
  await page.getByRole("button", { name: "Зерттеуді бастау" }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
  await page.getByRole("navigation", { name: "Негізгі мәзір" }).getByRole("button", { name: "Зертханалар" }).click();
  await expect(page.getByRole("heading", { name: "Зертханалар атласы", level: 2 })).toBeInViewport();
  await expect(page.locator("#labs li")).toHaveCount(10);
  await page.getByRole("link", { name: /^Robotics & IoT:/ }).click();
  await expect(page).toHaveURL(/\/labs\/iot$/, { timeout: 20000 });
});

test("home: explore the chip and open a lab from it", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Чипті зертте" }).first().click();
  const panel = page.getByRole("region", { name: "Чипті зерттеу" });
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: /Cybersecurity/ }).click();
  await panel.getByRole("link", { name: "Cybersecurity зертханасын ашу" }).click();
  // Software WebGL in CI is slow to tear the chip down: allow the navigation more time.
  await expect(page).toHaveURL(/\/labs\/sec$/, { timeout: 20000 });
});

test("labs: the PID warm-up on Robotics and the cipher on Cybersecurity pay XP", async ({ page }) => {
  await page.goto("/labs/iot");
  const pid = page.locator("#pid-demo");
  await pid.scrollIntoViewIfNeeded();
  await pid.getByLabel(/^Kp/).fill("10");
  await pid.getByLabel(/^Ki/).fill("5");
  await pid.getByLabel(/^Kd/).fill("4");
  await expect(pid.getByText("Тапсырма орындалды: +20 XP")).toBeVisible();
  await page.goto("/labs/sec");
  const cipher = page.locator("#cipher-demo");
  await cipher.scrollIntoViewIfNeeded();
  await cipher.getByLabel(/Кілт/).fill("11");
  await expect(cipher.getByText(/Бұзылды!/)).toBeVisible();
  await expect(cipher.getByText("технологияның ішіне кір: оны өз қолыңмен зертте")).toBeAttached();
  await expect(page.getByRole("group", { name: /Деңгей 1, 40 XP/ })).toBeAttached();
});

test("home: one story, the world finale leads to the courses", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#pid-demo, #cipher-demo")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Сигнал AI блогына кірді." })).toBeAttached();
  await page.locator("#world").scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Курсты таңда" }).click();
  await expect(page.getByRole("heading", { name: "Зертханалар атласы", level: 2 })).toBeInViewport();
});

test("home: the live AI demo trains in the browser", async ({ page }) => {
  await page.goto("/");
  const ai = page.locator("#ai-demo");
  await ai.scrollIntoViewIfNeeded();
  await expect.poll(async () => Number(await ai.locator("dd").first().textContent()), { timeout: 15000 }).toBeGreaterThan(5);
  await ai.getByRole("button", { name: "XOR" }).click();
  await expect(ai.getByRole("button", { name: "XOR" })).toHaveAttribute("aria-pressed", "true");
});

test("phone 360px: the tools menu is reachable, the headline fits, a lab and its first lesson open", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto("/");
  await expect(page.getByText("Құралдар")).toBeVisible();
  const h1 = await page.getByRole("heading", { level: 1 }).evaluate((e) => [...e.querySelectorAll("span")].map((s) => s.getBoundingClientRect().right));
  for (const right of h1) expect(right).toBeLessThanOrEqual(360);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  await page.getByRole("navigation", { name: "Негізгі мәзір" }).getByRole("button", { name: "Зертханалар" }).click();
  await page.getByRole("link", { name: /^Cybersecurity:/ }).click();
  await expect(page).toHaveURL(/\/labs\/sec$/, { timeout: 20000 });
  await page.getByRole("link", { name: "Бірінші сабақтан бастау" }).click();
  await expect(page).toHaveURL(/\/labs\/sec\/.+/, { timeout: 20000 });
  await ctx.close();
});

test("keyboard: tab reaches a lab tile and Enter opens it", async ({ page }) => {
  await page.goto("/");
  const tile = page.getByRole("link", { name: /^Cybersecurity:/ });
  await tile.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/labs\/sec$/, { timeout: 20000 });
  const start = page.getByRole("link", { name: "Бірінші сабақтан бастау" });
  await start.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/labs\/sec\/.+/, { timeout: 20000 });
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
  await expect(page.locator("#labs li")).toHaveCount(10);
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
  await expect(page.getByRole("link", { name: /^Cloud & DevOps: 1 сабақ аяқталды/ })).toBeAttached();
  await page.goto("/labs/cloud");
  await expect(page.getByRole("group", { name: /Деңгей 1, 1\d0 XP/ })).toBeAttached();
});
